import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createTaskAssignmentApi } from "./task-assignment-api";

describe("task assignment server receipt projection", () => {
  it("accepts the production-shaped development projection returned by Java", async () => {
    const request = vi.fn().mockResolvedValue({
      serverNow: "2026-08-21 16:50:36",
      devices: [{
        deviceId: 811,
        instanceNo: "DEV-HOME-PHONE-60723152670",
        deviceType: "MOBILE",
        lockUntil: null,
        currentTask: null,
        recentTasks: [],
      }],
      source: "server",
      sourceEnvironment: "PRODUCTION",
      runId: "",
      serverCanonical: true,
    });

    await expect(createTaskAssignmentApi({ request } as unknown as ApiClient, "dev").state())
      .resolves.toMatchObject({
        devices: [{ deviceId: 811, recentTasks: [] }],
        sourceEnvironment: "PRODUCTION",
        runId: "",
      });
  });

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

  it("loads and validates the canonical Proof-of-Compute receipt detail", async () => {
    const request = vi.fn().mockResolvedValue({
      receiptNo: "R-CTA-1", taskNo: "CTA-1", deviceId: 7, deviceInstanceNo: "D-7",
      deviceName: "你的手机", deviceType: "MOBILE", deviceGpu: "Adreno", vramTotalGb: 8,
      taskId: "ll-1", taskName: "LLM inference", taskClass: "LL", model: "Gemma",
      client: "Gemma AI Support", rewardUsdt: 0.25, rewardNex: 0,
      earningStatus: "SETTLED", proofHash: "a".repeat(64),
      startedAt: "2026-08-14T23:59:00Z", completedAt: "2026-08-15T00:00:00Z", durationSec: 60,
      source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "dev");

    await expect(api.receipt("R-CTA-1")).resolves.toMatchObject({
      receiptNo: "R-CTA-1", proofHash: "a".repeat(64), settledAt: Date.parse("2026-08-15T00:00:00Z"),
      sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });
    expect(request).toHaveBeenCalledWith({ path: "/api/tasks/receipts/R-CTA-1" });
  });

  it("rejects a canonical receipt when the response identity differs from the requested receipt", async () => {
    const request = vi.fn().mockResolvedValue({
      receiptNo: "R-CTA-OTHER", taskNo: "CTA-OTHER", deviceId: 7, deviceInstanceNo: "D-7",
      deviceName: "你的手机", deviceType: "MOBILE", deviceGpu: "Adreno", vramTotalGb: 8,
      taskId: "ll-1", taskName: "LLM inference", taskClass: "LL", model: "Gemma",
      client: "Gemma AI Support", rewardUsdt: 0.25, rewardNex: 0,
      earningStatus: "SETTLED", proofHash: "a".repeat(64),
      startedAt: "2026-08-14T23:59:00Z", completedAt: "2026-08-15T00:00:00Z", durationSec: 60,
      source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });

    await expect(createTaskAssignmentApi({ request } as unknown as ApiClient, "prod").receipt("R-CTA-1"))
      .rejects.toMatchObject({ kind: "protocol", message: "TASK_RECEIPT_RESPONSE_INVALID" });
  });

  it("paginates canonical Proof-of-Compute receipt summaries independently of device previews", async () => {
    const request = vi.fn().mockResolvedValue({
      items: [{
        receiptNo: "R-CTA-2", taskNo: "CTA-2", taskClass: "LL", model: "Gemma",
        client: "Gemma AI Support", rewardUsdt: 0.25, rewardNex: 0,
        earningStatus: "SETTLED", completedAt: "2026-08-15T00:00:00Z",
      }],
      nextOffset: 20,
      source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });
    const api = createTaskAssignmentApi({ request } as unknown as ApiClient, "dev");

    await expect(api.receipts(0, 20)).resolves.toMatchObject({
      items: [{ receiptNo: "R-CTA-2", rewardUsdt: 0.25, completedAt: Date.parse("2026-08-15T00:00:00Z") }],
      nextOffset: 20,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      serverCanonical: true,
    });
    expect(request).toHaveBeenCalledWith({ path: "/api/tasks/receipts?offset=0&limit=20" });
  });

  it("rejects an unsettled receipt summary before rendering the history list", async () => {
    const request = vi.fn().mockResolvedValue({
      items: [{
        receiptNo: "R-PENDING", taskNo: "CTA-PENDING", taskClass: "LL", model: "Gemma",
        client: "Gemma AI Support", rewardUsdt: 0.25, rewardNex: 0,
        earningStatus: "PENDING", completedAt: "2026-08-15T00:00:00Z",
      }],
      nextOffset: null,
      source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });

    await expect(createTaskAssignmentApi({ request } as unknown as ApiClient, "prod").receipts())
      .rejects.toMatchObject({ kind: "protocol", message: "TASK_RECEIPT_PAGE_RESPONSE_INVALID" });
  });

  it("rejects a receipt whose proof or canonical provenance is missing", async () => {
    const request = vi.fn().mockResolvedValue({
      receiptNo: "R-CTA-1", taskNo: "CTA-1", deviceId: 7, deviceInstanceNo: "D-7",
      deviceName: "你的手机", deviceType: "MOBILE", deviceGpu: "Adreno", vramTotalGb: 8,
      taskId: "ll-1", taskName: "LLM inference", taskClass: "LL", model: "Gemma",
      client: "Gemma AI Support", rewardUsdt: 0.25, rewardNex: 0,
      earningStatus: "SETTLED", proofHash: "not-a-proof",
      startedAt: "2026-08-14T23:59:00Z", completedAt: "2026-08-15T00:00:00Z", durationSec: 60,
      source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
    });

    await expect(createTaskAssignmentApi({ request } as unknown as ApiClient, "prod").receipt("R-CTA-1"))
      .rejects.toMatchObject({ kind: "protocol", message: "TASK_RECEIPT_RESPONSE_INVALID" });
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
