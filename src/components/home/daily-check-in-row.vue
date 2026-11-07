<template>
  <view class="daily-check-in-row" data-home-section="check-in">
    <view v-if="rewardFeedback" class="daily-check-in-row__reward-flight" role="status" aria-live="polite" :aria-label="rewardFeedback.title + ' · ' + rewardFeedback.body" @animationend="rewardFeedback = null">
      <text class="daily-check-in-row__reward">{{ rewardFeedback.title }}</text>
    </view>
    <view class="daily-check-in-row__top">
      <view class="daily-check-in-row__copy" role="link" tabindex="0" :aria-label="copy.viewDaily" @click="openDaily">
        <text class="daily-check-in-row__title">{{ ready ? fmt(copy.streak, { n: faucet.signInStreak }) : copy.daily }}</text>
        <text v-if="subtitle" class="daily-check-in-row__meta" :class="{ 'daily-check-in-row__meta--warning': faucet.remoteReadState === 'error' }">{{ subtitle.lead }}<text v-if="subtitle.reward" class="daily-check-in-row__gift-hint">{{ subtitle.reward }}</text>{{ subtitle.tail }}</text>
      </view>
      <NxButton class="daily-check-in-row__action" :class="{ 'daily-check-in-row__action--checked': canCheckIn && checked }" :variant="!canCheckIn ? 'secondary' : checked ? 'link' : 'brand'" :label="checkInLabel" size="small" :busy="submitting" @click="checkIn">
        <template v-if="canCheckIn && checked">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 5 5 9-10" /></svg>
          <text>{{ checkInLabel }}</text>
        </template>
        <text v-else>{{ checkInLabel }}</text>
      </NxButton>
    </view>
    <view v-if="ready" class="daily-check-in-row__days">
      <view class="daily-check-in-row__rail" aria-hidden="true"><view class="daily-check-in-row__rail-fill" :style="{ width: railFill }" /></view>
      <view v-for="day in days" :key="day.n" class="daily-check-in-row__node" :aria-label="fmt(copy.day,{n:day.n}) + (day.today ? ' · ' + copy.today : '') + (day.done ? ' · ' + copy.checkedIn : '') + (day.gift ? ' · ' + giftText(day.gift) : '')">
        <view class="daily-check-in-row__dot" aria-hidden="true">
          <view v-if="day.done" class="daily-check-in-row__done" :class="{ 'daily-check-in-row__done--filling': filledToday && day.today }"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="m5 12 5 5 9-10"/></svg></view>
          <view v-else-if="day.gift" class="daily-check-in-row__gift" :class="{ 'daily-check-in-row__gift--today': day.today }"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg></view>
          <text v-else-if="day.today" class="daily-check-in-row__today">{{ baseReward === null ? '' : '+' + baseReward }}</text>
          <view v-else class="daily-check-in-row__future" />
        </view>
        <text class="daily-check-in-row__label" :class="{ 'daily-check-in-row__label--gift': !!day.gift && !day.done }" aria-hidden="true">{{ day.today ? copy.today : day.gift && !day.done && day.gift.rewardType !== 'BADGE' ? '+' + day.gift.rewardAmount : '' }}</text>
      </view>
    </view>
    <view v-else class="daily-check-in-row__days" :aria-busy="faucet.remoteReadState === 'idle' || faucet.remoteReadState === 'loading' ? 'true' : 'false'" :aria-label="copy.viewDaily">
      <view class="daily-check-in-row__rail" aria-hidden="true" />
      <view v-for="n in 7" :key="n" class="daily-check-in-row__node" aria-hidden="true"><view class="daily-check-in-row__dot"><view class="daily-check-in-row__placeholder" /></view><text class="daily-check-in-row__label" /></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { onShow, onHide } from '@/composables/use-tab-page-lifecycle';
import { useNexFaucet } from '@/store/nex-faucet';
import { useApp } from '@/store/app';
import { remoteApiEnabled } from '@/api/runtime';
import { navTo } from '@/lib/route';
import { fmt } from '@/i18n/format';
import { useAuditUiCopy } from '@/i18n/audit-ui';
import { useT } from '@/i18n/use-t';
import { toast } from '@/store/ui';
import { dailyCheckInSuccessCopy } from '@/pages/daily/daily-success-copy';
import { dailyBaseReward, dailyMilestoneRewardText, dailyRewardLabels } from '@/pages/daily/daily-reward-view';
import type { CanonicalDailyMilestone } from '@/api/points-api';
import NxButton from '@/components/ui/nx-button.vue';
const faucet = useNexFaucet(), app = useApp(), copy = useAuditUiCopy(), t = useT();
const submitting = ref(false);
const rewardFeedback = ref<{ title: string; body: string } | null>(null);
// The today node fills once after a confirmed check-in; it resets when the page is left.
const filledToday = ref(false);
let visible = true, visit = 0;
const ready = computed(() => remoteApiEnabled && (faucet.remoteReadState === 'ready'
  || (['loading','error'].includes(faucet.remoteReadState) && faucet.remoteHasSnapshot)));
const checked = computed(() => ready.value && faucet.remoteCheckedInToday);
const canCheckIn = computed(() => ready.value && faucet.remoteReadState !== 'error');
const baseReward = computed(() => dailyBaseReward(faucet.remoteRules));
const checkInLabel = computed(() => !canCheckIn.value ? copy.value.viewDaily : checked.value ? copy.value.checkedIn : copy.value.checkIn);
const days = computed(() => {
  const streak = faucet.signInStreak, current = Math.max(1, streak + (checked.value ? 0 : 1));
  const start = Math.floor((current - 1) / 7) * 7;
  return Array.from({ length: 7 }, (_, i) => ({ n: start + i + 1, done: start + i + 1 <= streak, today: start + i + 1 === current, gift: faucet.remoteMilestones?.find(m=>m.milestoneDay===start+i+1&&m.status!=='CLAIMED') }));
});
function giftText(gift:CanonicalDailyMilestone){return dailyMilestoneRewardText(gift,dailyRewardLabels(t.value.daily.milestones));}
function milestoneReward(gift:CanonicalDailyMilestone){return gift.rewardType.trim().toUpperCase() === 'UVT' ? `+${gift.rewardAmount} ${t.value.daily.milestones.rewardNex}` : giftText(gift);}
// A reached milestone whose reward is still unclaimed comes first (with the daily "Claim" word);
// otherwise the rail already shows today's reward, so the subtitle names the next milestone in this week.
const subtitle = computed<{ lead: string; reward: string; tail: string } | null>(() => {
  if (faucet.remoteReadState === 'error') return { lead: t.value.daily.checkInUnconfirmed, reward: '', tail: '' };
  if (!ready.value) return { lead: copy.value.viewDaily, reward: '', tail: '' };
  const claimable = faucet.remoteMilestones.filter(m => m.status === 'CLAIMABLE').sort((a, b) => a.milestoneDay - b.milestoneDay)[0];
  if (claimable) return { lead: fmt(t.value.daily.milestones.dayLabel, { n: claimable.milestoneDay }) + ' ', reward: milestoneReward(claimable), tail: ' · ' + t.value.daily.milestones.claim };
  const next = days.value.find(day => day.gift && !day.done);
  if (next?.gift) return {
    lead: (next.today ? copy.value.today : fmt(t.value.daily.milestones.dayLabel, { n: next.gift.milestoneDay })) + ' ',
    reward: milestoneReward(next.gift), tail: '',
  };
  return !checked.value && baseReward.value === null ? { lead: copy.value.viewDaily, reward: '', tail: '' } : null;
});
// Seven equal columns; the rail runs between the first and last node centres (7.14% in from each side)
// and fills up to the last checked day.
const railFill = computed(() => {
  const done = ready.value ? days.value.filter(day => day.done).length : 0;
  return `${done ? (done - 1) / 6 * 100 : 0}%`;
});
function refresh() { if (visible && remoteApiEnabled) void faucet.ensureRemote(10_000); }
function openDaily() {
  if (!visible) return;
  navTo('/pages/daily/daily');
}
onMounted(refresh);
onShow(() => { visible = true; refresh(); });
onHide(() => { visible = false; visit++; rewardFeedback.value = null; filledToday.value = false; });
onUnmounted(() => { visible = false; visit++; });
watch(() => [app.accountKey, app.accountBindingEpoch], () => { rewardFeedback.value = null; filledToday.value = false; refresh(); });
async function checkIn() {
  if (submitting.value || !visible) return;
  if (faucet.remoteReadState !== 'ready' || checked.value) { navTo('/pages/daily/daily'); return; }
  const scope = `${app.accountKey}:${app.accountBindingEpoch}:${visit}`;
  submitting.value = true;
  try {
    const result = await faucet.checkInRemote();
    if (!visible || scope !== `${app.accountKey}:${app.accountBindingEpoch}:${visit}`) return;
    if (result.ok) { rewardFeedback.value = dailyCheckInSuccessCopy(result, t.value.daily); filledToday.value = true; }
    else { toast.error(result.reason === 'B1_COVERAGE_BELOW_REDLINE' ? t.value.binary.blockReasons.COVERAGE_BELOW_REDLINE : result.reason === 'B1_COVERAGE_DATA_UNAVAILABLE' ? t.value.binary.blockReasons.B1_COVERAGE_UNRELIABLE : t.value.authOtp.errorServiceUnavailable); }
  } finally { submitting.value = false; }
}
</script>
<style scoped>
/* Liquid-glass soft-edge card (04.1 签到): frosted fill directly on the page floor. */
.daily-check-in-row {
  --ci-fill: rgba(255,255,255,.045); --ci-rim: rgba(255,255,255,.10); --ci-highlight: rgba(255,255,255,.20);
  --ci-bottom: rgba(0,0,0,.40); --ci-sheen: rgba(255,255,255,.06); --ci-shadow: 0 12px 32px rgba(0,0,0,.35);
  position:relative; padding:12px 14px 10px 16px; border-radius:22px;
  background:linear-gradient(145deg,var(--ci-sheen),transparent 40%,transparent 70%,var(--ci-sheen)),var(--ci-fill);
  box-shadow:inset 0 0 0 1px var(--ci-rim),inset 0 7px 10px -7px var(--ci-highlight),inset 3px 0 12px -8px var(--ci-highlight),inset 0 -8px 14px -8px var(--ci-bottom),var(--ci-shadow);
  backdrop-filter:blur(16px) saturate(140%); -webkit-backdrop-filter:blur(16px) saturate(140%);
}
:global([data-theme="light"] .daily-check-in-row) {
  --ci-fill: rgba(255,255,255,.58); --ci-rim: rgba(73,94,125,.12); --ci-highlight: rgba(255,255,255,.95);
  --ci-bottom: rgba(87,115,155,.16); --ci-sheen: rgba(255,255,255,.30); --ci-shadow: 0 2px 8px rgba(20,16,8,.05);
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .daily-check-in-row { background:var(--v5-surface); backdrop-filter:none; -webkit-backdrop-filter:none; }
}
.daily-check-in-row__reward-flight { position:absolute; z-index:4; inset-inline:0; top:-42px; height:calc(50% + 24px); display:flex; align-items:flex-start; justify-content:center; pointer-events:none; animation:check-in-reward-rise 1900ms linear both; }
.daily-check-in-row__reward { color:var(--v5-brand); font:600 20px/24px var(--font-v5); white-space:nowrap; }
@keyframes check-in-reward-rise {
  0% { opacity:0; transform:translateY(100%); }
  28%,66% { opacity:1; transform:translateY(0); }
  100% { opacity:0; transform:translateY(-36px); }
}
@keyframes check-in-reward-fade { 0%,100% { opacity:0; } 15%,85% { opacity:1; } }
@media (prefers-reduced-motion:reduce) { .daily-check-in-row__reward-flight { animation-name:check-in-reward-fade; animation-duration:1900ms!important; animation-delay:0s!important; transform:none; } }
.daily-check-in-row__top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.daily-check-in-row__copy { min-width:0; min-height:44px; margin-block:-3px; display:flex; flex-direction:column; justify-content:center; cursor:pointer; }
.daily-check-in-row__copy:focus-visible { outline:2px solid var(--v5-brand); outline-offset:3px; border-radius:8px; }
.daily-check-in-row__title { display:block; font:500 15px/20px var(--font-v5); color:var(--v5-ink); }
.daily-check-in-row__meta { display:block; margin-top:2px; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }
.daily-check-in-row__meta--warning { color:var(--v5-warning-ink); }
.daily-check-in-row__gift-hint { font-weight:500; color:var(--v5-warning-ink); }
/* Glass S: 32px surface inside a 44px hit area; the hit area overlaps the card padding, not the layout. */
.daily-check-in-row :deep(.daily-check-in-row__action) { flex:none; margin-block:-6px; }
.daily-check-in-row :deep(.daily-check-in-row__action .nx-button__surface) { min-height:32px; height:32px; padding:0 14px; }
.daily-check-in-row :deep(.daily-check-in-row__action.nx-button--brand .nx-button__surface) { --ui-button-fill:color-mix(in srgb,var(--v5-brand) 18%,transparent); }
.daily-check-in-row :deep(.daily-check-in-row__action--checked .nx-button__surface) { padding:0; }
.daily-check-in-row :deep(.daily-check-in-row__action--checked .nx-button__content) { gap:4px; }
.daily-check-in-row :deep(.daily-check-in-row__action--checked .nx-native-svg) { width:14px; height:14px; }
.daily-check-in-row :deep(.daily-check-in-row__action--checked .nx-native-svg svg) { display:block; width:100%; height:100%; }
/* Seven-node rail: checked days fill in brand up to the last one; today carries the real base reward. */
.daily-check-in-row__days { position:relative; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); margin-top:10px; }
.daily-check-in-row__rail { position:absolute; left:7.14%; right:7.14%; top:11px; height:2px; border-radius:2px; background:var(--v5-surface-3); }
.daily-check-in-row__rail-fill { height:100%; border-radius:inherit; background:var(--v5-brand); transform-origin:left center; transition:width 900ms cubic-bezier(.16,1,.3,1); animation:check-in-rail-grow 900ms 200ms cubic-bezier(.16,1,.3,1) both; }
.daily-check-in-row__node { position:relative; z-index:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:3px; }
.daily-check-in-row__dot { width:24px; height:24px; display:grid; place-items:center; }
.daily-check-in-row__done { width:20px; height:20px; border-radius:50%; display:grid; place-items:center; background:var(--v5-brand); color:var(--v5-on-brand); }
.daily-check-in-row__done--filling { animation:check-in-node-fill 520ms cubic-bezier(.2,.9,.3,1.3) both; }
.daily-check-in-row__today { position:relative; box-sizing:border-box; width:24px; height:24px; border-radius:50%; display:grid; place-items:center; border:2px solid var(--v5-brand); background:var(--v5-surface); color:var(--v5-brand); font:500 10px/12px var(--font-v5); white-space:nowrap; }
.daily-check-in-row__gift { position:relative; box-sizing:border-box; width:22px; height:22px; border-radius:50%; display:grid; place-items:center; background:var(--v5-warning-soft); color:var(--v5-warning-ink); }
.daily-check-in-row__gift--today { width:26px; height:26px; border:2px solid var(--v5-warning); }
.daily-check-in-row__today::after { content:""; position:absolute; inset:-2px; border-radius:50%; border:2px solid currentColor; animation:check-in-ping 2.4s ease-out infinite; }
.daily-check-in-row__future { width:6px; height:6px; border-radius:50%; background:var(--v5-ink-4); }
.daily-check-in-row__placeholder { width:6px; height:6px; border-radius:50%; background:var(--v5-surface-3); }
/* Labels stay on one line and may overflow their equal column (Vietnamese "Hôm nay"). */
.daily-check-in-row__label { height:14px; font:500 10.5px/14px var(--font-v5); color:var(--v5-brand); white-space:nowrap; overflow:visible; }
.daily-check-in-row__label--gift { color:var(--v5-warning-ink); }
.daily-check-in-row__dot :deep(.nx-native-svg) { width:11px; height:11px; }
.daily-check-in-row__gift :deep(.nx-native-svg) { width:12px; height:12px; }
.daily-check-in-row__dot :deep(.nx-native-svg svg) { display:block; width:100%; height:100%; }
@keyframes check-in-rail-grow { from { transform:scaleX(0); } }
@keyframes check-in-node-fill { from { transform:scale(.4); opacity:.3; } }
@keyframes check-in-ping { 0% { transform:scale(1); opacity:.45; } 70%,100% { transform:scale(1.65); opacity:0; } }
@media (max-width:339px) {
  .daily-check-in-row { padding:12px 12px 10px 14px; }
}
@media (prefers-reduced-motion:reduce) {
  .daily-check-in-row__rail-fill { transition:none; animation:none; }
  .daily-check-in-row__done--filling { animation:none; }
  .daily-check-in-row__today::after { animation:none; opacity:0; }
}
</style>
