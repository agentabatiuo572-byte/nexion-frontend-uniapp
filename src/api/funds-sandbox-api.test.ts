import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFundsSandboxApi } from "./funds-sandbox-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

const RUN = "funds-run-20260816";

function wallet() {
  return { availableUsdt: 100, reservedUsdt: 0, version: 1, source: "mock", sourceEnvironment: "SANDBOX" };
}

function policy() {
  return {
    minAmount: 1,
    dailyLimitCount: 5,
    balanceMaxRatio: 0.8,
    smallAmountThresholdUsd: 50,
    payoutSlaHours: 24,
    networkConfirmFeeUsd: { trc20: 1, bep20: 1, erc20: 1 },
    nexFeeOffsetRate: 0.1,
    policyVersion: "sandbox-v1",
    cooldownDays: 1,
    complianceHoldEnabled: false,
    withdrawalEnabled: true,
    enabledNetworks: ["USDT-BEP20"],
    network: "USDT-BEP20",
    channel: "CREGIS_USDT_BEP20",
    source: "mock",
    sourceEnvironment: "SANDBOX",
    mode: "LOCAL_SANDBOX",
  };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    runId: RUN,
    orderNo: "SBX-ORDER-1",
    kind: "TOPUP",
    channel: "CARD",
    amount: 25,
    targetAddress: null,
    status: "SETTLED",
    source: "mock",
    sourceEnvironment: "SANDBOX",
    version: 1,
    createdAt: "2026-08-16T00:00:00.000Z",
    settledAt: "2026-08-16T00:01:00.000Z",
    wallet: wallet(),
    ...overrides,
  };
}

function overview(overrides: Record<string, unknown> = {}) {
  return {
    runId: RUN,
    wallet: wallet(),
    orders: [order()],
    ledger: [{
      runId: RUN,
      ledgerNo: "SBX-LEDGER-1",
      orderNo: "SBX-ORDER-1",
      entryRole: "TOPUP_CREDIT",
      direction: "IN",
      amount: 25,
      availableAfter: 100,
      reservedAfter: 0,
      source: "mock",
      sourceEnvironment: "SANDBOX",
      createdAt: "2026-08-16T00:01:00.000Z",
    }],
    withdrawalPolicy: policy(),
    source: "mock",
    sourceEnvironment: "SANDBOX",
    mode: "LOCAL_SANDBOX",
    ...overrides,
  };
}

beforeEach(() => setCurrentCommerceSandboxRun(null));

describe("funds sandbox API run fence", () => {
  it("passes the explicit sandbox mode and accepts only the current commerce run", async () => {
    setCurrentCommerceSandboxRun(RUN);
    const request = vi.fn().mockResolvedValue(overview());
    const api = createFundsSandboxApi({ request } as never, "dev");

    await expect(api.overview()).resolves.toMatchObject({ runId: RUN, sourceEnvironment: "SANDBOX" });
    expect(request).toHaveBeenCalledWith({ method: "GET", path: "/api/app/wallet/sandbox" });
  });

  it("rejects a response from a previous run before exposing any wallet data", async () => {
    setCurrentCommerceSandboxRun("funds-run-20260817");
    const request = vi.fn().mockResolvedValue(overview({ runId: RUN }));
    const api = createFundsSandboxApi({ request } as never, "dev");

    await expect(api.overview()).rejects.toMatchObject({ message: "FUNDS_SANDBOX_RUN_ID_MISMATCH" });
  });

  it("fails closed in remote mode without issuing a sandbox request", async () => {
    const request = vi.fn();
    const api = createFundsSandboxApi({ request } as never, "prod");

    await expect(api.overview()).rejects.toMatchObject({ message: "FUNDS_SANDBOX_MODE_INVALID" });
    expect(request).not.toHaveBeenCalled();
  });

  it("run-fences mutation responses as well as overview responses", async () => {
    setCurrentCommerceSandboxRun(RUN);
    const request = vi.fn().mockResolvedValue(order({ kind: "WITHDRAWAL", channel: "CREGIS_USDT_BEP20", targetAddress: "0xabc" }));
    const api = createFundsSandboxApi({ request } as never, "dev");
    await expect(api.createWithdrawal(25, "0xabc", "idempotency")).resolves.toMatchObject({ runId: RUN });

    setCurrentCommerceSandboxRun("funds-run-20260817");
    await expect(api.applyCallback("SBX-ORDER-1", "CONFIRMED", 1, "event-1"))
      .rejects.toMatchObject({ message: "FUNDS_SANDBOX_RUN_ID_MISMATCH" });
  });
});
