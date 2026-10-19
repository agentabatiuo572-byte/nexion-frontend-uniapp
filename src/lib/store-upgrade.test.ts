import { expect, test } from "vitest";
import { activePhoneDailyRate, storeUpgrade, storeYieldMultiplier } from "./store-upgrade";
const products = [
  { id: "stellarbox-s1", name: "S1", dailyEarn: 1, dailyEarnNEX: 2 },
  { id: "stellarbox-pro-v2", name: "Pro V2", dailyEarn: 5, dailyEarnNEX: 8 },
  { id: "stellarrack-p1", name: "P1", dailyEarn: 10, dailyEarnNEX: 12 },
];
test("an owned Pro V2 compares with the next available hardware, never phone to S1", () => {
  const result = storeUpgrade(products, [{ kind: "stellarbox-pro-v2", name: "My Pro V2", activatedAt: 1, baseRate: 5, baseRateNEX: 8 }]);
  expect(result?.target.id).toBe("stellarrack-p1");
  expect(result?.base.kind).toBe("stellarbox-pro-v2");
  expect(result?.multiplier).toBe(2);
});
test("unknown, inactive and top-tier owners receive no invented upgrade comparison", () => {
  expect(storeUpgrade(products, [])).toBeNull();
  expect(storeUpgrade(products, [{ kind: "phone", name: "Phone", activatedAt: null, baseRate: 1, baseRateNEX: 1 }])).toBeNull();
  expect(storeUpgrade(products, [{ kind: "stellarrack-p2", name: "P2", activatedAt: 1, baseRate: 50, baseRateNEX: 50 }])).toBeNull();
});
test("h5-lite excludes activated phones from upgrade comparisons without changing rate calculations", () => {
  const phones = [
    { kind: "phone" as const, name: "Inactive", activatedAt: null, baseRate: 0.06, baseRateNEX: 0 },
    { kind: "phone" as const, name: "Current phone", activatedAt: 1, baseRate: 0.04, baseRateNEX: 6 },
  ];
  const phoneRate = activePhoneDailyRate(phones);
  expect(phoneRate).toBe(0.04);
  expect(storeYieldMultiplier(1, phoneRate)).toBe(25);
  expect(storeUpgrade(products, phones)).toBeNull();
  const upgrade = storeUpgrade(products, [...phones,
    { kind: "stellarbox-s1", name: "S1", activatedAt: 1, baseRate: 1, baseRateNEX: 2 },
  ]);
  expect(upgrade?.base.kind).toBe("stellarbox-s1");
  expect(upgrade?.target.id).toBe("stellarbox-pro-v2");
  expect(upgrade?.multiplier).toBe(5);
  expect(activePhoneDailyRate(phones.slice(0, 1))).toBe(0);
  expect(storeYieldMultiplier(1, 0)).toBe(0);
});
