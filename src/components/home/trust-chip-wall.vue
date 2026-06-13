<!--
  TrustChipWall — ZONE 7 trust close (ported from mission-control.tsx
  TrustChipWall). "Independently audited" header + brand/cert chip row + reserve-
  proof footer. Chip labels are proper nouns (vendor/cert names, untranslated).
-->
<template>
  <view class="block" style="background: var(--v5-surface); border: 1px solid var(--v5-border); border-radius: 16px; padding: 14px 16px" @click="goTrust">
    <view class="flex items-center gap-1.5 font-mono-tabular mb-2.5" style="font-size: 12px; color: var(--v5-ink-3)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <text>{{ t.home.trustAudited }}</text>
    </view>

    <view class="flex flex-wrap gap-1.5">
      <text
        v-for="n in CHIPS"
        :key="n"
        class="font-mono-tabular"
        style="padding: 3px 9px; border-radius: 999px; font-size: 11px; background: var(--v5-surface-2); color: var(--v5-ink-2); border: 1px solid var(--v5-border); font-weight: 500"
      >{{ n }}</text>
    </view>

    <text class="block mt-2.5 font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-3)">{{ t.home.trustReserve }}</text>
  </view>
</template>

<script setup lang="ts">
import { useT } from "@/i18n/use-t";

const t = useT();
const CHIPS = ["NVIDIA", "Intel", "AMD", "CertiK ✓", "SOC 2", "GDPR", "ISO 27001"];

function goTrust() {
  uni.navigateTo({ url: "/pages/trust/trust", fail: () => {} });
}
</script>
