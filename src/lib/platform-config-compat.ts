import type { PlatformConfig, PlatformConfigSeed } from "@/store/config-types";

// Compatibility belongs to the runtime config boundary, not to local Mock
// datasets. Remove these fallbacks when GET /api/config/platform is wired and
// older seeds are no longer supported.
const RUNTIME_PUBLIC_STATS_DEFAULT: PlatformConfig["publicStats"] = {
  // Deliberately invalid sentinel: H9 must stay unavailable until the server
  // projection is fetched and validated. Never replace it with plausible data.
  // 🔴 全零还不够非法:publicStatsHealth 的 members/rank/jitter 合法域包含 0,
  // 全零种子曾让首页把「Members 0 +0%/mo」当真数据渲染(z1 判决包 B7)。
  // 三个 -1 保证六个健康位全部 false —— 改回 0 前先去看 publicStatsHealth 的域。
  fleetDevices: 0,
  onlineRatePct: 0,
  onlineJitter: -1,
  registeredUsersBase: 0,
  registeredUsersMonthlyGrowthPct: -1,
  registeredUsersAnchorAt: 0,
  realUserCount: 0,
  virtualUserCount: -1,
  hashratePercentileTable: [],
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
