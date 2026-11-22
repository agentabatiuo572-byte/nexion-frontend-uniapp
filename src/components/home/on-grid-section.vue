<!--
  OnGridSection — ZONE 2 "what the network is computing now" (ported from
  mission-control.tsx OnGridSection). Header (On UVEL grid · now · Map) + 3
  client rows (company badge · company · model·city) + live footer. The formal
  App reads client rows from Java Home and display metrics from H9.
-->
<template>
  <view data-home-section="on-grid">
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: var(--ui-type-card-title-weight); font-size: var(--ui-type-card-title); color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.onGridTitle }} <text class="font-mono-tabular" style="font-size: 12px; font-weight: 400; color: var(--v5-ink-3)">{{ t.home.onGridNow }}</text></text>
      <text class="inline-flex items-center active:opacity-70 nx-after-chevron" style="min-height: 44px; padding-left: 12px; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3)" role="link" tabindex="0" data-home-action="on-grid-map" @click="goGlobe" @keydown.enter.stop.prevent="goGlobe">{{ t.home.onGridMap }}</text>
    </view>

    <view class="nx-glass-card" style="background: var(--nx-glass-fill); box-shadow: var(--nx-glass-edge); border-radius: var(--nx-glass-radius); overflow: hidden">
      <view
        v-for="(c, i) in gridClients"
        :key="c.id"
        class="grid items-center gap-3 px-4 py-2.5"
        :style="{ gridTemplateColumns: '32px 1fr', borderBottom: i < gridClients.length - 1 ? '1px solid var(--v5-border)' : 'none' }"
      >
        <view class="grid place-items-center" style="width: 30px; height: 30px; border-radius: 8px; background: var(--v5-brand-soft)">
          <text :style="{ color: c.color, fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '12px' }">{{ companyInitial(c.name) }}</text>
        </view>
        <view class="min-w-0">
          <text class="block truncate" style="font-family: var(--font-v5); font-weight: 500; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink); letter-spacing: -0.008em">{{ c.name ?? "—" }}</text>
          <text class="block font-mono-tabular mt-0.5 truncate" style="font-size: 12px; color: var(--v5-ink-3)">{{ c.model ?? "—" }} <text style="color: var(--v5-ink-4)">· {{ c.city ?? "—" }}</text></text>
        </view>
      </view>
      <view ref="footerRef" class="nx-glass-inset px-4 py-2 flex items-center justify-between font-mono-tabular on-grid__footer" :class="{ 'nx-loops-paused': !footerRunning }" style="border-top:1px solid var(--v5-border);font-size:12px;color:var(--v5-ink-3);min-height:44px">
        <view class="flex items-center" style="gap:6px;min-width:0">
          <view v-if="onlineBand !== null" class="on-grid__dot nx-online-dot" aria-hidden="true" />
          <text><text style="color:var(--v5-ink);font-weight:500"><NxTickNumber :text="onlineBand" /></text> {{ t.home.onGridOnline }}</text>
        </view>
        <text style="color:var(--v5-success-ink);font-weight:500">{{ perSecText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { refreshHomeDisplay, useHomeDisplay } from "@/composables/use-home-display";
import { formatAmount } from "@/lib/amount-display";
import { networkPopulationBand } from "@/lib/platform-stats";
import { useLocaleStore } from "@/store/locale";
import { useLoopsInView } from "@/composables/use-loops-in-view";
import { navTo } from "@/lib/route";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import { remoteApiEnabled } from "@/api/runtime";
import { computed } from "vue";
import NxTickNumber from "@/components/ui/nx-tick-number.vue";

const t = useT();
const app = useApp();
const cfg = useConfig();
const locale = useLocaleStore();
const displayValue = useHomeDisplay();
// The online figure is a platform band (06 §6.4); its live dot breathes only while the footer is on screen.
const { elRef: footerRef, running: footerRunning } = useLoopsInView(".on-grid__footer");
const perSecText = computed(() => {
  const value = displayValue.value?.paidPerSec;
  if (value == null) return "—";
  return `+${formatAmount(value)}/sec`;
});
defineExpose({ refresh: refreshHomeDisplay });

const gridClients = computed(() => (app.homeTruth?.onGrid.clients ?? [])
  .map((client) => ({ ...client, color: "var(--v5-brand)" })));
const activeDevices = computed(() => {
  if (remoteApiEnabled) return displayValue.value?.online ?? null;
  const online = cfg.config.networkPulse?.onlineDevices;
  return !cfg.syncFailed && online != null && Number.isSafeInteger(online) && online >= 0 ? online : null;
});

const onlineBand = computed(() => activeDevices.value === null ? null : networkPopulationBand(activeDevices.value, locale.code));

function companyInitial(value: string | null) {
  return value?.trim().charAt(0).toUpperCase() || "—";
}
function goGlobe() {
  navTo("/pages/globe/globe");
}


</script>

<style scoped>
.on-grid__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--v5-success); }
</style>
