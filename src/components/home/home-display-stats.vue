<template>
  <view ref="elRef" class="home-display-stats" :class="{ 'nx-loops-paused': !running }">
    <view class="home-display-item">
      <view v-if="value && value.online > 0" class="home-display-dot nx-online-dot" aria-hidden="true" />
      <NxTickNumber class="home-display-number" :text="value ? networkPopulationBand(value.online, locale.code) : null" />
      <text>{{ t.intro.statsDevices }}</text>
    </view>
    <view class="home-display-separator" />
    <view class="home-display-item">
      <NxTickNumber class="home-display-number home-display-number--brand" :text="value ? platformAmountBand(value.paid) : null" />
      <text>{{ t.intro.statsPaidTotal }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useHomeDisplay } from "@/composables/use-home-display";
import { useLoopsInView } from "@/composables/use-loops-in-view";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { networkPopulationBand, platformAmountBand } from "@/lib/platform-stats";
import NxTickNumber from "@/components/ui/nx-tick-number.vue";

// Platform figures as bands (06 §6.4), rolling on a band change; the online dot breathes while the pill is on screen.
const props = defineProps<{ active: boolean }>();
const t = useT();
const locale = useLocaleStore();
const value = useHomeDisplay(() => props.active);
const { elRef, running } = useLoopsInView(".home-display-stats");
</script>

<style scoped>
.home-display-stats { display: inline-flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; padding: 9px 16px; border-radius: 999px; background: var(--v5-surface); font-size: 12px; line-height: 1.5; color: var(--v5-ink-3); }
.home-display-item { display: flex; align-items: center; gap: 6px; }
.home-display-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--v5-success); }
.home-display-number { font-weight: 500; font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.home-display-number--brand { color: var(--v5-brand); }
.home-display-separator { height: 12px; border-left: 1px solid var(--v5-border-strong); }
</style>
