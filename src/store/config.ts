import { defineStore } from "pinia";
import { ref } from "vue";
import type { ComputeShareContent, FeatureFlagKey, PlatformConfig } from "./config-types";
import { DEFAULT_PLATFORM_CONFIG } from "@/mock/platform-config";

const IS_PRODUCTION = import.meta.env.PROD;

// Platform config / feature-flag store. Single source for client-side feature
// flags + tunable platform config across all carriers (signed APP / H5 /
// janus-loaded real-disc).
//
// MOCK-ONLY: seeded from mock/platform-config.ts. PROD: replace the seed with
// `GET /api/config/platform` on app boot; the admin console pushes updates and
// the client treats config as READ-ONLY (no client mutation in production).
export const useConfig = defineStore("config", () => {
  // PROD: hydrate from GET /api/config/platform instead of the mock seed.
  const config = ref<PlatformConfig>({
    featureFlags: { ...DEFAULT_PLATFORM_CONFIG.featureFlags },
    onlineBonus: { ...DEFAULT_PLATFORM_CONFIG.onlineBonus },
    riskCluster: { ...DEFAULT_PLATFORM_CONFIG.riskCluster },
    withdrawRules: { ...DEFAULT_PLATFORM_CONFIG.withdrawRules },
    computeShare: {
      downloadUrl: DEFAULT_PLATFORM_CONFIG.computeShare.downloadUrl,
      content: { ...DEFAULT_PLATFORM_CONFIG.computeShare.content },
      gpuTiers: DEFAULT_PLATFORM_CONFIG.computeShare.gpuTiers.map((tier) => ({
        ...tier,
        keywords: [...tier.keywords],
      })),
    },
  });

  function isEnabled(flag: FeatureFlagKey): boolean {
    return config.value.featureFlags[flag] === true;
  }

  // ⚠️ MOCK-ONLY demo helper: lets reviewers flip a flag locally to preview a
  // gated entry without an admin round-trip (front/back are not wired in the
  // prototype, DR-7). PROD: flags come from the server only; client never
  // mutates — remove this when wiring the real endpoint.
  function _devSetFlag(flag: FeatureFlagKey, value: boolean) {
    if (IS_PRODUCTION) return;
    config.value = {
      ...config.value,
      featureFlags: { ...config.value.featureFlags, [flag]: value },
    };
  }

  function _devSetComputeShareContent(content: Partial<ComputeShareContent>) {
    if (IS_PRODUCTION) return;
    config.value = {
      ...config.value,
      computeShare: {
        ...config.value.computeShare,
        content: { ...config.value.computeShare.content, ...content },
      },
    };
  }

  return { config, isEnabled, _devSetFlag, _devSetComputeShareContent };
});
