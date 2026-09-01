import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";
import { normalizeQuestActionRoute } from "@/lib/quest-presentation";

export type QuestLayer = "DAY_ONE" | "WEEKLY_T1" | "WEEKLY_T2";
export type QuestStatus = "PENDING" | "COMPLETED" | "CLAIMABLE" | "CLAIMED";
export type QuestTaskCategory = "wallet" | "explore" | "recommend" | "identity" | "social";

export interface CanonicalQuest {
  questCode: string;
  name: string;
  layer: QuestLayer;
  rewardNex: number;
  status: QuestStatus;
  category: QuestTaskCategory;
  actionRoute: string;
}

export interface CanonicalPromoBanner {
  bannerCode: string;
  baseReward: number;
  multiplier: number;
  countdownDays: number;
  countdownHours: number;
  targetDevice: string;
  targetDaily: number;
  status: "active" | "paused";
}

export interface QuestSnapshot {
  quests: CanonicalQuest[];
  promoBanner: CanonicalPromoBanner | null;
  questBonusMultiplier: number;
  rhythmMonth: number;
  source: string;
  serverCanonical: true;
  sourceEnvironment: "PRODUCTION" | "SANDBOX";
  runId: string;
}

export interface QuestClaimResult {
  questId: string;
  rewardNex: number;
  status: "CLAIMED";
  serverCanonical: true;
  sourceEnvironment: "PRODUCTION" | "SANDBOX";
  runId: string;
}

export interface QuestApi {
  state(locale?: string): Promise<QuestSnapshot>;
  claim(questCode: string, idempotencyKey: string): Promise<QuestClaimResult>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown, min = 0, max = Number.POSITIVE_INFINITY): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function invalid(message = "QUEST_RESPONSE_INVALID"): never {
  throw new ApiError({ kind: "protocol", message });
}

function validAuthority(row: Record<string, unknown>, mode: ApiEnvironment): boolean {
  if (row.serverCanonical !== true) return false;
  return (mode === "dev" || mode === "prod")
    && row.sourceEnvironment === "PRODUCTION" && row.runId === "";
}

function parseQuest(value: unknown): CanonicalQuest {
  const row = record(value);
  const questCode = text(row?.questCode);
  const name = text(row?.name);
  const layer = text(row?.layer)?.toUpperCase() as QuestLayer;
  const rewardNex = number(row?.rewardNex);
  const status = text(row?.status)?.toUpperCase() as QuestStatus;
  const category = text(row?.category)?.toLowerCase() as QuestTaskCategory;
  const rawActionRoute = text(row?.actionRoute);
  if (!row || !questCode || !name
      || !["DAY_ONE", "WEEKLY_T1", "WEEKLY_T2"].includes(layer)
      || rewardNex === null
      || !["PENDING", "COMPLETED", "CLAIMABLE", "CLAIMED"].includes(status)
      || !["wallet", "explore", "recommend", "identity", "social"].includes(category)
      || !rawActionRoute) {
    return invalid();
  }
  let actionRoute: string;
  try {
    actionRoute = normalizeQuestActionRoute(rawActionRoute);
  } catch {
    return invalid();
  }
  return { questCode, name, layer, rewardNex, status, category, actionRoute };
}

function parsePromo(value: unknown): CanonicalPromoBanner | null {
  const row = record(value);
  if (!row || Object.keys(row).length === 0) return null;
  const bannerCode = text(row.bannerCode);
  const baseReward = number(row.baseReward, 0, 100_000);
  const multiplier = number(row.multiplier, 0.1, 5);
  const countdownDays = number(row.countdownDays, 0, 365);
  const countdownHours = number(row.countdownHours, 0, 23);
  const targetDevice = text(row.targetDevice);
  const targetDaily = number(row.targetDaily, 0, 1_000_000);
  const status = text(row.status)?.toLowerCase() as "active" | "paused";
  if (!bannerCode || baseReward === null || multiplier === null
      || countdownDays === null || !Number.isInteger(countdownDays)
      || countdownHours === null || !Number.isInteger(countdownHours) || countdownHours > 23
      || !targetDevice || targetDaily === null || !["active", "paused"].includes(status)) {
    return invalid("QUEST_PROMO_RESPONSE_INVALID");
  }
  return {
    bannerCode,
    baseReward,
    multiplier,
    countdownDays,
    countdownHours,
    targetDevice,
    targetDaily,
    status,
  };
}

export function parseQuestSnapshot(value: unknown, mode: ApiEnvironment = "prod"): QuestSnapshot {
  const row = record(value);
  const multiplier = number(row?.questBonusMultiplier, 0.1);
  const rhythmMonth = number(row?.rhythmMonth, 1);
  const source = text(row?.source);
  if (!row || !validAuthority(row, mode) || !Array.isArray(row.quests) || multiplier === null
      || rhythmMonth === null || !Number.isInteger(rhythmMonth) || !source
      || !source.includes("nx_mission") || !source.includes("nx_user_mission")
      || source.toLowerCase().includes("mock")) {
    return invalid();
  }
  const quests = row.quests.map(parseQuest);
  const codes = new Set(quests.map((quest) => quest.questCode));
  if (codes.size !== quests.length) return invalid("QUEST_CODE_DUPLICATED");
  return {
    quests,
    promoBanner: parsePromo(row.promoBanner),
    questBonusMultiplier: multiplier,
    rhythmMonth,
    source,
    serverCanonical: true,
    sourceEnvironment: row.sourceEnvironment as "PRODUCTION" | "SANDBOX",
    runId: row.runId as string,
  };
}

export function parseQuestClaim(value: unknown, mode: ApiEnvironment = "prod"): QuestClaimResult {
  const row = record(value);
  const questId = text(row?.questId);
  const rewardNex = number(row?.rewardNex);
  if (!row || !validAuthority(row, mode) || !questId || rewardNex === null || row.status !== "CLAIMED") {
    return invalid("QUEST_CLAIM_RESPONSE_INVALID");
  }
  return {
    questId,
    rewardNex,
    status: "CLAIMED",
    serverCanonical: true,
    sourceEnvironment: row.sourceEnvironment as "PRODUCTION" | "SANDBOX",
    runId: row.runId as string,
  };
}

function required(value: string, error: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ApiError({ kind: "protocol", message: error });
  return normalized;
}

export function createQuestApi(client: ApiClient, mode: ApiEnvironment = "prod"): QuestApi {
  return {
    state: async (locale = "en") => parseQuestSnapshot(await client.request({
      method: "GET",
      path: `/api/quests/state?locale=${encodeURIComponent(["en", "zh", "vi"].includes(locale) ? locale : "en")}`,
    }), mode),
    claim: async (questCode, idempotencyKey) => parseQuestClaim(await client.request({
      method: "POST",
      path: `/api/quests/${encodeURIComponent(required(questCode, "QUEST_CODE_REQUIRED"))}/claim`,
      idempotencyKey: required(idempotencyKey, "QUEST_IDEMPOTENCY_KEY_REQUIRED"),
    }), mode),
  };
}
