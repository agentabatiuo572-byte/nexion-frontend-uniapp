<!-- Device warehouse card (P-43): device art, live state, today's earnings, the current job and the card actions in one view. -->
<template>
  <DeviceUnclassifiedCard v-if="device.kind === 'unknown'" :device="device" />
  <view v-else ref="loopRef" class="device-inventory-row" :class="{ 'device-inventory-row--idle': !active, 'nx-loops-paused': !loops.running.value }" :id="`device-card-${device.id}`" :data-device-key="`device:${device.id}`">
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
        <view class="device-inventory-row__task-name"><text class="device-inventory-row__label">{{ t.earn.currentTask }}</text><text class="device-inventory-row__task-value">{{ visibility.mask(device.currentTask.type) }}</text></view>
        <text class="device-inventory-row__pct font-mono-tabular">{{ visibility.mask(progressPct == null ? '—' : `${progressPct}%`) }}</text>
      </view>
      <view class="device-inventory-row__bar nx-progress" role="progressbar" :aria-label="t.earn.currentTask" :aria-valuenow="visibility.hidden || progressPct == null ? undefined : progressPct" aria-valuemin="0" aria-valuemax="100">
        <view v-if="!visibility.hidden && progressPct != null" class="device-inventory-row__fill nx-progress__fill nx-viz-grow" :style="{ width: `${progressPct}%` }" />
      </view>
    </view>
    <view v-else-if="active && (!remoteApiEnabled || device.kind !== 'phone')" class="device-inventory-row__task device-inventory-row__task--idle">
      <view class="device-inventory-row__wait" aria-hidden="true" />
      <text>{{ recovering ? computeCopy.statuses.RECOVERING : !runtimeConfirmed ? t.earn.runtimeUnknown : tasksConfirmed ? t.earn.noCurrentTask : t.earn.taskStatusUnavailable }}</text>
    </view>
    <PhoneComputeStatus v-if="remoteApiEnabled && device.kind === 'phone'" :device-id="device.id" style="margin:12px 0 0" />

    <slot name="replacement-status" />
    <view v-if="device.pendingDeactivate && !$slots['replacement-status']" class="device-inventory-row__pending">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      <text>{{ pendingChipLabel }}</text>
    </view>

    <view class="device-inventory-row__foot">
      <view class="device-inventory-row__money">
        <text class="device-inventory-row__total">{{ t.myDevices.inventoryEarnedLabel }}<text class="device-inventory-row__earned">{{ earnedText }}</text></text>
        <view v-if="tradeinCreditText || tradeinDisabledText" :id="`${quoteInfoId}-trigger`" class="device-inventory-row__quote device-inventory-row__info"
          :class="{ 'device-inventory-row__info--open': quoteInfoOpen }" role="button" tabindex="0"
          :aria-label="`${t.tradein.quoteInfoLabel} · ${tradeinQuoteAmount !== undefined ? t.tradein.inventoryCreditLabel + ' ' + visibility.mask(fmtMoney(tradeinQuoteAmount)) : tradeinDisabledText || t.tradein.quoteUnavailable}`"
          aria-haspopup="dialog" :aria-expanded="quoteInfoOpen"
          @click.stop="emit('quote-info', !quoteInfoOpen)" @keydown.enter.stop.prevent="emit('quote-info', !quoteInfoOpen)" @keydown.space.stop.prevent="emit('quote-info', !quoteInfoOpen)" @keydown.tab="emit('quote-info', false)" @keydown.esc.stop="emit('quote-info', false)">
          <text v-if="tradeinQuoteAmount !== undefined">{{ t.tradein.inventoryCreditLabel }}</text>
          <text v-if="tradeinQuoteAmount !== undefined" class="device-inventory-row__credit">{{ visibility.mask(fmtMoney(tradeinQuoteAmount)) }}</text>
          <text v-else class="device-inventory-row__tradein-disabled">{{ tradeinDisabledText || t.tradein.quoteUnavailable }}</text>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9h.01" /></svg>
        </view>
      </view>
      <view v-if="showAction" class="device-inventory-row__actions">
        <!-- An activated card keeps one 更多 control; trade-in and deactivation live in its bottom sheet (03 §3.5.1 选择). -->
        <NxButton v-if="active" class="device-inventory-row__more" size="small" variant="text" :label="moreLabel" :disabled="moreDisabled"
          aria-haspopup="dialog" :aria-expanded="menuOpen" @click="menuOpen = true"><NxIcon name="more" :size="20" /></NxButton>
        <NxButton v-if="tradeinCtaLabel && !active" class="device-inventory-row__tradein-cta" size="small" variant="secondary" :label="tradeinCtaLabel" @click="emit('quote-info', false); emit('tradein')" />
        <slot v-if="!active" name="inventory-action">
          <NxButton class="device-inventory-row__action device-inventory-row__action--activate" size="small" variant="brand" :label="actionLabel" :disabled="actionDisabled" @click="onAction" />
        </slot>
        <!-- display: contents keeps the closed host out of the button row; taps in the sheet stay off the page's close-on-tap. -->
        <view v-if="active" class="device-inventory-row__menu-host" @click.stop>
          <NxSheet :open="menuOpen" :title="deviceName(t, device)" @close="menuOpen = false">
            <view class="device-inventory-row__menu" role="group" :aria-label="t.myDevices.inventoryMoreActions">
              <view v-if="tradeinCtaLabel" class="device-inventory-row__menu-row" role="button" tabindex="0"
                @click="chooseMenu('tradein')" @keydown.enter.stop.prevent="chooseMenu('tradein')" @keydown.space.stop.prevent="chooseMenu('tradein')">
                <view class="device-inventory-row__menu-icon device-inventory-row__menu-icon--brand" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-4 4" /><path d="M3 7h18" /><path d="M7 21l-4-4 4-4" /><path d="M21 17H3" /></svg></view>
                <text class="device-inventory-row__menu-label">{{ tradeinCtaLabel }}</text>
                <view class="device-inventory-row__menu-chevron"><NxIcon name="chevron-right" :size="16" /></view>
              </view>
              <view class="device-inventory-row__menu-row device-inventory-row__menu-row--danger" role="button" :tabindex="actionDisabled ? -1 : 0" :aria-disabled="actionDisabled"
                @click="chooseMenu('toggle')" @keydown.enter.stop.prevent="chooseMenu('toggle')" @keydown.space.stop.prevent="chooseMenu('toggle')">
                <view class="device-inventory-row__menu-icon device-inventory-row__menu-icon--neutral" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10" /><path d="M6.3 5.3a9 9 0 1 0 11.4 0" /></svg></view>
                <view class="device-inventory-row__menu-copy">
                  <text class="device-inventory-row__menu-label">{{ actionLabel }}</text>
                  <text v-if="actionDisabled && device.pendingDeactivate" class="device-inventory-row__menu-desc">{{ pendingChipLabel }}</text>
                </view>
              </view>
            </view>
          </NxSheet>
        </view>
      </view>
    </view>
    <!-- An explanation the user opens is a bottom sheet (03 §3.5.1); taps inside it stay off the page's close-on-tap. -->
    <view v-if="tradeinCreditText || tradeinDisabledText" @click.stop>
      <NxSheet :open="quoteInfoOpen" :title="t.tradein.quoteInfoLabel" @close="emit('quote-info', false)">
        <!-- Board B-8a: this device's output and credit, the five-tier table with its current tier, one footnote. -->
        <view class="device-inventory-row__ladder-device">
          <view class="device-inventory-row__ladder-art" aria-hidden="true"><image v-if="imageSrc" class="device-inventory-row__ladder-image" :src="imageSrc" mode="aspectFit" @error="imageError" /></view>
          <view class="device-inventory-row__ladder-meta">
            <text class="device-inventory-row__ladder-name">{{ deviceName(t, device) }}</text>
            <text class="device-inventory-row__ladder-sub">{{ t.tradein.ladderEarnedLabel }} <text class="device-inventory-row__ladder-num">{{ earnedText }}</text></text>
          </view>
          <view class="device-inventory-row__ladder-credit">
            <text class="device-inventory-row__label">{{ t.tradein.inventoryCreditLabel }}</text>
            <text v-if="ladderCredit" class="device-inventory-row__ladder-amount"><text class="device-inventory-row__ladder-muted">$</text>{{ ladderCredit.int }}<text class="device-inventory-row__ladder-muted">{{ ladderCredit.dec }}</text></text>
            <text v-else class="device-inventory-row__ladder-amount">{{ visibility.mask("—") }}</text>
          </view>
        </view>
        <view class="device-inventory-row__ladder" role="img" :aria-label="ladder.aria">
          <text class="device-inventory-row__label" aria-hidden="true">{{ t.tradein.ladderRateCaption }}</text>
          <view class="device-inventory-row__ladder-grid device-inventory-row__ladder-rates" aria-hidden="true">
            <text v-for="(cell, i) in ladder.rates" :key="i" :class="{ 'device-inventory-row__ladder-on': i === ladder.current }">{{ cell }}</text>
          </view>
          <view class="device-inventory-row__ladder-track" aria-hidden="true">
            <view class="device-inventory-row__ladder-grid"><view v-for="(_, i) in ladder.rates" :key="i" class="device-inventory-row__ladder-seg" :class="{ 'device-inventory-row__ladder-seg--on': i === ladder.current }" /></view>
            <view v-if="ladder.marker != null" class="device-inventory-row__ladder-dot" :style="{ left: `calc(${ladder.marker}% - 4px)` }" />
          </view>
          <view class="device-inventory-row__ladder-grid device-inventory-row__ladder-ranges" aria-hidden="true">
            <text v-for="(cell, i) in ladder.ranges" :key="i" :class="{ 'device-inventory-row__ladder-on': i === ladder.current }">{{ cell }}</text>
          </view>
          <view class="device-inventory-row__ladder-foot" aria-hidden="true">
            <text class="device-inventory-row__label">{{ t.tradein.ladderRatioCaption }}</text>
            <text class="device-inventory-row__label" :class="{ 'device-inventory-row__ladder-on': ladder.current >= 0 }">{{ ladder.produced }}</text>
          </view>
        </view>
        <text class="device-inventory-row__sheet-footnote">{{ t.tradein.ladderFootnote }}</text>
      </NxSheet>
    </view>
  </view>
</template>

<script setup lang="ts">
import DeviceUnclassifiedCard from "@/components/device-unclassified-card.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import { computed, nextTick, ref } from "vue";
import type { Device } from "@/store/types";
import NxButton from "@/components/ui/nx-button.vue";
import NxSheet from "@/components/ui/nx-sheet.vue";
import { useT } from "@/i18n/use-t";
import { fmt, fmtMoney } from "@/i18n/format";
import { formatGroupedAmount } from "@/lib/amount-display";
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
import { useLoopsInView } from "@/composables/use-loops-in-view";
import type { CanonicalTradeinConfig, CanonicalTradeinQuote } from "@/api/device-e3-api";

type TradeinLadderConfig = Pick<CanonicalTradeinConfig, "creditRatesPct" | "outputRatioCutsPct">;
type TradeinLadderQuote = Pick<CanonicalTradeinQuote, "outputRatioPct" | "creditRatePct">;

const t = useT();
const computeCopy = useComputeV2Copy();
const recovering = computed(() => deviceTaskRecovering(props.device));
const visibility = useDataVisibility();
// The running equalizer and online dot pause while this card is off-screen or its page is hidden.
const loops = useLoopsInView(".device-inventory-row");
const loopRef = loops.elRef;
const props = withDefaults(
  defineProps<{
    device: Device;
    active: boolean;
    runtimeConfirmed?: boolean;
    /** False when the task read failed, so an idle-looking card must not claim it is waiting for a job. */
    tasksConfirmed?: boolean;
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
    tradeinLadderConfig?: TradeinLadderConfig;
    tradeinLadderQuote?: TradeinLadderQuote;
  }>(),
  { disabled: false, actionDisabled: false, showAction: true, runtimeConfirmed: true, tasksConfirmed: true, quoteInfoOpen: false },
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
// The 可抵 explainer (board B-8a). The credit and this device's output ratio follow the hide-stats switch (03.10); tier rates
// and ranges are public rules and stay visible.
const ladderCredit = computed(() => {
  if (visibility.hidden || props.tradeinQuoteAmount === undefined) return null;
  const [int, dec] = formatGroupedAmount(props.tradeinQuoteAmount).split(".");
  return { int, dec: dec === undefined ? "" : `.${dec}` };
});
const ladder = computed(() => ladderView(props.tradeinLadderConfig, props.tradeinLadderQuote, visibility.hidden));
/** Cells, current tier, marker position and the screen-reader sentence of the tier table, built from the data (PRD §7.5.4). */
function ladderView(config: TradeinLadderConfig | undefined, quote: TradeinLadderQuote | undefined, hidden: boolean) {
  const c = t.value.tradein;
  const truncate = (value: number) => Math.trunc(value * 10) / 10;
  const pct = (value: number) => `${truncate(value)}%`;
  const rates = config?.creditRatesPct ?? [];
  const cuts = config?.outputRatioCutsPct ?? [];
  // Rates step down from the first tier; cuts are the boundaries between tiers, so there is one fewer of them.
  const count = config ? rates.length : 5;
  const ranges = config ? rates.map((_, i) => i === 0 ? `<${pct(cuts[0])}` : i === count - 1 ? `≥${pct(cuts[i - 1])}` : `${truncate(cuts[i - 1])}–${pct(cuts[i])}`)
    : Array.from({ length: count }, () => "—");
  const output = hidden ? undefined : quote?.outputRatioPct;
  const current = quote && !hidden ? rates.indexOf(quote.creditRatePct) : -1;
  // The dot sits inside the current tier in proportion; the open-ended last tier has no upper bound, so it sits at its middle.
  let marker: number | null = null;
  if (output != null && current >= 0) {
    const lo = current === 0 ? 0 : cuts[current - 1];
    const hi = current < cuts.length ? cuts[current] : null;
    const within = hi == null ? 0.5 : Math.min(1, Math.max(0, (output - lo) / (hi - lo)));
    marker = Number(((current + within) / count * 100).toFixed(1));
  }
  const outputPct = output == null ? "—" : pct(output);
  const produced = fmt(c.ladderProduced, { pct: hidden ? visibility.mask("—") : outputPct });
  const aria = config
    ? [`${c.ladderRateCaption}: ${rates.map((rate, i) => fmt(c.ladderAriaBand, { range: ranges[i], rate: pct(rate) })).join("; ")}.`,
      current < 0 ? produced : fmt(c.ladderAriaYou, { pct: outputPct, n: current + 1 })].join(" ")
    : `${c.ladderRateCaption}: —. ${produced}`;
  return { rates: config ? rates.map(pct) : ranges, ranges, current, marker, produced, aria };
}
function onAction() {
  if (!props.showAction || actionDisabled.value) return;
  emit("toggle");
}
// 更多: the menu holds trade-in (only when this device has an entry) and deactivation. While a deactivation is pending
// the deactivate row is disabled with its reason; the button itself is disabled only when nothing else is left in it.
const menuOpen = ref(false);
const moreLabel = computed(() => `${t.value.myDevices.inventoryMoreActions} · ${deviceName(t.value, props.device)}`);
const moreDisabled = computed(() => actionDisabled.value && !props.tradeinCtaLabel);
async function chooseMenu(action: "toggle" | "tradein") {
  if (action === "toggle" && actionDisabled.value) return;
  // The sheet closes first and hands focus back to 更多, so the confirm or trade-in sheet that opens next returns it there.
  menuOpen.value = false;
  await nextTick();
  await nextTick();
  if (action === "tradein") {
    emit("quote-info", false);
    emit("tradein");
  } else onAction();
}
</script>

<style scoped>
.device-inventory-row { position: relative; min-width: 0; padding: 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); color: var(--v5-ink); box-shadow: var(--v5-glass-shadow); }
/* The device is the card's visual anchor: the catalog art leaves about 40% empty around the machine, so the square
   image is as wide as the art column (the Rack's 87%-wide body still fits) and the column is only as tall as the
   machine; the transparent margins overlap the card padding. The column bleeds 12px into that padding so the name
   column keeps its width. */
.device-inventory-row__head { display: grid; grid-template-columns: 88px minmax(0, 1fr) auto; align-items: center; gap: 12px; }
.device-inventory-row__art { position: relative; display: grid; place-items: center; width: 100px; height: 56px; margin-left: -12px; }
.device-inventory-row__image { position: absolute; left: 0; top: 50%; display: block; width: 100px; height: 100px; transform: translateY(-56%); pointer-events: none; }
.device-inventory-row__art--inactive .device-inventory-row__image { filter: grayscale(.85); opacity: .55; }
.device-inventory-row__identity { min-width: 0; }
/* The card opens no device page (更多 only exists on active cards), so a long name wraps in full instead of being cut (03 §3.6.1). */
.device-inventory-row__name { display: block; overflow-wrap: break-word; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.device-inventory-row__state { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--v5-ink-3); font: 400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.device-inventory-row__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--v5-success); flex: none; }
.device-inventory-row__status { display: block; margin-top: 4px; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; }
.device-inventory-row__today-box { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
/* Field names (今日、当前作业) use the auxiliary-figure role; the job title beside them the list-subtitle role (10 §10.1). */
.device-inventory-row__label { color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space: nowrap; }
/* Today's earnings are the card's own main amount: card-figure role, Montserrat (10 §10.1 卡内主数值, 01 §1.2). */
.device-inventory-row__today { color: var(--v5-success-ink); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); font-variant-numeric: tabular-nums; white-space: nowrap; }
.device-inventory-row__task { margin-top: 12px; padding: 12px; border-radius: var(--v5-radius-s); background: var(--v5-surface-2); }
.device-inventory-row__task-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.device-inventory-row__eq { display: flex; align-items: flex-end; gap: 2px; width: 12px; height: 12px; flex: none; }
.device-inventory-row__eq > view { width: 2.6px; height: 12px; border-radius: 1px; background: var(--v5-brand); transform-origin: bottom; animation: device-eq .9s ease-in-out infinite; }
.device-inventory-row__eq > view:nth-child(2) { animation-delay: -.3s; }
.device-inventory-row__eq > view:nth-child(3) { animation-delay: -.6s; }
:is(.nx-loops-paused, .nx-chassis[data-page-visible="false"], .nx-chassis[data-scrolling="true"]) .device-inventory-row__eq > view { animation-play-state: paused; }
.device-inventory-row__task-name { flex: 1; min-width: 0; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
/* The card opens no device detail, so the task name wraps in full; the label stays on the first line beside it. */
.device-inventory-row__task-value { overflow-wrap: break-word; }
.device-inventory-row__task-name .device-inventory-row__label { margin-right: 6px; }
.device-inventory-row__pct { font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric, var(--font-jet-mono)); }
.device-inventory-row__bar { margin-top: 10px; }
.device-inventory-row__fill { transition: width .6s linear; }
.device-inventory-row__task--idle { display: flex; align-items: center; gap: 8px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.device-inventory-row__wait { width: 14px; height: 14px; flex: none; box-sizing: border-box; border-radius: 50%; border: 1.5px dashed var(--v5-ink-3); }
.device-inventory-row__pending { display: flex; align-items: flex-start; gap: 6px; margin-top: 12px; padding: 8px; border-radius: 8px; background: color-mix(in srgb, var(--v5-warning) 12%, transparent); color: var(--v5-warning-ink); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.device-inventory-row__pending svg { flex: none; margin-top: 3px; }
/* The buttons never shrink (03 §3.6.1): when amounts and buttons do not fit on one line, the buttons wrap to the next line, right-aligned. */
.device-inventory-row__foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin-top: 12px; min-height: 44px; }
.device-inventory-row__money { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
/* Field names and amounts share the list-subtitle role (10 §10.1); amounts are General Sans figures in the main ink (01 §1.1.1, §1.2). */
.device-inventory-row__total { color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); white-space: nowrap; }
.device-inventory-row__earned { margin-left: 4px; color: var(--v5-ink); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); font-variant-numeric: tabular-nums; }
.device-inventory-row__quote { position: relative; align-self: flex-start; display: flex; align-items: center; gap: 4px; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); white-space: nowrap; }
.device-inventory-row__credit { color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.device-inventory-row__info--open { color: var(--v5-brand); }
/* A 44px tap target without spacing the two money lines apart (01 §1.3). It grows over the plain 收益 line above and
   only 6px down: wrapped buttons start 8px below, and their own hit boxes stay theirs. */
.device-inventory-row__quote::after { content: ""; position: absolute; inset: calc(var(--ui-type-list-subtitle-lh) + 6px - 44px) -4px -6px; }
.device-inventory-row__actions { display: flex; gap: 8px; flex: none; margin-left: auto; }
/* Explainer sheet (board B-8a): device row and tier table are surface-2 blocks 16 apart, then one footnote line. */
.device-inventory-row__ladder-device, .device-inventory-row__ladder { border-radius: var(--v5-radius-m); background: var(--v5-surface-2); }
.device-inventory-row__ladder-device { display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 8px; }
.device-inventory-row__ladder-art { position: relative; flex: none; width: 64px; height: 56px; }
.device-inventory-row__ladder-image { position: absolute; left: 0; top: 50%; width: 64px; height: 64px; transform: translateY(-50%); }
.device-inventory-row__ladder-meta { flex: 1 1 auto; min-width: 0; }
.device-inventory-row__ladder-name { display: block; overflow-wrap: break-word; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.device-inventory-row__ladder-sub { display: block; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.device-inventory-row__ladder-num { font-weight: 500; font-variant-numeric: tabular-nums; }
.device-inventory-row__ladder-credit { flex: none; display: flex; flex-direction: column; align-items: flex-end; }
/* The credit is this row's main figure: card-figure role in Montserrat, $ and decimals muted (01 §1.2, 10 §10.1). */
.device-inventory-row__ladder-amount { white-space: nowrap; color: var(--v5-ink); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); font-variant-numeric: tabular-nums; }
.device-inventory-row__ladder-muted { color: var(--v5-ink-3); }
.device-inventory-row__ladder-muted:first-child { font-size: max(12px, .55em); }
.device-inventory-row__ladder { margin-top: 16px; padding: 14px 16px; }
.device-inventory-row__ladder-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 4px; text-align: center; }
/* Tier rates use the inline-figure role (JetBrains Mono 500); the current tier is brand and one step larger (list-title size). */
.device-inventory-row__ladder-rates { margin-top: 6px; align-items: end; color: var(--v5-ink-3); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-list-title-lh) var(--font-metric); }
.device-inventory-row__ladder-rates .device-inventory-row__ladder-on { font-size: var(--ui-type-list-title); }
.device-inventory-row__ladder-ranges { margin-top: 8px; color: var(--v5-ink-3); font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-metric); white-space: nowrap; }
.device-inventory-row__ladder-on { color: var(--v5-brand); }
.device-inventory-row__ladder-track { position: relative; margin-top: 10px; }
.device-inventory-row__ladder-seg { height: 3px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.device-inventory-row__ladder-seg--on { background: color-mix(in srgb, var(--v5-brand) 60%, transparent); }
.device-inventory-row__ladder-dot { position: absolute; top: -2.5px; width: 8px; height: 8px; border-radius: 50%; background: var(--v5-brand); }
.device-inventory-row__ladder-foot { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; }
.device-inventory-row__sheet-footnote { display: block; margin-top: 16px; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
[role="button"] { cursor: pointer; }
[role="button"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
@keyframes device-eq { 0%, 100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
@media (max-width: 374px) {
  .device-inventory-row__head { grid-template-columns: 76px minmax(0, 1fr) auto; gap: 10px; }
  .device-inventory-row__art { width: 84px; height: 48px; margin-left: -8px; }
  .device-inventory-row__image { width: 84px; height: 84px; }
}
@media (prefers-reduced-motion: reduce) { .device-inventory-row__eq > view { animation: none; } .device-inventory-row__fill { transition: none; } }
/* 更多: a bare 20px icon, no fill, rim or stroke (user), in the card's secondary-icon ink like the ⓘ beside it, in a 44px
   hit box (01 §1.3) whose icon sits flush with the card's content edge. Pressing dims the icon instead of scaling it. */
.device-inventory-row__actions .device-inventory-row__more { min-width: 44px; margin-right: -12px; color: var(--v5-ink-3); }
.device-inventory-row__more :deep(.nx-button__surface) { flex: none; width: 44px; padding: 0; }
.device-inventory-row__actions .device-inventory-row__more:not(.nx-button--disabled):active { opacity: .6; transform: none; }
.device-inventory-row__menu-host { display: contents; }
.device-inventory-row__menu { overflow: hidden; border-radius: var(--v5-radius-m); background: var(--v5-surface-2); }
.device-inventory-row__menu-row { display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 12px 16px; border-bottom: 1px solid var(--v5-border); }
.device-inventory-row__menu-row:last-child { border-bottom: 0; }
.device-inventory-row__menu-row:not([aria-disabled="true"]):active { background: color-mix(in srgb, var(--v5-ink) 6%, transparent); }
.device-inventory-row__menu-row[role="button"]:focus-visible { outline-offset: -2px; }
.device-inventory-row__menu-row[aria-disabled="true"] { cursor: default; }
.device-inventory-row__menu-row[aria-disabled="true"] :is(.device-inventory-row__menu-icon, .device-inventory-row__menu-label) { opacity: .5; }
.device-inventory-row__menu-icon { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border-radius: 10px; }
.device-inventory-row__menu-icon--brand { background: var(--v5-brand-soft); color: var(--v5-brand); }
/* A destructive row swaps only its text to the error colour (03 §3.1); its icon tile stays neutral. */
.device-inventory-row__menu-icon--neutral { background: var(--v5-surface-3); color: var(--v5-ink-2); }
.device-inventory-row__menu-copy { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
/* Menu rows use the list-title role at 400 (03 §3.5); a destructive action only swaps its text to the error colour (03 §3.1). */
.device-inventory-row__menu-label { flex: 1; min-width: 0; color: var(--v5-ink); font: 400 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
/* Deactivating is a reverse action: it lives in this menu in neutral text; only its confirm dialog uses the error colour. */
.device-inventory-row__menu-row--danger .device-inventory-row__menu-label { color: var(--v5-ink); }
.device-inventory-row__menu-desc { color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.device-inventory-row__menu-chevron { display: flex; flex: none; color: var(--v5-ink-4); }
</style>
