import { defineStore } from "pinia";
import { ref } from "vue";
import { mockServerNow } from "./server-time";

/**
 * Lucky Spin 转盘 — daily free spin + Day-30 streak milestone bonus spins.
 * Ported from Nexion-prototype/lib/store/lucky-spin.ts (zustand persist → Pinia
 * + uni storage). Surfaced from:
 *   - /events `evt-spring-spin` card "Spin now" CTA (kind === "wheel")
 *   - /daily Day-30 streak milestone (grants a bonus ticket → opens sheet)
 *
 * Prize pool (8 segments) aligns 运营后台 PRD V3 Ch13 H4 ③ Lucky Spin 奖池表:
 * EV ≈ $0.78/spin · Genesis 整台节点不进转盘 · 真实奖(usdt/coupon)受护栏.
 *
 * Real backend (mock-replaceable, 关联 feedback_mock_real_compatible):
 *   - 中奖裁决 100% server 执行 `POST /api/events/:id/spin`(server-canonical
 *     RNG + NODE_ENV guard);本 store 的 rollPrize() 是 mock 占位,生产环境
 *     概率表 server 持有、client 永不可知 / 不 roll.
 *   - 真实奖三护栏(日派彩预算 / 单奖每日全局库存 / 真实奖总开关)+ B1 兑付
 *     覆盖率红线自动降级,server 侧裁决;本 store 的 realPrizeSoldOut /
 *     coverageDegraded 是前端演示这两类降级态的 mock flag.
 *   - 每日免费一次由 server 按 `eventId × userId × spinDate`(UTC 日桶)计票,
 *     超额返 409;本 store 的 lastFreeSpinDate 是其前端镜像.
 * persist key 带版本号;时间戳 ms epoch;action-driven → 接真后台前端零重写.
 */

export type SpinPrizeKind = "nex" | "points" | "usdt" | "coupon";

export interface SpinPrize {
  id: string;
  kind: SpinPrizeKind;
  amount: number; // NEX / points / USDT 数额,或 coupon 面值(USDT)
  labelKey: string; // i18n: t.luckySpin.prizes[labelKey]
  weight: number; // 概率权重(之和 = 100)
  isReal: boolean; // 真实奖(usdt / coupon)— 受护栏 + 红线降级约束
  tint: string; // 转盘扇区色 token
}

/** 8 档奖池 — 对齐 PRD V3 Ch13 H4 ③ 奖池表(顺序即转盘顺时针扇区序) */
export const SPIN_PRIZES: SpinPrize[] = [
  { id: "nex5",     kind: "nex",    amount: 5,   labelKey: "nex5",     weight: 38,  isReal: false, tint: "var(--v5-brand)" },
  { id: "usdt1",    kind: "usdt",   amount: 1,   labelKey: "usdt1",    weight: 5,   isReal: true,  tint: "var(--v5-warning)" },
  { id: "pts50",    kind: "points", amount: 50,  labelKey: "pts50",    weight: 24,  isReal: false, tint: "var(--v5-tech-cyan)" },
  { id: "usdt20",   kind: "usdt",   amount: 20,  labelKey: "usdt20",   weight: 0.9, isReal: true,  tint: "var(--v5-warning)" },
  { id: "nex30",    kind: "nex",    amount: 30,  labelKey: "nex30",    weight: 18,  isReal: false, tint: "var(--v5-brand)" },
  { id: "coupon50", kind: "coupon", amount: 50,  labelKey: "coupon50", weight: 3,   isReal: true,  tint: "var(--v5-tech-cyan)" },
  { id: "nex150",   kind: "nex",    amount: 150, labelKey: "nex150",   weight: 11,  isReal: false, tint: "var(--v5-brand-2)" },
  { id: "usdt500",  kind: "usdt",   amount: 500, labelKey: "usdt500",  weight: 0.1, isReal: true,  tint: "var(--v5-brand-2)" },
];

export const SEGMENT_COUNT = SPIN_PRIZES.length; // 8
const SEGMENT_DEG = 360 / SEGMENT_COUNT; // 45°

/** idle → confirming → spinning → won;失败走 ui netError(本 store 退回 idle) */
export type SpinPhase = "idle" | "confirming" | "spinning" | "won";

export interface SpinWin {
  prizeId: string;
  ts: number;
}

function utcDate(ms: number): string {
  // UTC 日桶 "YYYY-MM-DD"(对齐 server spinDate 计票)
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Mock server roll — 生产环境此逻辑在 server(`POST /api/events/:id/spin`,
 * server-canonical RNG + NODE_ENV guard),client 永不可知概率表。
 * 降级态(coverageDegraded / realPrizeSoldOut)时排除真实奖档、权重并入安慰档。
 */
function rollPrize(excludeReal: boolean): SpinPrize {
  const pool = excludeReal ? SPIN_PRIZES.filter((p) => !p.isReal) : SPIN_PRIZES;
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[0];
}

/** 目标旋转角:多转若干整圈 + 落到中奖扇区中心(指针在 12 点) */
function targetAngleFor(prizeId: string, prevAngle: number): number {
  const idx = SPIN_PRIZES.findIndex((p) => p.id === prizeId);
  const turns = 5; // 至少 5 整圈的爽快旋转
  // 扇区 idx 中心相对 0° 的角度;指针固定在顶部,故转盘需反向到该扇区
  const segCenter = idx * SEGMENT_DEG + SEGMENT_DEG / 2;
  const base = Math.ceil(prevAngle / 360) * 360; // 从当前圈数往上累加,保证只正向转
  return base + turns * 360 + (360 - segCenter);
}

export const useLuckySpin = defineStore("luckySpin", () => {
  // ── persisted (cross-session) ──
  function hydrate(): {
    bonusTickets: number;
    lastFreeSpinDate: string;
    history: SpinWin[];
    realPrizeSoldOut: boolean;
    coverageDegraded: boolean;
  } {
    const fallback = {
      bonusTickets: 0,
      lastFreeSpinDate: "",
      history: [] as SpinWin[],
      realPrizeSoldOut: false,
      coverageDegraded: false,
    };
    try {
      const s = uni.getStorageSync("nexion-lucky-spin-v1") as Partial<typeof fallback> | "";
      if (s && typeof s === "object") {
        return {
          bonusTickets: typeof s.bonusTickets === "number" ? s.bonusTickets : 0,
          lastFreeSpinDate: typeof s.lastFreeSpinDate === "string" ? s.lastFreeSpinDate : "",
          history: Array.isArray(s.history) ? s.history : [],
          realPrizeSoldOut: s.realPrizeSoldOut === true,
          coverageDegraded: s.coverageDegraded === true,
        };
      }
    } catch {
      // first run
    }
    return fallback;
  }

  const init = hydrate();

  // ── session-only (not persisted) ──
  const open = ref(false);
  const phase = ref<SpinPhase>("idle");
  const lastWonPrizeId = ref<string | null>(null);
  const wheelAngle = ref(0);

  // ── persisted ──
  const bonusTickets = ref(init.bonusTickets);
  const lastFreeSpinDate = ref(init.lastFreeSpinDate);
  const history = ref<SpinWin[]>(init.history);
  const realPrizeSoldOut = ref(init.realPrizeSoldOut);
  const coverageDegraded = ref(init.coverageDegraded);

  function persist() {
    try {
      uni.setStorageSync("nexion-lucky-spin-v1", {
        bonusTickets: bonusTickets.value,
        lastFreeSpinDate: lastFreeSpinDate.value,
        history: history.value,
        realPrizeSoldOut: realPrizeSoldOut.value,
        coverageDegraded: coverageDegraded.value,
      });
    } catch {
      // storage unavailable
    }
  }

  // ── derived (call as functions, like the source's selectors) ──
  function hasFreeSpinToday(): boolean {
    return lastFreeSpinDate.value !== utcDate(mockServerNow());
  }
  function availableSpins(): number {
    return (hasFreeSpinToday() ? 1 : 0) + bonusTickets.value;
  }
  /** 真实奖档当前是否参与裁决(售罄 / 降级 → false)*/
  function realPrizeActive(): boolean {
    return !realPrizeSoldOut.value && !coverageDegraded.value;
  }

  // ── actions ──
  function openSheet() {
    open.value = true;
    phase.value = "idle";
    lastWonPrizeId.value = null;
  }

  function closeSheet() {
    open.value = false;
    phase.value = "idle";
  }

  /** Day-30 里程碑发 bonus 票 */
  function grantBonusTicket(n: number) {
    bonusTickets.value = bonusTickets.value + n;
    persist();
  }

  function startConfirm() {
    phase.value = "confirming";
  }
  function cancelConfirm() {
    phase.value = "idle";
  }

  /**
   * 执行一次抽奖:消费 1 张票(免费优先)、mock server roll、置 spinning + 目标角。
   * 返回中奖 prizeId(供组件在动画结束后 reveal + 派奖);无票返 null。
   */
  function spin(): string | null {
    if (availableSpins() <= 0) return null;
    const useFree = hasFreeSpinToday();
    const prize = rollPrize(!realPrizeActive());
    const angle = targetAngleFor(prize.id, wheelAngle.value);
    phase.value = "spinning";
    lastWonPrizeId.value = prize.id;
    wheelAngle.value = angle;
    // 消费票:免费优先,否则扣 bonus 票(floor 0 防御:并发/重入永不为负)
    if (useFree) {
      lastFreeSpinDate.value = utcDate(mockServerNow());
    } else {
      bonusTickets.value = Math.max(0, bonusTickets.value - 1);
    }
    persist();
    return prize.id;
  }

  /** 动画结束:置 won 态(派奖由组件 compose 各 store 完成,store 不跨 import)*/
  function reveal() {
    phase.value = "won";
  }

  /** 失败回滚:退还本次消费的票 + 回 idle(网络失败场景)*/
  function refundAndReset(wasFree: boolean) {
    phase.value = "idle";
    lastWonPrizeId.value = null;
    // 退票:免费则清除今日已抽标记,否则退还 1 张 bonus
    if (wasFree) {
      lastFreeSpinDate.value = "";
    } else {
      bonusTickets.value = bonusTickets.value + 1;
    }
    persist();
  }

  /** 看完结果回 idle */
  function backToIdle() {
    phase.value = "idle";
    lastWonPrizeId.value = null;
  }

  /** 记录中奖历史(组件派奖后调用)*/
  function pushHistory(prizeId: string) {
    history.value = [{ prizeId, ts: mockServerNow() }, ...history.value].slice(0, 20);
    persist();
  }

  // ── mock 演示开关(replay-tour / dev / 用于演示边界态)──
  function setRealPrizeSoldOut(v: boolean) {
    realPrizeSoldOut.value = v;
    persist();
  }
  function setCoverageDegraded(v: boolean) {
    coverageDegraded.value = v;
    persist();
  }
  /** dev:重置今日免费次数(便于演示)*/
  function resetDailyFree() {
    lastFreeSpinDate.value = "";
    persist();
  }

  return {
    open,
    phase,
    bonusTickets,
    lastFreeSpinDate,
    lastWonPrizeId,
    wheelAngle,
    history,
    realPrizeSoldOut,
    coverageDegraded,
    hasFreeSpinToday,
    availableSpins,
    realPrizeActive,
    openSheet,
    closeSheet,
    grantBonusTicket,
    startConfirm,
    cancelConfirm,
    spin,
    reveal,
    refundAndReset,
    backToIdle,
    pushHistory,
    setRealPrizeSoldOut,
    setCoverageDegraded,
    resetDailyFree,
  };
});
