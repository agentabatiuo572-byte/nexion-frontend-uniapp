import { describe, expect, it } from "vitest";
import {
  firstLiveSession,
  formatCountdown,
  isSessionLive,
  normalizeSessions,
  PENDING_CHECKOUT_WINDOW_MIN,
  pruneExpiredSessions,
  sessionSecondsLeft,
  type PendingCheckoutSession,
} from "./pending-checkout-core";

const T0 = 1_760_000_000_000;

function session(over: Partial<PendingCheckoutSession> = {}): PendingCheckoutSession {
  return {
    id: "pc-a",
    kind: "purchase",
    orderNo: null,
    productId: "stellarbox-s1",
    method: "usdt-trc20",
    amountUsdt: 1299,
    address: "TABC",
    createdAt: T0,
    expiresAt: T0 + PENDING_CHECKOUT_WINDOW_MIN * 60_000,
    quote: { total: 1299, voucher: { id: null, discount: 0 }, trial: { applied: false, promo: 0, offsetUSD: 0, remainderUSD: 0, shadowNEX: 0 }, tradeIn: null },
    leftNoticeShown: false,
    ...over,
  };
}

describe("pending-checkout-core", () => {
  it("is live strictly before expiresAt and dead at/after it", () => {
    const s = session();
    expect(isSessionLive(s, s.expiresAt - 1)).toBe(true);
    expect(isSessionLive(s, s.expiresAt)).toBe(false);
    expect(isSessionLive(s, s.expiresAt + 1)).toBe(false);
    expect(isSessionLive(session({ expiresAt: Number.NaN }), T0)).toBe(false);
  });

  it("counts down in whole seconds and floors at 0", () => {
    const s = session();
    expect(sessionSecondsLeft(s, T0)).toBe(30 * 60);
    expect(sessionSecondsLeft(s, T0 + 1_500)).toBe(30 * 60 - 1);
    expect(sessionSecondsLeft(s, s.expiresAt + 5_000)).toBe(0);
    expect(formatCountdown(30 * 60)).toBe("30:00");
    expect(formatCountdown(61)).toBe("01:01");
    expect(formatCountdown(-4)).toBe("00:00");
  });

  it("prunes expired rows and picks the earliest live one as current", () => {
    const dead = session({ id: "pc-dead", expiresAt: T0 - 1 });
    const a = session({ id: "pc-a" });
    const b = session({ id: "pc-b", createdAt: T0 + 10 });
    expect(pruneExpiredSessions([dead, a, b], T0).map((s) => s.id)).toEqual(["pc-a", "pc-b"]);
    expect(firstLiveSession([dead, a, b], T0)?.id).toBe("pc-a");
    expect(firstLiveSession([dead], T0)).toBeNull();
  });

  it("normalizes storage rows: keeps well-formed sessions, drops broken ones", () => {
    const good = session({ leftNoticeShown: true, quote: { ...session().quote, voucher: { id: "v1", discount: 20 }, tradeIn: { deviceId: "d1" } } });
    const rows = [
      good,
      { ...session(), id: "" },                       // no id
      { ...session(), method: "card" },               // not a chain method
      { ...session(), address: "" },                  // no address
      { ...session(), amountUsdt: Number.NaN },       // bad amount
      { ...session(), quote: undefined },             // no quote snapshot
      null,
      "junk",
    ];
    const out = normalizeSessions(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(good);
    expect(normalizeSessions(undefined)).toEqual([]);
    expect(normalizeSessions({ not: "array" })).toEqual([]);
  });
});
