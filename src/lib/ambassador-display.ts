import type { AmbassadorApplication, AmbassadorMaterials, AmbassadorPolicyBucket } from "@/api/ambassador-application-api";

export type AmbassadorBucketId = AmbassadorPolicyBucket["id"];
export const AMBASSADOR_BUCKET_IDS: readonly AmbassadorBucketId[] = ["venue", "kol", "print", "dev"];

/** One accent per category, shared by the category tiles, list icons and the detail hero. */
export const AMBASSADOR_BUCKET_VISUALS: Record<AmbassadorBucketId, { tint: string; ink: string; paths: string[] }> = {
  venue: { tint: "var(--v5-brand)", ink: "var(--v5-brand)", paths: ["M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z", "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2", "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2", "M10 6h4M10 10h4M10 14h4M10 18h4"] },
  kol: { tint: "var(--v5-brand-2)", ink: "var(--v5-brand-2-ink)", paths: ["m3 11 18-5v12L3 14v-3z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"] },
  print: { tint: "var(--v5-warning)", ink: "var(--v5-warning-ink)", paths: ["M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 9V2h12v7", "M6 14h12v8H6z"] },
  dev: { tint: "var(--v5-nex)", ink: "var(--v5-nex-ink)", paths: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"] },
};
/** A historical application without a category: neutral grid, never a guessed category. */
export const AMBASSADOR_NO_BUCKET_VISUAL = { tint: "var(--v5-ink-3)", ink: "var(--v5-ink-3)", paths: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"] };

export type AmbassadorStatusKey = "draft" | "review" | "more" | "bucket" | "approved" | "rejected";
export type AmbassadorStepKey = "submitted" | "upload" | "uploaded" | "reviewing" | "more" | "checked" | "awaiting" | "approved" | "rejected";
export type AmbassadorStepState = "done" | "current" | "stop" | "fail" | "end" | "todo";
export interface AmbassadorStep { key: AmbassadorStepKey | null; state: AmbassadorStepState }
export interface AmbassadorPresentation {
  status: AmbassadorStatusKey;
  tone: "warning" | "brand" | "success" | "danger";
  /** Colour of the current node; reached, stopped and failed nodes have their own. */
  current: string;
  steps: AmbassadorStep[];
}

type Facts = Pick<AmbassadorApplication, "status" | "bucket" | "materialRevision" | "materialState">;

/**
 * The status tag and the four-node progress of one application. Only the
 * application row says whether it is approved or rejected; material progress
 * never implies a final decision.
 */
export function ambassadorPresentation(facts: Facts): AmbassadorPresentation {
  const submitted: AmbassadorStep = { key: "submitted", state: "done" };
  const todo: AmbassadorStep = { key: null, state: "todo" };
  const submittedMaterials = (facts.materialRevision ?? 0) > 0 && facts.materialState !== undefined && facts.materialState !== "NOT_SUBMITTED";
  if (facts.status === "APPROVED") {
    return { status: "approved", tone: "success", current: "var(--v5-success-ink)", steps: [submitted,
      { key: "uploaded", state: "done" }, { key: "checked", state: "done" }, { key: "approved", state: "end" }] };
  }
  if (facts.status === "REJECTED") {
    return { status: "rejected", tone: "danger", current: "var(--v5-danger)", steps: [submitted,
      submittedMaterials ? { key: "uploaded", state: "done" } : todo, todo, { key: "rejected", state: "fail" }] };
  }
  if (!facts.bucket || !submittedMaterials) {
    return { status: facts.bucket ? "draft" : "bucket", tone: "warning", current: "var(--v5-warning-ink)",
      steps: [submitted, { key: "upload", state: "current" }, todo, todo] };
  }
  const uploaded: AmbassadorStep = { key: "uploaded", state: "done" };
  if (facts.materialState === "NEEDS_MORE") {
    return { status: "more", tone: "warning", current: "var(--v5-warning-ink)", steps: [submitted, uploaded, { key: "more", state: "stop" }, todo] };
  }
  if (facts.materialState === "PASSED") {
    return { status: "review", tone: "brand", current: "var(--v5-brand)", steps: [submitted, uploaded, { key: "checked", state: "done" }, { key: "awaiting", state: "current" }] };
  }
  return { status: "review", tone: "brand", current: "var(--v5-brand)", steps: [submitted, uploaded, { key: "reviewing", state: "current" }, todo] };
}

/** Facts of the detail page: the row's status with the packet's category and material progress. */
export function ambassadorPacketFacts(status: AmbassadorApplication["status"], pack: AmbassadorMaterials): Facts {
  return { status, bucket: pack.bucket, materialRevision: pack.materialRevision, materialState: pack.materialState };
}

/**
 * A requested amount keeps every accepted decimal from the contract; integers
 * show ".00". Display only, never fed back into a command.
 */
export function ambassadorAmountParts(value: number | null | undefined): { integer: string; fraction: string } | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const [integer, fraction] = String(value).split(".");
  return { integer: integer.replace(/\B(?=(\d{3})+(?!\d))/g, ","), fraction: fraction ? `.${fraction}` : ".00" };
}

export function ambassadorAmountText(value: number | null | undefined): string {
  const parts = ambassadorAmountParts(value);
  return parts ? `${parts.integer}${parts.fraction} USDT` : "— USDT";
}

export const AMBASSADOR_ROUTES = {
  agent: "/pages/team/agent",
  records: "/pages/team/agent-applications",
  detail: (applicationId: number) => `/pages/team/agent-application?id=${applicationId}`,
} as const;
