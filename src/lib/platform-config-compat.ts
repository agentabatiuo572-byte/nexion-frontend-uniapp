import { FLEET_DEVICES } from "@/lib/platform-stats";
import type { PlatformConfig, PlatformConfigSeed } from "@/store/config-types";

// Compatibility belongs to the runtime config boundary, not to local Mock
// datasets. Remove these fallbacks when GET /api/config/platform is wired and
// older seeds are no longer supported.
const RUNTIME_PUBLIC_STATS_DEFAULT: PlatformConfig["publicStats"] = {
  fleetDevices: FLEET_DEVICES,
  onlineRatePct: 100,
  onlineJitter: 24,
  registeredUsersBase: 1_420_000,
  registeredUsersMonthlyGrowthPct: 2.9,
  registeredUsersAnchorAt: Date.UTC(2026, 7, 1),
  virtualUserCount: 12_000,
  hashratePercentileTable: [
    { tops: 5, cumPct: 20 },
    { tops: 20, cumPct: 55 },
    { tops: 60, cumPct: 82 },
    { tops: 150, cumPct: 96 },
    { tops: 700, cumPct: 97.6 },
    { tops: 2_700, cumPct: 98.7 },
    { tops: 5_400, cumPct: 99.3 },
    { tops: 11_000, cumPct: 99.6 },
    { tops: 27_000, cumPct: 99.8 },
    { tops: 53_000, cumPct: 99.9 },
  ],
};

const RUNTIME_WITHDRAW_RULE_DEFAULTS = {
  smallAmountThresholdUsd: 50,
  dailyWithdrawLimitCount: 1,
  payoutSlaHours: 24,
  payoutReviewWindowDays: 0,
  networkConfirmFeeUsd: { trc20: 1, bep20: 1, erc20: 5 },
} satisfies Pick<
  PlatformConfig["withdrawRules"],
  | "smallAmountThresholdUsd"
  | "dailyWithdrawLimitCount"
  | "payoutSlaHours"
  | "payoutReviewWindowDays"
  | "networkConfirmFeeUsd"
>;

const RUNTIME_CAPTCHA_ALWAYS_SCENES_DEFAULT: PlatformConfig["otpGate"]["captchaAlwaysScenes"] = ["register"];

/** Complete an older local seed without mutating or replacing its Mock data. */
export function completePlatformConfigSeed(seed: PlatformConfigSeed): PlatformConfig {
  const publicStats = seed.publicStats ?? RUNTIME_PUBLIC_STATS_DEFAULT;
  const networkConfirmFeeUsd =
    seed.withdrawRules.networkConfirmFeeUsd ??
    RUNTIME_WITHDRAW_RULE_DEFAULTS.networkConfirmFeeUsd;
  const captchaAlwaysScenes =
    seed.otpGate.captchaAlwaysScenes ??
    RUNTIME_CAPTCHA_ALWAYS_SCENES_DEFAULT;

  return {
    featureFlags: { ...seed.featureFlags },
    publicStats: {
      ...publicStats,
      hashratePercentileTable: publicStats.hashratePercentileTable.map((bucket) => ({ ...bucket })),
    },
    onlineBonus: { ...seed.onlineBonus },
    riskCluster: { ...seed.riskCluster },
    withdrawRules: {
      ...RUNTIME_WITHDRAW_RULE_DEFAULTS,
      ...seed.withdrawRules,
      networkConfirmFeeUsd: { ...networkConfirmFeeUsd },
    },
    rewards: {
      welcomeGift: { ...seed.rewards.welcomeGift },
      inviterReward: { ...seed.rewards.inviterReward },
    },
    riskScore: {
      dimensionWeights: { ...seed.riskScore.dimensionWeights },
      weakSignalClusterThreshold: seed.riskScore.weakSignalClusterThreshold,
    },
    otpGate: {
      ...seed.otpGate,
      captchaAlwaysScenes: [...captchaAlwaysScenes],
    },
    computeShare: {
      downloadUrl: seed.computeShare.downloadUrl,
      content: { ...seed.computeShare.content },
      gpuTiers: seed.computeShare.gpuTiers.map((tier) => ({
        ...tier,
        keywords: [...tier.keywords],
      })),
    },
    share: {
      baseUrl: seed.share.baseUrl,
      channels: seed.share.channels.map((channel) => ({ ...channel })),
      appDownload: { ...seed.share.appDownload },
    },
  };
}
