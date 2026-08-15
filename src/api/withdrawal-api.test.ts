import { expect, test } from "vitest";
import { createWithdrawalApi } from "./withdrawal-api";

const row = {
  withdrawalNo: "WD-1", targetAddress: "0x1234567890123456789012345678901234567890",
  amount: 25, chain: "USDT-BEP20", status: "REVIEW_PENDING", holdUntil: "2026-08-20T00:00:00Z",
  createdAt: "2026-08-15T00:00:00Z", networkConfirmUsd: 1, networkFee: 1, penaltyFee: 0,
  grossFee: 1, nexBurned: 0, feeWaived: 0, actualFee: 1, netReceive: 24,
  policyVersion: "p1", useNexFeeOffset: false, riskRoute: "delay", idSource: "server",
};

test("hydrates the durable withdrawal list and sends the server eligibility snapshot request", async () => {
  const requests: any[] = [];
  const api = createWithdrawalApi({ request: async (request: any) => {
    requests.push(request);
    if (request.method === "GET") return { source: "nx_withdrawal_order", sourceEnvironment: "PRODUCTION", withdrawals: [row] };
    return {
      canSubmit: true, maxWithdrawableUsdt: 100, route: "delay", riskReasons: ["K3_ROUTE:delay"],
      fastLaneApplied: false, waivedGates: [], dailyLimitReached: false,
      dailyCountResetAt: 1786838400000, configVersion: "p1",
    };
  }} as never);
  await expect(api.list()).resolves.toMatchObject([{ withdrawalNo: "WD-1", targetAddress: row.targetAddress }]);
  await expect(api.eligibility({ amount: 25, chain: "USDT-BEP20", address: row.targetAddress })).resolves.toMatchObject({ route: "delay" });
  expect(requests[0].path).toBe("/api/withdrawals");
  expect(requests[1].path).toBe("/api/withdrawals/eligibility");
});
