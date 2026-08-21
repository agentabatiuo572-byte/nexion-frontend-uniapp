import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const paymentApi = {
  config: vi.fn(),
  fxQuote: vi.fn(),
};

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  paymentApi,
}));

describe("fx remote failure", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    paymentApi.config.mockReset();
    paymentApi.fxQuote.mockReset();
  });

  it("marks the explicit remote/sandbox rail unavailable without fixed local values", async () => {
    paymentApi.config.mockResolvedValue({
      vietQr: { enabled: true, minDepositUsdt: 10, maxDepositUsdt: 5000, feeVnd: 0, feeUsdt: 0 },
    });
    paymentApi.fxQuote.mockResolvedValue({
      baseRateVndPerUsdt: 26000, buySpreadPct: 1.5, lockWindowMinutes: 30,
    });

    const { useFx } = await import("./fx");
    const fx = useFx();
    await fx.load();
    expect(fx.configReady).toBe(true);

    paymentApi.config.mockRejectedValue(new Error("PAYMENT_CONFIG_RESPONSE_INVALID"));
    await fx.load();

    expect(fx.syncFailed).toBe(true);
    expect(fx.configReady).toBe(false);
    expect(fx.fxAvailable).toBe(false);
    expect(fx.vietQrEnabled).toBe(false);
    expect(fx.baseRateVndPerUsdt).toBe(0);
    expect(fx.minDepositUsdt).toBe(0);
    expect(fx.maxDepositUsdt).toBe(0);
  });
});
