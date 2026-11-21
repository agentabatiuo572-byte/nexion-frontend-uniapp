import { productMediaUrl } from "@/api/product-catalog-contract";
import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";
import { matchesRuntimeProvenance } from "./runtime-provenance";

export type TeamQuotaEnvironment = "PRODUCTION";
export interface TeamQuotaFacts { rank: number; directRefs: number; directInvites: number | null; activeDirect: number; teamComputePoints: number }
export interface TeamQuotaCondition { kind: "rank" | "directRefs" | "teamComputePoints"; required: number; current: number }
export interface TeamQuotaTier {
  productId: string; imageUrl?: string; quotaCode: string; name: string; price: number; monthlyStock: number; soldThisMonth: number;
  unlockKind: "ALL" | "EITHER"; conditions: TeamQuotaCondition[]; perks: string[]; available: boolean;
  usedThisMonth: number; pendingThisMonth: number; remaining: number;
}
export interface TeamQuotaSnapshot {
  source: "server"; sourceEnvironment: TeamQuotaEnvironment; runId: string;
  generatedAt: string; facts: TeamQuotaFacts; tiers: TeamQuotaTier[];
}

function invalid(): never { throw new ApiError({ kind: "protocol", message: "TEAM_QUOTA_RESPONSE_INVALID" }); }
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function text(value: unknown, required = true): string { if (typeof value !== "string" || (required && !value.trim())) return invalid(); return value.trim(); }
function num(value: unknown, integer = false): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) return invalid(); return value; }

function parse(value: unknown, mode: ApiEnvironment): TeamQuotaSnapshot {
  const source = row(value);
  if (!matchesRuntimeProvenance(source, mode, "server")) return invalid();
  const environment = source.sourceEnvironment;
  const runId = text(source.runId, false);
  if (runId !== "") return invalid();
  const facts = row(source.facts);
  const parsedFacts = { rank: num(facts.rank, true), directRefs: num(facts.directRefs, true), directInvites: facts.directInvites == null ? null : num(facts.directInvites, true), activeDirect: num(facts.activeDirect, true), teamComputePoints: num(facts.teamComputePoints, true) };
  if (!Array.isArray(source.tiers)) return invalid();
  const tiers = source.tiers.map((value): TeamQuotaTier => {
    const item = row(value); const unlockKind = item.unlockKind;
    if (unlockKind !== "ALL" && unlockKind !== "EITHER" || typeof item.available !== "boolean" || !Array.isArray(item.conditions) || !Array.isArray(item.perks)) return invalid();
    const conditions = item.conditions.map((raw): TeamQuotaCondition => {
      const condition = row(raw); const kind = condition.kind;
      if (kind !== "rank" && kind !== "directRefs" && kind !== "teamComputePoints") return invalid();
      return { kind, required: num(condition.required), current: num(condition.current) };
    });
    const monthlyStock = num(item.monthlyStock, true);
    const soldThisMonth = num(item.soldThisMonth, true);
    const usedThisMonth = "usedThisMonth" in item ? num(item.usedThisMonth, true) : soldThisMonth;
    const pendingThisMonth = "pendingThisMonth" in item ? num(item.pendingThisMonth, true) : 0;
    const remaining = "remaining" in item ? num(item.remaining, true) : Math.max(0, monthlyStock - usedThisMonth);
    return { productId: text(item.productId), imageUrl: productMediaUrl(item.imageUrl), quotaCode: text(item.quotaCode), name: text(item.name), price: num(item.price),
      monthlyStock, soldThisMonth, usedThisMonth, pendingThisMonth, remaining, unlockKind,
      conditions, perks: item.perks.map((perk) => text(perk)), available: item.available };
  });
  const generatedAt = text(source.generatedAt);
  if (!Number.isFinite(Date.parse(generatedAt)) || new Set(tiers.map((tier) => tier.productId)).size !== tiers.length) return invalid();
  return { source: "server", sourceEnvironment: environment, runId, generatedAt, facts: parsedFacts, tiers };
}

export function createTeamQuotaApi(client: ApiClient, mode: ApiEnvironment = "prod") {
  return { snapshot: async (): Promise<TeamQuotaSnapshot> => parse(await client.request({ method: "GET", path: "/api/app/team/quota" }), mode) };
}
