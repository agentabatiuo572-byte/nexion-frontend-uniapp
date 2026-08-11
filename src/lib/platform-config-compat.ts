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
  // 🔴 小额免审(WD01 快车道)= 关闭。0 是**判定层的关闭开关**,不是"没配值":
  // isFastLane 要求 thresholdUsd > 0 才生效,0 → 一道闸都不免。
  //
  // 为什么必须是 0(2026-08-11 主人拍板"真停"):此前这里是 50,而 wallet-withdraw.vue
  // 的 smallAmountLine 恒 0、注释写着「WD01 is HOLD:后端尚未执行免审」——两句话同时为真,
  // 因为 HOLD 只做在**页面**那一层,判定层照旧拿这个 50 免掉「首提必审」与「新地址 hold」,
  // 页面还会弹「这笔可立即处理 · 已免去:首次提现审核」。后端不兑现的承诺不该由前端发放。
  //
  // 更硬的一条:config.ts 的远端同步只覆盖 featureFlags / onlineBonus / rewards /
  // computeShare,withdrawRules **永远不被服务端覆盖** —— 所以这个值一旦非 0,就是一份
  // 服务端够不着、运营改不动的客户端自发风控豁免。要恢复快车道,先把 withdrawRules
  // 接进远端同步(连带 dailyWithdrawLimitCount 等同族键),不要只把这里改回非 0。
  // 守门:selfcheck-config-compat ④(合成有效值 + 首提 $30 仍走 manual 的行为固定靶)。
  smallAmountThresholdUsd: 0,
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
