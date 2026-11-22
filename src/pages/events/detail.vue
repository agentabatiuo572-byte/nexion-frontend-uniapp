<template>
  <AppChassis active="home"><view class="event-detail" :class="{ 'event-detail--bar': detail && action }" :aria-busy="loading">
    <SubPageHeader back="/pages/events/events?source=legacy" :title="copy.title" />
    <text v-if="loading && !detail" class="event-copy" role="status">{{ copy.loading }}</text>
    <EmptyState v-else-if="!detail" kind="recoverable-error" page :title="copy.unavailable" :cta-label="uiT.ui.reload" @cta="load" />
    <template v-else>
      <view class="nx-glass-card event-section">
        <text class="event-title">{{ detail.event.title }}</text>
        <text class="event-copy">{{ detail.event.subtitle }}</text>
        <text v-if="detail.event.kind==='seasonal'&&detail.rules.voucherId" class="event-copy">{{ copy.voucherTerms }}</text>
        <NxTag class="event-status" role="status" wrap :tone="statusTone" :label="copy.eligibility[detail.eligibilityReason]" />
        <text v-if="detail.reminderSubscribed" class="event-copy" role="status">{{ reminderCopy.subscribed }}</text>
        <view v-if="detail.event.startsAt" class="event-row"><text>{{ copy.start }}</text><text>{{ displayDeadline(detail.event.startsAt, locale.code) }}</text></view>
        <view v-if="detail.event.endsAt" class="event-row"><text>{{ copy.end }}</text><text>{{ displayDeadline(detail.event.endsAt, locale.code) }}</text></view>
      </view>
      <view v-if="detail.rewards.length" class="nx-glass-card event-section">
        <text class="event-card-title">{{ copy.rewards }}</text>
        <text v-for="(reward, index) in detail.rewards" :key="index" class="event-reward">{{ reward.type === 'USDT' ? `${reward.pool ? `${copy.labels.poolUsdt} · ` : ''}${formatUsd(reward.quantity ?? reward.amount, 'detail')}` : eventDetailReward(reward, copy) }}</text>
      </view>
      <view v-if="ruleRows.length" class="event-section event-section--plain">
        <text class="event-heading">{{ copy.rules }}</text>
        <view v-for="row in ruleRows" :key="row.label" class="event-row" :class="{'event-rule-paragraph':[copy.labels.description,copy.labels.terms].includes(row.label)}"><text>{{ row.label }}</text><text>{{ row.value }}</text></view>
      </view>
      <view v-if="detail.event.kind !== 'regional' && detail.targetValue > 0" class="event-section event-section--plain">
        <view class="event-row"><text class="event-subheading">{{ copy.progress }}</text><text>{{ formatAmount(detail.progressValue) }} / {{ formatAmount(detail.targetValue) }}</text></view>
        <view class="event-progress" role="progressbar" :aria-label="copy.progress" :aria-valuenow="Math.min(detail.progressValue, detail.targetValue)" :aria-valuemin="0" :aria-valuemax="detail.targetValue"><view v-viz-inview class="nx-viz-grow" :style="{ width: `${Math.min(100, detail.progressValue / detail.targetValue * 100)}%` }" /></view>
      </view>
      <view v-if="detail.myRewardAmount != null" class="nx-glass-card event-section">
        <view class="event-row"><text class="event-subheading">{{ copy.myReward }}</text><text>{{ formatUsd(detail.myRewardAmount, 'detail') }}</text></view>
      </view>
      <view v-if="detail.results.length || detail.event.state === 'ended'" class="event-section event-section--plain">
        <text class="event-heading">{{ copy.results }}</text>
        <text v-if="!detail.results.length" class="event-copy">{{ copy.noResults }}</text>
        <view v-for="(result, index) in detail.results" :key="index" class="event-result">
          <view v-if="result.region" class="event-row"><text>{{ copy.region }}</text><text>{{ result.region }}</text></view>
          <view v-if="result.rank != null" class="event-row"><text>{{ copy.rank }}</text><text>{{ result.rank }}</text></view>
          <view v-if="result.volume != null" class="event-row"><text>{{ copy.volume }}</text><text>{{ formatUsd(result.volume, 'detail') }}</text></view>
          <view v-if="result.rewardAmount != null" class="event-row"><text>{{ detail.event.kind === 'regional' ? copy.regionPrize : copy.prize }}</text><text>{{ formatUsd(result.rewardAmount, 'detail') }}</text></view>
        </view>
      </view>
      <text v-if="commandError && !action" class="event-copy" role="status">{{ copy.pending }}</text>
      <view v-if="action" class="event-bar-space" :class="{ 'event-bar-space--note': barNote }" aria-hidden="true"><text v-if="barNote" class="event-bar-space__note">{{ barNote }}</text></view>
      <text v-else-if="detail.event.state === 'ongoing' && detail.enabled" class="event-copy">{{ copy.automatic }}</text>
    </template>
  </view>
  <template #pageFixed>
    <view v-if="detail && action" class="event-bar nx-glass-bar">
      <text v-if="barNote" class="nx-tray-note" role="status">{{ barNote }}</text>
      <NxButton v-if="action==='open'" variant="primary" size="large" :label="copy.open" icon="arrow-right" :busy="busy" @click="run"><text>{{ copy.open }}</text></NxButton>
      <NxButton v-else variant="primary" size="large" :label="action === 'remind' ? reminderCopy.remind : copy[action]" :busy="busy" :busy-label="copy.busy" :disabled="error" @click="run" />
    </view>
  </template></AppChassis>
</template>
<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import { computed, onUnmounted, ref, watch } from "vue";
import { onLoad, onShow, onHide } from "@dcloudio/uni-app";
import EmptyState from "@/components/empty-state.vue";
import { useT } from "@/i18n/use-t";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NxButton from '@/components/ui/nx-button.vue';
import NxTag from '@/components/ui/nx-tag.vue';
import { isTransientReadFailure } from "@/lib/remote-read-failure";
import { apiClient, eventsApi, remoteApiEnabled } from "@/api/runtime";
import { captureRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { createEventDetailApi, type EventDetail, type EventEligibilityReason } from "@/api/event-detail-api";
import { useApp } from "@/store/app";
import { useLocaleStore } from "@/store/locale";
import { eventDetailCopy } from "@/i18n/event-detail";
import { eventReminderCopy } from "@/i18n/event-detail";
import { navTo, takeNavigationQuery } from "@/lib/route";
import { displayDeadline } from "@/lib/promotion-display";
import { formatAmount } from "@/lib/amount-display";
import { formatUsd } from "@/lib/usd-display";
import { eventDetailAction, eventDetailRules, eventDetailReward, eventClaimCommandKey, eventDetailHref, eventCommandFailure } from "./event-detail-display";
import { toast } from "@/store/ui";
import { uiLocale, serverLanguage } from "@/i18n";

const app = useApp(), locale = useLocaleStore(), api = createEventDetailApi(apiClient);
const language = computed(() => serverLanguage(locale.code));
const copy = computed(() => eventDetailCopy[uiLocale(locale.code)]);
const uiT = useT();
const reminderCopy = computed(() => eventReminderCopy[uiLocale(locale.code)]);
const detail = ref<EventDetail | null>(null), loading = ref(true), error = ref(false), busy = ref(false), commandError = ref(false);
const ruleRows = computed(() => eventDetailRules(detail.value?.rules ?? {}, copy.value));
const action = computed(() => detail.value ? eventDetailAction(detail.value) : null);
// The button is only unavailable while the shown state is a stale snapshot (a failed read); a read in progress does not
// grey it (03 §3.1). The reason sits above it in the tray; otherwise an unknown result says it is being confirmed.
const barNote = computed(() => error.value && action.value !== "open" ? copy.value.staleNote : commandError.value ? copy.value.pending : "");
// State tag tones (03 §3.8): claimable success, running but not met warning, closed or done neutral; 「暂未开放」-type
// unavailability takes the spec's unavailable tone (neutral fill, auxiliary text). READY is success only for a reward
// the user can claim now (userStatus CLAIMABLE, the status the claim command needs); purchase, upgrade and voucher
// events return READY for eligibility to keep shopping, which is neutral.
const eligibilityTone: Record<EventEligibilityReason, "success" | "warning" | "neutral" | "unavailable"> = {
  READY: "success", IN_PROGRESS: "warning", NOT_ELIGIBLE: "warning",
  NOT_STARTED: "neutral", ENDED: "neutral", CLAIMED: "neutral",
  VOUCHER_NOT_STARTED: "neutral", VOUCHER_EXPIRED: "neutral", VOUCHER_ALREADY_USED: "neutral", VOUCHER_EXHAUSTED: "neutral",
  DISABLED: "unavailable", VOUCHER_UNAVAILABLE: "unavailable",
};
// Read only where the tag renders, i.e. once a detail is loaded.
const statusTone = computed(() => { const { eligibilityReason, userStatus } = detail.value!; return eligibilityReason === "READY" && userStatus !== "CLAIMABLE" ? "neutral" : eligibilityTone[eligibilityReason]; });
let code = "", visible = false, generation = 0;
let unconfirmedAction: "join" | "claim" | "remind" | null = null;
const identity = () => `${app.accountKey}:${app.accountBindingEpoch}:${language.value}:${captureRuntimeRevision().epoch}:${code}`;
function reset() { generation += 1; detail.value = null; error.value = false; commandError.value = false; unconfirmedAction = null; busy.value = false; }
async function load() {
  if (!visible) return;
  const request = ++generation, scope = identity();
  loading.value = true; error.value = false;
  const current = () => visible && generation === request && scope === identity();
  try {
    if (!remoteApiEnabled || !code) throw new Error("EVENT_UNAVAILABLE");
    const value = await api.detail(code, language.value);
    if (current()) {
      detail.value = value;
      if ((unconfirmedAction === "join" && ["JOINED", "CLAIMABLE", "CLAIMED"].includes(value.userStatus)) || (unconfirmedAction === "claim" && value.userStatus === "CLAIMED") || (unconfirmedAction === "remind" && value.reminderSubscribed)) {
        // A claim confirmed only by this read lost its receipt; a device it issued still has to reach the fleet.
        if (unconfirmedAction === "claim" && value.rewards.some((reward) => reward.type === "DEVICE")) void app.refreshRemoteFleet(app.captureRemoteAccountRequest());
        commandError.value = false; unconfirmedAction = null;
      }
    }
  } catch (cause) { if (current()) { error.value = true; if (!isTransientReadFailure(cause)) detail.value = null; } }
  finally { if (current()) loading.value = false; }
}
async function run() {
  if (!visible || busy.value || !detail.value || !action.value) return;
  const selectedAction = action.value;
  if (selectedAction === "open") { navTo(eventDetailHref(detail.value)); return; }
  if (error.value) return;
  const scope = identity(), request = generation;
  const current = () => visible && request === generation && scope === identity();
  busy.value = true; commandError.value = false;
  const fleetRequest = selectedAction === "claim" ? app.captureRemoteAccountRequest() : undefined;
  const deviceClaim = selectedAction === "claim" && detail.value.rewards.some((reward) => reward.type === "DEVICE");
  try {
    if (selectedAction === "remind") await api.remind(code, `h4-event-reminder:${code}`);
    else if (selectedAction === "claim") {
      // A lost claim receipt can leave the warehouse refresh to onShow.
      if (deviceClaim) app.invalidateRemoteFleet(fleetRequest);
      const claim = await eventsApi.claim(code, eventClaimCommandKey(code, detail.value.claimKeys));
      if (claim.rewardType === "DEVICE") await app.refreshRemoteFleet(fleetRequest);
    } else await eventsApi.join(code, `h4-event-join:${code}`);
    if (current()) { busy.value = false; await load(); }
  } catch (cause) {
    // The outcome may be unknown even if this page is gone: a fleet read started during the claim may predate the device.
    // Invalidate it, then read again so a warehouse already on screen does not keep the pre-claim fleet.
    if (deviceClaim) { app.invalidateRemoteFleet(fleetRequest); void app.refreshRemoteFleet(fleetRequest, { coalesce: true }); }
    if (!current()) return;
    busy.value = false;
    // Only an unknown outcome is confirmed by reading (03 §3.5.2); a refusal or a 503 from the server is a result: say why
    // once (03 §3.5.1 toast) and leave the action available. The read shows the event as it now stands.
    const failure = eventCommandFailure(cause);
    if (failure === "unknown") { commandError.value = true; unconfirmedAction = selectedAction; }
    else toast.error(failure === "claimed" ? copy.value.eligibility.CLAIMED : failure === "notEligible" ? copy.value.eligibility.NOT_ELIGIBLE : copy.value.failed[failure]);
    await load();
  }
}
onLoad(options => { const query = new URLSearchParams(takeNavigationQuery("/pages/events/detail")); code = String(options?.id ?? query.get("id") ?? "").trim(); reset(); if (visible) void load(); });
let releaseActiveRefresh = () => {};
onShow(() => { visible = true; releaseActiveRefresh = registerActivePageRefresh(() => error.value || commandError.value ? undefined : load()); void load(); });
onHide(() => { visible = false; releaseActiveRefresh(); reset(); });
watch(() => [app.accountKey, app.accountBindingEpoch, language.value], () => { reset(); void load(); }, { flush: "sync" });
const unsubscribe = subscribeRuntimeRevision(() => { reset(); void load(); });
onUnmounted(() => { visible = false; releaseActiveRefresh(); reset(); unsubscribe(); });
useAutoRecovery({ failed: () => remoteApiEnabled && error.value && !commandError.value && !loading.value && !busy.value, retry: load });
// A command whose result is unknown is settled by this read (load reconciles it), so the page keeps reading at a low rate
// until it is, quietly: a pull during the check is not a failed refresh (03 §3.5.2). One owner per state.
useAutoRecovery({ failed: () => remoteApiEnabled && commandError.value && !loading.value && !busy.value, retry: load, repeatMs: 30_000 });
</script>
<style scoped>
.event-detail { padding:0 16px 28px; color:var(--v5-ink); }
.event-section { margin-top:12px; padding:16px; border-radius:var(--nx-glass-radius); background:var(--nx-glass-fill); box-shadow:var(--nx-glass-edge); }
.event-section--plain { padding:var(--ui-space-inset) 0; border-radius:0; background:transparent; box-shadow:none; border-top:1px solid var(--v5-border); }
.event-title { display:block; font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); overflow-wrap:break-word; }
.event-heading { display:block; font:var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.event-card-title { display:block; font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.event-subheading { font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); }
.event-copy { display:block; margin-top:10px; font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color:var(--v5-ink-3); white-space:pre-wrap; overflow-wrap:break-word; }
.event-title + .event-copy { margin-top:4px; }
.event-reward { display:block; margin-top:12px; font:var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap:break-word; }
.event-reward + .event-reward { margin-top:8px; }
.event-status { margin-top:12px; }
.event-row { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:6px 12px; margin-top:12px; font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.event-row > text:first-child:not(.event-subheading) { color:var(--v5-ink-3); }
.event-row > text:last-child { min-width:0; overflow-wrap:break-word; color:var(--v5-ink); }
.event-progress { margin-top:12px; height:4px; border-radius:4px; background:color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.event-progress > view { position:relative; height:100%; border-radius:inherit; background:linear-gradient(90deg, color-mix(in srgb, var(--v5-brand) 12%, transparent), color-mix(in srgb, var(--v5-brand) 70%, transparent)); }
.event-progress > view::after { content:""; position:absolute; top:50%; right:-3px; width:6px; height:6px; margin-top:-3px; border-radius:50%; background:var(--v5-brand); }
.event-result + .event-result { margin-top:14px; border-top:1px solid var(--v5-border); }
/* The main action floats in the shared bottom bar (04 §4.0), in the chassis layer that does not scroll. The in-flow spacer
   reserves the clearance in place of the page's bottom padding: 48 + 22 + 16 for the lone button, the tray's own height
   + 38 once the pending note sits above it. The spacer carries an invisible copy of the note at the note's width
   (16 + 16 inside the page's 16 = the tray's 12 + 8 + 12) and type, so a note that wraps reserves its real height:
   12 (tray padding 8 + note 4) + note + 8 + 48 + 8, then 22 + 16. */
.event-detail--bar { padding-bottom:0; }
.event-bar-space { height:calc(48px + var(--nx-tray-bottom) + 16px); }
.event-bar-space--note { height:auto; padding:12px 16px calc(8px + 48px + 8px + var(--nx-tray-bottom) + 16px); visibility:hidden; }
.event-bar-space__note { display:block; font:var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align:center; overflow-wrap:break-word; text-wrap:pretty; }
.event-bar { position:absolute; z-index:36; display:flex; flex-direction:column; }
.event-bar > .nx-button { width:100%; }
.event-rule-paragraph { display:block; }
.event-rule-paragraph > text { display:block;white-space:pre-wrap;text-align:left;overflow-wrap:break-word; }
.event-row.event-rule-paragraph > text + text { margin-top:6px;color:var(--v5-ink-2);font:var(--ui-type-long-form-weight) var(--ui-type-long-form)/var(--ui-type-long-form-lh) var(--font-v5); }
</style>
