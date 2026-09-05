import { expect, test } from "vitest";
import { storeUpgrade } from "./store-upgrade";
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
