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
      <text class="font-mono-tabular inline-flex items-center active:opacity-70" style="min-height: 44px; padding-left: 12px; font-size: 13px; color: var(--v5-brand); font-weight: 500" role="link" tabindex="0" data-home-action="on-grid-map" @click="goGlobe" @keydown.enter.stop.prevent="goGlobe">{{ t.home.onGridMap }} →</text>
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
      <view class="nx-glass-inset px-4 py-2 flex items-center justify-between font-mono-tabular" style="border-top:1px solid var(--v5-border);font-size:12px;color:var(--v5-ink-3);min-height:44px">
        <text><text style="color:var(--v5-ink);font-weight:500">{{ activeDevicesText }}</text> {{ t.home.onGridOnline }}</text>
        <text style="color:var(--v5-success-ink);font-weight:500">{{ perSecText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatAmount } from "@/lib/amount-display";
import { networkPopulationBand } from "@/lib/platform-stats";
import { navTo } from "@/lib/route";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import { apiClient } from "@/api/runtime";
import { createHomeDisplayPlayer, parseHomeDisplayBatch, type homeDisplayAt } from "@/lib/home-display-player";
import { onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { computed, ref, onMounted, onUnmounted } from "vue";

const t = useT();
const app = useApp();
const cfg = useConfig();
const displayValue = ref<ReturnType<typeof homeDisplayAt>>(null);
const batchLoading = ref(false);
const batchFailed = ref(false);
const player = createHomeDisplayPlayer({
  fetch: async () => {
    try {
      const batch = parseHomeDisplayBatch(await apiClient.request({ path: "/api/config/home-display", authenticated: false }));
      batchFailed.value = false;
      return batch;
    } catch (cause) { batchFailed.value = true; throw cause; }
  },
  now: () => typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now(),
  render: next => { displayValue.value = next; },
  onLoading: loading => { batchLoading.value = loading; },
});
let visible = false;
useAutoRecovery({ failed: () => batchFailed.value && !batchLoading.value, retry: () => player.refresh() });
useAutoRecovery({ failed: () => cfg.configStatus === "failed", retry: () => cfg.load() });
function syncVisibility() {
  if (visible && (typeof document === "undefined" || !document.hidden)) player.start();
  else player.stop();
}
onShow(() => { visible = true; syncVisibility(); });
onHide(() => { visible = false; syncVisibility(); });
onMounted(() => { if (typeof document !== "undefined") document.addEventListener("visibilitychange", syncVisibility); });
onUnmounted(() => {
  player.stop();
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", syncVisibility);
});
const devicesBad = computed(() => cfg.syncFailed || !Number.isSafeInteger(cfg.config.networkPulse?.onlineDevices) || cfg.config.networkPulse!.onlineDevices! < 0);
const fleetBad = computed(() => displayValue.value === null);
const gridStatusText = computed(() => cfg.loading || batchLoading.value
  ? t.value.home.networkStatUpdating
  : t.value.uiChrome.unavailable);
const perSecText = computed(() => {
  const value = displayValue.value?.paidPerSec;
  if (value == null) return "—";
  return `+${formatAmount(value)}/sec`;
});
defineExpose({ refresh: () => player.refresh() });

const gridClients = computed(() => (app.homeTruth?.onGrid.clients ?? [])
  .map((client) => ({ ...client, color: "var(--v5-brand)" })));
const activeDevicesText = computed(() => {
  return devicesBad.value ? "—" : networkPopulationBand(cfg.config.networkPulse!.onlineDevices!);
});

function companyInitial(value: string | null) {
  return value?.trim().charAt(0).toUpperCase() || "—";
}
function goGlobe() {
  navTo("/pages/globe/globe");
}


</script>
