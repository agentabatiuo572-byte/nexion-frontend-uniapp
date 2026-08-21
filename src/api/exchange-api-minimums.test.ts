import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createExchangeApi } from "./exchange-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

const caps = {
  asset: "NEX",
  currency: "USDT",
  currentPrice: 0.125,
  userDailyCapUsdt: 50,
  platformDailyCapUsdt: 20000,
  feePct: 0,
  feeMinUsdt: 0.5,
  minUsdt: 3,
  minNex: 42,
  queueMode: "QUEUE",
  swapEnabled: true,
  serverCanonical: true,
  source: "G2/G3 server configuration",
  sourceEnvironment: "PRODUCTION",
  runId: "",
};

function client(response: unknown): ApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as ApiClient;
}

describe("exchange server minimums", () => {
  beforeEach(() => setCurrentCommerceSandboxRun(null));
  it("reads direction-specific minimums from the canonical caps response", async () => {
    await expect(createExchangeApi(client(caps)).fetchCaps()).resolves.toMatchObject({ minUsdt: 3, minNex: 42 });
  });

  it("rejects older caps responses without explicit environment/run provenance", async () => {
    const { minUsdt: _minUsdt, minNex: _minNex, sourceEnvironment: _sourceEnvironment, runId: _runId, ...legacy } = caps;
    await expect(createExchangeApi(client(legacy)).fetchCaps()).rejects.toMatchObject({ message: "EXCHANGE_CAPS_RESPONSE_INVALID" });
  });

  it("rejects a sandbox caps response from a previous run", async () => {
    setCurrentCommerceSandboxRun("sandbox-run-2");
    const sandbox = { ...caps, sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", swapEnabled: false };
    await expect(createExchangeApi(client(sandbox), "dev").fetchCaps())
      .rejects.toMatchObject({ message: "EXCHANGE_CAPS_RESPONSE_INVALID" });
  });
});
