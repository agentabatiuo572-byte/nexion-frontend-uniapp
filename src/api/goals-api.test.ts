import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGoalsApi } from "./goals-api";
import { advanceRuntimeRevision } from "./order-api";

beforeEach(() => advanceRuntimeRevision(null));

describe("goals API", () => {
  it("uses authenticated server CRUD and preserves canonical progress", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true,
      source: "nx_earning_goal",
      lifetimeEarningsUsdt: 250,
      goals: [{ id: 7, targetUsdt: 1000, deadlineAt: 1890000000000, createdAt: 1880000000000,
        achieved: false, progressPct: 25, lifetimeEarningsUsdt: 250 }],
    });
    const api = createGoalsApi({ request } as never, "prod");

    await expect(api.list()).resolves.toMatchObject({ serverCanonical: true, goals: [{ id: 7, progressPct: 25 }] });
    expect(request).toHaveBeenCalledWith({ method: "GET", path: "/api/goals" });
  });

  it("creates and updates goals without local persistence", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ id: 8, targetUsdt: 500, deadlineAt: 1890000000000, createdAt: 1880000000000, achieved: false, progressPct: 0, lifetimeEarningsUsdt: 0 })
      .mockResolvedValueOnce({ id: 8, targetUsdt: 500, deadlineAt: 1890000000000, createdAt: 1880000000000, achieved: true, progressPct: 100, lifetimeEarningsUsdt: 600 });
    const api = createGoalsApi({ request } as never, "prod");

    await api.create({ targetUsdt: 500, deadlineAt: 1890000000000 });
    await api.setStatus(8, true);
    expect(request).toHaveBeenNthCalledWith(1, {
      method: "POST", path: "/api/goals", body: { targetUsdt: 500, deadlineAt: 1890000000000 },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "POST", path: "/api/goals/8/status", body: { achieved: true },
    });
  });

  it("accepts only current run-scoped server recommendations in sandbox", async () => {
    advanceRuntimeRevision("sandbox-run-20260817");
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true, source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-20260817",
      productNo: "sandbox-sku", productName: "Sandbox SKU", dailyEarn: 1, price: 99,
      requiredDaily: 0.5, targetUsdt: 100, days: 200,
    });
    const api = createGoalsApi({ request } as never, "dev");

    await expect(api.recommendation(100, 1890000000000)).resolves.toMatchObject({ productNo: "sandbox-sku" });
  });

  it("rejects mock recommendation payload in remote mode", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true, source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-20260817",
      productNo: "sandbox-sku", productName: "Sandbox SKU", dailyEarn: 1, price: 99,
      requiredDaily: 0.5, targetUsdt: 100, days: 200,
    });
    const api = createGoalsApi({ request } as never, "prod");

    await expect(api.recommendation(100, 1890000000000)).rejects.toMatchObject({ message: "GOALS_RESPONSE_INVALID" });
  });
});
