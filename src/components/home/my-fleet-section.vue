<!-- Home "My devices" (P-62 design B): slot ring, a collapsed dock of device avatars, and an expandable reel without job progress. -->
<template>
  <view class="hf-section" data-home-section="fleet">
    <view class="hf-head">
      <view class="hf-title"><text class="hf-title__text" role="heading" aria-level="2">{{ t.home.myDevicesTitle }}</text><SlotRing /></view>
      <NxButton class="hf-manage" :label="t.home.fleetManage" variant="link" size="medium" @click="goManage"><text>{{ t.home.fleetManage }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></NxButton>
    </view>

    <view v-if="unavailable" class="hf-dock" role="status">
      <text class="hf-dock__error">{{ copy.fleetUnavailable }}</text>
      <view class="hf-retry" role="button" tabindex="0" @click="retry"><text>{{ t.ui.retry }}</text></view>
    </view>
    <view v-else-if="!fleet.fleetVisible.value" class="hf-dock" role="status" aria-busy="true">
      <view class="hf-avatars" aria-hidden="true"><view v-for="n in app.slotCap" :key="n" class="hf-av hf-av--loading" /></view>
      <text class="hf-dock__sub">{{ copy.fleetLoading }}</text>
    </view>
    <view v-else-if="!fleet.occupied.value.length" class="hf-dock hf-dock--action" role="button" tabindex="0" :aria-label="`${t.earn.addDevice}, ${freeSlotsText}`" @click="addDevice">
      <view class="hf-avatars" aria-hidden="true"><view v-for="(slot, i) in fleet.slots.value" :key="i" class="hf-av" :class="slot.kind === 'reserved' ? 'hf-av--reserved' : 'hf-av--empty'" :style="{ '--i': i }"><view v-if="slot.kind === 'reserved'" class="hf-spin" /><svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></view></view>
      <view class="hf-summary"><text class="hf-summary__title">{{ t.earn.addDevice }}</text><text class="hf-dock__sub">{{ freeSlotsText }}</text></view>
      <view class="hf-chev hf-chev--brand nx-frosted-button" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg></view>
    </view>
    <template v-else>
      <view class="hf-dock hf-dock--action" role="button" tabindex="0" :aria-expanded="expanded ? 'true' : 'false'" :aria-label="dockLabel" @click="expanded = !expanded">
        <view class="hf-avatars" aria-hidden="true">
          <view v-for="(slot, i) in fleet.slots.value" :key="slotKey(slot, i)" class="hf-av" :class="avatarClass(slot)" :style="{ '--i': i, zIndex: fleet.slots.value.length - i }">
            <DeviceArt v-if="slot.kind === 'device'" class="hf-av__art" :device="slot.device" />
            <DeviceArt v-else-if="slot.kind === 'trial'" class="hf-av__art" :src="trialArt" />
            <view v-else-if="slot.kind === 'reserved'" class="hf-spin" />
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <view v-if="slot.kind === 'device' || slot.kind === 'trial'" class="hf-av__led" :class="{ 'nx-online-dot': slot.online }" />
          </view>
        </view>
        <view class="hf-summary"><text class="hf-summary__title">{{ onlineText }}</text><text class="hf-dock__sub">{{ jobsText }}</text></view>
        <view class="hf-chev nx-frosted-button" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'" /></svg></view>
      </view>
      <view v-if="expanded" class="hf-reel">
        <view v-for="(slot, i) in fleet.occupied.value" :key="slotKey(slot, i)" class="hf-reel__item" :style="{ '--i': i }">
          <FleetReelCard v-if="slot.kind === 'device'" :device="slot.device" :online="slot.online" :runtime-confirmed="fleet.fleetReady.value" :tasks-confirmed="tasksReady" />
          <view v-else class="hf-card hf-card--trial" :class="{ 'hf-card--online': slot.kind === 'trial' && slot.online }" role="button" tabindex="0" :aria-label="trialLabel" @click="goTrial">
            <view class="hf-card__status"><view class="hf-card__dot" :class="{ 'nx-online-dot': fleet.trialOnline.value }" /><text>{{ trialStatusText }}</text></view>
            <text class="hf-card__badge">{{ trialCopy.imageBadge }}</text>
            <view class="hf-card__art"><DeviceArt class="hf-card__image" :src="trialArt" /><view class="hf-card__floor" /></view>
            <text class="hf-card__name">{{ fleet.trial.deviceName.value || '—' }}</text>
            <view class="hf-card__kv"><text class="hf-card__key">{{ t.home.trialLeftShort }}</text><text class="hf-card__mono">{{ trialRemaining }}</text></view>
            <view class="hf-card__kv"><text class="hf-card__key">{{ t.home.trialCreditShort }}</text><text class="hf-card__mono">{{ trialCredit }}</text></view>
          </view>
        </view>
        <view v-if="fleet.countReady.value && fleet.freeSlots.value > 0" class="hf-reel__item" :style="{ '--i': fleet.occupied.value.length }">
          <view class="hf-card hf-card--add" role="button" tabindex="0" :aria-label="`${t.earn.addDevice}, ${freeSlotsText}`" @click="addDevice">
            <view class="hf-card__plus nx-frosted-button" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></view>
            <text class="hf-card__add-title">{{ t.earn.addDevice }}</text>
            <text class="hf-dock__sub">{{ freeSlotsText }}</text>
          </view>
        </view>
      </view>
      <view v-if="expanded" class="hf-more">
        <view class="hf-more__link" role="link" tabindex="0" @click="goEarn"><text>{{ t.home.viewJobsOnEarn }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@/composables/use-tab-page-lifecycle";
import { useDataVisibility } from "@/store/data-visibility";
import { navTo } from "@/lib/route";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { remoteApiEnabled } from "@/api/runtime";
import { useAuditUiCopy } from "@/i18n/audit-ui";
import { useTrialFleetCopy } from "@/i18n/trial-fleet";
import { formatTrialCountdown } from "@/i18n/trial-lifecycle";
import { formatAmount } from "@/lib/amount-display";
import { getProductMedia } from "@/lib/product-media";
import { invalidatePassiveTabRead } from "@/lib/passive-tab-read";
import { useFreeTrial } from "@/store/free-trial";
import { useSlotActionSheet } from "@/store/slot-action-sheet";
import { useFleetSlots, type FleetSlot } from "@/composables/use-fleet-slots";
import NxButton from "@/components/ui/nx-button.vue";
import SlotRing from "@/components/slot-ring.vue";
import DeviceArt from "@/components/device-art.vue";
import FleetReelCard from "./fleet-reel-card.vue";

const visibility = useDataVisibility();
const t = useT();
const copy = useAuditUiCopy();
const trialCopy = useTrialFleetCopy();
const app = useApp();
const trial = useFreeTrial();
const fleet = useFleetSlots();

// Every visit to Home starts collapsed; the open state is not remembered.
const expanded = ref(false);
onShow(() => { expanded.value = false; });

const tasksReady = computed(() => !remoteApiEnabled || app.remoteAssignmentStatus === "ready"
  || (app.remoteAssignmentStatus === "loading" && app.remoteAssignmentHasSnapshot));
const unavailable = computed(() => app.remoteFleetStatus === "error" || trial.authorityStatus === "error");
const freeSlotsText = computed(() => fmt(t.value.myDevices.emptySlots, { n: fleet.freeSlots.value }));
const onlineText = computed(() => fmt(t.value.myDevices.activatedLabel, { n: fleet.occupied.value.filter((slot) => slot.kind !== "reserved" && slot.kind !== "empty" && slot.online).length }));
// Job state is only stated once the task snapshot is confirmed.
const jobsText = computed(() => tasksReady.value && fleet.fleetReady.value
  ? fmt(copy.value.jobs, { n: fleet.devices.value.filter((device) => device.currentTask != null).length }) : "—");
const dockLabel = computed(() => `${expanded.value ? t.value.home.collapseMyDevices : t.value.home.expandMyDevices}: ${onlineText.value}, ${jobsText.value}`);

const trialArt = computed(() => getProductMedia(fleet.trial.productId.value)?.src ?? null);
const trialStatusText = computed(() => !fleet.trial.presentationReady.value ? trialCopy.value.statusUnknown
  : fleet.trialOnline.value ? t.value.earn.online : trialCopy.value.grace);
const trialRemaining = computed(() => fleet.trial.remainingMs.value === null ? "—" : formatTrialCountdown(fleet.trial.remainingMs.value));
const trialCredit = computed(() => visibility.mask(fleet.trial.offsetUSD.value === null ? "—" : `$${formatAmount(fleet.trial.offsetUSD.value)}`));
const trialLabel = computed(() => `${trialCopy.value.details}: ${fleet.trial.deviceName.value || "—"} · ${trialStatusText.value} · ${t.value.home.trialLeftShort} ${trialRemaining.value} · ${t.value.home.trialCreditShort} ${trialCredit.value}`);

function slotKey(slot: FleetSlot, index: number) {
  return slot.kind === "device" ? `device:${slot.device.id}` : slot.kind === "trial" ? "trial:current" : `${slot.kind}:${index}`;
}
function avatarClass(slot: FleetSlot) {
  if (slot.kind === "reserved") return "hf-av--reserved";
  if (slot.kind === "empty") return "hf-av--empty";
  return slot.online ? "" : "hf-av--off";
}
function goManage() { navTo("/pages/me/devices"); }
function goTrial() { navTo("/pages/me/trial"); }
function goEarn() { navTo("/pages/earn/earn"); }
function addDevice() { useSlotActionSheet().openForSlot(); }
function retry() {
  if (app.remoteFleetStatus === "error") { invalidatePassiveTabRead("remote-fleet"); void app.refreshRemoteFleet().catch(() => undefined); }
  if (trial.authorityStatus === "error") void trial.refreshRemote();
}
</script>

<style scoped>
.hf-section { min-width: 0; color: var(--v5-ink); }
.hf-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 2px; }
.hf-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.hf-title__text { font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); color: var(--v5-ink); white-space: nowrap; }
.hf-manage :deep(.nx-button__surface) { padding: 0; gap: 2px; }
.hf-manage :deep(.nx-button__content) { gap: 2px; }

.hf-dock { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 72px; margin-top: 4px; padding: 14px 12px 14px 14px; box-sizing: border-box; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .hf-dock { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.hf-dock--action { cursor: pointer; -webkit-tap-highlight-color: transparent; }
.hf-dock--action:active { opacity: .85; }
.hf-dock--action:focus-visible, .hf-retry:focus-visible, .hf-more__link:focus-visible, .hf-card:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.hf-dock__sub { display: block; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.hf-dock__error { flex: 1; min-width: 0; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.hf-retry { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; font: 500 13px/18px var(--font-v5); color: var(--v5-brand); cursor: pointer; }

.hf-avatars { display: flex; align-items: center; flex: none; }
.hf-av { position: relative; flex: none; width: 38px; height: 38px; margin-left: -10px; border-radius: 50%; box-sizing: border-box; background: radial-gradient(80% 70% at 50% 72%, color-mix(in srgb, var(--v5-ink) 10%, transparent), transparent), var(--v5-surface-2); box-shadow: 0 0 0 2.5px var(--v5-surface), inset 0 1px 3px color-mix(in srgb, var(--v5-bg) 45%, transparent); animation: hf-pop 360ms cubic-bezier(.2, 1.4, .4, 1) both; animation-delay: calc(var(--i, 0) * 45ms); }
[data-theme="light"] .hf-av { box-shadow: 0 0 0 2.5px var(--v5-surface), inset 0 1px 3px color-mix(in srgb, var(--v5-ink) 10%, transparent); }
.hf-av:first-child { margin-left: 0; }
.hf-av__art { position: absolute; left: 3px; top: 4px; width: 32px; height: 28px; }
.hf-av--off .hf-av__art { filter: grayscale(.75); opacity: .55; }
.hf-av__led { position: absolute; right: -1px; bottom: 0; width: 9px; height: 9px; border-radius: 50%; background: var(--v5-ink-4); box-shadow: 0 0 0 2px var(--v5-surface); }
.hf-av__led.nx-online-dot { background: var(--v5-success); }
.hf-av--empty, .hf-av--reserved { display: grid; place-items: center; background: var(--v5-surface); color: var(--v5-ink-4); }
.hf-av--empty::before, .hf-av--reserved::before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 1.5px dashed var(--v5-border-strong); }
.hf-av--reserved { background: color-mix(in srgb, var(--v5-brand) 6%, var(--v5-surface)); }
.hf-av--reserved::before { border-color: color-mix(in srgb, var(--v5-brand) 60%, transparent); }
.hf-av--loading { background: var(--v5-surface-2); box-shadow: 0 0 0 2.5px var(--v5-surface); animation: none; }
.hf-spin { width: 12px; height: 12px; box-sizing: border-box; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--v5-brand) 25%, transparent); border-top-color: var(--v5-brand); animation: hf-spin 1s linear infinite; }

.hf-summary { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hf-summary__title { font: 500 15px/20px var(--font-v5); color: var(--v5-ink); }
.hf-chev { position: relative; flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; color: var(--v5-ink); }
.hf-chev--brand { --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); --ui-button-solid: color-mix(in srgb, var(--v5-brand) 12%, var(--v5-surface)); color: var(--v5-brand); }

.hf-reel { display: flex; gap: 10px; margin: 12px -16px 0; padding: 0 16px 2px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding: 0 16px; scrollbar-width: none; }
.hf-reel::-webkit-scrollbar { display: none; }
.hf-reel__item { flex: none; scroll-snap-align: start; animation: hf-slide 420ms cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i, 0) * 60ms); }
.hf-card { position: relative; display: flex; flex-direction: column; width: 164px; min-height: 220px; height: 100%; box-sizing: border-box; padding: 12px; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); overflow: hidden; cursor: pointer; }
[data-theme="light"] .hf-card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.hf-card:active { opacity: .85; }
.hf-card--online::before { content: ""; position: absolute; left: 0; right: 0; top: 22px; height: 128px; background: radial-gradient(55% 50% at 50% 55%, color-mix(in srgb, var(--v5-success) 13%, transparent), transparent 72%); pointer-events: none; }
.hf-card__status { position: relative; display: flex; align-items: center; gap: 6px; height: 16px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.hf-card__dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--v5-ink-4); }
.hf-card__dot.nx-online-dot { background: var(--v5-success); }
.hf-card__badge { position: absolute; z-index: 1; top: 11px; right: 12px; padding: 1px 6px; border-radius: 6px; background: var(--v5-brand); color: var(--v5-on-brand); font: 500 10px/14px var(--font-v5); }
.hf-card__art { position: relative; flex: none; width: 132px; height: 98px; margin: 6px auto 0; }
.hf-card__image { position: absolute; inset: 0; width: 100%; height: 100%; }
.hf-card__floor { position: absolute; left: 18%; right: 18%; bottom: -3px; height: 9px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-bg) 65%, transparent), transparent); }
[data-theme="light"] .hf-card__floor { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-ink) 20%, transparent), transparent); }
.hf-card__name { position: relative; display: block; margin-top: 8px; font: 500 15px/20px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hf-card__kv { position: relative; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 2px; }
.hf-card__key { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.hf-card__mono { font: 500 17px/22px var(--font-metric); color: var(--v5-ink); letter-spacing: -.01em; white-space: nowrap; font-variant-numeric: tabular-nums; }
.hf-card--add { align-items: center; justify-content: center; gap: 10px; background: transparent; box-shadow: none; border: 1.5px dashed var(--v5-border-strong); text-align: center; }
[data-theme="light"] .hf-card--add { box-shadow: none; }
.hf-card__plus { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--v5-ink-3); }
.hf-card__add-title { display: block; margin-bottom: -8px; font: 500 15px/20px var(--font-v5); color: var(--v5-ink); }
.hf-more { display: flex; justify-content: flex-end; margin-top: 4px; }
.hf-more__link { display: inline-flex; align-items: center; gap: 2px; min-height: 44px; padding: 0 2px; font: 500 13px/18px var(--font-v5); color: var(--v5-ink-3); cursor: pointer; }

@keyframes hf-pop { from { opacity: 0; transform: scale(.6); } }
@keyframes hf-slide { from { opacity: 0; transform: translateX(24px); } }
@keyframes hf-spin { to { transform: rotate(360deg); } }
/* Narrow phones keep the summary readable: at most four smaller avatars (the ring still shows every slot). */
@media (max-width: 374px) {
  .hf-av { width: 32px; height: 32px; margin-left: -12px; }
  .hf-av:nth-child(n + 5) { display: none; }
  .hf-av__art { left: 2px; top: 3px; width: 28px; height: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .hf-av, .hf-reel__item, .hf-spin { animation: none; }
}
</style>
