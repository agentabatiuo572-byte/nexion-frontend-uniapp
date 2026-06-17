<!--
  AddDeviceRow — ZONE 2 fleet "add a box" row (ported from mission-control.tsx
  AddDeviceRow). Targets the next upgrade tier (derivePromoUpgrade) so a Pro/Rack
  owner is pushed up-ladder; taps to that tier's store page.
-->
<template>
  <view class="grid items-center gap-3 py-3.5" :style="rootStyle" @click="go">
    <view class="grid place-items-center" style="width: 38px; height: 38px; border-radius: 10px; border: 1.5px dashed var(--v5-brand-border); color: var(--v5-brand)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14" /><path d="M12 5v14" />
      </svg>
    </view>
    <view class="min-w-0">
      <text class="block" style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.addNexionBox }}</text>
      <text class="block font-mono-tabular mt-0.5" style="font-size: 12px; color: var(--v5-ink-3)">{{ paybackText }}</text>
    </view>
    <view class="tabular-nums text-right whitespace-nowrap">
      <text class="block" style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-brand)">${{ targetDailyText }}</text>
      <text class="block font-mono-tabular" style="font-size: 10.5px; color: var(--v5-ink-3); font-weight: 500">{{ t.home.estPerDay }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { derivePromoUpgrade } from "@/store/device-types";

const props = defineProps<{ hasDevices: boolean }>();
const t = useT();
const app = useApp();

const promo = computed(() => derivePromoUpgrade(app.devices));
const paybackText = computed(() => fmt(t.value.home.addBoxPayback, { n: promo.value.targetPayback }));
const targetDailyText = computed(() => promo.value.targetDaily.toFixed(2));

const rootStyle = computed<CSSProperties>(() => ({
  gridTemplateColumns: "40px 1fr auto",
  borderTop: props.hasDevices ? "1px solid var(--v5-border)" : "none",
}));

function go() {
  uni.navigateTo({ url: `/pages/store/detail?id=${promo.value.targetKind}`, fail: () => {} });
}
</script>
