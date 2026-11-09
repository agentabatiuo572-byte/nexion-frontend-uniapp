<!-- Device warehouse card (P-43): device art, live state, today's earnings, the current job and the card actions in one view. -->
<template>
  <DeviceUnclassifiedCard v-if="device.kind === 'unknown'" :device="device" />
  <view v-else class="device-inventory-row" :class="{ 'device-inventory-row--idle': !active }" :id="`device-card-${device.id}`" :data-device-key="`device:${device.id}`">
    <view class="device-inventory-row__head">
      <view class="device-inventory-row__art" :class="{ 'device-inventory-row__art--inactive': !active }">
        <image v-if="imageSrc" class="device-inventory-row__image" :src="imageSrc" mode="aspectFit" @error="imageError" />
        <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 21h8m-4-5v5" /></svg>
      </view>
      <view class="device-inventory-row__identity">
        <text class="device-inventory-row__name">{{ deviceName(t, device) }}</text>
        <view v-if="active && !recovering && onlineState === 'online'" class="device-inventory-row__state device-inventory-row__state--active"><view class="device-inventory-row__dot" aria-hidden="true" /><text>{{ t.earn.online }}</text></view>
        <text v-if="statusText" class="device-inventory-row__status">{{ statusText }}</text>
      </view>
      <view v-if="active" class="device-inventory-row__today-box">
        <text class="device-inventory-row__label">{{ t.myDevices.inventoryTodayLabel }}</text>
        <text class="device-inventory-row__today font-mono-tabular">{{ todayText }}</text>
      </view>
    </view>

    <view v-if="active && device.currentTask" class="device-inventory-row__task">
      <view class="device-inventory-row__task-row">
        <view v-if="taskRunning" class="device-inventory-row__eq" aria-hidden="true"><view /><view /><view /></view>
        <text class="device-inventory-row__task-name"><text class="device-inventory-row__label">{{ t.earn.currentTask }}</text>{{ visibility.mask(device.currentTask.type) }}</text>
        <text class="device-inventory-row__pct font-mono-tabular">{{ visibility.mask(progressPct == null ? '—' : `${progressPct}%`) }}</text>
      </view>
      <view class="device-inventory-row__bar" role="progressbar" :aria-label="t.earn.currentTask" :aria-valuenow="visibility.hidden || progressPct == null ? undefined : progressPct" aria-valuemin="0" aria-valuemax="100">
        <view v-if="!visibility.hidden && progressPct != null" class="device-inventory-row__fill nx-viz-grow" :style="{ width: `${progressPct}%` }" />
      </view>
    </view>
    <view v-else-if="active && (!remoteApiEnabled || device.kind !== 'phone')" class="device-inventory-row__task device-inventory-row__task--idle">
      <view class="device-inventory-row__wait" aria-hidden="true" />
      <text>{{ recovering ? computeCopy.statuses.RECOVERING : runtimeConfirmed ? t.earn.noCurrentTask : t.earn.runtimeUnknown }}</text>
    </view>
    <PhoneComputeStatus v-if="remoteApiEnabled && device.kind === 'phone'" :device-id="device.id" style="margin:12px 0 0" />

    <view v-if="device.pendingDeactivate" class="device-inventory-row__pending">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      <text>{{ pendingChipLabel }}</text>
    </view>

    <view class="device-inventory-row__foot">
      <view class="device-inventory-row__money">
        <text class="device-inventory-row__total">{{ t.myDevices.inventoryEarnedLabel }}<text class="device-inventory-row__earned font-mono-tabular">{{ earnedText }}</text></text>
        <view v-if="tradeinCreditText || tradeinDisabledText" :id="`${quoteInfoId}-trigger`" class="device-inventory-row__quote device-inventory-row__info"
          :class="{ 'device-inventory-row__info--open': quoteInfoOpen }" role="button" tabindex="0"
          :aria-label="`${t.tradein.quoteInfoLabel} · ${tradeinQuoteAmount !== undefined ? t.tradein.inventoryCreditLabel + ' ' + visibility.mask(fmtMoney(tradeinQuoteAmount)) : tradeinDisabledText || t.tradein.quoteUnavailable}`"
          :aria-expanded="quoteInfoOpen" :aria-controls="quoteInfoId"
          @click.stop="emit('quote-info', !quoteInfoOpen)" @keydown.enter.stop.prevent="emit('quote-info', !quoteInfoOpen)" @keydown.space.stop.prevent="emit('quote-info', !quoteInfoOpen)" @keydown.tab="emit('quote-info', false)" @keydown.esc.stop="emit('quote-info', false)">
          <text v-if="tradeinQuoteAmount !== undefined">{{ t.tradein.inventoryCreditLabel }}</text>
          <text v-if="tradeinQuoteAmount !== undefined" class="device-inventory-row__credit font-mono-tabular">{{ visibility.mask(fmtMoney(tradeinQuoteAmount)) }}</text>
          <text v-else class="device-inventory-row__tradein-disabled">{{ tradeinDisabledText || t.tradein.quoteUnavailable }}</text>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9h.01" /></svg>
        </view>
      </view>
      <view v-if="showAction" class="device-inventory-row__actions">
        <NxButton v-if="active" class="device-inventory-row__action" size="small" variant="secondary" :label="actionLabel" :disabled="actionDisabled" @click="onAction" />
        <NxButton v-if="tradeinCtaLabel" class="device-inventory-row__tradein-cta" size="small" :variant="active ? 'brand' : 'secondary'" :label="tradeinCtaLabel" @click="emit('quote-info', false); emit('tradein')" />
        <NxButton v-if="!active" class="device-inventory-row__action device-inventory-row__action--activate" size="small" variant="brand" :label="actionLabel" :disabled="actionDisabled" @click="onAction" />
      </view>
    </view>
    <view v-if="quoteInfoOpen && (tradeinCreditText || tradeinDisabledText)" :id="quoteInfoId" class="device-inventory-row__popover" role="note" @click.stop>
      <text class="device-inventory-row__popover-copy">{{ t.tradein.ladderIntro }}</text>
      <text class="device-inventory-row__popover-footnote">{{ t.tradein.ladderFootnote }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import DeviceUnclassifiedCard from "@/components/device-unclassified-card.vue";
import { computed, ref } from "vue";
import type { Device } from "@/store/types";
import NxButton from "@/components/ui/nx-button.vue";
import { useT } from "@/i18n/use-t";
import { fmtMoney } from "@/i18n/format";
import { deviceName } from "@/lib/device-copy";
import { useDataVisibility } from "@/store/data-visibility";
import { deviceOnlineState } from "@/lib/hashpower";
import { useDeviceProductImage } from "@/composables/use-device-product-image";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { advanceMonotonicHighWater, projectServerNow, readMonotonicNowMs } from "@/lib/server-deadline-clock";
import { deviceTaskRecovering, deviceTaskRunning, taskProgressPercent } from "@/lib/task-progress";
import { useComputeV2Copy } from "@/i18n/compute-v2";
import PhoneComputeStatus from "@/components/earn/phone-compute-status.vue";
import { remoteApiEnabled } from "@/api/runtime";

const t = useT();
const computeCopy = useComputeV2Copy();
const recovering = computed(() => deviceTaskRecovering(props.device));
const visibility = useDataVisibility();
const props = withDefaults(
  defineProps<{
    device: Device;
    active: boolean;
    runtimeConfirmed?: boolean;
    showAction?: boolean;
    disabled?: boolean;
    actionDisabled?: boolean;
    /** Replaces the disabled action label when the server needs reconciliation. */
    disabledLabel?: string;
    activateLabel: string;
    deactivateLabel: string;
    slotsFullLabel: string;
    pendingChipLabel: string;
    tradeinCreditText?: string;
    tradeinQuoteAmount?: number;
    quoteInfoOpen?: boolean;
    tradeinCtaLabel?: string;
    tradeinDisabledText?: string;
  }>(),
  { disabled: false, actionDisabled: false, showAction: true, runtimeConfirmed: true, quoteInfoOpen: false },
);
const emit = defineEmits<{ (e: "toggle"): void; (e: "tradein"): void; (e: "quote-info", open: boolean): void }>();
const quoteInfoId = computed(() => `device-inventory-details-${encodeURIComponent(props.device.id)}-quote-info`);
const earnedText = computed(() => visibility.mask(props.runtimeConfirmed ? fmtMoney(props.device.cumulativeEarningsUsdt) : "—"));
const todayText = computed(() => visibility.mask(props.runtimeConfirmed ? `+${fmtMoney(props.device.todayEarnings)}` : "—"));
const { imageSrc, imageError } = useDeviceProductImage(() => props.device);
const onlineState = computed(() => deviceOnlineState(props.device, Date.now(), props.runtimeConfirmed));
const statusText = computed(() => {
  if (recovering.value) return computeCopy.value.statuses.RECOVERING;
  if (props.device.activationUnconfirmed) return t.value.earn.runtimeUnknown;
  if (onlineState.value === "unknown") return t.value.earn.runtimeUnknown;
  return "";
});
// Job progress follows the server task clock, exactly like the home device row.
const now = ref(Date.now());
const monotonicNow = ref(readMonotonicNowMs());
useVisibleInterval(() => {
  if (!props.active || !props.device.currentTask) return;
  now.value = Date.now();
  monotonicNow.value = advanceMonotonicHighWater(monotonicNow.value, readMonotonicNowMs());
}, 1000);
const liveTaskNow = computed(() => props.device.taskServerNow != null && props.device.taskServerNowReceivedAt != null
  ? projectServerNow(props.device.taskServerNow, props.device.taskServerNowReceivedAt, monotonicNow.value) : now.value);
const progressPct = computed(() => props.runtimeConfirmed
  ? taskProgressPercent(props.device.currentTask, liveTaskNow.value, props.device.interruptedAt,
    props.device.kind === "phone" ? props.device.phoneValidUntil : null) : null);
const taskRunning = computed(() => onlineState.value === "online" && deviceTaskRunning(props.device)
  && (props.device.kind !== "phone" || props.device.phoneValidUntil == null || liveTaskNow.value < props.device.phoneValidUntil));
const actionDisabled = computed(() => props.disabled || props.actionDisabled);
const actionLabel = computed(() =>
  props.active ? props.deactivateLabel : props.disabled ? props.disabledLabel ?? props.slotsFullLabel : props.activateLabel,
);
function onAction() {
  if (!props.showAction || actionDisabled.value) return;
  emit("toggle");
}
</script>

<style scoped>
.device-inventory-row { position: relative; min-width: 0; padding: 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); color: var(--v5-ink); box-shadow: var(--v5-glass-shadow); }
.device-inventory-row__head { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; align-items: center; gap: 12px; }
.device-inventory-row__art { position: relative; display: grid; place-items: center; width: 84px; height: 72px; }
.device-inventory-row__image { display: block; width: 78px; height: 64px; margin-top: -4px; }
.device-inventory-row__art--inactive .device-inventory-row__image { filter: grayscale(.85); opacity: .55; }
.device-inventory-row__identity { min-width: 0; }
.device-inventory-row__name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.device-inventory-row__state { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--v5-ink-3); font: 400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.device-inventory-row__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--v5-success); flex: none; }
.device-inventory-row__status { display: block; margin-top: 4px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); overflow-wrap: anywhere; }
.device-inventory-row__today-box { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.device-inventory-row__label { color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); white-space: nowrap; }
.device-inventory-row__today { color: var(--v5-success-ink); font: 500 18px/24px var(--font-metric, var(--font-jet-mono)); white-space: nowrap; }
.device-inventory-row__task { margin-top: 12px; padding: 12px; border-radius: var(--v5-radius-s); background: var(--v5-surface-2); }
.device-inventory-row__task-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.device-inventory-row__eq { display: flex; align-items: flex-end; gap: 2px; width: 12px; height: 12px; flex: none; }
.device-inventory-row__eq > view { width: 2.6px; height: 12px; border-radius: 1px; background: var(--v5-brand); transform-origin: bottom; animation: device-eq .9s ease-in-out infinite; }
.device-inventory-row__eq > view:nth-child(2) { animation-delay: -.3s; }
.device-inventory-row__eq > view:nth-child(3) { animation-delay: -.6s; }
.device-inventory-row__task-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 13px/18px var(--font-v5); }
.device-inventory-row__task-name .device-inventory-row__label { margin-right: 6px; }
.device-inventory-row__pct { font: 500 12px/16px var(--font-metric, var(--font-jet-mono)); }
.device-inventory-row__bar { position: relative; height: 4px; margin-top: 10px; overflow: hidden; border-radius: var(--v5-radius-full); background: var(--v5-surface-3); }
.device-inventory-row__fill { height: 100%; border-radius: inherit; background: var(--v5-brand); transition: width .6s linear; }
.device-inventory-row__task--idle { display: flex; align-items: center; gap: 8px; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.device-inventory-row__wait { width: 14px; height: 14px; flex: none; box-sizing: border-box; border-radius: 50%; border: 1.5px dashed var(--v5-ink-3); }
.device-inventory-row__pending { display: flex; align-items: flex-start; gap: 6px; margin-top: 12px; padding: 8px; border-radius: 8px; background: color-mix(in srgb, var(--v5-warning) 12%, transparent); color: var(--v5-warning-ink); font: 400 12px/18px var(--font-v5); }
.device-inventory-row__pending svg { flex: none; margin-top: 3px; }
.device-inventory-row__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; min-height: 44px; }
.device-inventory-row__money { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.device-inventory-row__total { color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); white-space: nowrap; }
.device-inventory-row__earned { margin-left: 4px; color: var(--v5-ink); font: 500 13px/18px var(--font-metric, var(--font-jet-mono)); }
.device-inventory-row__quote { position: relative; display: flex; align-items: center; gap: 4px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); white-space: nowrap; }
.device-inventory-row__credit { color: var(--v5-ink); font: 500 13px/18px var(--font-metric, var(--font-jet-mono)); }
.device-inventory-row__info--open { color: var(--v5-brand); }
/* Keeps a comfortable tap target without spacing the two money lines apart. */
.device-inventory-row__quote::after { content: ""; position: absolute; inset: -2px -4px -12px; }
.device-inventory-row__actions { display: flex; gap: 8px; flex: none; }
.device-inventory-row__popover { position: relative; margin-top: var(--v5-space-2); padding: var(--v5-space-3) var(--v5-space-4); border-radius: var(--v5-radius-s); background: var(--v5-surface-2); color: var(--v5-ink-2); font: 400 12px/18px var(--font-v5); }
.device-inventory-row__popover::before { content: ""; position: absolute; top: -6px; left: 24px; width: 12px; height: 12px; background: inherit; transform: rotate(45deg); }
.device-inventory-row__popover-copy, .device-inventory-row__popover-footnote { display: block; }
.device-inventory-row__popover-footnote { margin-top: var(--v5-space-2); color: var(--v5-ink-3); }
[role="button"] { cursor: pointer; }
[role="button"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
@keyframes device-eq { 0%, 100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
@media (max-width: 374px) {
  .device-inventory-row__head { grid-template-columns: 68px minmax(0, 1fr) auto; gap: 10px; }
  .device-inventory-row__art { width: 68px; height: 60px; }
  .device-inventory-row__image { width: 66px; height: 54px; }
  .device-inventory-row__foot { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) { .device-inventory-row__eq > view { animation: none; } .device-inventory-row__fill { transition: none; } }
</style>
