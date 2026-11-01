<!-- Earn fleet (P-62): device switcher chips over one device stage; empty, first-load and read-failure states take the stage's place. -->
<template>
  <view class="fleet-stage">
    <view v-if="app.remoteFleetStatus === 'error'" class="fleet-stage__banner" role="status">
      <view class="fleet-stage__banner-copy">
        <text class="fleet-stage__banner-title">{{ t.coreReview.fleetReadFailed }}</text>
        <text class="fleet-stage__banner-body">{{ t.coreReview.fleetReadRetry }}</text>
      </view>
      <view class="fleet-stage__retry" role="button" tabindex="0" @click="retryFleet"><text>{{ t.ui.retry }}</text></view>
    </view>
    <template v-else-if="!fleetReady">
      <view class="fleet-stage__chips" aria-hidden="true"><view v-for="n in 3" :key="n" class="fleet-stage__chip fleet-stage__chip--placeholder" /></view>
      <view class="fleet-stage__skeleton" aria-busy="true">
        <view class="fleet-stage__bar" style="width: 46%; height: 20px; margin-top: 4px" />
        <view class="fleet-stage__bar" style="width: 22%; height: 12px; margin-top: 10px" />
        <JobGauge />
        <text class="fleet-stage__loading" role="status">{{ copy.fleetLoading }}</text>
        <view class="fleet-stage__skeleton-stats"><view v-for="n in 3" :key="n"><view class="fleet-stage__bar" style="width: 56px; height: 12px" /><view class="fleet-stage__bar" style="width: 64px; height: 18px" /></view></view>
        <view style="height: 16px" />
      </view>
    </template>
    <view v-else-if="!items.length" class="fleet-stage__empty" role="button" tabindex="0" :aria-label="`${t.earn.addDevice}, ${freeSlotsText}`" @click="addDevice">
      <view class="fleet-stage__plus nx-frosted-button" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></view>
      <view><text class="fleet-stage__empty-title">{{ t.earn.addDevice }}</text><text class="fleet-stage__empty-sub">{{ freeSlotsText }}</text></view>
    </view>
    <template v-else>
      <view class="fleet-stage__chips" role="tablist" :aria-label="t.earn.selectDevice">
        <view v-for="item in items" :key="item.key" class="fleet-stage__chip" :class="{ 'fleet-stage__chip--selected nx-frosted-button': item.key === selected?.key, 'fleet-stage__chip--off': !item.online }" role="tab" :tabindex="item.key === selected?.key ? 0 : -1" :aria-selected="item.key === selected?.key ? 'true' : 'false'" @click="select(item.key)" @keydown.right.prevent="move(1)" @keydown.left.prevent="move(-1)">
          <DeviceArt v-if="item.device" class="fleet-stage__chip-art" :device="item.device" />
          <DeviceArt v-else class="fleet-stage__chip-art" :src="trialArt" />
          <text class="fleet-stage__chip-name">{{ item.name }}</text>
          <text v-if="!item.device" class="fleet-stage__chip-tag">{{ trialCopy.imageBadge }}</text>
          <view class="fleet-stage__chip-dot" :class="{ 'fleet-stage__chip-dot--on': item.online }" />
        </view>
        <view v-if="fleet.countReady.value && fleet.freeSlots.value > 0" class="fleet-stage__chip fleet-stage__chip--add" role="button" tabindex="0" :aria-label="`${t.earn.addDevice}, ${freeSlotsText}`" @click="addDevice"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></view>
      </view>
      <view class="fleet-stage__stage">
        <TrialStage v-if="selected && !selected.device" key="trial:current" />
        <DeviceCardPC v-else-if="selected?.device" :key="selected.key" :device="selected.device" stage />
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onShow } from "@/composables/use-tab-page-lifecycle";
import { remoteApiEnabled } from "@/api/runtime";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useAuditUiCopy } from "@/i18n/audit-ui";
import { useTrialFleetCopy } from "@/i18n/trial-fleet";
import { invalidatePassiveTabRead } from "@/lib/passive-tab-read";
import { deviceOnlineState } from "@/lib/hashpower";
import { deviceName } from "@/lib/device-copy";
import { deviceTaskRecovering } from "@/lib/task-progress";
import { getProductMedia } from "@/lib/product-media";
import { useApp } from "@/store/app";
import { useSlotActionSheet } from "@/store/slot-action-sheet";
import { useFleetSlots } from "@/composables/use-fleet-slots";
import type { Device } from "@/store/types";
import DeviceArt from "@/components/device-art.vue";
import DeviceCardPC from "./device-card-pc.vue";
import TrialStage from "./trial-stage.vue";
import JobGauge from "./job-gauge.vue";

const app = useApp();
const t = useT();
const copy = useAuditUiCopy();
const trialCopy = useTrialFleetCopy();
const fleet = useFleetSlots();

// A background refresh keeps the bound account's last confirmed fleet; a first read stays unknown.
const fleetReady = computed(() => !remoteApiEnabled || app.remoteFleetStatus === "ready"
  || (app.remoteFleetStatus === "loading" && app.remoteFleetHasSnapshot));
const freeSlotsText = computed(() => fmt(t.value.myDevices.emptySlots, { n: fleet.freeSlots.value }));
const trialArt = computed(() => getProductMedia(fleet.trial.productId.value)?.src ?? null);

type StageItem = { key: string; name: string; online: boolean; device: Device | null };
// The trial comes first, then the active fleet in its existing order.
const items = computed<StageItem[]>(() => [
  ...(fleet.trial.active.value ? [{ key: "trial:current", name: fleet.trial.deviceName.value || "—", online: fleet.trialOnline.value, device: null }] : []),
  ...app.visibleDevices.filter((device) => device.activatedAt !== null).map((device) => ({
    key: device.id, name: deviceName(t.value, device), device,
    online: !deviceTaskRecovering(device) && deviceOnlineState(device, Date.now(), fleetReady.value) === "online",
  })),
]);
// One concrete selection per visit: the first device with a job in progress, otherwise the first item. It is
// committed once the fleet and its task snapshot are known, kept while that item exists (so a task refresh never
// swaps the stage and unmounts an open menu or sheet), replaced only when it disappears, and reset on a new visit
// or account change. Before it is committed the stage shows that default provisionally.
const tasksSettled = computed(() => !remoteApiEnabled || app.remoteAssignmentStatus === "ready" || app.remoteAssignmentStatus === "error"
  || (app.remoteAssignmentStatus === "loading" && app.remoteAssignmentHasSnapshot));
const defaultKey = () => (items.value.find((item) => item.device?.currentTask != null) ?? items.value[0])?.key ?? null;
const selectedKey = ref<string | null>(null);
function commitSelection() {
  if (selectedKey.value !== null && items.value.some((item) => item.key === selectedKey.value)) return;
  selectedKey.value = fleetReady.value && tasksSettled.value ? defaultKey() : null;
}
watch([items, fleetReady, tasksSettled], commitSelection, { immediate: true });
onShow(() => { selectedKey.value = null; commitSelection(); });
watch(() => [app.accountKey, app.accountBindingEpoch], () => { selectedKey.value = null; commitSelection(); });
const selected = computed(() => items.value.find((item) => item.key === (selectedKey.value ?? defaultKey())) ?? null);

// The chosen chip scrolls fully into view; arrow keys also move focus with it (roving tabindex).
function select(key: string, focus = false) {
  selectedKey.value = key;
  void nextTick(() => {
    if (typeof document === "undefined") return;
    const chip = document.querySelector<HTMLElement>('.fleet-stage__chip[aria-selected="true"]');
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    if (focus) chip?.focus();
  });
}
function move(delta: number) {
  const index = items.value.findIndex((item) => item.key === selected.value?.key);
  const next = items.value[(index + delta + items.value.length) % items.value.length];
  if (next) select(next.key, true);
}
function addDevice() { useSlotActionSheet().openForSlot(); }
function retryFleet() { invalidatePassiveTabRead("remote-fleet"); void app.refreshRemoteFleet().catch(() => undefined); }
</script>

<style scoped>
.fleet-stage { color: var(--v5-ink); }
.fleet-stage__banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 16px; padding: 12px 14px; border-radius: 14px; background: var(--v5-danger-soft); color: var(--v5-danger); }
.fleet-stage__banner-copy { min-width: 0; }
.fleet-stage__banner-title { display: block; font: 600 13px/18px var(--font-v5); }
.fleet-stage__banner-body { display: block; margin-top: 2px; font: 400 12px/18px var(--font-v5); }
.fleet-stage__retry { position: relative; flex: none; display: inline-flex; align-items: center; min-height: 44px; padding: 0 2px; font: 500 13px/18px var(--font-v5); color: var(--v5-brand); cursor: pointer; }
.fleet-stage__retry::after { content: ""; position: absolute; inset: 0 -8px; }

.fleet-stage__chips { display: flex; gap: 8px; padding: 0 16px 2px; overflow-x: auto; scrollbar-width: none; }
.fleet-stage__chips::-webkit-scrollbar { display: none; }
.fleet-stage__chip { position: relative; flex: none; display: inline-flex; align-items: center; gap: 8px; height: 44px; box-sizing: border-box; padding: 0 14px 0 6px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 6%, transparent); font: 500 13px/18px var(--font-v5); color: var(--v5-ink-2); white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.fleet-stage__chip--selected { --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); --ui-button-solid: color-mix(in srgb, var(--v5-brand) 12%, var(--v5-surface)); color: var(--v5-brand); }
.fleet-stage__chip:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.fleet-stage__chip:active { opacity: .85; }
.fleet-stage__chip-art { width: 34px; height: 30px; flex: none; }
.fleet-stage__chip--off .fleet-stage__chip-art { filter: grayscale(.75); opacity: .55; }
.fleet-stage__chip-tag { padding: 0 4px; border-radius: 5px; background: var(--v5-brand); color: var(--v5-on-brand); font: 500 10px/14px var(--font-v5); }
.fleet-stage__chip-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--v5-ink-4); }
.fleet-stage__chip-dot--on { background: var(--v5-success); }
.fleet-stage__chip--add { width: 44px; padding: 0; justify-content: center; background: transparent; color: var(--v5-ink-3); }
.fleet-stage__chip--add::before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 1.5px dashed var(--v5-border-strong); }
.fleet-stage__chip--placeholder { width: 132px; padding: 0; cursor: default; }
.fleet-stage__stage { margin: 12px 16px 0; }

.fleet-stage__skeleton { position: relative; margin: 12px 16px 0; padding: 16px 18px 6px; border-radius: 24px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .fleet-stage__skeleton { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.fleet-stage__bar { display: block; border-radius: 8px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.fleet-stage__loading { display: block; margin-top: 12px; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); text-align: center; }
.fleet-stage__skeleton-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; padding: 12px 0; border-top: 1px solid var(--v5-border); border-bottom: 1px solid var(--v5-border); }
.fleet-stage__skeleton-stats > view { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.fleet-stage__skeleton-stats > view + view { border-left: 1px solid var(--v5-border); }

.fleet-stage__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 200px; margin: 12px 16px 0; box-sizing: content-box; border-radius: 24px; border: 1.5px dashed var(--v5-border-strong); text-align: center; cursor: pointer; }
.fleet-stage__empty:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.fleet-stage__empty:active { opacity: .85; }
.fleet-stage__plus { position: relative; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; color: var(--v5-ink-3); }
.fleet-stage__empty-title { display: block; font: 500 15px/20px var(--font-v5); color: var(--v5-ink); }
.fleet-stage__empty-sub { display: block; margin-top: 2px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
</style>
