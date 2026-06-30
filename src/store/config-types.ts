// Platform config / feature-flag types. Shared by the config store and its
// mock seed. PROD: this is the `GET /api/config/platform` response shape —
// the admin console (E 域「算力与设备配置」) is the authoring surface.

export interface FeatureFlags {
  // DR-1: 电脑算力(PC 共享)总开关。默认 false → 前端零入口零推送；
  // 后台一键开启后前端才长出弱入口。
  computeShareEnabled: boolean;
}

// Single source: derived from FeatureFlags keys — adding a flag to the
// interface auto-extends this union (no double-maintenance).
export type FeatureFlagKey = keyof FeatureFlags;

export type GpuTierId = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

export interface GpuTier {
  id: GpuTierId;
  label: string;
  keywords: string[];
  tops: number;
}

export interface ComputeShareContent {
  zhTitle: string;
  zhGuide: string;
  enTitle: string;
  enGuide: string;
}

// SPEC-1 在线加成系数 — admin E6「算力与设备配置」is the authoring surface; this
// shape is mirrored 1:1 in admin lib/mock/admin/compute-config.ts (COMPUTE_COEFFICIENTS).
// DR-7: each side mocks its own; structure/keys must match so PROD wires server→client.
export interface OnlineBonus {
  // H5 非常驻载体基础托管系数 ∈ (0,1]: effectiveTops = baseline × h5BaseFactor × network × jitter.
  h5BaseFactor: number;
  // App 连续在线满额时长(小时): continuity 因子在此时长达到满额 1.0(此前自 0.85 线性爬升)。
  continuityFullHours: number;
}

// SPEC-7 风险簇释放参数 — server/admin canonical. Client reads this as
// config, never as business constants. Defaults live only in mock/platform-config.
export interface RiskClusterConfig {
  freePhoneSlotsPerCluster: number;
  duplicateAccountPendingFrom: number;
  duplicateAccountFreezeFrom: number;
  pendingReleaseHours: number;
  appAttestationReleaseHours: number;
  maxSignupPerIp24h: number;
  maxAccountsPerDevice: number;
  maxAccountsPerPaymentInstrument: number;
  clusterFreezeSuggestThreshold: number;
}

export type WithdrawalRiskRoute = "pass" | "delay" | "manual" | "freeze" | "reject";

export interface WithdrawRulesConfig {
  minWithdrawableUsdt: number;
  sameAddressRoute: WithdrawalRiskRoute;
}

export interface PlatformConfig {
  featureFlags: FeatureFlags;
  onlineBonus: OnlineBonus;
  riskCluster: RiskClusterConfig;
  withdrawRules: WithdrawRulesConfig;
  computeShare: {
    downloadUrl: string;
    content: ComputeShareContent;
    gpuTiers: GpuTier[];
  };
}
