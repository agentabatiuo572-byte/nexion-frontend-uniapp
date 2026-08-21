import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTrialConfig } from "./trial-config";

describe("trial card server config", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("uses the PC-managed remaining quota instead of a frontend constant", () => {
    const store = useTrialConfig();
    store.applyAuthoritative({
      trialDays: "3",
      graceDays: "7",
      discountRate: "15",
      discountCapUSD: "50",
      trialOffsetCapUSD: "50",
      trialProductId: "device-trial-standard",
      trialPriceUSD: "1299",
      shadowDailyUSD: "7",
      shadowDailyNEX: "40",
      phaseOpen: "开放",
      autoPushEnabled: "开",
      autoPushDelayMs: "1500",
      autoPushCooldownHours: "24",
      autoPushMaxPerSession: "1",
      seatsLeftToday: "47",
    });

    expect(store.config.seatsLeftToday).toBe(47);
  });

  it.each(["-1", "47.5", "1000001"])("rejects an out-of-contract quota %s", (quota) => {
    const store = useTrialConfig();
    expect(() => store.applyAuthoritative({
      trialDays: "3", graceDays: "7", discountRate: "15", discountCapUSD: "50",
      trialOffsetCapUSD: "50", trialProductId: "device-trial-standard", trialPriceUSD: "1299",
      shadowDailyUSD: "7", shadowDailyNEX: "40", phaseOpen: "开放", autoPushEnabled: "开",
      autoPushDelayMs: "1500", autoPushCooldownHours: "24", autoPushMaxPerSession: "1",
      seatsLeftToday: quota,
    })).toThrow("TRIAL_CONFIG_RESPONSE_INVALID");
  });
});
