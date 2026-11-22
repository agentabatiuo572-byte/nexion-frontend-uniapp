<template>
  <AppChassis active="home"><view class="event-detail" :class="{ 'event-detail--bar': detail && action }" :aria-busy="loading">
    <SubPageHeader back="/pages/events/events?source=legacy" :title="copy.title" />
    <view v-if="loading && !detail" class="event-skeleton" role="status" aria-busy="true" :aria-label="copy.loading">
      <view class="nx-glass-card event-section event-skeleton__card"><view /><view /><view /><view /><view /></view>
      <view class="event-section event-section--plain event-skeleton__plain"><view /><view /><view /><view /></view>
    </view>
    <EmptyState v-else-if="!detail" kind="recoverable-error" page :title="copy.unavailable" :cta-label="uiT.ui.reload" @cta="load" />
    <template v-else>
      <view class="nx-glass-card event-section">
        <text class="event-title">{{ detail.event.title }}</text>
        <text class="event-copy">{{ detail.event.subtitle }}</text>
        <text v-if="detail.event.kind==='seasonal'&&detail.rules.voucherId" class="event-copy">{{ copy.voucherTerms }}</text>
        <NxTag ref="statusTag" class="event-status" role="status" tabindex="-1" wrap :tone="statusTone" :label="statusLabel" />
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
      <view v-if="hasMeasuredProgress" class="event-section event-section--plain">
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
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
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
import { eventDetailAction, eventDetailRules, eventDetailReward, eventClaimCommandKey, eventDetailHref, eventCommandFailure, isEventNotFound } from "./event-detail-display";
import { toast } from "@/store/ui";
import { forgetPendingEventCommand, readPendingEventCommand, rememberPendingEventCommand } from "@/lib/event-pending-command";
import { uiLocale, serverLanguage } from "@/i18n";

const app = useApp(), locale = useLocaleStore(), api = createEventDetailApi(apiClient);
const language = computed(() => serverLanguage(locale.code));
const copy = computed(() => eventDetailCopy[uiLocale(locale.code)]);
const uiT = useT();
const reminderCopy = computed(() => eventReminderCopy[uiLocale(locale.code)]);
const detail = ref<EventDetail | null>(null), loading = ref(true), error = ref(false), busy = ref(false), commandError = ref(false);
// Progress is drawn only from a measured value (04 §4.0). Only referral, onboarding and the reinvest bonus count real
// progress; the other kinds (promotion, voucher, boost, wheel) get a 0 / 1 placeholder from the server, as every event
// does before it starts, and regional events rank by region instead.
const MEASURED_PROGRESS_KINDS: readonly string[] = ["referral", "onboarding"];
const hasMeasuredProgress = computed(() => { const { event, targetValue } = detail.value!; return event.state !== "upcoming" && targetValue > 0 && (MEASURED_PROGRESS_KINDS.includes(event.kind) || code === "evt-reinvest-bonus"); });
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
// Read only where the tag renders, i.e. once a detail is loaded. READY without a claimable reward is eligibility to keep
// going (purchase, upgrade, voucher): neutral, and worded without "claim".
const readyToContinue = computed(() => detail.value!.eligibilityReason === "READY" && detail.value!.userStatus !== "CLAIMABLE");
const statusTone = computed(() => readyToContinue.value ? "neutral" : eligibilityTone[detail.value!.eligibilityReason]);
const statusLabel = computed(() => readyToContinue.value ? copy.value.readyToContinue : copy.value.eligibility[detail.value!.eligibilityReason]);
const statusTag = ref<{ $el?: HTMLElement } | null>(null);
// When the user's own action removes the bar (claim confirmed, reminder set) the button they used is gone: land focus on
// the status that action changed instead of the document (03 §3.5, 07 §7.2), without scrolling (03 §3.4). A bar that
// leaves because of a background read (a confirming read, a pull) moves nothing.
let userActed = false;
watch(action, (next, prev) => {
  if (!prev || next || !userActed || typeof document === "undefined") return;
  userActed = false;
  if (document.activeElement && document.activeElement !== document.body) return;
  statusTag.value?.$el?.focus({ preventScroll: true });
}, { flush: "post" });
// generation orders reads; commands is bumped only by reset(), so a read the user starts (a pull) during a command does
// not orphan it: the command still clears busy and reads its result.
let code = "", visible = false, generation = 0, commands = 0;
let unconfirmedAction: "join" | "claim" | "remind" | null = null;
// The claim key a claim with an unknown outcome used: a tiered event (the reinvest bonus) stays claimable after one tier,
// so the claim is confirmed once that key has left claimKeys, not only by CLAIMED.
let unconfirmedClaimKey = "";
const identity = () => `${app.accountKey}:${app.accountBindingEpoch}:${language.value}:${captureRuntimeRevision().epoch}:${code}`;
function reset() { generation += 1; commands += 1; detail.value = null; error.value = false; commandError.value = false; unconfirmedAction = null; unconfirmedClaimKey = ""; busy.value = false; }
async function load() {
  if (!visible) return;
  // A command left unconfirmed by a reload or an earlier visit of this account is confirmed again by this read. Not while
  // a command is in flight: it writes its own record before it is sent.
  const saved = !unconfirmedAction && !busy.value && code ? readPendingEventCommand(app.accountKey, code) : null;
  if (saved) { commandError.value = true; unconfirmedAction = saved.action; unconfirmedClaimKey = saved.claimKey; }
  const request = ++generation, scope = identity();
  // A failed read keeps its stale-snapshot state (greyed action and its reason) until a read succeeds, so a retry in
  // flight does not re-enable the action on data that is still stale.
  loading.value = true;
  const current = () => visible && generation === request && scope === identity();
  try {
    if (!remoteApiEnabled || !code) throw new Error("EVENT_UNAVAILABLE");
    const value = await api.detail(code, language.value);
    if (current()) {
      detail.value = value; error.value = false;
      // Success is said only on positive evidence: claimed, joined, subscribed. A claim key that left claimKeys only shows
      // the reward is not claimable now (a tiered claim's tier taken, or eligibility lost), so it ends the check quietly.
      const confirmed = (unconfirmedAction === "join" && ["JOINED", "CLAIMABLE", "CLAIMED"].includes(value.userStatus)) || (unconfirmedAction === "claim" && value.userStatus === "CLAIMED") || (unconfirmedAction === "remind" && !!value.reminderSubscribed);
      const claimKeyGone = unconfirmedAction === "claim" && !!unconfirmedClaimKey && !(value.claimKeys ?? []).includes(unconfirmedClaimKey);
      if (confirmed || claimKeyGone) {
        // A claim confirmed only by this read lost its receipt; a device it issued still has to reach the fleet.
        if (unconfirmedAction === "claim" && value.rewards.some((reward) => reward.type === "DEVICE")) void app.refreshRemoteFleet(app.captureRemoteAccountRequest());
        // The result the server confirmed is said once (03 §3.5.2 提交结果未知).
        if (confirmed) toast.success(unconfirmedAction === "claim" ? copy.value.eligibility.CLAIMED : unconfirmedAction === "remind" ? reminderCopy.value.subscribed : copy.value.joined);
        commandError.value = false; unconfirmedAction = null; unconfirmedClaimKey = "";
        void forgetPendingEventCommand(app.accountKey, code);
      } else if (unconfirmedAction && (eventDetailAction(value) !== unconfirmedAction || !readPendingEventCommand(app.accountKey, code))) {
        // Nothing is left to confirm when the event no longer offers that action (ended, claimed, no longer open to join or
        // remind), or when the stored record is gone or a day old: another page instance got the command's result, or it
        // never ran. The note and the record go; the page keeps the state it just read.
        commandError.value = false; unconfirmedAction = null; unconfirmedClaimKey = "";
        void forgetPendingEventCommand(app.accountKey, code);
      }
    }
  } catch (cause) {
    if (current()) {
      error.value = true; if (!isTransientReadFailure(cause)) detail.value = null;
      // The event no longer exists: a command on it has nothing left to confirm. This is not its success.
      if (isEventNotFound(cause)) { commandError.value = false; unconfirmedAction = null; unconfirmedClaimKey = ""; void forgetPendingEventCommand(app.accountKey, code); }
    }
  }
  finally { if (current()) loading.value = false; }
}
async function run() {
  if (!visible || busy.value || !detail.value || !action.value) return;
  const selectedAction = action.value;
  if (selectedAction === "open") { navTo(eventDetailHref(detail.value)); return; }
  if (error.value) return;
  const scope = identity(), request = commands;
  const current = () => visible && request === commands && scope === identity();
  busy.value = true; commandError.value = false; userActed = true;
  const claimKey = detail.value.claimKeys?.[0] ?? "";
  const fleetRequest = selectedAction === "claim" ? app.captureRemoteAccountRequest() : undefined;
  const deviceClaim = selectedAction === "claim" && detail.value.rewards.some((reward) => reward.type === "DEVICE");
  const account = app.accountKey, attempt = Date.now();
  const commandKey = selectedAction === "remind" ? `h4-event-reminder:${code}` : selectedAction === "claim" ? eventClaimCommandKey(code, detail.value.claimKeys) : `h4-event-join:${code}`;
  // Recorded before sending, as checkout does, so a reload while the result is unknown still confirms it. The record only
  // restores the confirming note; the fixed idempotency key keeps a resend safe without it, so a storage failure does not
  // block the command.
  void rememberPendingEventCommand(account, code, { action: selectedAction, key: commandKey, claimKey: selectedAction === "claim" ? claimKey : "", at: attempt });
  try {
    if (selectedAction === "remind") await api.remind(code, commandKey);
    else if (selectedAction === "claim") {
      // A lost claim receipt can leave the warehouse refresh to onShow.
      if (deviceClaim) app.invalidateRemoteFleet(fleetRequest);
      const claim = await eventsApi.claim(code, commandKey);
      if (claim.rewardType === "DEVICE") await app.refreshRemoteFleet(fleetRequest);
    } else await eventsApi.join(code, commandKey);
    // Only this attempt's record: a later attempt (after leaving and coming back) owns its own.
    void forgetPendingEventCommand(account, code, attempt);
    if (current()) { busy.value = false; await load(); }
  } catch (cause) {
    // The outcome may be unknown even if this page is gone: a fleet read started during the claim may predate the device.
    // Invalidate it, then read again so a warehouse already on screen does not keep the pre-claim fleet.
    if (deviceClaim) { app.invalidateRemoteFleet(fleetRequest); void app.refreshRemoteFleet(fleetRequest, { coalesce: true }); }
    // Only an unknown outcome is confirmed by reading (03 §3.5.2); a refusal or a 503 from the server is a result: say why
    // once (03 §3.5.1 toast) and leave the action available. The read shows the event as it now stands. A known result
    // needs no confirming later, even if this page is gone.
    const failure = eventCommandFailure(cause);
    if (failure !== "unknown") void forgetPendingEventCommand(account, code, attempt);
    if (!current()) return;
    busy.value = false;
    if (failure === "unknown") { commandError.value = true; unconfirmedAction = selectedAction; unconfirmedClaimKey = selectedAction === "claim" ? claimKey : ""; }
    // Already claimed is the outcome the user wanted, not an error.
    else if (failure === "claimed") toast.info(copy.value.eligibility.CLAIMED);
    else toast.error(failure === "notEligible" ? copy.value.eligibility.NOT_ELIGIBLE : copy.value.failed[failure]);
    await load();
  } finally {
    // Only the change this action makes may move focus; later background reads do not.
    await nextTick();
    userActed = false;
  }
}
onLoad(options => { const query = new URLSearchParams(takeNavigationQuery("/pages/events/detail")); code = String(options?.id ?? query.get("id") ?? "").trim(); reset(); if (visible) void load(); });
let releaseActiveRefresh = () => {};
onShow(() => { visible = true; releaseActiveRefresh = registerActivePageRefresh(() => error.value || commandError.value ? undefined : load(), "pages/events/detail"); void load(); });
onHide(() => { visible = false; releaseActiveRefresh(); reset(); });
// Another account does not inherit this account's unconfirmed command.
watch(() => [app.accountKey, app.accountBindingEpoch, language.value], (next, prev) => { if (code && next[0] !== prev[0]) void forgetPendingEventCommand(String(prev[0]), code); reset(); void load(); }, { flush: "sync" });
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
/* Content cards are solid (01 §1.1.2): .nx-glass-card is the flat content surface; light adds the general light shadow. */
[data-theme="light"] .event-section:not(.event-section--plain) { box-shadow:var(--v5-glass-shadow); }
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
.event-bar { position:absolute; z-index:36; display:flex; flex-direction:column; animation:event-bar-in .42s cubic-bezier(.16,1,.3,1) .3s both; }
@keyframes event-bar-in { from { transform:translateY(100%); } to { transform:none; } }
@media (prefers-reduced-motion: reduce) { .event-bar { animation:none; } }
.event-bar > .nx-button { width:100%; }
/* First load: the first card and the rules block in their real sizes (03 §3.4), static. */
.event-skeleton view > view { border-radius:8px; background:var(--v5-surface-3); }
.event-skeleton__card > view:nth-child(1) { width:62%; height:var(--ui-type-hero-title-lh); }
.event-skeleton__card > view:nth-child(2) { width:84%; height:14px; margin-top:8px; }
.event-skeleton__card > view:nth-child(3) { width:96px; height:24px; margin-top:12px; border-radius:999px; }
.event-skeleton__card > view:nth-child(n+4) { height:16px; margin-top:16px; }
.event-skeleton__plain > view:nth-child(1) { width:40%; height:var(--ui-type-section-lh); }
.event-skeleton__plain > view:nth-child(n+2) { height:16px; margin-top:14px; }
.event-skeleton__plain > view:last-child { width:70%; }
.event-rule-paragraph { display:block; }
.event-rule-paragraph > text { display:block;white-space:pre-wrap;text-align:left;overflow-wrap:break-word; }
.event-row.event-rule-paragraph > text + text { margin-top:6px;color:var(--v5-ink-2);font:var(--ui-type-long-form-weight) var(--ui-type-long-form)/var(--ui-type-long-form-lh) var(--font-v5); }
</style>
