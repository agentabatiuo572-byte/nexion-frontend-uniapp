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
 * 老数据迁移:一次性从旧 key `nexion-points-v1` 搬 streak/lastSignedInAt/longestStreak/
 * streakSavers/claimedMilestones/history,**丢弃旧 points 余额**(语义已并入钱包 NEX,迁了会凭空多发)。
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

// 旧设备级单键 "nexion-nex-faucet-v1" + 旧积分键 "nexion-points-v1" 均废弃(存量无账号归属,
// 不臆断迁移,mock 可重建);签到状态机按账号分行。
const ACCOUNTS_KEY = "nexion-nex-faucet-accounts-v1"; // { [accountKey]: FaucetData }

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
 *  - grossFee   = 金额 × penaltyFeeRate(无 NEX 抵扣时的费,「大幅增加」的那档)
 *  - requiredNex= 全额抵扣所需 NEX = grossFee / offsetRate
 *  - nexBurned  = min(用户 NEX, requiredNex)(部分抵扣)
 *  - feeWaived  = nexBurned × offsetRate(封顶 grossFee)
 *  - actualFee  = grossFee − feeWaived(烧够则 0)
 *  - netReceive = 金额 − actualFee
 * offsetRate 远高于市价(#3:抵扣价值高于实际兑换价值)。两费率后台可调(phase / admin D.withdraw.*)。
 */
export interface WithdrawFee {
  grossFee: number;
  requiredNex: number;
  nexBurned: number;
  feeWaived: number;
  actualFee: number;
  netReceive: number;
}

export function computeWithdrawFee(
  amountUSDT: number,
  userNex: number,
  penaltyFeeRate: number,
  nexFeeOffsetRate: number,
): WithdrawFee {
  const amount = Math.max(0, amountUSDT);
  const grossFee = amount * penaltyFeeRate;
  const requiredNex = nexFeeOffsetRate > 0 ? grossFee / nexFeeOffsetRate : 0;
  const nexBurned = Math.min(Math.max(0, userNex), requiredNex);
  const feeWaived = Math.min(grossFee, nexBurned * nexFeeOffsetRate);
  const actualFee = Math.max(0, grossFee - feeWaived);
  const netReceive = Math.max(0, amount - actualFee);
  return { grossFee, requiredNex, nexBurned, feeWaived, actualFee, netReceive };
}
