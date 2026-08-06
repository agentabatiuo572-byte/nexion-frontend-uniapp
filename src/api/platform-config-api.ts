import type { GpuTier, OnlineBonus, RewardsConfig } from "@/store/config-types";
import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export interface PlatformComputeConfigSnapshot {
  featureFlags: {
    computeShareEnabled: boolean;
  };
  onlineBonus: OnlineBonus;
  computeShare: {
    downloadUrl: string;
    content: {
      zhTitle: string;
      zhGuide: string;
      enTitle: string;
      enGuide: string;
    };
    gpuTiers: GpuTier[];
  };
  rewards: RewardsConfig;
  updatedAt: string;
  sources: string[];
}

export interface PlatformConfigApi {
  platformConfig(): Promise<PlatformComputeConfigSnapshot>;
}

const GPU_TIER_IDS = ["G1", "G2", "G3", "G4", "G5", "G6"] as const;
const COEFFICIENT_KEYS = new Set(["h5BaseFactor", "continuityFullHours"]);
const FLAG_KEYS = new Set(["computeShareEnabled"]);
const YIELD_KEYS = new Set(["topsBaseline", "dailyUsdtPerBaseline", "nexPerUsdt"]);
const KEYWORD_SLOTS = new Set(["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"]);

function invalid(message = "E6_PLATFORM_CONFIG_RESPONSE_INVALID"): never {
  throw new ApiError({ kind: "protocol", message });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}

function nonEmptyString(value: unknown): string {
  const normalized = string(value).trim();
  return normalized ? normalized : invalid();
}

function isoInstant(value: unknown): string {
  const normalized = nonEmptyString(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    || Number.isNaN(Date.parse(normalized))
  ) {
    return invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
  }
  return normalized;
}

function finiteNumber(value: unknown): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : invalid();
}

function positiveNumber(value: unknown): number {
  const parsed = finiteNumber(value);
  return parsed > 0 ? parsed : invalid();
}

function rewardAmount(value: unknown): number {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text)) {
    return invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999_999_999) {
    return invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
  }
  return parsed;
}

function exactKeySet(rows: Record<string, unknown>[], expected: Set<string>): void {
  const keys = rows.map((row) => nonEmptyString(row.key));
  if (keys.length !== expected.size || new Set(keys).size !== expected.size || keys.some((key) => !expected.has(key))) {
    invalid();
  }
}

function parseGpuTiers(value: unknown): GpuTier[] {
  if (!Array.isArray(value) || value.length !== GPU_TIER_IDS.length) return invalid();
  const rows = value.map(record);
  const byId = new Map(rows.map((row) => [nonEmptyString(row.id), row]));
  if (byId.size !== GPU_TIER_IDS.length || GPU_TIER_IDS.some((id) => !byId.has(id))) return invalid();

  let previousTops = 0;
  return GPU_TIER_IDS.map((id) => {
    const row = byId.get(id)!;
    const tops = positiveNumber(row.tops);
    if (tops <= previousTops) return invalid();
    previousTops = tops;

    if (!Array.isArray(row.keywords)) return invalid();
    const keywordRows = row.keywords.map(record);
    const slots = keywordRows.map((keyword) => nonEmptyString(keyword.slot));
    if (
      slots.length > KEYWORD_SLOTS.size
      || new Set(slots).size !== slots.length
      || slots.some((slot) => !KEYWORD_SLOTS.has(slot))
    ) {
      return invalid();
    }
    return {
      id,
      label: nonEmptyString(row.label),
      tops,
      keywords: keywordRows.map((keyword) => nonEmptyString(keyword.value)),
    };
  });
}

export function parsePlatformComputeConfig(value: unknown): PlatformComputeConfigSnapshot {
  const root = record(value);
  const featureFlags = record(root.featureFlags);
  const onlineBonus = record(root.onlineBonus);
  const compute = record(root.computerCompute);
  const download = record(compute.download);

  if (typeof featureFlags.computeShareEnabled !== "boolean" || compute.domain !== "E6") return invalid();
  const h5BaseFactor = positiveNumber(onlineBonus.h5BaseFactor);
  const continuityFullHours = positiveNumber(onlineBonus.continuityFullHours);
  if (h5BaseFactor > 1) return invalid();

  if (!Array.isArray(compute.flags) || !Array.isArray(compute.coefficients) || !Array.isArray(compute.yieldEstimate)) {
    return invalid();
  }
  const flags = compute.flags.map(record);
  const coefficients = compute.coefficients.map(record);
  const yields = compute.yieldEstimate.map(record);
  exactKeySet(flags, FLAG_KEYS);
  exactKeySet(coefficients, COEFFICIENT_KEYS);
  exactKeySet(yields, YIELD_KEYS);

  const flag = flags[0];
  if (typeof flag.enabled !== "boolean" || flag.enabled !== featureFlags.computeShareEnabled) return invalid();
  const coefficientValues = Object.fromEntries(
    coefficients.map((row) => [nonEmptyString(row.key), positiveNumber(row.value)]),
  ) as Record<string, number>;
  if (
    coefficientValues.h5BaseFactor !== h5BaseFactor
    || coefficientValues.continuityFullHours !== continuityFullHours
  ) {
    return invalid();
  }
  yields.forEach((row) => positiveNumber(row.value));

  const downloadUrl = string(download.url).trim();
  if (downloadUrl && !/^https:\/\/[^\s]+$/.test(downloadUrl)) return invalid();
  const sources = Array.isArray(compute.sources) ? compute.sources.map(nonEmptyString) : invalid();

  return {
    featureFlags: { computeShareEnabled: featureFlags.computeShareEnabled },
    onlineBonus: { h5BaseFactor, continuityFullHours },
    computeShare: {
      downloadUrl,
      content: {
        zhTitle: string(download.zhTitle),
        zhGuide: string(download.zhGuide),
        enTitle: string(download.enTitle),
        enGuide: string(download.enGuide),
      },
      gpuTiers: parseGpuTiers(compute.gpuTiers),
    },
    // H8 is fetched from its own bounded context and merged by createPlatformConfigApi.
    rewards: {
      welcomeGift: { lockMode: "risk_bucket", usdtAmount: 0, nexAmount: 0 },
      inviterReward: { nexAmount: 0 },
    },
    updatedAt: nonEmptyString(root.updatedAt),
    sources,
  };
}

export interface ReferralRewardConfigSnapshot {
  rewards: RewardsConfig;
  rhythmMonth: number;
  newcomerMultiplier: number;
  inviterMultiplier: number;
  effectiveAt: string;
  sources: string[];
}

export function parseReferralRewardConfig(value: unknown): ReferralRewardConfigSnapshot {
  try {
    const root = record(value);
    const welcomeGift = record(root.welcomeGift);
    const inviterReward = record(root.inviterReward);
    const lockMode = string(welcomeGift.lockMode);
    if (lockMode !== "risk_bucket" && lockMode !== "direct") {
      return invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
    }
    const rhythmMonth = finiteNumber(root.rhythmMonth);
    const newcomerMultiplier = positiveNumber(root.newcomerMultiplier);
    const inviterMultiplier = positiveNumber(root.inviterMultiplier);
    if (!Number.isInteger(rhythmMonth) || rhythmMonth < 1 || rhythmMonth > 120) {
      return invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
    }
    const sources = Array.isArray(root.sources)
      ? root.sources.map(nonEmptyString)
      : invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
    if (!sources.includes("nx_user.sponsor_user_id")) {
      return invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
    }
    return {
      rewards: {
        welcomeGift: {
          lockMode,
          usdtAmount: rewardAmount(welcomeGift.usdtAmount),
          nexAmount: rewardAmount(welcomeGift.nexAmount),
        },
        inviterReward: {
          nexAmount: rewardAmount(inviterReward.nexAmount),
        },
      },
      rhythmMonth,
      newcomerMultiplier,
      inviterMultiplier,
      effectiveAt: isoInstant(root.effectiveAt),
      sources,
    };
  } catch {
    return invalid("H8_REFERRAL_REWARD_CONFIG_RESPONSE_INVALID");
  }
}

export function createPlatformConfigApi(client: ApiClient): PlatformConfigApi {
  return {
    platformConfig: async () => {
      const [computeRaw, referralRaw] = await Promise.all([
        client.request({
          method: "GET",
          path: "/api/config/platform",
          authenticated: false,
        }),
        client.request({
          method: "GET",
          path: "/api/config/referral-rewards",
          authenticated: false,
        }),
      ]);
      const compute = parsePlatformComputeConfig(computeRaw);
      const referral = parseReferralRewardConfig(referralRaw);
      return {
        ...compute,
        rewards: referral.rewards,
        sources: [...compute.sources, ...referral.sources],
      };
    },
  };
}
