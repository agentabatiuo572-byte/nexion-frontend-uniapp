import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { PHONE_EMBEDDING_MODEL as model } from "@/lib/phone-embedding-model";

export interface PhoneComputeTask {
  protocolVersion: 3; state: string; taskNo: string; generation: number; inputHash: string;
  claimToken: string; proofNonce: string; modelDigest: string; modelRevision: string;
  taskClass: "EM"; runtimeKey: "phone-minilm-wasm-v1"; seed: number; startedAt: string;
  executionTimeoutSec: number;
  workload: { inputIds: number[][]; attentionMask: number[][]; tokenTypeIds: number[][]; texts?: string[] };
}
export interface PhoneComputeResult { resultHash: string; resultArtifactBase64: string; actualDurationMs: number }
export type PhoneExitReason = "COMPLETED" | "APP_PAUSED" | "PHONE_LOW_BATTERY" | "PHONE_OFFLINE" | "WORKER_ERROR";
export interface PhoneComputeReceipt { taskNo: string; generation: number; inputHash: string; startedAt: string; state: "COMPLETED" | "FAILED" | "IN_PROGRESS"; exitConfirmed: boolean; resultHash?: string }

export function createPhoneComputeApi(client: ApiClient) {
  const call = <T>(action: string, body: unknown, timeoutMs = 15_000) => client.request<T>({
    path: `/api/app/compute-v2/phone/${action}`, method: "POST", body, timeoutMs,
  });
  const identity = (task: PhoneComputeTask) => ({ taskNo: task.taskNo, generation: task.generation, claimToken: task.claimToken });
  return {
    async next(): Promise<PhoneComputeTask | null> {
      const response = await call<PhoneComputeTask | { state: "IDLE" }>("next", {
        runtimeKey: model.runtimeKey, modelRevision: model.modelRevision, modelDigest: model.modelDigest,
        modelSha256: model.modelSha256, engineReady: true, enginePlatform: "app-plus",
      });
      if (response.state === "IDLE") return null;
      const task = response as PhoneComputeTask;
      if (task.protocolVersion !== 3 || task.taskClass !== "EM" || task.runtimeKey !== model.runtimeKey
        || task.modelRevision !== model.modelRevision || task.modelDigest !== model.modelDigest
        || !/^CV2-[0-9A-F]{32}$/.test(task.taskNo) || !Number.isSafeInteger(task.generation) || task.generation <= 0
        || !/^[a-f0-9]{64}$/.test(task.inputHash) || typeof task.claimToken !== "string" || !task.claimToken
        || typeof task.proofNonce !== "string" || !task.proofNonce || !task.workload
        || !Number.isInteger(task.executionTimeoutSec) || task.executionTimeoutSec <= 0)
        throw new ApiError({ kind: "protocol", message: "PHONE_COMPUTE_TASK_INVALID" });
      return task;
    },
    heartbeat: (task: PhoneComputeTask) => call<{ state: string }>("heartbeat", identity(task)),
    async complete(task: PhoneComputeTask, result: PhoneComputeResult) {
      const response = await call<PhoneComputeReceipt>("complete", {
        ...identity(task), proofNonce: task.proofNonce, inputHash: task.inputHash, modelDigest: task.modelDigest,
        resultHash: result.resultHash, resultArtifactBase64: result.resultArtifactBase64, proofTimestamp: Math.floor(Date.now() / 1000),
      }, 120_000);
      if (response.state !== "COMPLETED" || response.taskNo !== task.taskNo || response.generation !== task.generation
        || response.inputHash !== task.inputHash || response.resultHash !== result.resultHash || response.startedAt !== task.startedAt)
        throw new ApiError({ kind: "protocol", message: "PHONE_COMPUTE_COMPLETION_UNCONFIRMED" });
      return response;
    },
    async receipt(task: PhoneComputeTask): Promise<PhoneComputeReceipt> {
      const receipt = await call<PhoneComputeReceipt>("receipt", identity(task));
      if (receipt.taskNo !== task.taskNo || receipt.generation !== task.generation || receipt.inputHash !== task.inputHash || receipt.startedAt !== task.startedAt
        || !["COMPLETED", "FAILED", "IN_PROGRESS"].includes(receipt.state) || typeof receipt.exitConfirmed !== "boolean")
        throw new ApiError({ kind: "protocol", message: "PHONE_COMPUTE_RECEIPT_INVALID" });
      return receipt;
    },
    async exited(task: PhoneComputeTask, reason: PhoneExitReason) {
      const response = await call<{ state: string; taskNo: string }>("exited", { ...identity(task), workerExited: true, exitReason: reason });
      if (response.state !== "EXIT_CONFIRMED" || response.taskNo !== task.taskNo)
        throw new ApiError({ kind: "protocol", message: "PHONE_COMPUTE_EXIT_UNCONFIRMED" });
      return response;
    },
  };
}
