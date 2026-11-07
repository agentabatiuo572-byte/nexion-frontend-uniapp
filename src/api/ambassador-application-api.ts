import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export function isAmbassadorApplicationPending(error: unknown): boolean {
  return error instanceof ApiError && error.kind === "http" && error.status === 409
    && error.message === "AMBASSADOR_APPLICATION_PENDING";
}

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
  materialRevision?: number;
  materialState?: AmbassadorMaterials["materialState"];
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

export interface AmbassadorMaterialAttachment {
  fileId: string;
  kind: string;
  name: string;
  contentType: "image/png" | "image/jpeg" | "application/pdf";
  sizeBytes: number;
}

export interface AmbassadorMaterialReview {
  status: "PENDING" | "NEEDS_MORE" | "PASSED";
  reviewerLabel: string | null;
  reviewedAt: string | null;
  reason: string | null;
  verifiedAttendees?: number | null;
  recognizedBudgetUsdt?: number | null;
}

export interface AmbassadorMaterialRequirement { kind: string; label: string; required: boolean }

export interface AmbassadorMaterials {
  applicationId: number;
  bucket: AmbassadorApplicationInput["bucket"] | null;
  eventDate: string;
  budgetUsdt: number;
  materialRevision: number;
  materialState: "NOT_SUBMITTED" | "PENDING" | "NEEDS_MORE" | "PASSED";
  requirements: AmbassadorMaterialRequirement[];
  requirementsByBucket?: Record<AmbassadorApplicationInput["bucket"], AmbassadorMaterialRequirement[]>;
  attachments: AmbassadorMaterialAttachment[];
  businessReview: AmbassadorMaterialReview;
  financeReview: AmbassadorMaterialReview;
  missingKinds: string[];
  statement: string;
  canSubmit: boolean;
  legacyApproved: boolean;
  approvalBlockers: string[];
}

export interface AmbassadorMaterialsInput {
  expectedMaterialRevision: number;
  attachments: Pick<AmbassadorMaterialAttachment, "fileId" | "kind">[];
  statement: string;
  budgetUsdt?: number;
  bucket?: AmbassadorApplicationInput["bucket"];
}

export interface AmbassadorApplicationApi {
  policy(): Promise<AmbassadorPolicy>;
  latest(): Promise<AmbassadorApplication>;
  history(): Promise<AmbassadorApplication[]>;
  submit(input: AmbassadorApplicationInput, idempotencyKey: string): Promise<AmbassadorApplication>;
  materials(applicationId: number): Promise<AmbassadorMaterials>;
  submitMaterials(applicationId: number, input: AmbassadorMaterialsInput, idempotencyKey: string): Promise<AmbassadorMaterials>;
  uploadMaterialFile(applicationId: number, filePath: string, kind: string, idempotencyKey: string, signal?: AbortSignal): Promise<AmbassadorMaterialAttachment>;
  materialFile(applicationId: number, fileId: string, signal?: AbortSignal): Promise<string>;
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
  if ((row.materialRevision !== undefined && (typeof row.materialRevision !== "number" || !Number.isSafeInteger(row.materialRevision) || row.materialRevision < 0))
    || (row.materialState !== undefined && !["NOT_SUBMITTED", "PENDING", "NEEDS_MORE", "PASSED"].includes(row.materialState as string))) return invalid();
  if (typeof applicationId !== "number" || !Number.isSafeInteger(applicationId) || applicationId <= 0
    || typeof city !== "string" || !city.trim()
    || typeof eventDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    || typeof budgetUsdt !== "number" || !Number.isFinite(budgetUsdt) || budgetUsdt < 0
    || (bucket !== null && bucket !== "venue" && bucket !== "kol" && bucket !== "print" && bucket !== "dev")
    || typeof submittedAt !== "string" || !Number.isFinite(Date.parse(submittedAt))) return invalid();
  return { applicationId, status, city: city.trim(), eventDate, budgetUsdt, bucket,
    submittedAt, source: "server", ...proof,
    ...(row.materialRevision !== undefined ? { materialRevision: row.materialRevision as number } : {}),
    ...(row.materialState !== undefined ? { materialState: row.materialState as AmbassadorMaterials["materialState"] } : {}) };
}

function materialAttachment(value: unknown): AmbassadorMaterialAttachment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (typeof row.fileId !== "string" || !row.fileId.trim()
    || typeof row.kind !== "string" || !row.kind.trim() || typeof row.name !== "string" || !row.name.trim()
    || !["image/png", "image/jpeg", "application/pdf"].includes(row.contentType as string)
    || typeof row.sizeBytes !== "number" || !Number.isSafeInteger(row.sizeBytes) || row.sizeBytes <= 0 || row.sizeBytes > 10 * 1024 * 1024) return invalid();
  return row as unknown as AmbassadorMaterialAttachment;
}

function materialReview(value: unknown): AmbassadorMaterialReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (!["PENDING", "NEEDS_MORE", "PASSED"].includes(row.status as string)
    || (row.reviewerLabel != null && typeof row.reviewerLabel !== "string")
    || (row.reason != null && typeof row.reason !== "string")
    || (row.reviewedAt != null && (typeof row.reviewedAt !== "string" || !Number.isFinite(Date.parse(row.reviewedAt))))
    || (row.verifiedAttendees != null && (typeof row.verifiedAttendees !== "number" || !Number.isSafeInteger(row.verifiedAttendees) || row.verifiedAttendees < 0))
    || (row.recognizedBudgetUsdt != null && (typeof row.recognizedBudgetUsdt !== "number" || !Number.isFinite(row.recognizedBudgetUsdt) || row.recognizedBudgetUsdt < 0))) return invalid();
  return { ...row, reviewerLabel: row.reviewerLabel ?? null, reviewedAt: row.reviewedAt ?? null, reason: row.reason ?? null } as unknown as AmbassadorMaterialReview;
}

function materialRequirements(value: unknown): AmbassadorMaterialRequirement[] {
  if (!Array.isArray(value) || !value.every(item => item && typeof item.kind === "string" && !!item.kind.trim()
    && typeof item.label === "string" && typeof item.required === "boolean")) return invalid();
  return value as AmbassadorMaterialRequirement[];
}

function materialPackage(value: unknown, applicationId: number): AmbassadorMaterials {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (row.applicationId !== applicationId
    || (row.bucket !== null && !["venue", "kol", "print", "dev"].includes(row.bucket as string))
    || typeof row.eventDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.eventDate)
    || typeof row.budgetUsdt !== "number" || !Number.isFinite(row.budgetUsdt) || row.budgetUsdt < 0
    || typeof row.materialRevision !== "number" || !Number.isSafeInteger(row.materialRevision) || row.materialRevision < 0
    || !["NOT_SUBMITTED", "PENDING", "NEEDS_MORE", "PASSED"].includes(row.materialState as string)
    || !Array.isArray(row.attachments) || row.attachments.length > 12
    || !Array.isArray(row.missingKinds) || !row.missingKinds.every(item => typeof item === "string")
    || !Array.isArray(row.approvalBlockers) || !row.approvalBlockers.every(item => typeof item === "string")
    || typeof row.statement !== "string" || typeof row.canSubmit !== "boolean" || typeof row.legacyApproved !== "boolean") return invalid();
  let requirementsByBucket: AmbassadorMaterials["requirementsByBucket"];
  if (row.requirementsByBucket !== undefined) {
    if (!row.requirementsByBucket || typeof row.requirementsByBucket !== "object" || Array.isArray(row.requirementsByBucket)) return invalid();
    const requirements = row.requirementsByBucket as Record<string, unknown>;
    requirementsByBucket = Object.fromEntries(["venue", "kol", "print", "dev"].map(bucket => [bucket, materialRequirements(requirements[bucket])])) as AmbassadorMaterials["requirementsByBucket"];
  }
  return { ...row, requirements: materialRequirements(row.requirements), requirementsByBucket,
    attachments: row.attachments.map(materialAttachment), businessReview: materialReview(row.businessReview),
    financeReview: materialReview(row.financeReview) } as unknown as AmbassadorMaterials;
}

export function parseAmbassadorApplicationPage(value: unknown, expectedEnvironment?: AmbassadorEnvironment): {
  rows: AmbassadorApplication[]; pageNum: number; pageSize: number; total: number; hasMore: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  provenance(row, expectedEnvironment);
  if (!Array.isArray(row.rows) || typeof row.pageNum !== "number" || !Number.isSafeInteger(row.pageNum) || row.pageNum < 1
    || typeof row.pageSize !== "number" || !Number.isSafeInteger(row.pageSize) || row.pageSize < 1 || row.pageSize > 100
    || typeof row.total !== "number" || !Number.isSafeInteger(row.total) || row.total < 0
    || typeof row.hasMore !== "boolean") return invalid();
  const rows = row.rows.map((entry) => parse(entry, expectedEnvironment));
  if (rows.length > row.pageSize || (row.pageNum - 1) * row.pageSize + rows.length > row.total
    || row.hasMore !== ((row.pageNum - 1) * row.pageSize + rows.length < row.total)) return invalid();
  return { rows, pageNum: row.pageNum, pageSize: row.pageSize, total: row.total, hasMore: row.hasMore };
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
    async history() {
      const rows: AmbassadorApplication[] = [];
      const seen = new Set<number>();
      let pageNum = 1;
      let expectedTotal: number | null = null;
      while (true) {
        const page = parseAmbassadorApplicationPage(await client.request<unknown>({
          path: `${path}?pageNum=${pageNum}&pageSize=50`,
        }), environment);
        if (page.pageNum !== pageNum || page.pageSize !== 50
          || (expectedTotal !== null && page.total !== expectedTotal)) return invalid();
        expectedTotal ??= page.total;
        for (const application of page.rows) {
          if (application.applicationId === null || seen.has(application.applicationId)) return invalid();
          seen.add(application.applicationId);
          rows.push(application);
        }
        if (!page.hasMore) {
          if (rows.length !== page.total) return invalid();
          return rows;
        }
        if (page.rows.length === 0) return invalid();
        pageNum += 1;
      }
    },
    async submit(input, idempotencyKey) {
      return parse(await client.request<unknown>({ path, method: "POST", body: input, idempotencyKey }), environment);
    },
    async materials(applicationId) {
      return materialPackage(await client.request({ path: `${path}/${applicationId}/materials` }), applicationId);
    },
    async submitMaterials(applicationId, input, idempotencyKey) {
      return materialPackage(await client.request({ path: `${path}/${applicationId}/materials`, method: "POST", body: input, idempotencyKey }), applicationId);
    },
    async uploadMaterialFile(applicationId, filePath, kind, idempotencyKey, signal) {
      return materialAttachment(await client.upload({ path: `${path}/${applicationId}/materials/files`, filePath,
        name: "file", formData: { kind }, idempotencyKey, signal }));
    },
    async materialFile(applicationId, fileId, signal) {
      if (!client.download) return invalid();
      return client.download({ path: `${path}/${applicationId}/materials/files/${encodeURIComponent(fileId)}`, signal });
    },
  };
}
