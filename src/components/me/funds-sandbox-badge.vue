<template>
  <view
    v-if="visible"
    class="nx-funds-sandbox-badge"
    data-testid="funds-sandbox-badge"
    role="status"
    aria-live="polite"
    style="margin: 0 16px 12px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--v5-warning) 36%, transparent); border-radius: 12px; background: var(--v5-warning-soft); text-align: center"
  >
    <!-- i18n-en-ok: source=mock / SANDBOX are backend provenance markers, not an App runtime mode. -->
    <text class="font-mono-tabular" style="font-size: 12px; font-weight: 800; letter-spacing: 0.01em; color: var(--v5-warning)">Development Funds · source=mock · SANDBOX</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { developmentFundsEnabled } from "@/api/runtime";
import { useApp } from "@/store/app";

const app = useApp();

// The dev environment and the authenticated GET
// /api/app/wallet/sandbox response must have passed the strict parser. Either
// missing or contradictory input leaves this hidden, so production cannot gain
// a development-funds label from stale client state alone.
const visible = computed(() => {
  const evidence = app.fundsSandboxEvidence;
  return developmentFundsEnabled
    && app.fundsSandboxStatus === "ready"
    && evidence?.source === "mock"
    && evidence.sourceEnvironment === "SANDBOX"
    && evidence.mode === "LOCAL_SANDBOX";
});
</script>
