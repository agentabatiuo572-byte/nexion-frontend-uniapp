import { describe, expect, it, vi } from "vitest";
import { createTaskAssignmentApi } from "./task-assignment-api";
import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { taskProgressPercent } from "@/lib/task-progress";
import { awaitsExecutionResultConfirmation } from "@/lib/task-result-confirmation";

const authority = { source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true };
const assignment = { taskNo: "CV2-1", deviceId: 7, taskId: "em-1", taskName: "Embedding", taskClass: "EM", model: "BGE-M3", client: "TEST", status: "QUEUED", rewardUsdt: "0.123456", requiredSeconds: 5, queuedAt: 1000, startedAt: null, completableAt: null, completedAt: null, settlementStatus: "NONE", settlementBatchNo: null, actualDurationSec: null, settledAt: null, configVersion: 3, ...authority };
const projection = { ...authority, protocolVersion: 2, serverNow: 10000, pendingEarned: [{ asset: "USDT", amount: "0.000000", taskCount: 0 }], devices: [{ deviceId: 7, instanceNo: "D-7", deviceType: "GPU", lockUntil: null, currentTask: assignment, recentTasks: [] }] };
const batch = { batchNo: "B-1", asset: "USDT", amount: "0.123456", taskCount: 1, status: "POSTED", windowStart: 0, windowEnd: 60000, postedAt: 65000 };
const item = { taskNo: "CV2-1", receiptNo: "R-1", deviceId: 7, taskType: "EM", amount: "0.123456", completedAt: 55000 };
const api = (request: ReturnType<typeof vi.fn>) => createTaskAssignmentApi({ request } as unknown as ApiClient, "dev");

describe("Compute V2 read contract", () => {
  it("keeps queued start unknown and pending amounts exact; an elapsed estimate cannot complete a task", async () => {
    const request = vi.fn().mockResolvedValue(projection);
    const state = await api(request).state(true);
    expect(request).toHaveBeenCalledWith({ path: "/api/tasks/v2/assignments" });
    expect(state.pendingEarned?.[0]).toEqual({ asset: "USDT", amount: "0.000000", taskCount: 0 });
    expect(state.devices[0].currentTask).toMatchObject({ status: "QUEUED", startedAt: null, configVersion: "3", settlementStatus: "NONE", rewardUsdt: 0.123456 });
    expect(taskProgressPercent({ startedAt: null, status: "QUEUED", totalSec: 5 } as any, 100000)).toBeNull();
    expect(awaitsExecutionResultConfirmation({ status: "QUEUED", completableAt: 1000 }, 100000)).toBe(false);
    expect(awaitsExecutionResultConfirmation({ status: "RUNNING", completableAt: 1000 }, 100000)).toBe(true);
  });
  it.each([404, 501])("uses v1 only when V2 endpoint is unavailable (%s)", async status => {
    const legacy = { ...authority, serverNow: 1000, devices: [] };
    const request = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "http", status, message: "UNAVAILABLE" })).mockResolvedValueOnce(legacy);
    await expect(api(request).state(true)).resolves.toMatchObject({ devices: [] });
    expect(request.mock.calls.map(([value]) => value.path)).toEqual(["/api/tasks/v2/assignments", "/api/tasks/assignments"]);
  });
  it("preserves the server's legacy recovery projection and hides its elapsed progress", async () => {
    const request = vi.fn().mockResolvedValue({ ...projection, devices: [{ ...projection.devices[0], currentTask: {
      ...assignment, taskNo: "CT-OLD", status: "RECOVERING", startedAt: 1000, completableAt: null,
    } }] });
    const state = await api(request).state(true);
    const current = state.devices[0].currentTask!;
    expect(current).toMatchObject({ taskNo: "CT-OLD", status: "RECOVERING", settlementStatus: "NONE", completableAt: null, receiptNo: null });
    expect(taskProgressPercent({ startedAt: current.startedAt, status: current.status, totalSec: current.requiredSeconds } as any, 100000)).toBeNull();
    expect(awaitsExecutionResultConfirmation(current, 100000)).toBe(false);
  });
  it("accepts additive device recovery after lease expiry and defaults older responses safely", async () => {
    const device = { ...projection.devices[0], currentTask: null, recoveryPending: true, recoveryReason: "LEGACY_COMPLETE_OUTCOME_UNKNOWN" };
    const state = await api(vi.fn().mockResolvedValue({ ...projection, devices: [device] })).state(true);
    expect(state.devices[0]).toMatchObject({ currentTask: null, recoveryPending: true, recoveryReason: "LEGACY_COMPLETE_OUTCOME_UNKNOWN", recentTasks: [] });
    expect((await api(vi.fn().mockResolvedValue(projection)).state(true)).devices[0]).toMatchObject({ recoveryPending: false, recoveryReason: null });
    for (const patch of [{ recoveryPending: "true" }, { recoveryReason: "UNKNOWN_REASON" }, { recoveryPending: false }]) {
      await expect(api(vi.fn().mockResolvedValue({ ...projection, devices: [{ ...device, ...patch }] })).state(true)).rejects.toMatchObject({ kind: "protocol" });
    }
  });
  it.each([new ApiError({ kind: "auth", status: 401, message: "AUTH" }), new ApiError({ kind: "network", message: "NETWORK" }), new ApiError({ kind: "http", status: 503, message: "DOWN" }), new ApiError({ kind: "protocol", message: "INVALID" })])("does not hide failure with legacy data: %s", async failure => {
    const request = vi.fn().mockRejectedValue(failure);
    await expect(api(request).state(true)).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed pending money and duplicate assets", async () => {
    for (const pendingEarned of [[{ asset: "USDT", amount: 0.1, taskCount: 1 }], [...projection.pendingEarned, ...projection.pendingEarned]]) {
      await expect(api(vi.fn().mockResolvedValue({ ...projection, pendingEarned })).state(true)).rejects.toMatchObject({ kind: "protocol" });
    }
    await expect(api(vi.fn().mockResolvedValue({ ...projection, protocolVersion: undefined })).state(true)).rejects.toMatchObject({ kind: "protocol" });
  });
  it("paginates batches and validates per-task allocations without floating point arithmetic", async () => {
    const request = vi.fn().mockResolvedValueOnce({ ...authority, records: [batch], nextCursor: "B+1" }).mockResolvedValueOnce({ ...authority, ...batch, items: [item] });
    expect((await api(request).settlements("B 2")).records[0].amount).toBe("0.123456");
    expect(request).toHaveBeenNthCalledWith(1, { path: "/api/tasks/v2/settlements?limit=20&cursor=B%202" });
    await expect(api(request).settlement("B-1")).resolves.toMatchObject({ batchNo: "B-1", items: [item] });
    for (const patch of [{ batchNo: "B-OTHER" }, { amount: "0.123457" }, { items: [item, item] }, { source: "mock" }]) {
      await expect(api(vi.fn().mockResolvedValue({ ...authority, ...batch, items: [item], ...patch })).settlement("B-1")).rejects.toMatchObject({ kind: "protocol" });
    }
  });
});
