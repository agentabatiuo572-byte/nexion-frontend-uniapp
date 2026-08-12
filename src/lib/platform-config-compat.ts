import type { PlatformConfig, PlatformConfigSeed } from "@/store/config-types";

// Compatibility belongs to the runtime config boundary, not to local Mock
// datasets. Remove these fallbacks when GET /api/config/platform is wired and
// older seeds are no longer supported.
const RUNTIME_PUBLIC_STATS_DEFAULT: PlatformConfig["publicStats"] = {
  // Deliberately invalid sentinel: H9 must stay unavailable until the server
  // projection is fetched and validated. Never replace it with plausible data.
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

// 🔴 这里没有 dailyWithdrawLimitCount,且不许加回来:每日提现笔数上限的唯一来源是
// 服务端 `GET /api/withdrawals/policy`。放一个本地默认值在这儿,等于给「客户端按写死的
// 1 笔拦人、而服务端配的是 3 笔」留了后门(z1 审计 P0-1 同批发现)。
const RUNTIME_WITHDRAW_RULE_DEFAULTS = {
  smallAmountThresholdUsd: 50,
  payoutSlaHours: 24,
  payoutReviewWindowDays: 0,
  networkConfirmFeeUsd: { trc20: 1, bep20: 1, erc20: 5 },
} satisfies Pick<
  PlatformConfig["withdrawRules"],
  | "smallAmountThresholdUsd"
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
