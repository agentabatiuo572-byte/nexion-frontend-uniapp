import type { PlatformConfig } from "@/store/config-types";
import { GPU_TIERS } from "@/lib/gpu-tiers";

// MOCK-ONLY seed for platform config / feature flags (backend-replaceable).
// PROD: `GET /api/config/platform` returns this exact shape; the admin console
// (E 域「算力与设备配置」+ K 域风控参数) is the single authoring surface. Client
// treats the fetched config as read-only.
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  featureFlags: {
    // DR-1: 电脑算力默认 OFF。
    computeShareEnabled: false,
  },
  // SPEC-1 在线加成系数(单一来源:lib/hashpower.ts 派生 H5_BASE_FACTOR / CONTINUITY_FULL_MS)。
  // 与 admin compute-config COMPUTE_COEFFICIENTS 同 key,运营在 E6 调,PROD 由服务端下发。
  onlineBonus: {
    h5BaseFactor: 0.6,
    continuityFullHours: 2,
  },
  // SPEC-7 mock seed only. PROD: server/admin owns these values; client must
  // not bake any of them into registration, settlement, or withdrawal logic.
  riskCluster: {
    freePhoneSlotsPerCluster: 1,
    duplicateAccountPendingFrom: 2,
    duplicateAccountFreezeFrom: 4,
    pendingReleaseHours: 72,
    appAttestationReleaseHours: 2,
    maxSignupPerIp24h: 3,
    maxAccountsPerDevice: 2,
    maxAccountsPerPaymentInstrument: 1,
    clusterFreezeSuggestThreshold: 0.82,
    releaseMode: "attest_or_manual",
    freeSlotRequiresBinding: true,
  },
  withdrawRules: {
    minWithdrawableUsdt: 20,
    sameAddressRoute: "manual",
    firstWithdrawalManual: true,
    newAddressHoldHours: 24,
  },
  rewards: {
    // NEX 数量原 200(≈免费 $2000 提现抵扣额度)过松,已收紧到 20;此处仅 mock seed,运营在 K 域调。
    welcomeGift: { lockMode: "risk_bucket", usdtAmount: 5, nexAmount: 20 },
  },
  // FEAT-AUTH01 OTP 闸门 mock seed(PRD §4.6.2/§16.2.1;运营在 K 域调)。
  otpGate: {
    resendSeconds: 60,
    captchaAfterSends: 2,
    otpTtlSeconds: 300,
    maxVerifyAttempts: 5,
    captchaTicketTtlSeconds: 120,
  },
  // SPEC-7 §5b 七维权重 mock seed(K4 权威可配)。强维 0.8+,中维 0.4-0.5,弱维 ≤0.3。
  riskScore: {
    dimensionWeights: {
      serverDeviceId: 0.9,
      ipBucket: 0.8,
      withdrawAddress: 0.9,
      paymentInstrument: 0.5,
      sponsor: 0.4,
      uaFingerprint: 0.2,
      signupTiming: 0.3,
    },
    weakSignalClusterThreshold: 0.6,
  },
  // SPEC-2 M5/M6: structure mirrors admin E6 compute config. DR-7: mock-only,
  // not wired to the admin console yet; PROD server makes this authoritative.
  computeShare: {
    downloadUrl: "",
    content: {
      zhTitle: "电脑显卡算力共享",
      zhGuide: "下载桌面客户端,使用同一账号登录,连接后电脑会出现在设备仓库中。",
      enTitle: "电脑 GPU 共享",
      enGuide: "下载桌面客户端,使用同一账号登录,连接后电脑会出现在设备仓库中。",
    },
    gpuTiers: GPU_TIERS,
  },
};
