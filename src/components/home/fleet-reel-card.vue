<!-- One device in the Home "My devices" reel: status, artwork, name, today's earnings and job state (no job name or progress). -->
<template>
  <view class="fleet-reel-card" :class="{ 'fleet-reel-card--online': online, 'fleet-reel-card--off': !online }" :data-device-id="device.id" role="button" tabindex="0" :aria-label="label" @click="go">
    <view class="fleet-reel-card__status"><view class="fleet-reel-card__dot" :class="{ 'nx-online-dot': online }" /><text>{{ statusText }}</text></view>
    <view class="fleet-reel-card__art"><DeviceArt class="fleet-reel-card__image" :device="device" /><view class="fleet-reel-card__floor" /></view>
    <text class="fleet-reel-card__name">{{ displayName }}</text>
    <view class="fleet-reel-card__kv"><text class="fleet-reel-card__key">{{ t.home.todayShort }}</text><text class="fleet-reel-card__money">{{ todayText }}</text></view>
    <view class="fleet-reel-card__kv"><text class="fleet-reel-card__key">{{ t.home.jobLabel }}</text><text class="fleet-reel-card__job" :class="{ 'fleet-reel-card__job--dim': jobText === '—' }">{{ jobText }}</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDataVisibility } from "@/store/data-visibility";
import { fmtMoney } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { useComputeV2Copy } from "@/i18n/compute-v2";
import { navTo } from "@/lib/route";
import { deviceOnlineState } from "@/lib/hashpower";
import { deviceName } from "@/lib/device-copy";
import { deviceTaskRecovering } from "@/lib/task-progress";
import type { Device } from "@/store/types";
import DeviceArt from "@/components/device-art.vue";

const props = defineProps<{ device: Device; online: boolean; runtimeConfirmed: boolean; tasksConfirmed: boolean }>();
const visibility = useDataVisibility();
const t = useT();
const computeCopy = useComputeV2Copy();
const displayName = computed(() => deviceName(t.value, props.device));
// Same status rule and copy as the former Home device row.
const statusText = computed(() => deviceTaskRecovering(props.device) ? computeCopy.value.statuses.RECOVERING
  : deviceOnlineState(props.device, Date.now(), props.runtimeConfirmed) === "unknown" ? t.value.earn.runtimeUnknown
    : props.online ? t.value.earn.online : t.value.home.deviceOffline);
const todayText = computed(() => visibility.mask(props.runtimeConfirmed ? (props.device.todayEarnings > 0 ? "+" : "") + fmtMoney(props.device.todayEarnings) : "—"));
const jobText = computed(() => !props.online || !props.tasksConfirmed ? "—" : props.device.currentTask ? t.value.home.jobRunning : t.value.home.jobIdle);
const label = computed(() => `${t.value.earn.deviceDetailTitle}: ${displayName.value} · ${statusText.value} · ${t.value.home.todayShort} ${todayText.value} · ${t.value.home.jobLabel} ${jobText.value}`);

function go() {
  navTo(`/pages/earn/device-detail?id=${encodeURIComponent(props.device.id)}&from=home`);
}
</script>

<style scoped>
.fleet-reel-card { position: relative; display: flex; flex-direction: column; width: 164px; min-height: 220px; height: 100%; box-sizing: border-box; padding: 12px; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); overflow: hidden; cursor: pointer; }
[data-theme="light"] .fleet-reel-card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.fleet-reel-card:active { opacity: .85; }
.fleet-reel-card:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.fleet-reel-card--online::before { content: ""; position: absolute; left: 0; right: 0; top: 22px; height: 128px; background: radial-gradient(55% 50% at 50% 55%, color-mix(in srgb, var(--v5-success) 13%, transparent), transparent 72%); pointer-events: none; }
.fleet-reel-card__status { position: relative; display: flex; align-items: center; gap: 6px; height: 16px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.fleet-reel-card__dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--v5-ink-4); }
.fleet-reel-card__dot.nx-online-dot { background: var(--v5-success); }
.fleet-reel-card__art { position: relative; flex: none; width: 132px; height: 98px; margin: 6px auto 0; }
.fleet-reel-card__image { position: absolute; inset: 0; width: 100%; height: 100%; }
.fleet-reel-card--off .fleet-reel-card__image { filter: grayscale(.75); opacity: .55; }
.fleet-reel-card__floor { position: absolute; left: 18%; right: 18%; bottom: -3px; height: 9px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-bg) 65%, transparent), transparent); }
[data-theme="light"] .fleet-reel-card__floor { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-ink) 20%, transparent), transparent); }
.fleet-reel-card__name { position: relative; display: block; margin-top: 8px; font: 500 15px/20px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fleet-reel-card__kv { position: relative; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 2px; }
.fleet-reel-card__key { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.fleet-reel-card__money { font: 500 17px/22px var(--font-metric); color: var(--v5-success-ink); letter-spacing: -.01em; white-space: nowrap; font-variant-numeric: tabular-nums; }
.fleet-reel-card__job { font: 500 13px/22px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fleet-reel-card__job--dim { color: var(--v5-ink-3); }
</style>
