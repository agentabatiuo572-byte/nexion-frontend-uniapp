import type { PlatformConfig } from "@/store/config-types";
import { GPU_TIERS } from "@/lib/gpu-tiers";

// MOCK-ONLY seed for platform config / feature flags (backend-replaceable).
// PROD: `GET /api/config/platform` returns this exact shape; the admin console
// (E 域「算力与设备配置」) is the single authoring surface. Client treats the
// fetched config as read-only.
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
  },
  withdrawRules: {
    minWithdrawableUsdt: 20,
    sameAddressRoute: "manual",
  },
  // SPEC-2 M5/M6: structure mirrors admin E6 compute config. DR-7: mock-only,
  // not wired to the admin console yet; PROD server makes this authoritative.
  computeShare: {
    downloadUrl: "",
    content: {
      zhTitle: "电脑显卡算力共享",
      zhGuide: "下载桌面客户端,使用同一账号登录,连接后电脑会出现在设备仓库中。",
      enTitle: "Computer GPU share",
      enGuide: "Download the desktop client, sign in with the same account, and the computer appears in device inventory after connection.",
    },
    gpuTiers: GPU_TIERS,
  },
};
