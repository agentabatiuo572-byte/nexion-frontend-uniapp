import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { matchesRuntimeProvenance, type ServerSourceEnvironment } from "./runtime-provenance";
import type { ApiEnvironment } from "./runtime-config";

export interface TaskExecutionMetadata {
  executionMode?: "MODEL" | "RULE_CYCLE" | "SIMULATED";
  proofKind?: "MODEL_EXECUTION" | "RULE_SETTLEMENT" | "TASK_RECEIPT";
  modelExecuted?: boolean;
}

export interface CanonicalTaskAssignment extends TaskExecutionMetadata {
  taskNo: string;
  deviceId: number;
  taskId: string;
  taskName: string;
  taskClass: "IG" | "VG" | "LL" | "FT" | "EM" | "SP";
  model: string;
  client: string;
  status: "CLAIMED" | "QUEUED" | "RUNNING" | "VERIFYING" | "RECOVERING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";
  rewardUsdt: number;
  rewardAsset?: "USDT" | "UVT";
  rewardAmount?: string;
  requiredSeconds: number;
  startedAt: number | null;
  protocolVersion?: 2 | 3;
  queuedAt?: number | null;
  actualDurationSec?: number | null;
  settlementStatus?: SettlementStatus | "NONE";
  settlementBatchNo?: string | null;
  settledAt?: number | null;
  configVersion?: string;
  pausedAt?: number | null;
  pausedSeconds?: number;
  completableAt: number | null;
  completedAt: number | null;
  receiptNo: string | null;
  proofNonce: string | null;
  proofExpiresAt: number | null;
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface CanonicalTaskDeviceState {
  deviceId: number;
  instanceNo: string;
  deviceType: string;
  lockUntil: number | null;
  currentTask: CanonicalTaskAssignment | null;
  recentTasks: CanonicalTaskAssignment[];
  recoveryPending?: boolean;
  recoveryReason?: "LEGACY_COMPLETE_OUTCOME_UNKNOWN" | null;
  phoneValidUntil?: number | null;
  simulationState?: SimulationState;
}

export type SimulationState = "RUNNING" | "EXPIRED" | "STOPPED" | "WAITING_CONFIG" | "CLOSING" | "ERROR";
export interface CanonicalPhoneOnline {
  serverNow: number;
  deviceId: number;
  phoneValidUntil: number | null;
  simulationState: SimulationState;
}

export interface CanonicalTaskAssignments {
  serverNow: number;
  devices: CanonicalTaskDeviceState[];
  protocolVersion?: 2 | 3;
  pendingEarned?: PendingComputeEarning[];
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface CanonicalComputeReceipt extends TaskExecutionMetadata {
  receiptNo: string;
  displayReceiptNo?: string;
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
  proofHash: string | null;
  receiptHash?: string;
  startedAt: number;
  completedAt: number;
  /** Null when the backend has not supplied an actual posting time. */
  settledAt: number | null;
  durationSec: number;
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface CanonicalComputeReceiptSummary extends TaskExecutionMetadata {
  receiptNo: string;
  displayReceiptNo?: string;
  taskNo: string;
  taskName?: string;
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
  /** Server-validated seek boundary for the next stable receipt page. */
  nextCursor: string | null;
  /** Null means an older compatible server has not exposed a canonical total. */
  total: number | null;
  source: "server";
  sourceEnvironment: ServerSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface TaskAssignmentApi {
  state(preferV2?: boolean): Promise<CanonicalTaskAssignments>;
  confirmPhoneOnline(deviceId: number, installationId: string): Promise<CanonicalPhoneOnline>;
  stopSimulatedTask(deviceId: number, afterCurrent: boolean, installationId?: string): Promise<Omit<CanonicalPhoneOnline, "serverNow">>;
  receipt(receiptNo: string): Promise<CanonicalComputeReceipt>;
  receipts(offset?: number, limit?: number, cursor?: string | null): Promise<CanonicalComputeReceiptPage>;
  settlements(cursor?: string | null, limit?: number): Promise<ComputeSettlementPage>;
  settlement(batchNo: string): Promise<ComputeSettlementDetail>;
}

export type SettlementStatus = "PENDING" | "POSTED" | "BLOCKED";
export interface PendingComputeEarning { asset: "USDT" | "NEX"; amount: string; taskCount: number }
export interface ComputeSettlementBatch extends PendingComputeEarning {
  batchNo: string;
  status: SettlementStatus;
  windowStart: number;
  windowEnd: number;
  postedAt: number | null;
}
export interface ComputeSettlementPage {
  records: ComputeSettlementBatch[];
  nextCursor: string | null;
}
export interface ComputeSettlementDetail extends ComputeSettlementBatch {
  items: { taskNo: string; receiptNo: string | null; deviceId: number; taskType: string; amount: string; completedAt: number }[];
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
    const normalized = value.trim();
    // Java serializes the task-assignment boundary as LocalDateTime. Those
    // values are business-clock facts in Asia/Shanghai, not browser-local
    // timestamps; parsing them with Date.parse alone shifts the business day
    // whenever the viewer is outside UTC+08 (for example Japan at UTC+09).
    const shanghaiLocal = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalized);
    const parsed = Date.parse(shanghaiLocal
      ? `${normalized.replace(" ", "T")}+08:00`
      : normalized);
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

function executionMetadata(source: Record<string, unknown>): TaskExecutionMetadata {
  const executionMode = source.executionMode ?? undefined;
  const proofKind = source.proofKind ?? undefined;
  const modelExecuted = source.modelExecuted ?? undefined;
  if ((executionMode !== undefined && executionMode !== "MODEL" && executionMode !== "RULE_CYCLE" && executionMode !== "SIMULATED")
    || (proofKind !== undefined && proofKind !== "MODEL_EXECUTION" && proofKind !== "RULE_SETTLEMENT" && proofKind !== "TASK_RECEIPT")
    || (modelExecuted !== undefined && typeof modelExecuted !== "boolean")
    || ((executionMode === "RULE_CYCLE" || proofKind === "RULE_SETTLEMENT")
      && (executionMode !== "RULE_CYCLE" || proofKind !== "RULE_SETTLEMENT" || modelExecuted !== false))
    || ((executionMode === "SIMULATED" || proofKind === "TASK_RECEIPT")
      && (executionMode !== "SIMULATED" || proofKind !== "TASK_RECEIPT" || modelExecuted !== false))) return invalid();
  return { executionMode, proofKind, modelExecuted };
}

function task(value: unknown, mode: ApiEnvironment, version = 1): CanonicalTaskAssignment {
  const source = record(value);
  const taskVersion = version === 3 && source.protocolVersion === 2 ? 2 : version;
  const proof = provenance(source, mode);
  const taskClass = text(source.taskClass).toUpperCase();
  const status = text(source.status).toUpperCase();
  if (!/^(IG|VG|LL|FT|EM|SP)$/.test(taskClass)
    || !(taskVersion >= 2 ? /^(CLAIMED|QUEUED|RUNNING|VERIFYING|RECOVERING|PAUSED|COMPLETED|FAILED|CANCELLED)$/ : /^(CLAIMED|RUNNING|PAUSED|COMPLETED)$/).test(status)) return invalid();
  const startedAt = timestamp(source.startedAt, taskVersion >= 2 && source.executionMode !== "SIMULATED");
  const completableAt = timestamp(source.completableAt, taskVersion >= 2 || status === "PAUSED");
  if ((taskVersion < 2 && status !== "PAUSED" && completableAt === null)
    || (completableAt !== null && startedAt !== null && completableAt < startedAt)) return invalid();
  const completedAt = timestamp(source.completedAt, true);
  if (status === "COMPLETED" && completedAt === null) return invalid();
  const rewardAsset = source.rewardAsset === "NEX" ? "UVT" : source.rewardAsset;
  if (source.executionMode === "SIMULATED" && rewardAsset !== "USDT" && rewardAsset !== "UVT") return invalid();
  return {
    taskNo: text(source.taskNo),
    deviceId: integer(source.deviceId, 1),
    taskId: text(source.taskId),
    taskName: text(source.taskName),
    taskClass: taskClass as CanonicalTaskAssignment["taskClass"],
    model: text(source.executionMode === "SIMULATED" ? source.model ?? "" : source.model, true),
    client: text(source.executionMode === "SIMULATED" ? source.client ?? "" : source.client, source.executionMode === "SIMULATED"),
    status: status as CanonicalTaskAssignment["status"],
    rewardUsdt: decimal(source.rewardUsdt),
    ...(source.executionMode === "SIMULATED" ? { rewardAsset: rewardAsset as "USDT" | "UVT", rewardAmount: exactAmount(source.rewardAmount) } : {}),
    requiredSeconds: integer(source.requiredSeconds, 1),
    startedAt,
    pausedAt: timestamp(source.pausedAt, true),
    pausedSeconds: source.pausedSeconds == null ? 0 : integer(source.pausedSeconds),
    completableAt,
    completedAt,
    receiptNo: source.receiptNo == null ? null : text(source.receiptNo),
    proofNonce: source.proofNonce == null ? null : text(source.proofNonce),
    proofExpiresAt: timestamp(source.proofExpiresAt, true),
    ...(taskVersion >= 2 ? {
      protocolVersion: taskVersion as 2 | 3,
      queuedAt: timestamp(source.queuedAt, true),
      actualDurationSec: source.actualDurationSec == null ? null : decimal(source.actualDurationSec),
      settlementStatus: taskVersion === 3 && source.settlementStatus == null ? undefined
        : source.settlementStatus === "NONE" ? "NONE" as const : settlementStatus(source.settlementStatus),
      settlementBatchNo: source.settlementBatchNo == null ? null : text(source.settlementBatchNo),
      settledAt: timestamp(source.settledAt, true),
      configVersion: source.configVersion == null ? undefined : text(String(source.configVersion)),
    } : {}),
    ...executionMetadata(source),
    ...proof,
  };
}

function device(value: unknown, mode: ApiEnvironment, version = 1): CanonicalTaskDeviceState {
  const source = record(value);
  if (!Array.isArray(source.recentTasks)) return invalid();
  const currentTask = source.currentTask == null ? null : task(source.currentTask, mode, version);
  const recentTasks = source.recentTasks.map((entry) => task(entry, mode, version));
  const deviceId = integer(source.deviceId, 1);
  if (currentTask && currentTask.deviceId !== deviceId) return invalid();
  if (recentTasks.some((entry) => entry.deviceId !== deviceId || !(version >= 2 ? ["COMPLETED", "FAILED", "CANCELLED"] : ["COMPLETED"]).includes(entry.status))) return invalid();
  if (version >= 2 && ((source.recoveryPending !== undefined && typeof source.recoveryPending !== "boolean")
    || (source.recoveryReason != null && source.recoveryReason !== "LEGACY_COMPLETE_OUTCOME_UNKNOWN")
    || (source.recoveryReason != null && source.recoveryPending !== true))) return invalid();
  return {
    deviceId,
    instanceNo: text(source.instanceNo),
    deviceType: text(source.deviceType),
    lockUntil: timestamp(source.lockUntil, true),
    currentTask,
    recentTasks,
    ...(version >= 2 ? { recoveryPending: source.recoveryPending === true,
      recoveryReason: source.recoveryReason == null ? null : "LEGACY_COMPLETE_OUTCOME_UNKNOWN" as const } : {}),
    phoneValidUntil: timestamp(source.phoneValidUntil, true),
    simulationState: source.simulationState == null ? undefined : simulationState(source.simulationState),
  };
}

function state(value: unknown, mode: ApiEnvironment, requireV2 = false): CanonicalTaskAssignments {
  const source = record(value);
  const proof = provenance(source, mode);
  if ((requireV2 && source.protocolVersion !== 2) || (source.protocolVersion !== undefined && source.protocolVersion !== 2 && source.protocolVersion !== 3)) return invalid();
  if (!Array.isArray(source.devices)) return invalid();
  const version = source.protocolVersion === 3 ? 3 : source.protocolVersion === 2 ? 2 : 1;
  const devices = source.devices.map((entry) => device(entry, mode, version)).filter(entry => !["PHONE", "MOBILE"].includes(entry.deviceType.toUpperCase()));
  if (new Set(devices.map((entry) => entry.deviceId)).size !== devices.length) return invalid();
  if (version === 2 && !Array.isArray(source.pendingEarned)) return invalid();
  if (source.pendingEarned != null && !Array.isArray(source.pendingEarned)) return invalid();
  const pendingEarned = Array.isArray(source.pendingEarned) ? source.pendingEarned.map(pendingEarning) : undefined;
  if (pendingEarned && new Set(pendingEarned.map((row) => row.asset)).size !== pendingEarned.length) return invalid();
  return { serverNow: timestamp(source.serverNow) as number, devices, ...(version >= 2 ? { protocolVersion: version as 2 | 3, pendingEarned } : {}), ...proof };
}

function simulationState(value: unknown): SimulationState {
  if (value !== "RUNNING" && value !== "EXPIRED" && value !== "STOPPED"
    && value !== "WAITING_CONFIG" && value !== "CLOSING" && value !== "ERROR") return invalid();
  return value;
}

function settlementStatus(value: unknown): SettlementStatus {
  const status = text(value);
  if (status !== "PENDING" && status !== "POSTED" && status !== "BLOCKED") return invalid();
  return status;
}

function exactAmount(value: unknown): string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,11})\.\d{6}$/.test(value)) return invalid();
  return value;
}

function pendingEarning(value: unknown): PendingComputeEarning {
  const source = record(value);
  if (source.asset !== "USDT" && source.asset !== "NEX") return invalid();
  return { asset: source.asset, amount: exactAmount(source.amount), taskCount: integer(source.taskCount) };
}

function settlementBatch(value: unknown): ComputeSettlementBatch {
  const source = record(value);
  const windowStart = timestamp(source.windowStart) as number;
  const windowEnd = timestamp(source.windowEnd) as number;
  if (windowEnd < windowStart) return invalid();
  const status = settlementStatus(source.status);
  const postedAt = timestamp(source.postedAt, true);
  if (status === "POSTED" && postedAt === null) return invalid();
  return { ...pendingEarning(source), batchNo: text(source.batchNo), status, windowStart, windowEnd, postedAt };
}

function receipt(value: unknown, mode: ApiEnvironment): CanonicalComputeReceipt {
  const source = record(value);
  const proof = provenance(source, mode);
  const taskClass = text(source.taskClass).toUpperCase();
  const metadata = executionMetadata(source);
  const proofHash = metadata.executionMode === "SIMULATED" && source.proofHash == null ? null : text(source.proofHash).toLowerCase();
  const receiptHash = source.receiptHash == null ? undefined : text(source.receiptHash);
  if (!/^(IG|VG|LL|FT|EM|SP)$/.test(taskClass) || (proofHash !== null && !/^[a-f0-9]{64,128}$/.test(proofHash))
    || (receiptHash !== undefined && (metadata.executionMode !== "SIMULATED" || !/^[a-f0-9]{64}$/.test(receiptHash)))
    || (metadata.executionMode === "SIMULATED" && proofHash !== null)) {
    return invalid("TASK_RECEIPT_RESPONSE_INVALID");
  }
  const startedAt = timestamp(source.startedAt) as number;
  const completedAt = timestamp(source.completedAt) as number;
  const settledAt = timestamp(source.settledAt, true);
  const durationSec = integer(source.durationSec);
  if (completedAt < startedAt) return invalid("TASK_RECEIPT_RESPONSE_INVALID");
  return {
    receiptNo: text(source.receiptNo),
    displayReceiptNo: source.displayReceiptNo == null ? undefined : text(source.displayReceiptNo),
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
    model: text(metadata.executionMode === "SIMULATED" ? source.model ?? "" : source.model, true),
    client: text(metadata.executionMode === "SIMULATED" ? source.client ?? "" : source.client, metadata.executionMode === "SIMULATED"),
    rewardUsdt: decimal(source.rewardUsdt),
    rewardNex: decimal(source.rewardNex),
    earningStatus: text(source.earningStatus),
    proofHash,
    receiptHash,
    startedAt,
    completedAt,
    // The legacy detail constructor copies completedAt into settledAt. It does
    // not establish a posting time; Task Center can supply the v2 projection.
    settledAt: metadata.executionMode !== "SIMULATED" && settledAt === completedAt ? null : settledAt,
    durationSec,
    ...metadata,
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
    displayReceiptNo: source.displayReceiptNo == null ? undefined : text(source.displayReceiptNo),
    taskNo: text(source.taskNo),
    taskName: source.taskName == null ? undefined : text(source.taskName),
    taskClass: taskClass as CanonicalTaskAssignment["taskClass"],
    model: text(source.executionMode === "SIMULATED" ? source.model ?? "" : source.model, true),
    client: text(source.executionMode === "SIMULATED" ? source.client ?? "" : source.client, source.executionMode === "SIMULATED"),
    rewardUsdt: decimal(source.rewardUsdt),
    rewardNex: decimal(source.rewardNex),
    earningStatus,
    completedAt: timestamp(source.completedAt) as number,
    ...executionMetadata(source),
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
  const nextCursor = source.nextCursor == null ? null : text(source.nextCursor);
  const total = source.total == null ? null : integer(source.total);
  if (total !== null && total < items.length) return invalid("TASK_RECEIPT_PAGE_RESPONSE_INVALID");
  return { items, nextOffset, nextCursor, total, ...proof };
}

export function createTaskAssignmentApi(client: ApiClient, mode: ApiEnvironment): TaskAssignmentApi {
  return {
    async state(preferV2 = false) {
      const current = state(await client.request<unknown>({ path: "/api/tasks/assignments" }), mode);
      if (current.protocolVersion === 3) return current;
      if (preferV2) {
        try { return state(await client.request<unknown>({ path: "/api/tasks/v2/assignments" }), mode, true); }
        catch (cause) {
          if (!(cause instanceof ApiError) || cause.kind !== "http" || (cause.status !== 404 && cause.status !== 501)) throw cause;
        }
      }
      return current;
    },
    async settlements(cursor = null, limit = 20) {
      const normalizedLimit = integer(limit, 1);
      if (normalizedLimit > 50) return invalid();
      const source = record(await client.request<unknown>({ path: `/api/tasks/v2/settlements?limit=${normalizedLimit}` + (cursor == null ? "" : `&cursor=${encodeURIComponent(text(cursor))}`) }));
      provenance(source, mode);
      if (!Array.isArray(source.records)) return invalid();
      const records = source.records.map(settlementBatch);
      if (new Set(records.map((row) => row.batchNo)).size !== records.length) return invalid();
      return { records, nextCursor: source.nextCursor == null ? null : text(source.nextCursor) };
    },
    async settlement(batchNo) {
      const expectedBatch = text(batchNo);
      const source = record(await client.request<unknown>({ path: `/api/tasks/v2/settlements/${encodeURIComponent(expectedBatch)}` }));
      provenance(source, mode);
      const batch = settlementBatch(source);
      if (batch.batchNo !== expectedBatch || !Array.isArray(source.items)) return invalid();
      const items = source.items.map((value) => {
        const row = record(value);
        return { taskNo: text(row.taskNo), receiptNo: row.receiptNo == null ? null : text(row.receiptNo), deviceId: integer(row.deviceId, 1), taskType: text(row.taskType), amount: exactAmount(row.amount), completedAt: timestamp(row.completedAt) as number };
      });
      if (items.length !== batch.taskCount || new Set(items.map((row) => row.taskNo)).size !== items.length) return invalid();
      if (items.length > 200 || items.reduce((sum, row) => sum + BigInt(row.amount.replace(".", "")), BigInt(0)) !== BigInt(batch.amount.replace(".", ""))) return invalid();
      return { ...batch, items };
    },
    async confirmPhoneOnline(deviceId, installationId) {
      const expectedDeviceId = integer(deviceId, 1);
      const source = record(await client.request<unknown>({
        path: "/api/tasks/simulated/phone-online",
        method: "POST",
        headers: { "X-Phone-Installation-Id": text(installationId) },
        body: { deviceId: expectedDeviceId },
      }));
      if (integer(source.deviceId, 1) !== expectedDeviceId) return invalid();
      return { deviceId: expectedDeviceId, serverNow: timestamp(source.serverNow) as number,
        phoneValidUntil: timestamp(source.phoneValidUntil, true), simulationState: simulationState(source.simulationState) };
    },
    async stopSimulatedTask(deviceId, afterCurrent, installationId) {
      const expectedDeviceId = integer(deviceId, 1);
      if (typeof afterCurrent !== "boolean") return invalid();
      const source = record(await client.request<unknown>({
        path: "/api/tasks/simulated/stop", method: "POST", body: { deviceId: expectedDeviceId, afterCurrent },
        ...(installationId === undefined ? {} : { headers: { "X-Phone-Installation-Id": text(installationId) } }),
      }));
      if (integer(source.deviceId, 1) !== expectedDeviceId) return invalid();
      return { deviceId: expectedDeviceId, phoneValidUntil: timestamp(source.phoneValidUntil, true),
        simulationState: simulationState(source.simulationState) };
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
    async receipts(offset = 0, limit = 20, cursor = null) {
      const normalizedOffset = integer(offset);
      const normalizedLimit = integer(limit, 1);
      const normalizedCursor = cursor == null ? null : text(cursor);
      if (normalizedOffset > 1_000_000 || normalizedLimit > 50) {
        throw new ApiError({ kind: "configuration", message: "TASK_RECEIPT_PAGE_INVALID" });
      }
      return receiptPage(await client.request<unknown>({
        path: `/api/tasks/receipts?offset=${normalizedOffset}&limit=${normalizedLimit}`
          + (normalizedCursor === null ? "" : `&cursor=${encodeURIComponent(normalizedCursor)}`),
      }), mode);
    },
  };
}
