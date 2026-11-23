<!--
  OnGridSection — ZONE 2 "what the network is computing now" (ported from
  mission-control.tsx OnGridSection). Header (On UVEL grid · now · Map) + 3
  client rows (company badge · company · model·city) + live footer. The formal
  App reads client rows from Java Home and display metrics from H9.
-->
<template>
  <view data-home-section="on-grid">
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: var(--ui-type-card-title-weight); font-size: var(--ui-type-card-title); color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.onGridTitle }} <text class="on-grid__title-note">{{ t.home.onGridNow }}</text></text>
      <text class="inline-flex items-center active:opacity-70 nx-after-chevron" style="min-height: 44px; padding-left: 12px; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3)" role="link" tabindex="0" data-home-action="on-grid-map" @click="goGlobe" @keydown.enter.stop.prevent="goGlobe">{{ t.home.onGridMap }}</text>
    </view>

    <!-- Not a focal block on any approved board, so a solid card (01 §1.1.2): surface, soft shadow in light. -->
    <view class="on-grid__card">
      <view
        v-for="(c, i) in gridClients"
        :key="c.id"
        class="grid items-center gap-3 px-4 py-2.5"
        :style="{ gridTemplateColumns: '32px 1fr', borderBottom: i < gridClients.length - 1 ? '1px solid var(--v5-border)' : 'none' }"
      >
        <view class="grid place-items-center" style="width: 30px; height: 30px; border-radius: 8px; background: var(--v5-brand-soft)">
          <text class="on-grid__initial" :style="{ color: c.color }">{{ companyInitial(c.name) }}</text>
        </view>
        <view class="min-w-0">
          <!-- The rows open nothing, so names wrap in full instead of being cut (03 §3.6.1). -->
          <text class="on-grid__name">{{ c.name ?? "—" }}</text>
          <text class="on-grid__meta">{{ c.model ?? "—" }} <text style="color: var(--v5-ink-4)">·</text> {{ c.city ?? "—" }}</text>
        </view>
      </view>
      <view ref="footerRef" class="px-4 py-2 flex items-center justify-between on-grid__footer" :class="{ 'nx-loops-paused': !footerRunning }" style="border-top:1px solid var(--v5-border);min-height:44px">
        <view class="flex items-center" style="gap:6px;min-width:0">
          <view v-if="activeDevices !== null && activeDevices > 0" class="on-grid__dot nx-online-dot" aria-hidden="true" />
          <text><text class="font-mono-tabular" style="color:var(--v5-ink);font-weight:500"><NxTickNumber :text="onlineBand" /></text> {{ t.home.onGridOnline }}</text>
        </view>
        <text class="font-mono-tabular" style="color:var(--v5-ink);font-weight:500">{{ perSecText }}</text>
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
.on-grid__card { overflow: hidden; border-radius: var(--ui-radius-surface); background: var(--v5-surface); }
[data-theme="light"] .on-grid__card { box-shadow: var(--v5-glass-shadow); }
.on-grid__title-note { font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); letter-spacing: 0; }
.on-grid__initial { font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); }
.on-grid__name { display: block; min-width: 0; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.on-grid__meta { display: block; margin-top: 2px; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: break-word; }
/* Figures in JetBrains Mono, the label in the interface font (01 §1.2, 06 §6.3); aux figure role. */
.on-grid__footer { font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.on-grid__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--v5-success); }
</style>
