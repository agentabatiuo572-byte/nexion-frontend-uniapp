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
      vietQr: { enabled: true, minDepositUsdt: 10, maxDepositUsdt: 5000,
        todayRemainingDepositUsdt: 2578.62, todayRemainingVnd: 68050000, feeVnd: 0, feeUsdt: 0 },
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
    expect(fx.todayRemainingDepositUsdt).toBe(0);
  });

  it("makes concurrent callers wait for the same configuration refresh", async () => {
    let resolveConfig!: (value: {
      vietQr: { enabled: boolean; minDepositUsdt: number; maxDepositUsdt: number;
        todayRemainingDepositUsdt: number; todayRemainingVnd: number; feeVnd: number; feeUsdt: number };
    }) => void;
    paymentApi.config.mockReturnValue(new Promise((resolve) => {
      resolveConfig = resolve;
    }));
    paymentApi.fxQuote.mockResolvedValue({
      baseRateVndPerUsdt: 26000, buySpreadPct: 1.5, lockWindowMinutes: 30,
    });

    const { useFx } = await import("./fx");
    const fx = useFx();
    const firstLoad = fx.load();
    const concurrentLoad = fx.load();
    let concurrentSettled = false;
    void concurrentLoad.then(() => {
      concurrentSettled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(concurrentSettled).toBe(false);
    expect(paymentApi.config).toHaveBeenCalledTimes(1);
    expect(paymentApi.fxQuote).toHaveBeenCalledTimes(1);

    resolveConfig({
      vietQr: { enabled: true, minDepositUsdt: 10, maxDepositUsdt: 5000,
        todayRemainingDepositUsdt: 2578.62, todayRemainingVnd: 68050000, feeVnd: 0, feeUsdt: 0 },
    });
    await Promise.all([firstLoad, concurrentLoad]);

    expect(concurrentSettled).toBe(true);
    expect(fx.maxDepositUsdt).toBe(5000);
    expect(fx.todayRemainingDepositUsdt).toBe(2578.62);
  });
});
