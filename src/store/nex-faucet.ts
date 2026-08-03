import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

/**
 * NEX 水龙头 + 提现闸 — 由旧 points.ts 演化(积分系统下线,NEX 接管)。
 *
 * 两件事:
 *  1) 提现费抵扣:NEX 可抵扣提现手续费(取代旧积分门槛)。纯函数 `computeWithdrawFee`;
 *     无 NEX 不拦截;NEX 抵扣为用户自选开关(FEAT-WD02)。实际扣减由 wallet-withdraw
 *     调 app.debitNex 完成(store 不 import app — 架构铁律)。
 *  2) 签到回访水龙头:每日签到 + 连胜 + 里程碑机制保留,奖励币种从积分换成少量 NEX。
 *     本 store 只管「签到状态机」(连胜/里程碑/saver)+ 一份展示用 history;真正把 NEX 计入钱包,
 *     由 daily 页 compose `app.creditNex(gained)` 完成,这里不持有余额(余额单源 = app.user.nexBalance)。
 *
 * 旧 key(points-v1 时代)已废弃,不做迁移——存量无账号归属,mock 可重建;hydrate() 只读
 * ACCOUNTS_KEY(与下方注释同口径;旧「一次性搬数据」逻辑已移除,勿按本段臆想它存在)。
 *
 * ⚠️ MOCK-ONLY: lucky multiplier + day-boundary check are client-side.
 * PRODUCTION: POST /api/nex/sign-in → server returns {gained, streak, multiplier} and credits NEX server-side;
 * server enforces day boundary in platform TZ, prevents tampered clocks.
 */

const ONE_DAY = 86400 * 1000;

export interface FaucetEvent {
  ts: number;
  delta: number; // NEX gained on this event
  reason: string;
}

interface FaucetData {
  history: FaucetEvent[];
  lastSignedInAt: number;
  signInStreak: number;
  longestStreak: number;
  streakSavers: number;
  claimedMilestones: number[];
}

// 旧设备级单键 "nexgrid-nex-faucet-v1" + 旧积分键 "nexgrid-points-v1" 均废弃(存量无账号归属,
// 不臆断迁移,mock 可重建);签到状态机按账号分行。
const ACCOUNTS_KEY = "nexgrid-nex-faucet-accounts-v1"; // { [accountKey]: FaucetData }

// 签到奖励档(小额 NEX,水龙头定位):基础 +2 NEX / 7 连胜额外 +5 NEX。
const SIGNIN_BASE_NEX = 2;
const SIGNIN_STREAK7_BONUS_NEX = 5;

function defaults(): FaucetData {
  return {
    history: [
      { ts: Date.now() - 1 * ONE_DAY, delta: SIGNIN_BASE_NEX, reason: "Daily check-in" },
      { ts: Date.now() - 2 * ONE_DAY, delta: SIGNIN_BASE_NEX, reason: "Daily check-in" },
      { ts: Date.now() - 4 * ONE_DAY, delta: SIGNIN_BASE_NEX, reason: "Daily check-in" },
    ],
    lastSignedInAt: 0,
    signInStreak: 0,
    longestStreak: 0,
    streakSavers: 1,
    claimedMilestones: [],
  };
}

function hydrate(accountKey: string): FaucetData {
  const row = readAccountRow<Partial<FaucetData>>(ACCOUNTS_KEY, accountKey);
  if (
    row &&
    Array.isArray(row.claimedMilestones) && Array.isArray(row.history) &&
    typeof row.lastSignedInAt === "number"
  ) {
    return { ...defaults(), ...row };
  }
  // 旧设备级 points 迁移已废除:设备级存量无账号归属,迁给任一账号=臆断多发,mock 可重建。
  return defaults();
}

export const useNexFaucet = defineStore("nexFaucet", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const history = ref<FaucetEvent[]>(init.history);
  const lastSignedInAt = ref(init.lastSignedInAt);
  const signInStreak = ref(init.signInStreak);
  const longestStreak = ref(init.longestStreak);
  const streakSavers = ref(init.streakSavers);
  const claimedMilestones = ref<number[]>(init.claimedMilestones);

  function persist() {
    writeAccountRow<FaucetData>(ACCOUNTS_KEY, boundKey, {
      history: history.value,
      lastSignedInAt: lastSignedInAt.value,
      signInStreak: signInStreak.value,
      longestStreak: longestStreak.value,
      streakSavers: streakSavers.value,
      claimedMilestones: claimedMilestones.value,
    });
  }

  /** 账号切换重绑:装载该账号的签到状态机(防跨账号继承连胜/里程碑/saver)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    history.value = next.history;
    lastSignedInAt.value = next.lastSignedInAt;
    signInStreak.value = next.signInStreak;
    longestStreak.value = next.longestStreak;
    streakSavers.value = next.streakSavers;
    claimedMilestones.value = next.claimedMilestones;
  }

  /**
   * 签到。更新连胜状态 + 记一条 history 事件,返回本次获得的 NEX。
   * 不在此计入钱包余额 — 调用方(daily 页)负责 `app.creditNex(gained)`(架构铁律:store 不 import app)。
   */
  function signIn(): { ok: boolean; gained: number; streak: number; multiplier: number } {
    const t = Date.now();
    const last = lastSignedInAt.value;
    // 同一天不可重复
    if (last && new Date(last).toDateString() === new Date(t).toDateString()) {
      return { ok: false, gained: 0, streak: signInStreak.value, multiplier: 1 };
    }
    const continuous = last && t - last < 2 * ONE_DAY;
    const newStreak = continuous ? signInStreak.value + 1 : 1;
    const baseGain = SIGNIN_BASE_NEX;
    const bonus = newStreak > 0 && newStreak % 7 === 0 ? SIGNIN_STREAK7_BONUS_NEX : 0;
    // Lucky multiplier: 1.0x baseline, 15% chance of 1.5x, 5% chance of 2x.
    const roll = Math.random();
    const multiplier = roll < 0.05 ? 2 : roll < 0.20 ? 1.5 : 1;
    const gained = Math.round((baseGain + bonus) * multiplier);
    const newLongest = Math.max(longestStreak.value, newStreak);
    lastSignedInAt.value = t;
    signInStreak.value = newStreak;
    longestStreak.value = newLongest;
    history.value = [
      {
        ts: t,
        delta: gained,
        reason:
          multiplier > 1
            ? `Daily +${baseGain + bonus} × ${multiplier}x lucky`
            : bonus
              ? `Day-${newStreak} streak bonus`
              : "Daily check-in",
      },
      ...history.value.slice(0, 49),
    ];
    persist();
    return { ok: true, gained, streak: newStreak, multiplier };
  }

  function useSaver(): boolean {
    if (streakSavers.value <= 0) return false;
    if (signInStreak.value !== 0 && lastSignedInAt.value > 0 && Date.now() - lastSignedInAt.value < 2 * ONE_DAY) {
      // Streak isn't actually broken
      return false;
    }
    const yesterday = Date.now() - ONE_DAY;
    streakSavers.value = streakSavers.value - 1;
    lastSignedInAt.value = yesterday;
    signInStreak.value = Math.max(1, Math.min(30, longestStreak.value || 1));
    history.value = [
      { ts: Date.now(), delta: 0, reason: "Streak saver used" },
      ...history.value.slice(0, 49),
    ];
    persist();
    return true;
  }

  /**
   * 领取里程碑。校验未领 + 连胜达标后标记已领 + 记 history,返回是否成功。
   * NEX 计入钱包由调用方负责(`app.creditNex(gainedNex)`)。
   */
  function claimMilestone(day: number, gainedNex: number, reason: string): boolean {
    if (claimedMilestones.value.includes(day)) return false;
    if (signInStreak.value < day) return false;
    claimedMilestones.value = [...claimedMilestones.value, day];
    history.value = [{ ts: Date.now(), delta: gainedNex, reason }, ...history.value.slice(0, 49)];
    persist();
    return true;
  }

  return {
    history, lastSignedInAt, signInStreak, longestStreak, streakSavers, claimedMilestones,
    signIn, useSaver, claimMilestone, bindAccount,
  };
});

/**
 * 提现费 + NEX 自选抵扣模型(FEAT-WD02,取代 WD01c「网络费夹逼 + 按金额比例平台费」双费模型)。
 *
 * 🔴 费用 = **每笔固定的网络确认费**,按提现网络取值(后台 D5 networkConfirmFeeUsd 可配,
 *    种子 TRC20/BEP20 $1.00 · ERC20 $5.00,值域 [0, 25]);旧「按金额比例的平台留存费」与 grossFee 概念已删除。
 *  - networkConfirmUsd = 金额 ≤ 0 ? 0 : 配置值(没转账就没有这笔费;不再按金额比例)
 *  - NEX 抵扣是**用户自选**(offsetWithNex,默认关):server 侧无此意图**永不烧 NEX**(规格 ③)
 *  - requiredNex = offsetRate > 0 ? ceil(费 / offsetRate) : 0(整数 NEX,2026-08-02 拍板项1)
 *  - nexBurned  = 开着才烧:min(用户 NEX, requiredNex);offsetRate ≤ 0 → 0(禁除零烧光)
 *  - feeWaived  = min(费, nexBurned × offsetRate)(🔴 必须封顶费本身:ceil 会过烧 ≤1 NEX,
 *                 3 NEX × $0.40 = $1.20 > $1.00 费 —— 账单只准记实际减免 $1.00,不记 $1.20)
 *  - actualFee  = max(0, 费 − nexBurned × offsetRate)(server 权威校验等式,不出负数)
 *  - netReceive = max(0, 金额 − actualFee)
 *
 * ⚠️ 这段文档头必须与实现同步改 —— 2026-07-31 本文件曾被误用 git checkout 整段回滚,
 *    是**照着注释重建**的。一份写着旧公式的文档头 = 下一次回滚的复发引信。
 *
 * offsetRate 远高于市价(#3:抵扣价值高于实际兑换价值),权威 §13.4(phase 全档 $0.40)。
 * networkConfirmFeeUsd 三键走 admin D5;行为覆盖在 scripts/selfcheck-withdrawfee.mjs。
 */
export interface WithdrawFee {
  /** 本笔网络确认费(金额 ≤ 0 时为 0) */
  networkConfirmUsd: number;
  /** 全额抵扣所需 NEX(整数,ceil;费 0 或 offsetRate ≤ 0 时为 0) */
  requiredNex: number;
  nexBurned: number;
  feeWaived: number;
  actualFee: number;
  netReceive: number;
}

export type WithdrawNetworkKey = "trc20" | "bep20" | "erc20";

/** D5 网络确认费值域上限(USD)。admin normalize pin 同数字系,单边改会被 verify 的
 *  跨仓 parity 哨兵与两侧固定靶(uniapp 26→false / admin 30→invalid)拦住。 */
export const NETWORK_CONFIRM_FEE_MAX_USD = 25;

/**
 * 网络确认费配置可用性(规格 FEAT-WD02 ② 异常2)。
 * 三键(trc20/bep20/erc20)齐全、均为有限数、∈[0, 25];任一违反 → 不可用。
 * 0 合法($0 免费网络,显示 $0.00 不藏行)。
 *
 * 🔴 不可用时调用方必须**禁止下单**,绝不回退写死值 —— 与汇率牌价同口径(isFxQuoteUsable)。
 * 理由:回退写死值 = 用户按 A 费下单、平台按 B 费扣款,资金面对不上账。
 * 🔴 [0, 25] 是后台 D5 的法定值域,本函数是 uniapp 侧**唯一执行者**。
 */
export function isNetworkFeeConfigUsable(
  cfg: Partial<Record<WithdrawNetworkKey, number>> | undefined | null,
): boolean {
  if (!cfg) return false;
  const keys: WithdrawNetworkKey[] = ["trc20", "bep20", "erc20"];
  return keys.every((k) => {
    const v = cfg[k];
    return Number.isFinite(v) && (v as number) >= 0 && (v as number) <= NETWORK_CONFIRM_FEE_MAX_USD;
  });
}

/**
 * 🔴 FEAT-WD02 费用引擎。公式见文件头文档(与实现同笔改)。
 * networkConfirmFeeUsd 传**单网络费值**(调用方按当前绑定网络取键);
 * 合法性在信任边界(config.ts feeConfigValid)裁决,本函数只对负数做防御性钳零。
 */
export function computeWithdrawFee(
  amountUSDT: number,
  userNex: number,
  offsetWithNex: boolean,
  nexFeeOffsetRate: number,
  networkConfirmFeeUsd: number,
): WithdrawFee {
  const amount = Math.max(0, amountUSDT);
  // 金额 0 → 费 0(保留「没转账就没这笔费」不变量,违者会渲染 总费 > 提现额)。
  const fee = amount <= 0 ? 0 : Math.max(0, networkConfirmFeeUsd);
  const rate = nexFeeOffsetRate;
  // 🔴 offsetRate ≤ 0 守卫:纯函数入参外部可喂,少了它 ceil(fee/0) = Infinity →
  //    nexBurned = min(userNex, ∞) = 烧光全部 NEX 抵 $0(独立证伪构造出的反例)。
  const requiredNex = fee > 0 && rate > 0 ? Math.ceil(fee / rate) : 0;
  const nexBurned = offsetWithNex && rate > 0 ? Math.min(Math.max(0, userNex), requiredNex) : 0;
  const feeWaived = Math.min(fee, nexBurned * rate);
  const actualFee = Math.max(0, fee - nexBurned * rate);
  const netReceive = Math.max(0, amount - actualFee);
  return { networkConfirmUsd: fee, requiredNex, nexBurned, feeWaived, actualFee, netReceive };
}

/**
 * 🔴 server 侧费用快照校验(mock 同构;PROD = POST /api/withdrawals 里 server 以权威
 * 费率重算并拒不一致单)。app.submitWithdrawal 入口调用,拦三类坏单:
 *  ① 意图守恒:offsetWithNex=false 时 nexBurned 必须为 0(无意图永不烧 NEX,规格 ③);
 *  ② 等式:|actualFeeUsd − max(0, networkConfirmUsd − nexBurned × offsetRate)| ≤ 0.0001
 *    (页面拼装错 / 过期报价落盘,一律 fail-closed 拒单);
 *  ③ 权威交叉核对(2026-08-03 资金 P1):networkConfirmUsd 必须与权威配置里当前网络的
 *    费值一致,容差同 ②(|Δ| ≤ 0.0001 —— 严格 !== 会把 UI toFixed 反算值与配置存值的
 *    浮点误差误判成攻击)。只校 ①② 时任意「自洽三元组」如 {0,0,0} 一路放行 =
 *    客户端改配置即可 $0 费提现,真后台按此同构接线就是平台吃 gas。
 *    权威 map 缺失 / 超值域(isNetworkFeeConfigUsable=false)/ 该网络键取不到 →
 *    一律 fail-closed 拒单;$0 是合法权威值(免费网络),用 Number.isFinite 判存在性。
 *
 * network + authoritativeFeeMap 在**提交边界(app.submitWithdrawal)必传**(权威 map 走
 * config.currentNetworkConfirmFeeUsd() 单源);页面的 staleness 预检(报价过期提示)
 * 可不传,只走 ①② —— UI 预检不是资金门,资金门在 store 提交边界。两参传任一即启用 ③,
 * 传了一半(另一半缺)按 fail-closed 拒。
 */
export function isWithdrawalFeeSnapshotValid(
  fee: { networkConfirmUsd: number; nexBurned: number; actualFeeUsd: number } | null | undefined,
  offsetWithNex: boolean,
  nexFeeOffsetRate: number,
  network?: WithdrawNetworkKey,
  authoritativeFeeMap?: Partial<Record<WithdrawNetworkKey, number>> | null,
): boolean {
  if (!fee) return false;
  const parts = [fee.networkConfirmUsd, fee.nexBurned, fee.actualFeeUsd];
  if (!parts.every((v) => Number.isFinite(v) && v >= 0)) return false;
  if (network !== undefined || authoritativeFeeMap !== undefined) {
    if (!isNetworkFeeConfigUsable(authoritativeFeeMap)) return false;
    const authoritative = network !== undefined ? authoritativeFeeMap?.[network] : undefined;
    // Number.isFinite 而非 truthy:$0 免费网络的权威值 0 是合法值,`!authoritative` 会把它当缺失误拒。
    if (!Number.isFinite(authoritative)) return false;
    if (Math.abs(fee.networkConfirmUsd - (authoritative as number)) > 0.0001) return false;
  }
  if (!offsetWithNex && fee.nexBurned !== 0) return false;
  return Math.abs(fee.actualFeeUsd - Math.max(0, fee.networkConfirmUsd - fee.nexBurned * nexFeeOffsetRate)) <= 0.0001;
}
