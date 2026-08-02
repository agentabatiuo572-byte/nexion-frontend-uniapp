import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

/**
 * NEX 水龙头 + 提现闸 — 由旧 points.ts 演化(积分系统下线,NEX 接管)。
 *
 * 两件事:
 *  1) 提现费抵扣:NEX 可抵扣提现手续费(取代旧积分门槛)。纯函数 `computeWithdrawFee`;
 *     无 NEX 不拦截、按惩罚费率收费;烧 NEX 按优惠率抵扣。实际扣减由 wallet-withdraw
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
 * 提现费 + NEX 优惠抵扣模型(取代旧积分/硬燃烧门槛)。
 *
 * 🔴 总费是**两笔相加**(FEAT-WD01c),后端对这条等式有硬校验:
 *  - networkFee = clamp(金额 × networkFeeRate, min, max) —— 链上转账真实成本
 *  - penaltyFee = 金额 × penaltyFeeRate —— 平台留存杠杆
 *  - grossFee   = networkFee + penaltyFee
 *  - requiredNex= 全额抵扣所需 NEX = grossFee / offsetRate(按**总费**算,不是只按惩罚费)
 *  - nexBurned  = min(用户 NEX, requiredNex)(部分抵扣)
 *  - feeWaived  = nexBurned × offsetRate(封顶 grossFee)
 *  - actualFee  = grossFee − feeWaived(烧够则 0)
 *  - netReceive = 金额 − actualFee
 *
 * ⚠️ 这段文档头必须与实现同步改 —— 2026-07-31 本文件曾被误用 git checkout 整段回滚,
 *    是**照着注释重建**的。一份写着旧公式的文档头 = 下一次回滚的复发引信。
 *
 * offsetRate 远高于市价(#3:抵扣价值高于实际兑换价值)。
 * 费率后台可调:penaltyFeeRate 走 phase/H1;networkFee 三件套走 admin D5。
 */
export interface WithdrawFee {
  grossFee: number;
  requiredNex: number;
  nexBurned: number;
  feeWaived: number;
  actualFee: number;
  netReceive: number;
  /** 链上转账成本(已夹在 min/max 之间) */
  networkFee: number;
  /** 惩罚费(= 金额 × penaltyFeeRate),不含网络费 */
  penaltyFee: number;
}

/** 网络费配置(后台 D5 可配)。 */
export interface NetworkFeeConfig {
  /** 比例(0–0.05),对金额取比例 */
  rate: number;
  /** 下限(USDT):小额提现按此兜底,防止按比例算出 $0.1 这种付不起链上 gas 的数 */
  min: number;
  /** 上限(USDT):大额提现按此封顶 */
  max: number;
}

/**
 * 网络费配置可用性(规格 FEAT-WD01c ② 异常4)。
 * 缺字段 / NaN / 负数 / 比例越界(> 5%,后台 D5 的合法上限)/ min > max 任一 → 不可用。
 *
 * 🔴 不可用时调用方必须**禁止下单**,绝不回退写死值 —— 与汇率牌价同口径(isFxQuoteUsable)。
 * 理由:回退写死值 = 用户按 A 费率下单、平台按 B 费率扣款,资金面对不上账。
 * 🔴 那 5% 是后台 D5 的法定上限,本函数是**唯一执行者** ——
 *    删掉它意味着后端下发 50% 时提 $100 只到手 $30 而页面照渲(独立验收实测)。
 *    行为覆盖在 scripts/selfcheck-withdrawfee.mjs。
 */
export function isNetworkFeeConfigUsable(cfg: Partial<NetworkFeeConfig> | undefined | null): boolean {
  if (!cfg) return false;
  const rate = cfg.rate;
  const min = cfg.min;
  const max = cfg.max;
  if (!Number.isFinite(rate) || (rate as number) < 0 || (rate as number) > 0.05) return false;
  if (!Number.isFinite(min) || (min as number) < 0) return false;
  if (!Number.isFinite(max) || (max as number) < 0) return false;
  return (max as number) >= (min as number);
}

/**
 * 网络费:先按比例,再夹进 [min, max]。min > max 这种坏配置下取 min,不返回负数。
 *
 * 🔴 金额为 0 时返回 0,**不套下限** —— 否则用户还没输金额,明细区就显示「网络手续费 $1」,
 * 且总费($1)> 提现额($0),既误导又违反后端 `netReceive ≤ amount` 不变量。
 * 下限的语义是「真发生一笔链上转账时至少要付的 gas」,没有转账就没有这笔费。
 */
export function computeNetworkFee(amountUSDT: number, cfg: NetworkFeeConfig): number {
  const amount = Math.max(0, amountUSDT);
  if (amount <= 0) return 0;
  const min = Math.max(0, cfg.min);
  const max = Math.max(min, cfg.max);
  const raw = amount * Math.max(0, cfg.rate);
  return Math.min(Math.max(raw, min), max);
}

/**
 * 🔴 FEAT-WD01c:总费是**两笔相加** —— grossFee = networkFee + 金额 × penaltyFeeRate。
 * 后端对这条等式有硬校验(误差 > 0.0001 即判数据非法)。前端此前只算了后半截,
 * 接真后端后用户看到的费会比实扣的少 —— 资金面最不能出的错。
 * NEX 抵扣作用于**总费**(含网络费),与后端一致。
 */
export function computeWithdrawFee(
  amountUSDT: number,
  userNex: number,
  penaltyFeeRate: number,
  nexFeeOffsetRate: number,
  networkFeeConfig: NetworkFeeConfig,
): WithdrawFee {
  const amount = Math.max(0, amountUSDT);
  const networkFee = computeNetworkFee(amount, networkFeeConfig);
  const penaltyFee = amount * penaltyFeeRate;
  const grossFee = networkFee + penaltyFee;
  const requiredNex = nexFeeOffsetRate > 0 ? grossFee / nexFeeOffsetRate : 0;
  const nexBurned = Math.min(Math.max(0, userNex), requiredNex);
  const feeWaived = Math.min(grossFee, nexBurned * nexFeeOffsetRate);
  const actualFee = Math.max(0, grossFee - feeWaived);
  const netReceive = Math.max(0, amount - actualFee);
  return { networkFee, penaltyFee, grossFee, requiredNex, nexBurned, feeWaived, actualFee, netReceive };
}
