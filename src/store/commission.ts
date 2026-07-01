import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Ported from Nexion-prototype/lib/v3/commission.ts (zustand persist → Pinia + uni storage).
 * ⚠️ MOCK-ONLY business rates table. UNILEVEL_USDT / UNILEVEL_NEX are
 * server-authoritative in production (GET /api/config/commission/rates).
 *
 * v3 玩法 — 佣金事件流(5 类):unilevel 7 层 / binary 对碰 / peer 平级 /
 * cultivation 培育 / leadership 领导池 / genesis 创世日分红。
 * 状态:cooling → unlocked → withdrawn。USDT 默认 30 天冷却期。
 */

export type CommissionKind =
  | "unilevel"
  | "binary"
  | "peer"
  | "cultivation"
  | "leadership"
  | "genesis";

export type CommissionStatus = "cooling" | "unlocked" | "withdrawn";

export interface CommissionEvent {
  id: string;
  kind: CommissionKind;
  sourceUserId: string;
  sourceUserName: string;
  layer?: number;             // 仅 unilevel
  orderId?: string;
  orderAmountUSD?: number;
  amountUSDT: number;
  amountNEX: number;
  ts: number;
  unlockAt: number;           // 30d 后
  status: CommissionStatus;
}

const ONE_DAY = 86400 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/** Unilevel 各层 USDT 比例 */
export const UNILEVEL_USDT: Record<number, number> = {
  1: 0.10, 2: 0.05, 3: 0.03, 4: 0.02, 5: 0.01, 6: 0.005, 7: 0.005,
};
/** Unilevel 各层 NEX 比例 (per $1 订单) */
export const UNILEVEL_NEX: Record<number, number> = {
  1: 50, 2: 20, 3: 10, 4: 5, 5: 2.5, 6: 1, 7: 1,
};

const now = Date.now();

/**
 * Mock "today" commission events — `ts` set a few hours ago so they always
 * fall within local today. These exist so Home Hero's cross-stream "today"
 * aggregate (`earnings.today + commission.todayUSDT()`) reads a non-zero
 * commission component. Real backend: server delivers today-bucketed events
 * via SSE (PRD §9.11c.1, endpoint pending).
 */
function buildTodayDemoEvents(): CommissionEvent[] {
  return [
    {
      id: "c-today-1", kind: "unilevel", sourceUserId: "net-12", sourceUserName: "Mei L.",
      layer: 1, orderId: "ord-today-1", orderAmountUSD: 299,
      amountUSDT: 29.90, amountNEX: 14_950,
      ts: now - 4 * ONE_HOUR, unlockAt: now + 30 * ONE_DAY - 4 * ONE_HOUR, status: "cooling",
    },
    {
      id: "c-today-2", kind: "binary", sourceUserId: "match-today", sourceUserName: "Daily binary match",
      amountUSDT: 17.30, amountNEX: 0,
      ts: now - 2 * ONE_HOUR, unlockAt: now + 30 * ONE_DAY - 2 * ONE_HOUR, status: "cooling",
    },
  ];
}

function seedEvents(): CommissionEvent[] {
  return [
    ...buildTodayDemoEvents(),
    {
      id: "c-1", kind: "unilevel", sourceUserId: "net-0", sourceUserName: "Sarah K.",
      layer: 1, orderId: "ord-1", orderAmountUSD: 899,
      amountUSDT: 89.90, amountNEX: 44_950,
      ts: now - 5 * ONE_DAY, unlockAt: now + 25 * ONE_DAY, status: "cooling",
    },
    {
      id: "c-2", kind: "unilevel", sourceUserId: "net-1", sourceUserName: "Tom Wang",
      layer: 1, orderId: "ord-2", orderAmountUSD: 299,
      amountUSDT: 29.90, amountNEX: 14_950,
      ts: now - 12 * ONE_DAY, unlockAt: now + 18 * ONE_DAY, status: "cooling",
    },
    {
      id: "c-3", kind: "unilevel", sourceUserId: "net-9", sourceUserName: "Carlos R.",
      layer: 2, orderId: "ord-3", orderAmountUSD: 899,
      amountUSDT: 44.95, amountNEX: 17_980,
      ts: now - 8 * ONE_DAY, unlockAt: now + 22 * ONE_DAY, status: "cooling",
    },
    {
      id: "c-4", kind: "binary", sourceUserId: "match-1", sourceUserName: "Daily binary match",
      amountUSDT: 12.40, amountNEX: 0,
      ts: now - 1 * ONE_DAY, unlockAt: now + 29 * ONE_DAY, status: "cooling",
    },
    {
      id: "c-5", kind: "binary", sourceUserId: "match-2", sourceUserName: "Daily binary match",
      amountUSDT: 9.20, amountNEX: 0,
      ts: now - 2 * ONE_DAY, unlockAt: now + 28 * ONE_DAY, status: "cooling",
    },
    {
      id: "c-6", kind: "cultivation", sourceUserId: "net-0", sourceUserName: "Sarah K. → V1",
      amountUSDT: 0, amountNEX: 500,
      ts: now - 15 * ONE_DAY, unlockAt: now - 15 * ONE_DAY, status: "unlocked",
    },
    {
      id: "c-7", kind: "cultivation", sourceUserId: "net-1", sourceUserName: "Tom Wang → V1",
      amountUSDT: 0, amountNEX: 500,
      ts: now - 20 * ONE_DAY, unlockAt: now - 20 * ONE_DAY, status: "unlocked",
    },
    {
      id: "c-8", kind: "cultivation", sourceUserId: "net-2", sourceUserName: "Lisa Park → V1",
      amountUSDT: 0, amountNEX: 500,
      ts: now - 24 * ONE_DAY, unlockAt: now - 24 * ONE_DAY, status: "unlocked",
    },
    {
      id: "c-9", kind: "leadership", sourceUserId: "pool-w42", sourceUserName: "Week 42 pool",
      amountUSDT: 8.74, amountNEX: 0,
      ts: now - 3 * ONE_DAY, unlockAt: now - 3 * ONE_DAY, status: "unlocked",
    },
  ];
}

const STORAGE_KEY = "nexion-commission-v1";

function hydrate(): CommissionEvent[] {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { events?: CommissionEvent[] } | "";
    if (s && typeof s === "object" && Array.isArray(s.events)) {
      const existing = s.events;
      // Ensure today's demo seed is present (parity with the v1→v2 migrate that
      // injects today events so Home Hero's cross-stream "today" reads non-zero).
      const hasTodaySeed = existing.some((e) => e.id.startsWith("c-today-"));
      return hasTodaySeed ? existing : [...buildTodayDemoEvents(), ...existing];
    }
  } catch {
    // first run
  }
  return seedEvents();
}

export const useCommission = defineStore("commission", () => {
  const events = ref<CommissionEvent[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { events: events.value });
    } catch {
      // storage unavailable
    }
  }

  function addEvent(e: Omit<CommissionEvent, "id" | "ts" | "unlockAt" | "status">) {
    const ev: CommissionEvent = {
      ...e,
      id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ts: Date.now(),
      unlockAt: Date.now() + (e.kind === "unilevel" || e.kind === "binary" ? 30 * ONE_DAY : 0),
      status: e.kind === "unilevel" || e.kind === "binary" ? "cooling" : "unlocked",
    };
    events.value = [ev, ...events.value];
    persist();
  }

  function unlockMatured() {
    const t = Date.now();
    const needsUpdate = events.value.some((e) => e.status === "cooling" && e.unlockAt <= t);
    if (!needsUpdate) return;
    events.value = events.value.map((e) =>
      e.status === "cooling" && e.unlockAt <= t ? { ...e, status: "unlocked" } : e,
    );
    persist();
  }

  function withdraw(id: string): boolean {
    const e = events.value.find((x) => x.id === id);
    if (!e || e.status !== "unlocked") return false;
    events.value = events.value.map((x) => (x.id === id ? { ...x, status: "withdrawn" } : x));
    persist();
    return true;
  }

  function totalUSDTLifetime() {
    return events.value.reduce((s, e) => s + e.amountUSDT, 0);
  }
  function totalNEXLifetime() {
    return events.value.reduce((s, e) => s + e.amountNEX, 0);
  }
  function unlockedUSDT() {
    return events.value.filter((e) => e.status === "unlocked").reduce((s, e) => s + e.amountUSDT, 0);
  }
  function unlockedNEX() {
    return events.value.filter((e) => e.status === "unlocked").reduce((s, e) => s + e.amountNEX, 0);
  }
  function coolingUSDT() {
    return events.value.filter((e) => e.status === "cooling").reduce((s, e) => s + e.amountUSDT, 0);
  }
  /** sum since local midnight — Home Hero "today's earnings" cross-stream. */
  function todayUSDT() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = today.getTime();
    return events.value.filter((e) => e.ts >= cutoff).reduce((s, e) => s + e.amountUSDT, 0);
  }
  function monthUSDT() {
    const cutoff = Date.now() - 30 * ONE_DAY;
    return events.value.filter((e) => e.ts >= cutoff).reduce((s, e) => s + e.amountUSDT, 0);
  }
  function monthNEX() {
    const cutoff = Date.now() - 30 * ONE_DAY;
    return events.value.filter((e) => e.ts >= cutoff).reduce((s, e) => s + e.amountNEX, 0);
  }

  function byKind(): Record<CommissionKind, { usdt: number; nex: number; count: number }> {
    const kinds: CommissionKind[] = ["unilevel", "binary", "peer", "cultivation", "leadership", "genesis"];
    const out = {} as Record<CommissionKind, { usdt: number; nex: number; count: number }>;
    for (const k of kinds) out[k] = { usdt: 0, nex: 0, count: 0 };
    for (const e of events.value) {
      out[e.kind].usdt += e.amountUSDT;
      out[e.kind].nex += e.amountNEX;
      out[e.kind].count += 1;
    }
    return out;
  }

  return {
    events,
    addEvent, unlockMatured, withdraw,
    totalUSDTLifetime, totalNEXLifetime, unlockedUSDT, unlockedNEX, coolingUSDT,
    todayUSDT, monthUSDT, monthNEX, byKind,
  };
});
