import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { CanonicalE3Fleet } from "@/api/device-e3-api";
import type { CanonicalTaskAssignments } from "@/api/task-assignment-api";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  fundsServerEnabled: true,
  expectedApiEnvironment: "dev",
  sessionVault: { read: vi.fn() },
  deviceE3Api: { fleet: vi.fn() },
  taskAssignmentApi: { state: vi.fn() },
  appHomeApi: { fetch: vi.fn() },
  withdrawalApi: { submit: vi.fn(), list: vi.fn(), get: vi.fn() },
}));

vi.mock("@/api/runtime", () => remote);

const { useApp } = await import("./app");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fleet(walletUsdt: number): CanonicalE3Fleet {
  return {
    dailyUsdt: 0,
    dailyNex: 0,
    realizedTodayUsdt: 0,
    realizedTodayNex: 0,
    walletUsdt,
    walletNex: 0,
    userJoinedAt: 1,
    serverNow: 1,
    timezone: "UTC",
    slotCap: 1,
    devices: [],
    capacitySchedule: {
      stageEarlyEnd: "3",
      stageMidEnd: "8",
      capacityFloorPct: "22",
      capacitySubsidyDays: "30",
      capacityBand1DeltaPct: "-4",
      capacityBand2DeltaPct: "-6",
      capacityBand3DeltaPct: "-23.7",
      capacityApplyToPhone: "false",
      capacityApplyToCloudShare: "false",
      capacityApplyToPcGpu: "false",
      capacityApplyToS1: "true",
      capacityApplyToPro: "true",
      capacityApplyToProV2: "true",
      capacityApplyToRackP1: "true",
      capacityApplyToRackP2: "true",
    },
    source: "nx_user_device + nx_compute_receipt + nx_compute_e3_config",
    sourceEnvironment: "PRODUCTION",
    runId: "",
    serverCanonical: true,
  };
}

const assignments: CanonicalTaskAssignments = {
  serverNow: 1,
  devices: [],
  source: "server",
  sourceEnvironment: "PRODUCTION",
  runId: "",
  serverCanonical: true,
};

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  remote.sessionVault.read.mockReturnValue({ user: { userId: 1001 } });
  remote.taskAssignmentApi.state.mockResolvedValue(assignments);
});

describe("App remote fleet refresh wiring", () => {
  it("lets an existing lifecycle read coalesce, but makes the following default read fresh", async () => {
    const staleFleet = deferred<CanonicalE3Fleet>();
    const freshFleet = deferred<CanonicalE3Fleet>();
    remote.deviceE3Api.fleet
      .mockReturnValueOnce(staleFleet.promise)
      .mockReturnValueOnce(freshFleet.promise);
    const app = useApp();
    app.bindAccount("user:1001");
    const request = app.captureRemoteAccountRequest();

    const lifecycle = app.refreshRemoteFleet(request, { coalesce: true });
    const mutationReadback = app.refreshRemoteFleet(request);

    expect(remote.deviceE3Api.fleet).toHaveBeenCalledTimes(2);
    freshFleet.resolve(fleet(720));
    await expect(mutationReadback).resolves.toBe(true);
    expect(app.user.usdtBalance).toBe(720);

    staleFleet.resolve(fleet(900));
    await expect(lifecycle).resolves.toBe(false);
    expect(app.user.usdtBalance).toBe(720);
  });

  it("keeps an old-account completion from applying after the account epoch advances", async () => {
    const oldFleet = deferred<CanonicalE3Fleet>();
    const currentFleet = deferred<CanonicalE3Fleet>();
    remote.deviceE3Api.fleet
      .mockReturnValueOnce(oldFleet.promise)
      .mockReturnValueOnce(currentFleet.promise);
    const app = useApp();
    app.bindAccount("user:1001");
    const oldRequest = app.captureRemoteAccountRequest();
    const oldRead = app.refreshRemoteFleet(oldRequest, { coalesce: true });

    remote.sessionVault.read.mockReturnValue({ user: { userId: 2002 } });
    app.bindAccount("user:2002");
    const currentRead = app.refreshRemoteFleet();

    currentFleet.resolve(fleet(420));
    await expect(currentRead).resolves.toBe(true);
    expect(app.user.usdtBalance).toBe(420);

    oldFleet.resolve(fleet(900));
    await expect(oldRead).resolves.toBe(false);
    expect(app.user.usdtBalance).toBe(420);
  });

  it("keeps the last confirmed wallet and fleet snapshot when a later fleet read fails", async () => {
    remote.deviceE3Api.fleet
      .mockResolvedValueOnce(fleet(680))
      .mockRejectedValueOnce(new Error("fleet unavailable"));
    const app = useApp();
    app.bindAccount("user:1001");

    await expect(app.refreshRemoteFleet()).resolves.toBe(true);
    expect(app.remoteFleetHasSnapshot).toBe(true);
    expect(app.user.usdtBalance).toBe(680);

    await expect(app.refreshRemoteFleet()).resolves.toBe(false);
    expect(app.remoteFleetStatus).toBe("error");
    expect(app.remoteFleetHasSnapshot).toBe(true);
    expect(app.user.usdtBalance).toBe(680);
  });

  it("retains an authenticated Genesis wallet receipt when the first fleet read fails", async () => {
    remote.deviceE3Api.fleet.mockRejectedValueOnce(new Error("fleet unavailable"));
    const app = useApp();
    app.bindAccount("user:1001");
    const receiptScope = app.captureRemoteAccountRequest();

    expect(app.adoptDevelopmentGenesisWallet(315.5, receiptScope, "PRODUCTION")).toBe(true);
    expect(app.remoteFleetHasSnapshot).toBe(false);
    expect(app.remoteWalletReceiptHasSnapshot).toBe(true);
    expect(app.user.usdtBalance).toBe(315.5);

    await expect(app.refreshRemoteFleet()).resolves.toBe(false);
    expect(app.remoteFleetStatus).toBe("error");
    expect(app.remoteFleetHasSnapshot).toBe(false);
    expect(app.remoteWalletReceiptHasSnapshot).toBe(true);
    expect(app.user.usdtBalance).toBe(315.5);
  });
});
