import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";
import { matchesRuntimeProvenance } from "./runtime-provenance";

export interface DeveloperApiKey { id: number; keyId: string; name: string; prefix: string; last4: string; status: "ACTIVE" | "REVOKED"; source: "server"; sourceEnvironment: "SANDBOX" | "PRODUCTION"; runId: string; createdAt: string; revokedAt?: string; secret?: string }
export type DeveloperWebhookDeliveryStatus = "NOT_DELIVERED" | "PENDING" | "DELIVERING" | "RETRYING" | "SUCCEEDED" | "DEAD";
export interface DeveloperWebhook { id: number; name: string; url: string; events: string[]; status: "ACTIVE" | "DISABLED" | "DELETED"; deliveryStatus: DeveloperWebhookDeliveryStatus; deliveryEnabled: boolean; source: "server"; sourceEnvironment: "SANDBOX" | "PRODUCTION"; runId: string; createdAt: string; secret?: string }
export interface DeveloperResourcesApi {
  listKeys(): Promise<DeveloperApiKey[]>;
  createKey(name: string, idempotencyKey: string): Promise<DeveloperApiKey>;
  revokeKey(id: number, idempotencyKey: string): Promise<DeveloperApiKey>;
  listWebhooks(): Promise<DeveloperWebhook[]>;
  createWebhook(input: { name: string; url: string; events: string[] }, idempotencyKey: string): Promise<DeveloperWebhook>;
  updateWebhook(id: number, input: { name: string; url: string; events: string[]; rotateSecret: boolean }, idempotencyKey: string): Promise<DeveloperWebhook>;
  deleteWebhook(id: number, idempotencyKey: string): Promise<void>;
}
const EVENTS = new Set(["order.updated", "order.completed", "compute.job.completed", "compute.job.failed", "earnings.updated", "billing.invoice.created", "market.updated", "account.updated"]);
function invalid(message = "DEVELOPER_RESOURCE_RESPONSE_INVALID"): never { throw new ApiError({ kind: "protocol", message }); }
function key(value: unknown, mode: ApiEnvironment): DeveloperApiKey { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); const row = value as Record<string, unknown>; if (typeof row.id !== "number" || typeof row.keyId !== "string" || typeof row.name !== "string" || typeof row.prefix !== "string" || typeof row.last4 !== "string" || (row.status !== "ACTIVE" && row.status !== "REVOKED") || !matchesRuntimeProvenance(row, mode, "server") || typeof row.createdAt !== "string") return invalid(); return row as unknown as DeveloperApiKey; }
function webhook(value: unknown, mode: ApiEnvironment): DeveloperWebhook { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("DEVELOPER_WEBHOOK_RESPONSE_INVALID"); const row = value as Record<string, unknown>; const statuses = new Set(["NOT_DELIVERED", "PENDING", "DELIVERING", "RETRYING", "SUCCEEDED", "DEAD"]); if (typeof row.id !== "number" || typeof row.name !== "string" || typeof row.url !== "string" || !Array.isArray(row.events) || row.events.some((e) => typeof e !== "string" || !EVENTS.has(e)) || (row.status !== "ACTIVE" && row.status !== "DISABLED" && row.status !== "DELETED") || typeof row.deliveryStatus !== "string" || !statuses.has(row.deliveryStatus) || typeof row.deliveryEnabled !== "boolean" || !matchesRuntimeProvenance(row, mode, "server") || typeof row.createdAt !== "string") return invalid("DEVELOPER_WEBHOOK_RESPONSE_INVALID"); return row as unknown as DeveloperWebhook; }
export function createDeveloperResourcesApi(client: ApiClient, mode: ApiEnvironment = "prod"): DeveloperResourcesApi { return {
  async listKeys() { const value = await client.request<unknown>({ path: "/api/app/developer/api-keys" }); if (!Array.isArray(value)) return invalid(); return value.map(item => key(item, mode)); },
  async createKey(name, idempotencyKey) { return key(await client.request<unknown>({ path: "/api/app/developer/api-keys", method: "POST", body: { name }, idempotencyKey }), mode); },
  async revokeKey(id, idempotencyKey) { return key(await client.request<unknown>({ path: `/api/app/developer/api-keys/${id}`, method: "DELETE", idempotencyKey }), mode); },
  async listWebhooks() { const value = await client.request<unknown>({ path: "/api/app/developer/webhooks" }); if (!Array.isArray(value)) return invalid("DEVELOPER_WEBHOOK_RESPONSE_INVALID"); return value.map(item => webhook(item, mode)); },
  async createWebhook(input, idempotencyKey) { return webhook(await client.request<unknown>({ path: "/api/app/developer/webhooks", method: "POST", body: { ...input, eventsJson: JSON.stringify(input.events) }, idempotencyKey }), mode); },
  async updateWebhook(id, input, idempotencyKey) { return webhook(await client.request<unknown>({ path: `/api/app/developer/webhooks/${id}`, method: "PUT", body: { ...input, eventsJson: JSON.stringify(input.events) }, idempotencyKey }), mode); },
  async deleteWebhook(id, idempotencyKey) { await client.request<unknown>({ path: `/api/app/developer/webhooks/${id}`, method: "DELETE", idempotencyKey }); },
}; }
