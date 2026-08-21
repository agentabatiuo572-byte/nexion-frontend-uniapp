import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";
import { matchesRuntimeProvenance } from "./runtime-provenance";

export interface RankHowPolicySection { id: string; title: string; body: string; order: number }
export interface RankHowPolicy { version: string; locale: string; hero: string; sections: RankHowPolicySection[]; source: "server"; sourceEnvironment: "SANDBOX" | "PRODUCTION"; runId: string }
function invalid(message = "RANK_HOW_POLICY_RESPONSE_INVALID"): never { throw new ApiError({ kind: "protocol", message }); }
function parse(value: unknown, mode: ApiEnvironment): RankHowPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (row.status !== "PUBLISHED" || typeof row.version !== "string" || !row.version.trim() || typeof row.locale !== "string" || typeof row.hero !== "string" || !Array.isArray(row.sections) || !matchesRuntimeProvenance(row, mode, "server")) return invalid();
  const sections = row.sections.map((item): RankHowPolicySection => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return invalid();
    const section = item as Record<string, unknown>;
    if (typeof section.id !== "string" || typeof section.title !== "string" || typeof section.body !== "string" || !Number.isSafeInteger(section.order)) return invalid();
    return { id: section.id, title: section.title, body: section.body, order: section.order as number };
  }).sort((a, b) => a.order - b.order);
  if (!sections.length) return invalid("RANK_HOW_POLICY_EMPTY");
  return { version: row.version, locale: row.locale, hero: row.hero, sections, source: "server", sourceEnvironment: row.sourceEnvironment as "SANDBOX" | "PRODUCTION", runId: row.runId as string };
}
export interface RankHowPolicyApi { published(locale: string): Promise<RankHowPolicy> }
export function createRankHowPolicyApi(client: ApiClient, mode: ApiEnvironment = "prod"): RankHowPolicyApi {
  return { published: async (locale) => parse(await client.request<unknown>({ method: "GET", path: `/api/config/v-rank-policy?locale=${encodeURIComponent(locale)}`, authenticated: false }), mode) };
}
