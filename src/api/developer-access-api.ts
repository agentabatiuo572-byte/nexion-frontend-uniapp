import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";
import { matchesRuntimeProvenance } from "./runtime-provenance";

export type DeveloperAccessStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface DeveloperAccessReceipt { requestNo: string; idempotencyKey: string; status: DeveloperAccessStatus; submittedAt: string; source: "server"; sourceEnvironment: "SANDBOX" | "PRODUCTION"; runId: string }
export interface DeveloperAccessApi {
  submit(input: { company: string; email: string; useCase: string }, key: string): Promise<DeveloperAccessReceipt>;
  latest(): Promise<DeveloperAccessReceipt | null>;
}
function invalid(): never { throw new ApiError({ kind: "protocol", message: "DEVELOPER_ACCESS_RESPONSE_INVALID" }); }
function receipt(value: unknown, mode: ApiEnvironment, nullable = false): DeveloperAccessReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  const provenanceValid = matchesRuntimeProvenance(row, mode, "server");
  if (nullable && row.status === "NONE" && provenanceValid) return null;
  if (typeof row.requestNo !== "string" || !row.requestNo.trim() || typeof row.idempotencyKey !== "string" || !row.idempotencyKey.trim()
      || (row.status !== "PENDING" && row.status !== "APPROVED" && row.status !== "REJECTED") || typeof row.submittedAt !== "string"
      || !Number.isFinite(Date.parse(row.submittedAt)) || row.source !== "server" || !provenanceValid) return invalid();
  return { requestNo: row.requestNo.trim(), idempotencyKey: row.idempotencyKey.trim(), status: row.status, submittedAt: row.submittedAt, source: "server", sourceEnvironment: row.sourceEnvironment, runId: row.runId };
}
export function createDeveloperAccessApi(client: ApiClient, mode: ApiEnvironment = "prod"): DeveloperAccessApi { return {
  async submit(input, key) { return receipt(await client.request<unknown>({ path: "/api/app/developer/access-requests", method: "POST", body: input, idempotencyKey: key }), mode) as DeveloperAccessReceipt; },
  async latest() { return receipt(await client.request<unknown>({ path: "/api/app/developer/access-requests/latest" }), mode, true); },
}; }
