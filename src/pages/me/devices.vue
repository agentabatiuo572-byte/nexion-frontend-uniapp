<!--
  Device inventory (设备仓库) — ported from
  Nexion-prototype/app/(main)/me/devices/page.tsx.

  Full per-device list with activate/deactivate. Two sections:
    - Active: devices currently contributing to earnings (slot-capped)
    - Inventory: purchased but not yet activated (no slot impact)
  Slot cap (MAX_DEVICES) applies to ACTIVE devices only; a running free trial
  reserves a shadow slot too (composed here — stores don't import each other).
  A device with a running task routes through DeviceDeactivateSheet (wait/force).

  Wrapped in <AppChassis active="me">; SubPageHeader (back chevron) scrolls
  with content (no chassis-level back row in uni — see sub-page-header.vue).

  FEAT-DEV02: each paid eligible device row carries an upgrade trade-in strip
  (「可抵 $X」chip → quote tooltip · 「升级置换」CTA → retire flow via the
  chassis-mounted TradeinSheets). Free devices (paidPriceUsdt=0) show no trace;
  a device with no qualified upgrade target shows no trade-in entry.
-->
<template>
  <AppChassis active="me" @click="quoteInfoDeviceId = null">
    <view class="device-page" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.myDevices.inventoryTitle" />

      <EmptyState
        v-if="inventoryError"
        class="mx-4"
        kind="recoverable-error"
        :title="t.empty.errorTitle"
        :desc="t.empty.errorDesc"
        :cta-label="t.empty.errorCta"
        emphasis
        @cta="retryInventory"
      />

      <!-- Slot chassis: a liquid-glass panel whose bays show which device holds each compute slot. -->
      <view v-if="!inventoryError" class="device-stage mx-4">
        <view class="device-stage__aura" aria-hidden="true"><view /><view /></view>
        <view class="device-hero nx-tint" role="group" :aria-label="inventoryLoading ? t.earn.deviceLoading : slotMeterLabel" :aria-busy="inventoryLoading">
          <view class="device-hero__top">
            <view>
              <text class="device-hero__title">{{ t.myDevices.inventorySlotsLabel }}</text>
              <view class="device-hero__count"><text class="device-hero__used">{{ slotsUsed === null ? '—' : slotsUsed }}</text><text class="device-hero__max">/ {{ app.slotCap }}</text></view>
            </view>
            <view class="device-hero__tags">
              <view v-if="inventoryLoading" class="device-hero__loading" role="status"><view class="device-hero__spin" aria-hidden="true" /><text>{{ t.earn.deviceLoading }}</text></view>
              <template v-else>
                <view v-if="onlineCount > 0" class="device-hero__tag"><view class="device-hero__dot" aria-hidden="true" /><text>{{ fmt(t.myDevices.activatedLabel, { n: onlineCount }) }}</text></view>
                <view v-if="slotsUsed !== null && slotsFull" class="device-hero__tag device-hero__tag--warn"><text>{{ t.myDevices.inventoryRowSlotsFull }}</text></view>
                <view v-else-if="slotsUsed !== null" class="device-hero__tag"><text>{{ fmt(t.myDevices.emptySlots, { n: app.slotCap - slotsUsed }) }}</text></view>
                <view v-else class="device-hero__tag"><text>{{ slotUnavailableText }}</text></view>
              </template>
            </view>
          </view>
          <view class="device-bays">
            <view v-for="(bay, i) in bays" :key="bay.key" class="device-bays__cell" :style="{ '--i': i }">
              <DeviceBay v-if="bay.kind === 'device' || bay.kind === 'trial'" :device="bay.device" :image="bay.image" :name="bay.name"
                :online="bay.online" :badge="bay.kind === 'trial' ? trialCopy.imageBadge : undefined" :label="bay.label" @open="openBay(bay.target)" />
              <view v-else-if="bay.kind === 'reserved'" class="device-bay-slot device-bay-slot--reserved" role="img" :aria-label="t.orders.statusProvisioning">
                <view class="device-hero__spin device-hero__spin--lg" aria-hidden="true" /><text>{{ t.orders.statusProvisioning }}</text>
              </view>
              <view v-else-if="bay.kind === 'empty'" class="device-bay-slot device-bay-slot--empty" role="button" tabindex="0" :aria-label="t.myDevices.inventoryCtaGoStore" @click="goStore">
                <view class="device-bay-slot__plus nx-frosted-button" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></view>
              </view>
              <view v-else class="device-bay-slot device-bay-slot--loading" aria-hidden="true" />
            </view>
          </view>
        </view>
      </view>

      <view v-if="inventoryReady" class="mx-4">
        <!-- 空库存:《06》no-owned-asset 插画 + 引导(只在库存读完后出现,加载中不冒充空态)。
             「去商店」主按钮常驻底部固定栏,这里不再给第二个同义 CTA。 -->
        <EmptyState v-if="inventoryEmpty" kind="no-owned-asset" compact :title="t.empty.devicesTitle" :desc="t.empty.devicesDesc" />
        <!-- Trial and activated devices share one list; the count describes rows, not capacity. -->
        <view v-if="activeDevices.length > 0 || trialPresentation.active.value" class="device-inventory-section" data-inventory-section="devices">
          <view class="device-inventory-section__head">
            <text class="device-inventory-section__title">{{ t.myDevices.inventorySectionDevices }}</text>
            <text class="device-inventory-section__count">{{ activeDevices.length + (trialPresentation.active.value ? 1 : 0) }}</text>
          </view>
          <view class="device-inventory-list">
            <TrialDeviceRow v-if="trialPresentation.active.value" id="device-card-trial" key="trial:current" variant="inventory" show-cancel :cancel-busy="cancelTrialBusy" @cancel="handleCancelTrial" />
            <DeviceInventoryRow
              v-for="d in activeDevices"
              :key="d.id"
              :device="d"
              :active="true"
              :runtime-confirmed="!remoteApiEnabled || app.remoteFleetStatus === 'ready' || app.remoteFleetStatus === 'loading'"
              :show-action="canControlDevice(d)"
              :activate-label="t.myDevices.inventoryRowActivate"
              :deactivate-label="t.myDevices.inventoryRowDeactivate"
              :slots-full-label="t.myDevices.inventoryRowSlotsFull"
              :pending-chip-label="t.myDevices.inventoryPendingDeactivateChip"
              :action-disabled="remoteApiEnabled && !!d.pendingDeactivate"
              v-bind="tradeinStrip(d)"
              :quote-info-open="quoteInfoDeviceId === d.id"
              @quote-info="quoteInfoDeviceId = $event ? d.id : null"
              @toggle="handleDeactivate(d)"
              @tradein="handleTradein(d)"
            />
          </view>
        </view>

        <!-- Inventory (purchased but not activated) -->
        <view v-if="inactiveDevices.length > 0" class="device-inventory-section" data-inventory-section="pending">
          <view class="device-inventory-section__head">
            <text class="device-inventory-section__title">{{ t.myDevices.inventorySectionInventory }}</text>
            <text class="device-inventory-section__count">{{ inactiveDevices.length }}</text>
          </view>
          <view class="device-inventory-list">
            <DeviceInventoryRow
              v-for="d in inactiveDevices"
              :key="d.id"
              :device="d"
              :active="false"
              :show-action="canControlDevice(d)"
              :disabled="slotsFull || !activationReady"
              :disabled-label="slotsUsed === null || !activationReady ? slotUnavailableText : undefined"
              :activate-label="t.myDevices.inventoryRowActivate"
              :deactivate-label="t.myDevices.inventoryRowDeactivate"
              :slots-full-label="t.myDevices.inventoryRowSlotsFull"
              :pending-chip-label="t.myDevices.inventoryPendingDeactivateChip"
              v-bind="tradeinStrip(d)"
              :quote-info-open="quoteInfoDeviceId === d.id"
              @quote-info="quoteInfoDeviceId = $event ? d.id : null"
              @toggle="handleActivate(d)"
              @tradein="handleTradein(d)"
            />
          </view>
          <view v-if="slotsUsed !== null && slotsFull && inactiveDevices.length > 0" class="device-inventory-warn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            <text>{{ t.myDevices.inventorySlotsFullWarning }}</text>
          </view>
        </view>

        <!-- Remote active lifecycle without activation time: support-visible, never activatable. -->
        <view v-if="unconfirmedDevices.length > 0" class="device-inventory-section" data-inventory-section="unconfirmed">
          <view class="device-inventory-section__head">
            <text class="device-inventory-section__title">{{ t.myDevices.inventorySectionActivationUnconfirmed }}</text>
            <text class="device-inventory-section__count">{{ unconfirmedDevices.length }}</text>
          </view>
          <view class="device-inventory-list">
            <DeviceInventoryRow
              v-for="d in unconfirmedDevices"
              :key="d.id"
              :device="d"
              :active="false"
              :show-action="canControlDevice(d)"
              disabled
              :disabled-label="t.myDevices.inventoryActivationUnconfirmed"
              :activate-label="t.myDevices.inventoryRowActivate"
              :deactivate-label="t.myDevices.inventoryRowDeactivate"
              :slots-full-label="t.myDevices.inventoryRowSlotsFull"
              :pending-chip-label="t.myDevices.inventoryPendingDeactivateChip"
              v-bind="tradeinStrip(d)"
              :quote-info-open="quoteInfoDeviceId === d.id"
              @quote-info="quoteInfoDeviceId = $event ? d.id : null"
            />
          </view>
        </view>

        <!-- Phone compute invites the user like an empty slot: dashed outline, the phone art and its activation step. -->
        <view class="device-inventory-section device-inventory-connections" data-inventory-section="connections">
          <view v-if="phoneNeedsActivation" class="device-phone-card">
            <view class="device-phone-card__copy">
              <text class="device-phone-card__title">{{ phoneActivationGuidance.title }}</text>
              <text class="device-phone-card__body">{{ phoneActivationGuidance.body }}</text>
              <NxButton v-if="nativePhoneAvailable" class="device-phone-card__cta" variant="brand" size="medium" :label="t.myDevices.phoneActivationCta" @click="goPhoneActivation" />
            </view>
            <view class="device-phone-card__art" aria-hidden="true"><image class="device-phone-card__img" src="/static/img/home-glass-20260928/phone.webp" mode="aspectFit" /><view class="device-phone-card__floor" /></view>
          </view>
        </view>
      </view>
      <view class="device-page__bar-space" aria-hidden="true" />
    </view>

    <DeviceDeactivateSheet
      :device="sheetDevice"
      @wait="onSheetWait"
      @force="onSheetForce"
      @dismiss="sheetDevice = null"
    />
    <!-- Buying more devices is the page's main action, in the thumb zone (DS-30). -->
    <template #pageFixed>
      <view class="device-page__bar nx-glass-bar"><NxButton class="device-page__bar-btn" variant="primary" :label="t.myDevices.inventoryCtaGoStore" @click="goStore"><view class="device-page__bar-label"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg><text>{{ t.myDevices.inventoryCtaGoStore }}</text></view></NxButton></view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { navReset, navTo, takeNavigationQuery } from "@/lib/route";
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { computed, ref } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import DeviceInventoryRow from "@/components/me/device-inventory-row.vue";
import DeviceBay from "@/components/me/device-bay.vue";
import NxButton from "@/components/ui/nx-button.vue";
import EmptyState from "@/components/empty-state.vue";
import DeviceDeactivateSheet from "@/components/me/device-deactivate-sheet.vue";
import TrialDeviceRow from "@/components/trial-device-row.vue";
import { useTrialPresentation } from "@/composables/use-trial-presentation";
import { useDeviceDeactivation } from "@/composables/use-device-deactivation";
import { useTradeinStrip } from "@/composables/use-tradein-strip";
import { useTrialFleetCopy } from "@/i18n/trial-fleet";
import { useT } from "@/i18n/use-t";
import { deviceName } from "@/lib/device-copy";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useSession } from "@/store/session";
import { hasNativePhoneRuntime } from "@/lib/native-phone-runtime";
import { resolvePhoneActivationGuidance } from "@/lib/phone-activation-guidance";
import { canControlDevice } from "@/lib/device-control-platform";
import { getProductMedia } from "@/lib/product-media";
import { deviceOnlineState } from "@/lib/hashpower";
import { useFreeTrial } from "@/store/free-trial";
import type { Device } from "@/store/types";
import { confirm as uiConfirm, toast } from "@/store/ui";
import { apiRuntimeConfig, remoteApiEnabled } from "@/api/runtime";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { productCatalogState } from "@/store/product-catalog";
import { refreshRemoteFleetAfterCatalog } from "@/lib/e3-fleet-bootstrap";
import { isActivatableInventoryDevice, requiresActivationConfirmation } from "@/lib/device-slot-policy";

const t = useT();
const app = useApp();
const session = useSession();
const nativePhoneAvailable = hasNativePhoneRuntime();
const phoneActivationGuidance = computed(() => resolvePhoneActivationGuidance(nativePhoneAvailable, t.value.myDevices));
const trial = useFreeTrial();
onShow(() => { void trial.refreshVisible(); });
const trialPresentation = useTrialPresentation();
const trialCopy = useTrialFleetCopy();
const cancelTrialBusy = ref(false);
const quoteInfoDeviceId = ref<string | null>(null);

// A failed trial read cannot remove the account's previously confirmed devices.
// Slot counts and mutations have their own stricter readiness below.
const inventoryReady = computed(() => !remoteApiEnabled || app.remoteFleetHasSnapshot);
const inventoryError = computed(() => !inventoryReady.value && (app.remoteFleetStatus === "error"
  || trial.authorityStatus === "error"
  || (apiRuntimeConfig.environment === "dev" && productCatalogState.status === "error")));
const inventoryLoading = computed(() => !inventoryReady.value && !inventoryError.value);
async function retryInventory() {
  await Promise.all([refreshRemoteFleetAfterCatalog(app.accountKey), trial.poll(Date.now())]);
}
useAutoRecovery({
  failed: () => remoteApiEnabled && app.remoteFleetStatus !== "loading" && trial.authorityStatus !== "loading"
    && productCatalogState.status !== "loading" && (app.remoteFleetStatus === "error" || trial.authorityStatus === "error"
      || (apiRuntimeConfig.environment === "dev" && productCatalogState.status === "error")),
  retry: retryInventory,
});

const activeDevices = computed(() => app.visibleDevices.filter((d) => d.activatedAt !== null));
const inactiveDevices = computed(() => app.visibleDevices.filter(isActivatableInventoryDevice));
const unconfirmedDevices = computed(() => app.visibleDevices.filter(requiresActivationConfirmation));
const inventoryEmpty = computed(() => activeDevices.value.length === 0
  && inactiveDevices.value.length === 0
  && unconfirmedDevices.value.length === 0 && !trialPresentation.active.value);
const phoneNeedsActivation = computed(() => {
  const phones = app.visibleDevices.filter((device) => device.kind === "phone");
  if (phones.some(requiresActivationConfirmation)) return true;
  return !phones.some((device) => device.activatedAt !== null)
    || app.remotePhoneBindingInvalid || !session.isCurrentDeviceCalibrated(app.accountKey);
});

// Trial reserves a slot too (shadow device, not in devices[]).
const trialReserved = trialPresentation.reservedSlots;
const slotsUsed = computed(() => remoteApiEnabled && app.remoteFleetStatus !== "ready"
  && app.remoteFleetStatus !== "loading" ? null : app.remoteSlotsUsed
    ?? (trialReserved.value === null ? null : app.activeSlotCount + trialReserved.value));
const slotsFull = computed(() => slotsUsed.value === null || slotsUsed.value >= app.slotCap);
const activationReady = computed(() => !remoteApiEnabled
  || (app.remoteFleetStatus === "ready" && trialPresentation.actionsReady.value));
const slotUnavailableText = computed(() => app.remoteFleetStatus === "error" || trial.authorityStatus === "error"
  ? trialCopy.value.slotsUnknown : trialCopy.value.slotsChecking);

const slotMeterLabel = computed(() =>
  slotsUsed.value === null ? slotUnavailableText.value
    : fmt(t.value.myDevices.inventorySlotMeter, { active: slotsUsed.value, max: app.slotCap }),
);

// Hero bays: the trial and activated devices hold slots first, then server-reserved
// (provisioning) slots, then free ones. Unknown capacity shows placeholders only.
type Bay = { key: string; kind: "device" | "trial" | "reserved" | "empty" | "loading"; device?: Device; image?: string;
  name: string; online: boolean; label: string; target: string };
const deviceOnline = (d: Device) => deviceOnlineState(d, Date.now(), !remoteApiEnabled || app.remoteFleetStatus === "ready" || app.remoteFleetStatus === "loading") === "online";
const onlineCount = computed(() => activeDevices.value.filter(deviceOnline).length + (trialPresentation.active.value && trial.status === "active" ? 1 : 0));
const bays = computed<Bay[]>(() => {
  const blank = (kind: Bay["kind"], i: number): Bay => ({ key: `${kind}:${i}`, kind, name: "", online: false, label: "", target: "" });
  if (slotsUsed.value === null) return Array.from({ length: app.slotCap }, (_, i) => blank("loading", i));
  const list: Bay[] = [];
  if (trialPresentation.active.value) {
    const name = trialPresentation.deviceName.value || "—";
    const online = trial.status === "active";
    list.push({ key: "trial", kind: "trial", image: getProductMedia(trialPresentation.productId.value)?.src, name, online,
      label: `${name} · ${trialCopy.value.imageBadge}${online ? " · " + t.value.earn.online : ""}`, target: "trial" });
  }
  for (const d of activeDevices.value) {
    const name = deviceName(t.value, d), online = deviceOnline(d);
    list.push({ key: d.id, kind: "device", device: d, name, online, label: online ? `${name} · ${t.value.earn.online}` : name, target: d.id });
  }
  const reserved = app.remoteSlotUsage?.reservedSlotCount ?? 0;
  for (let i = 0; i < reserved && list.length < app.slotCap; i++) list.push(blank("reserved", i));
  while (list.length < app.slotCap) list.push(blank("empty", list.length));
  return list;
});
function openBay(target: string) {
  if (typeof document === "undefined") return;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(`device-card-${target}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
}

// Deactivate sheet (running-task branch) — page-driven (no chassis store).
const { sheetDevice, handleDeactivate, onSheetWait, onSheetForce, runRemoteDeviceCommand } = useDeviceDeactivation();
let deactivateRequest = 0;
onUnload(() => { deactivateRequest += 1; });
onLoad(async options => {
  const query = new URLSearchParams(takeNavigationQuery('/pages/me/devices'));
  const id = options?.deactivate || query.get('deactivate') || '';
  if (!id) return;
  const request = ++deactivateRequest;
  const scope = captureAccountScope();
  if (remoteApiEnabled && !await refreshRemoteFleetAfterCatalog(app.accountKey)) return;
  if (request !== deactivateRequest || !isCurrentAccountScope(scope)) return;
  const device = app.visibleDevices.find(item => item.id === id && item.activatedAt !== null);
  if (device) await handleDeactivate(device);
});

const { tradeinStrip, handleTradein } = useTradeinStrip();

async function handleActivate(d: Device) {
  if (!canControlDevice(d)) return;
  if (requiresActivationConfirmation(d)) {
    toast.warn(t.value.myDevices.inventoryActivationUnconfirmed);
    return;
  }
  if (d.kind === "phone") {
    goPhoneActivation();
    return;
  }
  if (slotsUsed.value === null || !activationReady.value) {
    toast.warn(slotUnavailableText.value);
    return;
  }
  if (slotsFull.value) {
    toast.warn(fmt(t.value.myDevices.inventoryToastSlotsFull, { max: app.slotCap }));
    return;
  }
  if (remoteApiEnabled) {
    await runRemoteDeviceCommand(d, "activate");
    return;
  }
  // Mock-only projection keeps the prototype slot simulation.
  const ok = app.activateDevice(d.id, trialReserved.value ?? 0);
  if (ok) {
    toast.success(fmt(t.value.myDevices.inventoryToastActivated, { deviceName: deviceName(t.value, d) }));
  } else {
    toast.warn(fmt(t.value.myDevices.inventoryToastSlotsFull, { max: app.slotCap }));
  }
}

function goPhoneActivation() {
  if (!nativePhoneAvailable) return;
  navTo("/pages/onboarding/connect?mode=recalibrate");
}

async function handleCancelTrial() {
  if (cancelTrialBusy.value || !trialPresentation.actionsReady.value || trial.status !== "active") return;
  const accountKey = app.accountKey;
  const bindingEpoch = app.accountBindingEpoch;
  cancelTrialBusy.value = true;
  try {
    const ok = await uiConfirm({
      title: t.value.trial.cancelConfirmTitle,
      message: t.value.trial.cancelConfirmMsg,
      confirmLabel: t.value.trial.cancelConfirmOk,
      cancelLabel: t.value.trial.cancelConfirmKeep,
    });
    if (!ok || accountKey !== app.accountKey || bindingEpoch !== app.accountBindingEpoch
      || !trialPresentation.actionsReady.value || trial.status !== "active") return;
    const result = await trial.cancel();
    if (accountKey !== app.accountKey || bindingEpoch !== app.accountBindingEpoch) return;
    if (result.ok) {
      toast.info(t.value.trial.toastCancelled);
      if (remoteApiEnabled) void app.refreshRemoteFleet();
    }
    else toast.warn(t.value.trial.cancelError);
  } finally {
    cancelTrialBusy.value = false;
  }
}

function goStore() {
  navReset({ url: "/pages/store/store", fail: () => {} });
}

</script>

<style scoped>
.device-stage { position: relative; margin-top: 15px; }
.device-stage__aura { position: absolute; inset: -8px -6px; pointer-events: none; }
.device-stage__aura > view { position: absolute; width: 190px; height: 150px; border-radius: 50%; filter: blur(42px); }
.device-stage__aura > view:first-child { left: -10px; top: -6px; background: color-mix(in srgb, var(--v5-tech-cyan) 22%, transparent); }
.device-stage__aura > view:last-child { right: -14px; bottom: 20px; background: color-mix(in srgb, var(--v5-aura-sky) 28%, transparent); }
[data-theme="light"] .device-stage__aura > view:first-child { background: color-mix(in srgb, var(--v5-tech-cyan) 16%, transparent); }
[data-theme="light"] .device-stage__aura > view:last-child { background: color-mix(in srgb, var(--v5-aura-sky) 18%, transparent); }
/* Page focus block: the stage's cyan as one uniform tint (.nx-tint) over the outer aura; bays sit in it as recessed wells. */
.device-hero { --nx-tint: var(--v5-tech-cyan); --device-bay-well: inset 0 2px 8px rgba(0,0,0,.45); position: relative; padding: 20px; border-radius: var(--v5-radius-xl); }
[data-theme="light"] .device-hero { --device-bay-well: inset 0 1px 4px rgba(20,16,8,.10); }
.device-hero__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.device-hero__title { display: block; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.device-hero__count { display: flex; align-items: baseline; gap: 6px; margin-top: 6px; font-family: var(--font-metric); font-variant-numeric: tabular-nums; }
.device-hero__used { font-size: 44px; font-weight: 500; line-height: 48px; letter-spacing: -.02em; }
.device-hero__max { color: var(--v5-ink-3); font-size: 20px; font-weight: 500; line-height: 24px; }
.device-hero__tags { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; padding-top: 2px; }
.device-hero__tag { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); background: var(--v5-surface-3); color: var(--v5-ink-2); font: 500 12px/16px var(--font-v5); white-space: nowrap; }
.device-hero__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--v5-success); flex: none; }
.device-hero__tag--warn { background: var(--v5-warning-soft); color: var(--v5-warning-ink); }
.device-hero__loading { display: inline-flex; align-items: center; gap: 8px; color: var(--v5-ink-3); font: 400 13px/18px var(--font-v5); }
.device-hero__spin { width: 14px; height: 14px; box-sizing: border-box; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--v5-brand) 25%, transparent); border-top-color: var(--v5-brand); animation: spin 1s linear infinite; }
.device-hero__spin--lg { width: 22px; height: 22px; }
.device-bays__cell { min-width: 0; }
.device-bays { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 18px; }
.device-bay-slot { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 112px; box-sizing: border-box; border-radius: var(--v5-radius-m); }
.device-bay-slot--empty { border: 1.5px dashed var(--v5-border-strong); cursor: pointer; }
.device-bay-slot--empty:active { transform: scale(.97); }
.device-bay-slot__plus { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; color: var(--v5-ink-3);
  backdrop-filter: none; -webkit-backdrop-filter: none; }
/* Over the stage aura the shared frosted blur only applied during the page-enter animation (bright, then
   dim); a fixed, slightly denser fill keeps the brighter look without the flash. */
[data-theme="dark"] .device-bay-slot__plus { --ui-button-fill: color-mix(in srgb, var(--v5-ink) 14%, transparent); }
.device-bay-slot--reserved { border: 1.5px dashed color-mix(in srgb, var(--v5-brand) 60%, transparent); background: color-mix(in srgb, var(--v5-brand) 5%, transparent); color: var(--v5-ink-2); font: 500 12px/16px var(--font-v5); }
.device-bay-slot--loading { background: linear-gradient(100deg, color-mix(in srgb, var(--v5-ink) 4%, transparent) 30%, color-mix(in srgb, var(--v5-ink) 10%, transparent) 50%, color-mix(in srgb, var(--v5-ink) 4%, transparent) 70%); background-size: 300% 100%; animation: device-shimmer 1.6s linear infinite; }
.device-inventory-section { margin-top: var(--ui-space-section-gap, 32px); min-width: 0; }
.device-inventory-section__head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; margin-bottom: 12px; }
.device-inventory-section__title { font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.device-inventory-section__count { color: var(--v5-ink-3); font: 500 13px/18px var(--font-metric); }
.device-inventory-list { display: flex; flex-direction: column; gap: 12px; }
.device-inventory-warn { display: flex; align-items: center; gap: 6px; margin: 10px 4px 0; color: var(--v5-warning-ink); font: 400 12px/18px var(--font-v5); }
.device-inventory-connections:empty { display: none; }
.device-phone-card { display: grid; grid-template-columns: minmax(0, 1fr) 84px; align-items: center; gap: 12px; padding: 16px; border-radius: var(--ui-radius-surface); border: 1.5px dashed var(--v5-border-strong); background: color-mix(in srgb, var(--v5-ink) 3%, transparent); }
.device-phone-card__title { display: block; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.device-phone-card__body { display: block; margin-top: 4px; color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.device-phone-card__cta { display: inline-flex; margin-top: 12px; }
.device-phone-card__art { position: relative; width: 84px; height: 72px; }
.device-phone-card__img { position: absolute; left: 3px; top: 2px; width: 78px; height: 64px; }
.device-phone-card__floor { position: absolute; left: 20%; right: 20%; bottom: 2px; height: 8px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.65), transparent); }
[data-theme="light"] .device-phone-card__floor { background: radial-gradient(closest-side, rgba(20,16,8,.20), transparent); }
.device-page__bar-space { height: calc(110px + env(safe-area-inset-bottom)); }
.device-page__bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; display: flex; padding: var(--v5-space-3) var(--v5-space-4) calc(30px + env(safe-area-inset-bottom)); }
.device-page__bar-btn { display: flex; flex: 1; }
.device-page__bar-label { display: flex; align-items: center; gap: 6px; }
@keyframes device-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .device-hero__spin, .device-bay-slot--loading { animation: none; } }
</style>
