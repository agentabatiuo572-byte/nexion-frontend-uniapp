import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { matchesRuntimeProvenance, type ServerSourceEnvironment } from "./runtime-provenance";
import type { ApiEnvironment } from "./runtime-config";

export interface CanonicalTaskAssignment {
  taskNo: string;
  deviceId: number;
  taskId: string;
  taskName: string;
  taskClass: "IG" | "VG" | "LL" | "FT" | "EM" | "SP";
  model: string;
  client: string;
  status: "CLAIMED" | "RUNNING" | "COMPLETED";
  rewardUsdt: number;
  requiredSeconds: number;
  startedAt: number;
  completableAt: number;
  completedAt: number | null;
  receiptNo: string | null;
  proofNonce: string | null;
  proofExpiresAt: number | null;
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface TrustedTaskCompletionProof {
  resultHash: string;
  proofMode: "PRODUCTION" | "SANDBOX";
  executorId: string;
  proofNonce: string;
  proofTimestamp: number;
  proofSignature: string;
}

export interface CanonicalTaskDeviceState {
  deviceId: number;
  instanceNo: string;
  deviceType: string;
  lockUntil: number | null;
  currentTask: CanonicalTaskAssignment | null;
  recentTasks: CanonicalTaskAssignment[];
}

export interface CanonicalTaskAssignments {
  serverNow: number;
  devices: CanonicalTaskDeviceState[];
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface CanonicalComputeReceipt {
  receiptNo: string;
  taskNo: string;
  deviceId: number;
  deviceInstanceNo: string;
  deviceName: string;
  deviceType: string;
  deviceGpu: string;
  vramTotalGb: number | null;
  taskId: string;
  taskName: string;
  taskClass: CanonicalTaskAssignment["taskClass"];
  model: string;
  client: string;
  rewardUsdt: number;
  rewardNex: number;
  earningStatus: string;
  proofHash: string;
  startedAt: number;
  completedAt: number;
  settledAt: number;
  durationSec: number;
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface CanonicalComputeReceiptSummary {
  receiptNo: string;
  taskNo: string;
  taskClass: CanonicalTaskAssignment["taskClass"];
  model: string;
  client: string;
  rewardUsdt: number;
  rewardNex: number;
  earningStatus: string;
  completedAt: number;
}

export interface CanonicalComputeReceiptPage {
  items: CanonicalComputeReceiptSummary[];
  nextOffset: number | null;
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface TaskAssignmentApi {
  state(): Promise<CanonicalTaskAssignments>;
  receipt(receiptNo: string): Promise<CanonicalComputeReceipt>;
  receipts(offset?: number, limit?: number): Promise<CanonicalComputeReceiptPage>;
  claim(deviceId: number, idempotencyKey: string): Promise<CanonicalTaskAssignment>;
  complete(taskNo: string, proof: TrustedTaskCompletionProof, idempotencyKey: string): Promise<CanonicalTaskAssignment>;
}

function invalid(message = "TASK_ASSIGNMENT_RESPONSE_INVALID"): never {
  throw new ApiError({ kind: "protocol", message });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown, optional = false): string {
  if (typeof value !== "string") return invalid();
  const normalized = value.trim();
  if (!optional && !normalized) return invalid();
  return normalized;
}

function integer(value: unknown, minimum = 0): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < minimum) return invalid();
  return parsed;
}

function decimal(value: unknown): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) return invalid();
  return parsed;
}

function timestamp(value: unknown, optional = false): number | null {
  if (optional && (value === null || value === undefined || value === "")) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return invalid();
}

function provenance(source: Record<string, unknown>, mode: ApiEnvironment): {
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
} {
  if (source.serverCanonical !== true || !matchesRuntimeProvenance(source, mode, "server")) {
    return invalid("TASK_ASSIGNMENT_PROVENANCE_INVALID");
  }
  return {
    source: "server",
    sourceEnvironment: source.sourceEnvironment,
    runId: source.runId,
    serverCanonical: true,
  };
}

function task(value: unknown, mode: ApiEnvironment): CanonicalTaskAssignment {
  const source = record(value);
  const proof = provenance(source, mode);
  const taskClass = text(source.taskClass).toUpperCase();
  const status = text(source.status).toUpperCase();
  if (!/^(IG|VG|LL|FT|EM|SP)$/.test(taskClass) || !/^(CLAIMED|RUNNING|COMPLETED)$/.test(status)) return invalid();
  const startedAt = timestamp(source.startedAt) as number;
  const completableAt = timestamp(source.completableAt) as number;
  if (completableAt < startedAt) return invalid();
  return {
    taskNo: text(source.taskNo),
    deviceId: integer(source.deviceId, 1),
    taskId: text(source.taskId),
    taskName: text(source.taskName),
    taskClass: taskClass as CanonicalTaskAssignment["taskClass"],
    model: text(source.model, true),
    client: text(source.client),
    status: status as CanonicalTaskAssignment["status"],
    rewardUsdt: decimal(source.rewardUsdt),
    requiredSeconds: integer(source.requiredSeconds, 1),
    startedAt,
    completableAt,
    completedAt: timestamp(source.completedAt, true),
    receiptNo: source.receiptNo == null ? null : text(source.receiptNo),
    proofNonce: source.proofNonce == null ? null : text(source.proofNonce),
    proofExpiresAt: timestamp(source.proofExpiresAt, true),
    ...proof,
  };
}

function device(value: unknown, mode: ApiEnvironment): CanonicalTaskDeviceState {
  const source = record(value);
  if (!Array.isArray(source.recentTasks)) return invalid();
  const currentTask = source.currentTask == null ? null : task(source.currentTask, mode);
  const recentTasks = source.recentTasks.map((entry) => task(entry, mode));
  const deviceId = integer(source.deviceId, 1);
  if (currentTask && currentTask.deviceId !== deviceId) return invalid();
  if (recentTasks.some((entry) => entry.deviceId !== deviceId || entry.status !== "COMPLETED")) return invalid();
  return {
    deviceId,
    instanceNo: text(source.instanceNo),
    deviceType: text(source.deviceType),
    lockUntil: timestamp(source.lockUntil, true),
    currentTask,
    recentTasks,
  };
}

function state(value: unknown, mode: ApiEnvironment): CanonicalTaskAssignments {
  const source = record(value);
  const proof = provenance(source, mode);
  if (!Array.isArray(source.devices)) return invalid();
  const devices = source.devices.map((entry) => device(entry, mode));
  if (new Set(devices.map((entry) => entry.deviceId)).size !== devices.length) return invalid();
  return { serverNow: timestamp(source.serverNow) as number, devices, ...proof };
}

function receipt(value: unknown, mode: ApiEnvironment): CanonicalComputeReceipt {
  const source = record(value);
  const proof = provenance(source, mode);
  const taskClass = text(source.taskClass).toUpperCase();
  const proofHash = text(source.proofHash).toLowerCase();
  if (!/^(IG|VG|LL|FT|EM|SP)$/.test(taskClass) || !/^[a-f0-9]{64,128}$/.test(proofHash)) {
    return invalid("TASK_RECEIPT_RESPONSE_INVALID");
  }
  const startedAt = timestamp(source.startedAt) as number;
  const completedAt = timestamp(source.completedAt) as number;
  const durationSec = integer(source.durationSec);
  if (completedAt < startedAt) return invalid("TASK_RECEIPT_RESPONSE_INVALID");
  return {
    receiptNo: text(source.receiptNo),
    taskNo: text(source.taskNo),
    deviceId: integer(source.deviceId, 1),
    deviceInstanceNo: text(source.deviceInstanceNo),
    deviceName: text(source.deviceName),
    deviceType: text(source.deviceType),
    deviceGpu: text(source.deviceGpu, true),
    vramTotalGb: source.vramTotalGb == null ? null : integer(source.vramTotalGb),
    taskId: text(source.taskId),
    taskName: text(source.taskName),
    taskClass: taskClass as CanonicalTaskAssignment["taskClass"],
    model: text(source.model, true),
    client: text(source.client),
    rewardUsdt: decimal(source.rewardUsdt),
    rewardNex: decimal(source.rewardNex),
    earningStatus: text(source.earningStatus),
    proofHash,
    startedAt,
    completedAt,
    settledAt: completedAt,
    durationSec,
    ...proof,
  };
}

function receiptSummary(value: unknown): CanonicalComputeReceiptSummary {
  const source = record(value);
  const taskClass = text(source.taskClass).toUpperCase();
  const earningStatus = text(source.earningStatus).toUpperCase();
  if (!/^(IG|VG|LL|FT|EM|SP)$/.test(taskClass)
      || !/^(POSTED|SUCCESS|SETTLED|CREDITED|PAID)$/.test(earningStatus)) {
    return invalid("TASK_RECEIPT_PAGE_RESPONSE_INVALID");
  }
  return {
    receiptNo: text(source.receiptNo),
    taskNo: text(source.taskNo),
    taskClass: taskClass as CanonicalTaskAssignment["taskClass"],
    model: text(source.model, true),
    client: text(source.client),
    rewardUsdt: decimal(source.rewardUsdt),
    rewardNex: decimal(source.rewardNex),
    earningStatus,
    completedAt: timestamp(source.completedAt) as number,
  };
}

function receiptPage(value: unknown, mode: ApiEnvironment): CanonicalComputeReceiptPage {
  const source = record(value);
  const proof = provenance(source, mode);
  if (!Array.isArray(source.items)) return invalid("TASK_RECEIPT_PAGE_RESPONSE_INVALID");
  const items = source.items.map(receiptSummary);
  if (new Set(items.map((item) => item.receiptNo)).size !== items.length) {
    return invalid("TASK_RECEIPT_PAGE_RESPONSE_INVALID");
  }
  const nextOffset = source.nextOffset == null ? null : integer(source.nextOffset);
  return { items, nextOffset, ...proof };
}

function key(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ApiError({ kind: "configuration", message: "IDEMPOTENCY_KEY_REQUIRED" });
  return normalized;
}

export function createTaskAssignmentApi(client: ApiClient, mode: ApiEnvironment): TaskAssignmentApi {
  return {
    async state() {
      return state(await client.request<unknown>({ path: "/api/tasks/assignments" }), mode);
    },
    async receipt(receiptNo) {
      const normalizedReceiptNo = text(receiptNo);
      const detail = receipt(await client.request<unknown>({
        path: `/api/tasks/receipts/${encodeURIComponent(normalizedReceiptNo)}`,
      }), mode);
      if (detail.receiptNo !== normalizedReceiptNo) {
        return invalid("TASK_RECEIPT_RESPONSE_INVALID");
      }
      return detail;
    },
    async receipts(offset = 0, limit = 20) {
      const normalizedOffset = integer(offset);
      const normalizedLimit = integer(limit, 1);
      if (normalizedOffset > 1_000_000 || normalizedLimit > 50) {
        throw new ApiError({ kind: "configuration", message: "TASK_RECEIPT_PAGE_INVALID" });
      }
      return receiptPage(await client.request<unknown>({
        path: `/api/tasks/receipts?offset=${normalizedOffset}&limit=${normalizedLimit}`,
      }), mode);
    },
    async claim(deviceId, idempotencyKey) {
      if (mode === "dev") {
        throw new ApiError({ kind: "configuration", message: "TASK_ASSIGNMENT_SANDBOX_CLAIM_DISABLED" });
      }
      return task(await client.request<unknown>({
        method: "POST",
        path: "/api/tasks/assignments/claim",
        body: { deviceId: integer(deviceId, 1) },
        idempotencyKey: key(idempotencyKey),
      }), mode);
    },
    async complete(taskNo, proof, idempotencyKey) {
      const normalizedTaskNo = text(taskNo);
      if (mode === "dev") {
        throw new ApiError({ kind: "configuration", message: "TASK_ASSIGNMENT_SANDBOX_PROOF_DISABLED" });
      }
      const proofMode = proof && text(proof.proofMode).toUpperCase();
      if (!proof || proofMode !== "PRODUCTION" || !/^[a-f0-9]{64}$/i.test(text(proof.resultHash))
          || !/^[a-f0-9]{64}$/i.test(text(proof.proofNonce))
          || !Number.isSafeInteger(proof.proofTimestamp) || proof.proofTimestamp <= 0
          || !text(proof.executorId) || !text(proof.proofSignature)) {
        if (proof && proofMode === "SANDBOX") {
          throw new ApiError({ kind: "configuration", message: "TASK_ASSIGNMENT_PRODUCTION_PROOF_REQUIRED" });
        }
        throw new ApiError({ kind: "configuration", message: "TASK_ASSIGNMENT_PROOF_INVALID" });
      }
      return task(await client.request<unknown>({
        method: "POST",
        path: `/api/tasks/assignments/${encodeURIComponent(normalizedTaskNo)}/complete`,
        body: {
          resultHash: proof.resultHash.toLowerCase(),
          proofMode: "PRODUCTION",
          executorId: text(proof.executorId),
          proofNonce: proof.proofNonce.toLowerCase(),
          proofTimestamp: proof.proofTimestamp,
          proofSignature: text(proof.proofSignature),
        },
        idempotencyKey: key(idempotencyKey),
      }), mode);
    },
  };
}
