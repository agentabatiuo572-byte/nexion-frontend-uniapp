import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createTaskAssignmentApi } from "./task-assignment-api";

describe("task assignment server receipt projection", () => {
  it("preserves the backend-issued receiptNo on completed assignments", async () => {
    const request = vi.fn().mockResolvedValue({
      serverNow: "2026-08-15T00:00:00Z",
      source: "server",
      sourceEnvironment: "PRODUCTION",
      runId: "",
      serverCanonical: true,
      devices: [{
        deviceId: 7, instanceNo: "D-7", deviceType: "GPU", lockUntil: null,
        currentTask: null,
        recentTasks: [{
          taskNo: "CTA-1", deviceId: 7, taskId: "ig-1", taskName: "Image Gen",
          taskClass: "IG", model: "Flux", client: "Mosaic", status: "COMPLETED",
          rewardUsdt: 0.25, requiredSeconds: 60,
          startedAt: "2026-08-14T23:58:00Z", completableAt: "2026-08-14T23:59:00Z",
          completedAt: "2026-08-15T00:00:00Z", receiptNo: "CTR-CTA-1",
          proofNonce: null, proofExpiresAt: null,
          source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
        }],
      }],
    });
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "prod");
    await expect(api.state()).resolves.toMatchObject({
      devices: [{ recentTasks: [{ receiptNo: "CTR-CTA-1" }] }],
      source: "server",
      sourceEnvironment: "PRODUCTION",
      runId: "",
      serverCanonical: true,
    });
    expect(request).toHaveBeenCalledWith({ path: "/api/tasks/assignments" });
  });

  it("rejects a non-canonical or non-production remote projection before consumption", async () => {
    const request = vi.fn().mockResolvedValue({
      serverNow: "2026-08-15T00:00:00Z", source: "server", sourceEnvironment: "SANDBOX",
      runId: "", serverCanonical: false, devices: [],
    });
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "prod");

    await expect(api.state()).rejects.toMatchObject({
      kind: "protocol", message: "TASK_ASSIGNMENT_PROVENANCE_INVALID",
    });
  });

  it("requires claim command responses to carry the same canonical provenance", async () => {
    const request = vi.fn().mockResolvedValue({
      taskNo: "CTA-1", deviceId: 7, taskId: "ig-1", taskName: "Image Gen",
      taskClass: "IG", model: "Flux", client: "Mosaic", status: "RUNNING",
      rewardUsdt: 0.25, requiredSeconds: 60,
      startedAt: "2026-08-14T23:58:00Z", completableAt: "2026-08-14T23:59:00Z",
      completedAt: null, receiptNo: null, proofNonce: "a".repeat(64),
      proofExpiresAt: "2026-08-15T23:59:00Z",
      source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "prod");

    await expect(api.claim(7, "claim-1")).resolves.toMatchObject({
      source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });
  });

  it("does not allow development to submit a production proof", async () => {
    const request = vi.fn();
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "dev");

    await expect(api.complete("CTA-1", {
      resultHash: "a".repeat(64), proofMode: "PRODUCTION", executorId: "exec-1",
      proofNonce: "b".repeat(64), proofTimestamp: 1786363200000, proofSignature: "c".repeat(64),
    }, "complete-1")).rejects.toMatchObject({
      kind: "configuration", message: "TASK_ASSIGNMENT_SANDBOX_PROOF_DISABLED",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("does not send a claim mutation from the read-only development projection", async () => {
    const request = vi.fn();
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "dev");

    await expect(api.claim(7, "claim-1")).rejects.toMatchObject({
      kind: "configuration", message: "TASK_ASSIGNMENT_SANDBOX_CLAIM_DISABLED",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("requires the complete production proof shape on the production rail", async () => {
    const request = vi.fn();
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "prod");

    await expect(api.complete("CTA-1", {
      resultHash: "a".repeat(64), proofMode: "SANDBOX", executorId: "exec-1",
      proofNonce: "b".repeat(64), proofTimestamp: 1786363200000, proofSignature: "c".repeat(64),
    }, "complete-1")).rejects.toMatchObject({
      kind: "configuration", message: "TASK_ASSIGNMENT_PRODUCTION_PROOF_REQUIRED",
    });
    expect(request).not.toHaveBeenCalled();
  });
});
