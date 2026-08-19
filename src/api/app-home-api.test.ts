import { describe, expect, it } from "vitest";
import { parseAppHomeOverview } from "./app-home-api";

const valid = {
  serverCanonical: true,
  sourceEnvironment: "PRODUCTION",
  runId: "",
  generatedAt: "2026-08-15T00:00:00Z",
  accountScope: "authenticated-account",
  source: "server:nx_compute_receipt,nx_compute_task,nx_user_device,nx_product,nx_growth_promo_banner",
  earnings: {
    today: { usdt: 1.2, nex: 4, jobCount: 3 }, week: { usdt: 4, nex: 8, jobCount: 9 },
    month: { usdt: 5, nex: 10, jobCount: 12 }, all: { usdt: 6, nex: 11, jobCount: 13 },
  },
  marketBoard: { workloads: [{ code: "IG", name: "Image", unit: "image", price: 0.1, deltaPct: 1, sparkline: [1, 2], flagshipDeltaPct: null }], deviceRankings: [{ rank: 1, name: "S1", kind: "stellarbox-s1", bestFor: "images", dailyUsdt: 2 }] },
  weeklyPromo: { status: "active", rewardNex: 10, multiplier: 1.5, endAt: "2026-08-20T00:00:00Z", product: { kind: "stellarbox-s1", name: "S1", dailyUsdt: 2, priceUsdt: 100 } },
  onboarding: { cumulativePaidUsdt: 99, activeDevices: 10 },
  onGrid: { clients: [{ id: "P", name: "Client", model: "Model", city: "Tokyo", gpus: 2 }], activeDevices: 10, activeJobs: 3, perSecUsdt: 0.1 },
};

describe("parseAppHomeOverview", () => {
  it("accepts a complete server projection", () => {
    expect(parseAppHomeOverview(valid).earnings.week.jobCount).toBe(9);
  });
  it("keeps unavailable facts explicit instead of inventing zero", () => {
    const parsed = parseAppHomeOverview({ ...valid, onboarding: { cumulativePaidUsdt: null, activeDevices: null }, onGrid: { ...valid.onGrid, activeJobs: null }, weeklyPromo: null });
    expect(parsed.onboarding.cumulativePaidUsdt).toBeNull();
    expect(parsed.onGrid.activeJobs).toBeNull();
    expect(parsed.weeklyPromo).toBeNull();
  });
  it("rejects an untrusted or malformed response", () => {
    expect(() => parseAppHomeOverview({ ...valid, serverCanonical: false })).toThrow("APP_HOME_OVERVIEW_INVALID");
    expect(() => parseAppHomeOverview({ ...valid, earnings: { ...valid.earnings, today: { usdt: -1, nex: 0, jobCount: 0 } } })).toThrow("APP_HOME_OVERVIEW_INVALID");
  });
});
