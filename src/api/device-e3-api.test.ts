import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createDeviceE3Api } from "./device-e3-api";

function client(payload: unknown): ApiClient {
  return {
    request: vi.fn().mockResolvedValue(payload),
    upload: vi.fn(),
    refreshSession: vi.fn(),
  } as unknown as ApiClient;
}

describe("device E3 eligibility API", () => {
  function fleetPayload(capacityPct: number) {
    return {
      dailyUsdt: 1,
      dailyNex: 2,
      realizedTodayUsdt: 0,
      realizedTodayNex: 0,
      walletUsdt: 0,
      walletNex: 0,
      userJoinedAt: 1,
      serverNow: 2,
      timezone: "Asia/Shanghai",
      slotCap: 6,
      source: "server",
      sourceEnvironment: "PRODUCTION",
      runId: "",
      serverCanonical: true,
      capacitySchedule: { stageEarlyEnd: "3", stageMidEnd: "8", capacityFloorPct: "22", capacitySubsidyDays: "30", capacityBand1DeltaPct: "-4", capacityBand2DeltaPct: "-6", capacityBand3DeltaPct: "-23.7", capacityApplyToPhone: "false", capacityApplyToCloudShare: "false", capacityApplyToPcGpu: "false", capacityApplyToS1: "true", capacityApplyToPro: "true", capacityApplyToProV2: "true", capacityApplyToRackP1: "true", capacityApplyToRackP2: "true" },
      devices: [{
        id: 1, rowVersion: 1, instanceNo: "E3-1", name: "Box", deviceType: "BOX", productCode: "STELLARBOX-S1", status: "ACTIVE", pendingDeactivate: false,
        activatedAt: 1, purchasedAt: 1, dailyUsdt: 1, dailyNex: 1, todayEarningsUsdt: 0, todayEarningsNex: 0,
        gpuModel: "GPU", vramTotalGb: 1, basePowerW: 1, location: "Local", capacityPct, capacityAgeMonths: 1,
        capacityConfigKey: "capacityApplyToS1", capacitySubsidized: false, capacitySubsidyDays: 30,
        actualPaidUsdt: 1, cumulativeOutputUsdt: 0,
      }],
    };
  }

  it.each([[-0.0001, "below zero"], [100.0001, "above one hundred"]] as const)(
    "rejects E3 capacityPct %s (%s) instead of accepting an impossible projection",
    async (capacityPct) => {
      const api = createDeviceE3Api(client(fleetPayload(capacityPct)));
      await expect(api.fleet()).rejects.toMatchObject({ message: "E3_CANONICAL_RESPONSE_INVALID" });
    },
  );

  it("requests server eligibility and accepts only a complete server source projection", async () => {
    const request = vi.fn().mockResolvedValue({
      enabled: true,
      eligible: true,
      decisionCode: "ELIGIBLE",
      targetProductId: 22,
      targetProductNo: "stellarbox-pro-v2",
      targetProductName: "NexionBox Pro v2",
      targetPriceUsdt: 1500,
      requireHigherPrice: true,
      maxDevicesPerOrder: 3,
      sources: [{ sourceDeviceId: 11, sourceProductName: "Old", eligible: true, reasonCode: "OK" }],
      decisionSource: "server",
    });

    const api = createDeviceE3Api({ request } as unknown as ApiClient);
    await expect(api.eligibility("stellarbox-pro-v2")).resolves.toMatchObject({
      eligible: true,
      decisionCode: "ELIGIBLE",
      sources: [{ sourceDeviceId: 11, eligible: true, reasonCode: "OK" }],
    });
    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/api/app/trade-in/eligibility",
      body: { targetProductNo: "stellarbox-pro-v2" },
    });
  });

  it("rejects local or incomplete eligibility projections", async () => {
    const api = createDeviceE3Api(client({
      enabled: true,
      eligible: true,
      decisionCode: "ELIGIBLE",
      targetProductId: 22,
      targetProductNo: "stellarbox-pro-v2",
      targetProductName: "NexionBox Pro v2",
      targetPriceUsdt: 1500,
      requireHigherPrice: true,
      maxDevicesPerOrder: 3,
      sources: [{ sourceDeviceId: 11, sourceProductName: "Old", eligible: true, reasonCode: "OK" }],
      decisionSource: "local",
    }));

    await expect(api.eligibility("stellarbox-pro-v2")).rejects.toMatchObject({
      message: "TRADEIN_ELIGIBILITY_RESPONSE_INVALID",
    });
  });

  it("rejects an eligible response containing an ineligible source", async () => {
    const api = createDeviceE3Api(client({
      enabled: true,
      eligible: true,
      decisionCode: "ELIGIBLE",
      targetProductId: 22,
      targetProductNo: "stellarbox-pro-v2",
      targetProductName: "NexionBox Pro v2",
      targetPriceUsdt: 1500,
      requireHigherPrice: true,
      maxDevicesPerOrder: 3,
      sources: [{ sourceDeviceId: 11, sourceProductName: "Old", eligible: false, reasonCode: "OK" }],
      decisionSource: "server",
    }));

    await expect(api.eligibility("stellarbox-pro-v2")).rejects.toMatchObject({
      message: "TRADEIN_ELIGIBILITY_RESPONSE_INVALID",
    });
  });

  it("rejects an unknown source reason code", async () => {
    const api = createDeviceE3Api(client({
      enabled: true,
      eligible: false,
      decisionCode: "NO_ELIGIBLE_SOURCE",
      targetProductId: 22,
      targetProductNo: "stellarbox-pro-v2",
      targetProductName: "NexionBox Pro v2",
      targetPriceUsdt: 1500,
      requireHigherPrice: true,
      maxDevicesPerOrder: 3,
      sources: [{ sourceDeviceId: 11, sourceProductName: "Old", eligible: false, reasonCode: "CLIENT_GUESSED" }],
      decisionSource: "server",
    }));

    await expect(api.eligibility("stellarbox-pro-v2")).rejects.toMatchObject({
      message: "TRADEIN_ELIGIBILITY_RESPONSE_INVALID",
    });
  });
});
