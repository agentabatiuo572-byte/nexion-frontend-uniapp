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

// ── SPEC-7 §5 风险簇释放参数(推倒重写版)──────────────────────────────
// server/admin canonical. Client reads these as config, never as business
// constants. Defaults live only in mock/platform-config (mock seed).
// K1 是风险簇权威;K4 是评分权威;K3 是提现路由权威。

// R1(整改): pending 释放模式。没有 "auto" —— 观察窗口到达永不自动释放,
// 释放源只有 App 在线证明或 D2 人工放行。
export type PendingReleaseMode = "attest_or_manual" | "manual_only";

export interface RiskClusterConfig {
  freePhoneSlotsPerCluster: number;
  duplicateAccountPendingFrom: number;
  duplicateAccountFreezeFrom: number;
  // R1: 观察窗口只作运营/熔断统计口径 —— 到达不触发任何释放。
  pendingReleaseHours: number;
  appAttestationReleaseHours: number;
  maxSignupPerIp24h: number;
  maxAccountsPerDevice: number;
  maxAccountsPerPaymentInstrument: number;
  clusterFreezeSuggestThreshold: number;
  releaseMode: PendingReleaseMode;
  // R4: 首号免费槽收益进可提前,需至少一次有效绑定(支付/推荐/App 在线证明)。
  freeSlotRequiresBinding: boolean;
}

export type WithdrawalRiskRoute = "pass" | "delay" | "manual" | "freeze" | "reject";

export interface WithdrawRulesConfig {
  minWithdrawableUsdt: number;
  sameAddressRoute: WithdrawalRiskRoute;
  // R2 冷启动保守: 新账户首次提现无条件人工,兜「每号换指纹+换地址」的分散薅。
  firstWithdrawalManual: boolean;
  // R2: 提现地址首次绑定后 N 小时内提现走 delay/manual。
  newAddressHoldHours: number;
}

// 新人礼发放模式: risk_bucket = 按当前风险簇分桶(默认);direct = 直入可提(运营可关闸)。
export type WelcomeGiftLockMode = "risk_bucket" | "direct";

export interface RewardsConfig {
  welcomeGift: {
    lockMode: WelcomeGiftLockMode;
    // 注册礼包金额(运营可调;admin K.rewards.welcomeGift.* 同键,CGM-F-020)。
    usdtAmount: number;
    nexAmount: number;
  };
}

// ── SPEC-7 §5b K1 聚簇维度权重(K4 可配)──────────────────────────────
// mock K4 分数 = 命中维度的权重和(cap 1);强维命中直接入簇(OR),
// 中/弱维叠加权重 ≥ weakSignalClusterThreshold 才入簇。空维度不计分(空值降权)。
export interface RiskScoreConfig {
  dimensionWeights: {
    serverDeviceId: number;
    ipBucket: number;
    withdrawAddress: number;
    paymentInstrument: number;
    sponsor: number;
    uaFingerprint: number;
    signupTiming: number;
  };
  weakSignalClusterThreshold: number;
}

// ── FEAT-AUTH01 OTP 发送闸门参数(PRD §4.6.2/§16.2.1;K 域风控可配)────
// server/admin canonical. Client reads as config, never as business constants.
export interface OtpGateConfig {
  // Resend 冷却(秒);client 倒计时以 otpSend 响应的 resendAfterSec 为准。
  resendSeconds: number;
  // 24h 滑动窗内成功 send 达到此值后,下一次 send 需过滑块(≥3 次触发 → 值为 2)。
  captchaAfterSends: number;
  // OTP server-side 有效期(秒)。
  otpTtlSeconds: number;
  // 单个 code 允许的 verify 错误次数,用尽即作废。
  maxVerifyAttempts: number;
  // 滑块通过后签发 ticket 的有效期(秒),单次使用。
  captchaTicketTtlSeconds: number;
}

// ── FEAT-SHARE01 分享链路配置(§13.3 share.*;K/E 域运营可调)─────────────
// server/admin canonical. Client reads as config, never as business constants.
// baseUrl 为空(mock/dev)时由 lib/share 回退运行时 origin,不产出死链。

// web = H5 可直接唤起的分享 intent URL;scheme = 仅 App 直发(H5 走复制降级);
// copy / poster / system = 本地动作,无外链模板。
export type ShareIntentType = "web" | "scheme" | "copy" | "poster" | "system";

export type ShareChannelKey =
  | "zalo"
  | "telegram"
  | "whatsapp"
  | "messenger"
  | "sms"
  | "x"
  | "copy"
  | "poster"
  | "system";

export interface ShareChannelDef {
  key: ShareChannelKey;
  intentType: ShareIntentType;
  // web 型必填:intent 模板,{link}/{text} 占位(URL-encode 后代入)。
  urlTemplate?: string;
  // App 壳已装检测参数(H5 忽略;v1 仅承载结构,检测在组件层接入)。
  androidPackage?: string;
  iosScheme?: string;
  enabled: boolean;
}

export interface ShareConfig {
  // 短链前缀(如 https://nexion.ai/ref/)。空串 = dev 回退运行时 origin。
  baseUrl: string;
  // 顺序即渠道面板展示序(越南盘默认 Zalo 首位)。
  channels: ShareChannelDef[];
  // 注册成功页下载引导;全空 = 未上架态(隐藏下载 CTA)。
  appDownload: {
    iosUrl: string;
    androidUrl: string;
    apkUrl: string;
  };
}

export interface PlatformConfig {
  featureFlags: FeatureFlags;
  onlineBonus: OnlineBonus;
  riskCluster: RiskClusterConfig;
  withdrawRules: WithdrawRulesConfig;
  rewards: RewardsConfig;
  riskScore: RiskScoreConfig;
  otpGate: OtpGateConfig;
  computeShare: {
    downloadUrl: string;
    content: ComputeShareContent;
    gpuTiers: GpuTier[];
  };
  share: ShareConfig;
}
