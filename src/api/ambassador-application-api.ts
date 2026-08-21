import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
export type AmbassadorEnvironment = "PRODUCTION";

export interface AmbassadorPolicyBucket {
  id: "venue" | "kol" | "print" | "dev";
  title: string;
  range: string;
  rule: string;
  minBudgetUsdt: number;
  maxBudgetUsdt: number;
}

export interface AmbassadorPolicy {
  policyVersion: string;
  revision: number;
  defaultBudgetUsdt: number;
  buckets: AmbassadorPolicyBucket[];
  source: "server";
  sourceEnvironment: "PRODUCTION";
  runId: string;
}

export type AmbassadorApplicationStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export interface AmbassadorApplication {
  applicationId: number | null;
  status: AmbassadorApplicationStatus;
  city: string | null;
  eventDate: string | null;
  budgetUsdt: number | null;
  bucket: "venue" | "kol" | "print" | "dev" | null;
  submittedAt: string | null;
  source: "server";
  sourceEnvironment: "PRODUCTION";
  runId: string;
}

export interface AmbassadorApplicationInput {
  eventDate: string;
  city: string;
  budgetUsdt: number;
  bucket: "venue" | "kol" | "print" | "dev";
}

export interface AmbassadorApplicationApi {
  policy(): Promise<AmbassadorPolicy>;
  latest(): Promise<AmbassadorApplication>;
  submit(input: AmbassadorApplicationInput, idempotencyKey: string): Promise<AmbassadorApplication>;
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "AMBASSADOR_APPLICATION_RESPONSE_INVALID" });
}

function provenance(row: Record<string, unknown>, expectedEnvironment: AmbassadorEnvironment = "PRODUCTION"): { sourceEnvironment: "PRODUCTION"; runId: string } {
  const environment = row.sourceEnvironment;
  const runId = row.runId;
  if (row.source !== "server" || environment !== expectedEnvironment || typeof runId !== "string" || runId !== "") return invalid();
  return { sourceEnvironment: "PRODUCTION", runId: "" };
}

export function parseAmbassadorPolicy(value: unknown, expectedEnvironment?: AmbassadorEnvironment): AmbassadorPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  const proof = provenance(row, expectedEnvironment);
  const rawBuckets = row.buckets;
  if (typeof row.policyVersion !== "string" || !row.policyVersion.trim()
    || typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision <= 0
    || typeof row.defaultBudgetUsdt !== "number" || !Number.isFinite(row.defaultBudgetUsdt) || row.defaultBudgetUsdt <= 0
    || !Array.isArray(rawBuckets) || rawBuckets.length !== 4) return invalid();
  const ids = new Set<string>();
  const buckets = rawBuckets.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return invalid();
    const item = entry as Record<string, unknown>;
    const id = item.id;
    if (id !== "venue" && id !== "kol" && id !== "print" && id !== "dev") return invalid();
    if (ids.has(id) || typeof item.title !== "string" || !item.title.trim()
      || typeof item.range !== "string" || !item.range.trim() || typeof item.rule !== "string" || !item.rule.trim()
      || typeof item.minBudgetUsdt !== "number" || !Number.isFinite(item.minBudgetUsdt)
      || typeof item.maxBudgetUsdt !== "number" || !Number.isFinite(item.maxBudgetUsdt)
      || item.minBudgetUsdt < 100 || item.maxBudgetUsdt < item.minBudgetUsdt || item.maxBudgetUsdt > 10000) return invalid();
    ids.add(id);
    return { id: id as AmbassadorPolicyBucket["id"], title: item.title.trim(), range: item.range.trim(), rule: item.rule.trim(), minBudgetUsdt: item.minBudgetUsdt, maxBudgetUsdt: item.maxBudgetUsdt };
  });
  if (ids.size !== 4) return invalid();
  return { policyVersion: row.policyVersion.trim(), revision: row.revision, defaultBudgetUsdt: row.defaultBudgetUsdt,
    buckets, source: "server", ...proof };
}

function parse(value: unknown, expectedEnvironment?: AmbassadorEnvironment): AmbassadorApplication {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  const status = row.status;
  const proof = provenance(row, expectedEnvironment);
  if (status !== "NONE" && status !== "PENDING" && status !== "APPROVED" && status !== "REJECTED") return invalid();
  if (status === "NONE") {
    return { applicationId: null, status, city: null, eventDate: null, budgetUsdt: null, bucket: null,
      submittedAt: null, source: "server", ...proof };
  }
  const applicationId = row.applicationId;
  const city = row.city;
  const eventDate = row.eventDate;
  const budgetUsdt = row.budgetUsdt;
  const bucket = row.bucket;
  const submittedAt = row.submittedAt;
  if (typeof applicationId !== "number" || !Number.isSafeInteger(applicationId) || applicationId <= 0
    || typeof city !== "string" || !city.trim()
    || typeof eventDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    || typeof budgetUsdt !== "number" || !Number.isFinite(budgetUsdt) || budgetUsdt < 0
    || (bucket !== "venue" && bucket !== "kol" && bucket !== "print" && bucket !== "dev")
    || typeof submittedAt !== "string" || !Number.isFinite(Date.parse(submittedAt))) return invalid();
  return { applicationId, status, city: city.trim(), eventDate, budgetUsdt, bucket,
    submittedAt, source: "server", ...proof };
}

export function createAmbassadorApplicationApi(client: ApiClient, environment: AmbassadorEnvironment = "PRODUCTION"): AmbassadorApplicationApi {
  const path = "/api/app/team/ambassador-applications";
  return {
    async policy() {
      return parseAmbassadorPolicy(await client.request<unknown>({ path: `${path}/policy` }), environment);
    },
    async latest() {
      return parse(await client.request<unknown>({ path: `${path}/latest` }), environment);
    },
    async submit(input, idempotencyKey) {
      return parse(await client.request<unknown>({ path, method: "POST", body: input, idempotencyKey }), environment);
    },
  };
}
