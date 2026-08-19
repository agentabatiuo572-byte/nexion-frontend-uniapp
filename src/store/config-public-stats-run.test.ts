import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { platformConfig, listeners, currentScope } = vi.hoisted(() => ({
  platformConfig: vi.fn(),
  listeners: new Set<(scope: { runId: string | null; epoch: number }) => void>(),
  currentScope: { value: { runId: null as string | null, epoch: 0 } },
}));

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  apiRuntimeConfig: { mode: "sandbox", modeExplicit: true },
  platformConfigApi: { platformConfig },
}));

vi.mock("@/api/order-api", () => ({
  captureCommerceSandboxRun: () => currentScope.value,
  subscribeCurrentCommerceSandboxRun: vi.fn((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }),
}));

import { useConfig } from "./config";

function snapshot(runId: string, fleetDevices = 28_432) {
  return {
    featureFlags: {
      computeShareEnabled: true,
      homeNewcomerTasksEnabled: true,
      homeWeeklyPromoEnabled: true,
    },
    publicStats: {
      fleetDevices,
      onlineRatePct: 100,
      onlineJitter: 20,
      registeredUsersBase: 1_420_000,
      registeredUsersMonthlyGrowthPct: 2.9,
      registeredUsersAnchorAt: 1_786_097_730_000,
      realUserCount: 4_321,
      virtualUserCount: 12_000,
      hashratePercentileTable: [{ tops: 10, cumPct: 40 }, { tops: 20, cumPct: 100 }],
    },
    publicStatsAuthority: { source: "mock", sourceEnvironment: "SANDBOX", runId, version: 3 },
    onlineBonus: { h5BaseFactor: 0.6, continuityFullHours: 24 },
    rewards: {
      welcomeGift: { lockMode: "risk_bucket", usdtAmount: 0, nexAmount: 0 },
      inviterReward: { nexAmount: 0 },
    },
    computeShare: { downloadUrl: "", content: { zhTitle: "", zhGuide: "", enTitle: "", enGuide: "" }, gpuTiers: [] },
    share: {
      baseUrl: "https://nexgrid.ai/ref/",
      channels: [],
      appDownload: { officialUrl: "", iosUrl: "", androidUrl: "", apkUrl: "", version: "", releaseNotes: { zh: "", en: "" }, source: "unavailable" },
    },
    updatedAt: "2026-08-19T00:00:00Z",
    sources: ["server:H9"],
  } as const;
}

function publishRun(runId: string | null) {
  currentScope.value = { runId, epoch: currentScope.value.epoch + 1 };
  listeners.forEach((listener) => listener(currentScope.value));
}

describe("H9 public stats commerce Run binding", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    platformConfig.mockReset();
    listeners.clear();
    currentScope.value = { runId: null, epoch: 0 };
  });

  it("keeps Sandbox stats closed until the catalogue establishes the same Run", async () => {
    platformConfig.mockResolvedValue(snapshot("home-public-stats-20260819"));
    const config = useConfig();

    await config.load();
    expect(config.syncFailed).toBe(true);
    expect(config.config.publicStats.fleetDevices).toBe(0);

    publishRun("home-public-stats-20260819");
    await vi.waitFor(() => expect(config.syncFailed).toBe(false));
    expect(config.config.publicStats.fleetDevices).toBe(28_432);
  });

  it("clears the previous Run immediately and installs only the replacement snapshot", async () => {
    currentScope.value = { runId: "home-public-stats-20260819", epoch: 1 };
    platformConfig.mockResolvedValueOnce(snapshot("home-public-stats-20260819"));
    const config = useConfig();
    await config.load();
    expect(config.config.publicStats.fleetDevices).toBe(28_432);

    platformConfig.mockResolvedValueOnce(snapshot("home-public-stats-20260820", 31_000));
    publishRun("home-public-stats-20260820");
    expect(config.config.publicStats.fleetDevices).toBe(0);
    await vi.waitFor(() => expect(config.config.publicStats.fleetDevices).toBe(31_000));
  });

  it("rejects a production H9 projection while the App is in Sandbox", async () => {
    currentScope.value = { runId: "home-public-stats-20260819", epoch: 1 };
    platformConfig.mockResolvedValue({
      ...snapshot("home-public-stats-20260819"),
      publicStatsAuthority: {
        source: "server:nx_config_item,nx_user",
        sourceEnvironment: "PRODUCTION",
        runId: "",
        version: 3,
      },
    });
    const config = useConfig();

    await config.load();

    expect(config.syncFailed).toBe(true);
    expect(config.publicStatsAuthority).toBeNull();
    expect(config.config.publicStats.fleetDevices).toBe(0);
  });
});
