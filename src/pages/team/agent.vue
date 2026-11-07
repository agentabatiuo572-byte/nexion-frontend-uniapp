<template>
  <AppChassis active="team">
    <view class="agent-page nx-viz-motion">
      <SubPageHeader back="/pages/team/team" :title="t.headerTitles.teamAgent" />

      <EmptyState v-if="pageReadState === 'error' && !policy" kind="recoverable-error" :title="t.agent.loadError" :cta-label="t.agent.retry" @cta="retryAgentPage" />
      <view v-else-if="pageReadState === 'loading' && !policy" class="agent-loading" role="status" aria-busy="true"><text>{{ t.agent.loading }}</text></view>
      <CardStagger v-if="policy" class="agent-content">
        <!-- The page focus: headline, the V1→V5 track and eligibility share one soft-glass card. -->
        <view class="agent-hero nx-soft-glass">
          <view>
            <text class="agent-headline">{{ t.agent.heroHeadline }}</text>
            <text class="agent-intro">{{ fmt(t.agent.heroBody, { rank: requiredRankLabel }) }}</text>
          </view>
          <view v-if="displayRank !== null && !visibility.hidden" ref="agentTrackRef" class="agent-track" role="img" :aria-label="`${t.rank.currentRank}: V${displayRank}`">
            <template v-for="n in AGENT_TRACK" :key="n">
              <view v-if="n > 1" class="agent-track__line"><view :style="{ width: agentTrackInView === false ? '0%' : n <= trackRank ? '100%' : '0%', transition: agentTrackInView === false ? 'none' : PROGRESS_GROW_TRANSITION, transitionDelay: agentTrackInView === false ? '0ms' : vizStagger(n - 2, 120) }" /></view>
              <view class="agent-track__stop" :class="{ 'agent-track__stop--current': n === trackRank, 'agent-track__stop--goal': n === AGENT_TRACK }">
                <view class="agent-track__node" :class="{ 'agent-track__node--done': n <= trackRank, 'agent-track__node--current': n === trackRank, 'agent-track__node--goal': n === AGENT_TRACK }"><text>V{{ n }}</text></view>
                <text class="agent-track__label">{{ n === trackRank ? trackCurrentLabel : n === AGENT_TRACK ? t.agent.applicationOpens : '' }}</text>
              </view>
            </template>
          </view>
          <view class="agent-eligibility">
            <svg v-if="unlocked" class="agent-eligibility__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></svg>
            <text class="agent-eligibility__text">{{ unlocked ? t.agent.eligible : rankReady ? fmt(t.agent.levelsRemaining, { n: visibility.mask(levelsRemaining) }) : t.profile.rankUnavailable }}</text>
            <view v-if="!unlocked" class="agent-path" role="button" tabindex="0" :aria-label="t.agent.pathCta" @click="go('/pages/team/rank')" @keydown.enter.prevent="go('/pages/team/rank')" @keydown.space.prevent="go('/pages/team/rank')">
              <view class="agent-opening-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg><text>{{ fmt(t.agent.openFrom, { rank: requiredRankLabel }) }}</text></view>
            </view>
          </view>
        </view>

        <view v-if="pendingApplication" class="agent-section">
          <view class="agent-section__head">
            <text class="agent-section__title">{{ c.currentApplication }}</text>
            <view class="agent-link" role="link" tabindex="0" @click="go(AMBASSADOR_ROUTES.records)" @keydown.enter.prevent="go(AMBASSADOR_ROUTES.records)"><text>{{ c.allRecords }}</text><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></view>
          </view>
          <AmbassadorApplicationCard :application="pendingApplication" />
        </view>
        <view v-else-if="latestRecord" class="agent-section">
          <view class="agent-section__head">
            <text class="agent-section__title">{{ c.myApplications }}</text>
            <view class="agent-link" role="link" tabindex="0" @click="go(AMBASSADOR_ROUTES.records)" @keydown.enter.prevent="go(AMBASSADOR_ROUTES.records)"><text>{{ c.allRecords }}</text><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></view>
          </view>
          <view class="agent-latest"><AmbassadorApplicationRow :application="latestRecord" /></view>
        </view>

        <view class="agent-section">
          <view class="agent-section__head">
            <text class="agent-section__title">{{ t.agent.supportTypes }}</text>
            <text v-if="formOffered" class="agent-section__sub">{{ c.chooseOne }}</text>
          </view>
          <view v-if="formOffered" class="agent-tiles" role="radiogroup" :aria-label="t.agent.supportTypes" @keydown.right.prevent="moveBucketFocus($event, 1)" @keydown.down.prevent="moveBucketFocus($event, 1)" @keydown.left.prevent="moveBucketFocus($event, -1)" @keydown.up.prevent="moveBucketFocus($event, -1)">
            <view v-for="(b, i) in BUCKETS" :key="b.id" class="agent-tile nx-viz-press" :class="{ 'agent-tile--selected': selectedBucketId === b.id }" :style="{ '--tint-ink': b.ink }"
              role="radio" :tabindex="bucketTabStop(b.id, i) ? 0 : -1" :aria-checked="selectedBucketId === b.id" :aria-label="b.title" :aria-disabled="selectionLocked"
              @click="selectBucket(b)" @keydown.enter.prevent="selectBucket(b)" @keydown.space.prevent="selectBucket(b)">
              <AmbassadorBucketIcon :bucket="b.id" />
              <svg v-if="selectedBucketId === b.id" class="agent-tile__check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              <view><text class="agent-tile__title">{{ b.title }}</text><text class="agent-tile__rule">{{ b.rule }}</text><text class="agent-tile__range">{{ b.range }}</text></view>
            </view>
          </view>
          <view v-else class="agent-tiles">
            <view v-for="b in BUCKETS" :key="b.id" class="agent-tile" :style="{ '--tint-ink': b.ink }">
              <AmbassadorBucketIcon :bucket="b.id" />
              <view><text class="agent-tile__title">{{ b.title }}</text><text class="agent-tile__rule">{{ b.rule }}</text><text class="agent-tile__range">{{ b.range }}</text></view>
            </view>
          </view>
          <view v-if="pendingApplication" class="agent-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg><text>{{ c.pendingHint }}</text></view>
        </view>

        <view v-if="formOffered && !unlocked" class="agent-preview nx-frosted-button" role="button" tabindex="0" aria-controls="agent-application-form" :aria-expanded="previewForm" @click="togglePreview" @keydown.enter.prevent="togglePreview" @keydown.space.prevent="togglePreview"><text>{{ previewForm ? t.agent.closePreview : t.agent.previewForm }}</text></view>
        <!-- Collapsing the preview leaves the account-owned draft intact. -->
        <view v-if="formOffered" v-show="unlocked || previewForm" id="agent-application-form" class="agent-section">
          <view class="agent-section__head">
            <text class="agent-section__title">{{ t.agent.newApplication }}</text>
            <text v-if="selectedBucketTitle" class="agent-section__sub">{{ selectedBucketTitle }}</text>
          </view>
          <view class="agent-form">
            <view class="agent-field">
              <view class="agent-field__label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg><text>{{ t.agent.fieldEventDate }}</text></view>
              <picker class="agent-date-picker" mode="date" :value="date" role="button" :tabindex="formReady && !submitting ? 0 : -1" :aria-label="t.agent.fieldEventDate" :aria-disabled="!formReady || submitting" :disabled="!formReady || submitting" @change="date = $event.detail.value">
                <view class="agent-control"><text class="agent-control__value" :class="{ 'agent-control__placeholder': !date }">{{ date || t.agent.chooseEventDate }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></view>
              </picker>
            </view>
            <view class="agent-field">
              <view class="agent-field__label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg><text>{{ t.agent.fieldCity }}</text></view>
              <view class="agent-control"><input v-model="city" class="agent-control__value agent-control__input" :aria-label="t.agent.fieldCity" type="text" :disabled="!formReady || submitting" :placeholder="t.agent.cityPlaceholder" placeholder-class="agent-control__placeholder" /></view>
            </view>
            <view class="agent-field">
              <view class="agent-field__label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg><text>{{ auditCopy.budgetLabel }}</text></view>
              <view class="agent-control">
                <text class="agent-control__prefix">USDT</text>
                <text v-if="visibility.hidden" class="agent-control__value" :aria-label="auditCopy.budgetLabel">{{ visibility.mask(budgetText) }}</text>
                <input v-else v-model="budgetText" class="agent-control__value agent-control__input" :aria-label="auditCopy.budgetLabel" type="text" inputmode="decimal" :disabled="!formReady || submitting" />
              </view>
              <text v-if="selectedBucket" class="agent-field__help">{{ fmt(c.bucketRange, { bucket: selectedBucket.title, range: selectedBucket.range }) }}</text>
            </view>
          </view>
          <view v-if="draft.touched" class="agent-discard"><NxButton variant="text" :label="logicCopy.discardDraft" :disabled="submitting || pageReadState !== 'ready'" @click="discardDraft" /></view>
          <view class="agent-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg><text>{{ c.applyHint }}</text></view>
        </view>
        <view class="agent-bar-space" />
      </CardStagger>
    </view>
    <template #pageFixed>
      <AmbassadorActionBar v-if="policy && pendingApplication">
        <NxButton variant="primary" @click="go(AMBASSADOR_ROUTES.detail(pendingApplication.applicationId ?? 0))"><text>{{ pendingAction }}</text><text aria-hidden="true">→</text></NxButton>
      </AmbassadorActionBar>
      <AmbassadorActionBar v-else-if="policy && formOffered && (unlocked || previewForm)">
        <NxButton variant="primary" :label="t.agent.submitForReview" :disabled="!formReady" :busy="submitting" @click="submit" />
        <text v-if="!unlocked" class="amb-bar__why">{{ rankReady ? fmt(t.agent.previewOnly, { rank: requiredRankLabel }) : t.profile.rankUnavailable }}</text>
      </AmbassadorActionBar>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useDataVisibility } from "@/store/data-visibility";
import { teamLogicCopy } from "@/i18n/team-logic-copy";
import { ambassadorDraftCache, clearAmbassadorDraft, beginAmbassadorDraftSubmit, endAmbassadorDraftSubmit, type AmbassadorDraftForm } from "@/lib/ambassador-draft-session";
import { navTo } from "@/lib/route";
import { ref, shallowRef, computed, watch } from "vue";
import { onShow, onHide, onUnload } from "@dcloudio/uni-app";
import EmptyState from "@/components/empty-state.vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CardStagger from "@/components/card-stagger.vue";
import NxButton from "@/components/ui/nx-button.vue";
import AmbassadorActionBar from "@/components/team/ambassador-action-bar.vue";
import AmbassadorApplicationCard from "@/components/team/ambassador-application-card.vue";
import AmbassadorApplicationRow from "@/components/team/ambassador-application-row.vue";
import AmbassadorBucketIcon from "@/components/team/ambassador-bucket-icon.vue";
import { useVRank } from "@/store/v-rank";
import { rankLabel } from "@/lib/v-rank-copy";
import { useLocaleStore } from "@/store/locale";
import { networkReauditCopy } from "@/i18n/network-reaudit";
import { ambassadorCopy } from "@/i18n/ambassador";
import { formatFinanceAmount } from "@/lib/finance-amount-display";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION, vizStagger } from "@/composables/use-scroll-grow-progress";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useAuth } from '@/store/auth';
import { useApp } from "@/store/app";
import { ambassadorApplicationApi, apiRuntimeConfig } from "@/api/runtime";
import { subscribeRuntimeRevision } from "@/api/order-api";
import type { AmbassadorApplication, AmbassadorApplicationInput, AmbassadorPolicy, AmbassadorPolicyBucket } from "@/api/ambassador-application-api";
import { isAmbassadorApplicationPending } from "@/api/ambassador-application-api";
import { isSettledRejection } from "@/api/errors";
import { acquireAmbassadorCommandKey, finishAmbassadorCommand } from "@/lib/ambassador-command-key";
import { AMBASSADOR_BUCKET_VISUALS, AMBASSADOR_ROUTES, ambassadorAmountText, ambassadorPresentation } from "@/lib/ambassador-display";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import {
  isCurrentTeamP31718Request,
  ambassadorSubmitErrorRecovery,
  parseAmbassadorApplicationDraft,
  successfulAmbassadorApplicationState,
  type AmbassadorAgentFormState,
  type TeamP31718Request,
} from "@/lib/team-p3-17-18-request-scope";

const t = useT();
const visibility = useDataVisibility();
const vrank = useVRank();
const locale = useLocaleStore();
const logicCopy = computed(() => teamLogicCopy(locale.code));
const auditCopy = computed(() => networkReauditCopy(locale.code));
const c = computed(() => ambassadorCopy(locale.code));
const app = useApp();
const auth = useAuth();
const readEnvironment = [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const;
let environmentInvalidated = false;
watch(() => [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const, () => { environmentInvalidated = true; }, { flush: 'sync' });
const environmentCurrent = () => !environmentInvalidated && readEnvironment[0] === apiRuntimeConfig.environment && readEnvironment[1] === apiRuntimeConfig.baseUrl;

const myRank = computed(() => vrank.myRank);
const rankReady = computed(() => vrank.remoteReady);
// A normal rank reread retains its confirmed facts. Keep that account's track mounted,
// while authorization still requires remoteReady. Revoked facts must never animate as V0.
const rankPresentation = ref<{ rank: number; accountKey: string; accountEpoch: number } | null>(null);
watch([() => vrank.remoteReady, () => vrank.myRank, () => vrank.remoteError, () => vrank.ladder.length], () => {
  if (vrank.remoteError || (!vrank.remoteReady && vrank.ladder.length === 0)) {
    rankPresentation.value = null;
  } else if (vrank.remoteReady && auth.isAuthenticated && environmentCurrent()) {
    rankPresentation.value = { rank: vrank.myRank, accountKey: app.accountKey, accountEpoch: app.accountBindingEpoch };
  }
}, { immediate: true });
const displayRank = computed(() => {
  const value = rankPresentation.value;
  return value && auth.isAuthenticated && environmentCurrent()
    && value.accountKey === app.accountKey && value.accountEpoch === app.accountBindingEpoch ? value.rank : null;
});
const stopRankPresentationRuntime = subscribeRuntimeRevision(() => { rankPresentation.value = null; });
// The existing application contract opens at V5; use one value for qualification and its display.
const AGENT_TRACK = 5;
// V6–V8 have reached the whole V1→V5 track; the V5 node carries their actual rank.
const trackRank = computed(() => Math.min(displayRank.value ?? 0, AGENT_TRACK));
const trackCurrentLabel = computed(() => (displayRank.value ?? 0) > AGENT_TRACK ? `${t.value.agent.trackCurrent} V${displayRank.value}` : t.value.agent.trackCurrent);
const requiredRankLabel = computed(() => rankLabel(AGENT_TRACK, locale.code, vrank.ladder));
const unlocked = computed(() => rankReady.value && vrank.myRank >= AGENT_TRACK);
const levelsRemaining = computed(() => Math.max(0, AGENT_TRACK - myRank.value));
const previewForm = ref(false);
const { elRef: agentTrackRef, inView: agentTrackInView } = useScrollGrowProgress();
const formReady = computed(() => pageReadState.value === 'ready' && unlocked.value);

interface Bucket {
  id: AmbassadorPolicyBucket["id"];
  title: string;
  range: string;
  rule: string;
  ink: string;
}
const policy = ref<AmbassadorPolicy | null>(null);
const pageReadState = ref<"loading" | "ready" | "error">("loading");
// Bucket ids are a closed server enum (venue/kol/print/dev) but the policy rows
// carry only the operator's English title/rule. Resolve the visible name and
// rule from the locale dictionary; the server copy stays the fallback for any
// id a future release adds before its translation ships.
const BUCKETS = computed<Bucket[]>(() => (policy.value?.buckets ?? []).map((bucket) => {
  const copy = t.value.agent.buckets[bucket.id];
  return {
    id: bucket.id, title: copy?.title || bucket.title,
    range: `${formatFinanceAmount(bucket.minBudgetUsdt).replace(/\.00$/, '')}–${formatFinanceAmount(bucket.maxBudgetUsdt).replace(/\.00$/, '')} USDT`,
    rule: copy?.rule || bucket.rule,
    ink: AMBASSADOR_BUCKET_VISUALS[bucket.id].ink,
  };
}));

const draft = shallowRef(ambassadorDraftCache.forAccount({ accountKey: app.accountKey, accountEpoch: app.accountBindingEpoch }));
function draftField<K extends keyof AmbassadorDraftForm>(key: K) {
  return computed({ get: () => draft.value.form[key], set: (value: AmbassadorDraftForm[K]) => {
    if (draft.value.pending || !agentMounted || pageReadState.value !== "ready") return;
    draft.value.form[key] = value;
    draft.value.touched = true;
  } });
}
const date = draftField('date');
const city = draftField('city');
const budgetText = draftField('budgetText');
const selectedBucketTitle = draftField('bucketTitle');
const selectedBucketId = draftField('bucketId');
const selectedBucket = computed(() => BUCKETS.value.find(bucket => bucket.id === selectedBucketId.value) ?? null);
const submitting = computed(() => draft.value.pending !== null);
const selectionLocked = computed(() => submitting.value || pageReadState.value !== 'ready');
const latestApplication = ref<AmbassadorApplication>(emptyApplication());
const applications = ref<AmbassadorApplication[]>([]);
// Only one application can be pending. While it is, the new-application form is
// not offered; the server would refuse it (409) anyway.
const pendingApplication = computed(() => applications.value.find(row => row.status === "PENDING")
  ?? (latestApplication.value.status === "PENDING" ? latestApplication.value : null));
const latestRecord = computed(() => applications.value[0] ?? (latestApplication.value.status !== "NONE" ? latestApplication.value : null));
const formOffered = computed(() => !pendingApplication.value);
const pendingAction = computed(() => {
  const status = pendingApplication.value ? ambassadorPresentation(pendingApplication.value).status : "review";
  return status === "draft" || status === "bucket" ? c.value.uploadMaterials : status === "more" ? c.value.supplementMaterials : c.value.viewProgress;
});

let agentMounted = true;
let agentRequestGeneration = 0;
function emptyApplication(): AmbassadorApplication {
  return { applicationId: null, status: "NONE", city: null, eventDate: null, budgetUsdt: null, bucket: null,
    submittedAt: null, source: "server", sourceEnvironment: "PRODUCTION", runId: "" };
}
function captureAgentRequest(): TeamP31718Request {
  return {
    accountKey: app.accountKey,
    accountEpoch: app.accountBindingEpoch,
    generation: agentRequestGeneration,
  };
}
function requestIsCurrent(request: TeamP31718Request): boolean {
  return auth.isAuthenticated && environmentCurrent() && isCurrentTeamP31718Request(request, {
    mounted: agentMounted,
    accountKey: app.accountKey,
    accountEpoch: app.accountBindingEpoch,
    generation: agentRequestGeneration,
  });
}
function invalidateAgentRequests(): void {
  agentRequestGeneration += 1;
}
function clearAgentFormState(form: AmbassadorAgentFormState = {
  date: "", city: "", budgetText: "3000", bucketId: "", bucketTitle: "",
}): void {
  clearAmbassadorDraft(draft.value);
  Object.assign(draft.value.form, form);
}
function resetAgentPageState(): void {
  invalidateAgentRequests();
  pageReadState.value = "loading";
  latestApplication.value = emptyApplication();
  applications.value = [];
  policy.value = null;
}
function discardDraft(): void {
  if (submitting.value || !agentMounted || pageReadState.value !== "ready") return;
  clearAmbassadorDraft(draft.value, String(policy.value?.defaultBudgetUsdt ?? 3000));
}

function selectBucket(b: Bucket) {
  if (selectionLocked.value || !agentMounted) return;
  selectedBucketTitle.value = b.title;
  selectedBucketId.value = b.id as AmbassadorApplicationInput["bucket"];
}
// Arrow keys move through the categories and select, like any radio group.
function moveBucketFocus(event: KeyboardEvent, delta: number) {
  const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'));
  const next = items[(items.indexOf(document.activeElement as HTMLElement) + delta + items.length) % items.length];
  next?.focus();
  next?.click();
}
/** Roving tab stop: the selected category, or the first one before anything is chosen. */
function bucketTabStop(id: string, index: number) { return !selectionLocked.value && (selectedBucketId.value ? selectedBucketId.value === id : index === 0); }
function togglePreview() { previewForm.value = !previewForm.value; }

function payloadIdentity(input: AmbassadorApplicationInput): string {
  return JSON.stringify([input.eventDate, input.city, input.budgetUsdt, input.bucket]);
}

async function refreshLatest(requestScope = captureAgentRequest()): Promise<AmbassadorApplication> {
  const value = await ambassadorApplicationApi.latest();
  if (requestIsCurrent(requestScope)) latestApplication.value = value;
  return value;
}

async function refreshHistory(requestScope = captureAgentRequest()): Promise<AmbassadorApplication[]> {
  const value = await ambassadorApplicationApi.history();
  if (requestIsCurrent(requestScope)) applications.value = value;
  return value;
}

async function submit() {
  if (submitting.value || !agentMounted || pageReadState.value !== "ready" || pendingApplication.value) return;
  if (!unlocked.value) {
    toast.error(t.value.agent.toastV5Required, fmt(t.value.agent.toastV5RequiredSub, { rank: requiredRankLabel.value }));
    return;
  }
  let parsedInput: AmbassadorApplicationInput | null;
  try {
    parsedInput = parseAmbassadorApplicationDraft({
      eventDate: date.value,
      city: city.value,
      budgetText: budgetText.value,
      bucket: selectedBucketId.value,
    });
  } catch {
    toast.error(t.value.agent.toastRemoteFailed, t.value.agent.submitUnconfirmedBody);
    return;
  }
  const input = parsedInput;
  if (!input) {
    toast.error(t.value.agent.invalidFormTitle, t.value.agent.invalidFormBody);
    return;
  }
  const activeBucket = policy.value?.buckets.find((bucket) => bucket.id === input.bucket);
  if (!activeBucket || input.budgetUsdt < activeBucket.minBudgetUsdt || input.budgetUsdt > activeBucket.maxBudgetUsdt) {
    toast.error(t.value.agent.invalidFormTitle, t.value.agent.invalidFormBody);
    return;
  }
  const identity = payloadIdentity(input);
  // A page-load read may still be in flight. It must not replace this POST's
  // authoritative receipt when it settles later.
  invalidateAgentRequests();
  const requestScope = captureAgentRequest();
  let key: string;
  try {
    key = acquireAmbassadorCommandKey(requestScope.accountKey, identity);
  } catch {
    toast.error(t.value.agent.toastRemoteFailed, t.value.agent.submitUnconfirmedBody);
    return;
  }
  const submittedDraft = draft.value;
  const submitToken = beginAmbassadorDraftSubmit(submittedDraft);
  if (!submitToken) return;
  try {
    const result = await ambassadorApplicationApi.submit(input, key);
    // A successful command can settle the same account's cached draft while
    // hidden/unloaded. Page reads/receipts still require the full request fence.
    if (requestScope.accountKey !== app.accountKey || requestScope.accountEpoch !== app.accountBindingEpoch) return;
    finishAmbassadorCommand(requestScope.accountKey, identity);
    endAmbassadorDraftSubmit(submittedDraft, submitToken, true);
    if (!requestIsCurrent(requestScope)) {
      if (agentMounted) { invalidateAgentRequests(); refreshAgentPage(); }
      return;
    }
    latestApplication.value = result;
    void refreshHistory(requestScope).catch(() => undefined);
  } catch (error) {
    if (!requestIsCurrent(requestScope)) return;
    const pending = isAmbassadorApplicationPending(error);
    const recovery = ambassadorSubmitErrorRecovery(pending || isSettledRejection(error));
    try {
      if (pending) await refreshHistory(requestScope);
      else if (recovery.refreshLatestForDisplay) await refreshLatest(requestScope);
      if (!requestIsCurrent(requestScope)) return;
    } catch {
      if (!requestIsCurrent(requestScope)) return;
    }
    if (!requestIsCurrent(requestScope)) return;
    if (recovery.finishCommand) finishAmbassadorCommand(requestScope.accountKey, identity);
    toast.error(pending ? t.value.agent.pendingApplicationTitle : t.value.agent.toastRemoteFailed,
      pending ? t.value.agent.pendingApplicationBody : t.value.agent.submitUnconfirmedBody);
    return;
  } finally {
    endAmbassadorDraftSubmit(submittedDraft, submitToken);
  }
  toast.success(t.value.agent.toastSubmitted, fmt(t.value.agent.toastSubmittedSub, { city: input.city, budget: visibility.mask(ambassadorAmountText(input.budgetUsdt)) }));
  const settled = successfulAmbassadorApplicationState(latestApplication.value);
  latestApplication.value = settled.receipt;
  clearAgentFormState(settled.form);
}

/** Resolves false only when this read failed; a superseded read leaves the outcome to its successor. */
function refreshAgentPage(): Promise<boolean> {
  if (!agentMounted || !auth.isAuthenticated || !environmentCurrent()) return Promise.resolve(true);
  invalidateAgentRequests();
  const requestScope = captureAgentRequest();
  pageReadState.value = "loading";
  // 🔴 本页的契约是三条大使读取(policy / latest / history),**不是**等级阶梯(zentao #204)。
  // 此前就绪判据写成 `vrank.remoteReady && policy.value`,而等级读挂在另一个端点、另一份契约上:
  // 那边一有风吹草动(响应缺字段、契约漂移、服务端尚未部署),整页就报「无法读取大使信息」——
  // 预算规则、活动类型、申请记录全都读到了也照样不显示,而且重试永远复现,因为重试跑的是同一组读。
  // 现在:三条大使读取成功即就绪;等级失败只降级「资格横幅」(unlocked 仍要求 rankReady,
  // rankReady=false 时渲染未知态),不再吃掉整页。
  return Promise.all([
    refreshLatest(requestScope),
    refreshHistory(requestScope),
    ambassadorApplicationApi.policy().then((value) => {
      if (!requestIsCurrent(requestScope)) return;
      policy.value = value;
      if (!draft.value.touched && !submitting.value) draft.value.form.budgetText = String(value.defaultBudgetUsdt);
      // Preserve an edited/removed selection for validation against the new
      // policy; never silently replace a user's budget or selected category.
      const bucket = value.buckets.find(row => row.id === selectedBucketId.value);
      if (bucket) draft.value.form.bucketTitle = t.value.agent.buckets[bucket.id]?.title || bucket.title;
    }),
    // 等级读单独吞掉自己的失败:它只喂资格横幅(rankReady/unlocked),失败由 store 记进
    // remoteError、由横幅渲染未知态。挂在这里是为了让「等级不是本页的就绪前提」成为本页
    // 自己的显式契约,而不是依赖 store 恰好不 rethrow 这个内部细节。
    vrank.refreshCanonicalVRank().catch(() => undefined),
  ]).then(() => {
    if (requestIsCurrent(requestScope)) pageReadState.value = policy.value ? "ready" : "error";
    return pageReadState.value !== "error";
  }).catch(() => {
    if (!requestIsCurrent(requestScope)) return true;
    invalidateAgentRequests();
    policy.value = null; applications.value = []; latestApplication.value = emptyApplication(); pageReadState.value = "error";
    return false;
  });
}

function retryAgentPage(): Promise<boolean> {
  resetAgentPageState();
  return refreshAgentPage();
}

watch([() => app.accountKey, () => app.accountBindingEpoch, () => auth.isAuthenticated, () => locale.code, () => apiRuntimeConfig.environment, () => apiRuntimeConfig.baseUrl], () => {
  if (displayRank.value === null) rankPresentation.value = null;
  draft.value = ambassadorDraftCache.forAccount({ accountKey: app.accountKey, accountEpoch: app.accountBindingEpoch });
  resetAgentPageState();
  if (agentMounted) void refreshAgentPage();
}, { flush: "sync" });

let releaseActiveRefresh = () => {};
onShow(() => {
  draft.value = ambassadorDraftCache.forAccount({ accountKey: app.accountKey, accountEpoch: app.accountBindingEpoch });
  agentMounted = true;
  invalidateAgentRequests();
  void refreshAgentPage();
  releaseActiveRefresh();
  // Pull-down rereads the page; a failed read rejects so the shared refresh reports it once.
  releaseActiveRefresh = registerActivePageRefresh(() => refreshAgentPage().then((ok) => { if (!ok) throw new Error("AMBASSADOR_PAGE_REFRESH_FAILED"); }), "pages/team/agent");
});

onHide(() => {
  agentMounted = false;
  invalidateAgentRequests();
  pageReadState.value = "loading";
  releaseActiveRefresh();
});

onUnload(() => {
  agentMounted = false;
  stopRankPresentationRuntime();
  releaseActiveRefresh();
  resetAgentPageState();
});

function go(url: string) {
  navTo(url);
}

useAutoRecovery({ failed: () => pageReadState.value === "error", retry: retryAgentPage });
</script>

<style scoped>
.agent-page { color: var(--v5-ink); }
.agent-loading { padding: var(--v5-space-8) var(--v5-space-4) 0; text-align: center; color: var(--v5-ink-3); }
.agent-content { display: flex; flex-direction: column; padding-top: var(--v5-space-4); }
/* Focus card: the shared soft glass (design system 01 §1.1.2); layout only here. */
.agent-hero { display: flex; flex-direction: column; gap: var(--v5-space-4); margin: 0 var(--v5-space-4); padding: var(--ui-space-inset-hero); border-radius: var(--v5-radius-2xl); }
.agent-headline { display: block; font: var(--ui-type-page-title-weight, 600) var(--ui-type-page-title)/var(--ui-type-page-title-lh) var(--font-v5); color: var(--v5-ink); white-space: pre-line; text-wrap: balance; overflow-wrap: anywhere; }
.agent-intro { display: block; margin-top: var(--v5-space-1); font: var(--ui-type-description-weight, 400) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-2); }
.agent-track { display: flex; align-items: center; }
.agent-track__line { flex: 1; height: 3px; margin: 0 var(--v5-space-1) 26px; border-radius: var(--v5-radius-full); background: var(--v5-surface-3); overflow: hidden; }
.agent-track__line > view { height: 100%; border-radius: var(--v5-radius-full); background: var(--v5-brand); }
.agent-track__stop { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; flex: none; width: 44px; min-height: 62px; gap: var(--v5-space-1); }
.agent-track__node { display: grid; place-items: center; flex: none; width: 36px; height: 40px; clip-path: polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%); background: var(--v5-border); font: 600 11px/1 var(--font-metric); color: var(--v5-ink-3); }
.agent-track__node > text { display: grid; place-items: center; width: calc(100% - 2px); height: calc(100% - 2px); clip-path: inherit; background: var(--v5-surface-2); }
.agent-track__node--done { color: var(--v5-brand); }
.agent-track__node--current { background: var(--v5-ink-3); color: var(--v5-brand); }
.agent-track__node--goal { width: 40px; height: 44px; color: var(--v5-brand-2-ink); }
.agent-track__label { display: block; min-height: 20px; max-width: 64px; font: 500 11px/14px var(--font-v5); text-align: center; color: var(--v5-ink-3); }
.agent-track__stop--current .agent-track__label { color: var(--v5-brand); }
.agent-track__stop--goal .agent-track__label { color: var(--v5-brand-2-ink); }
.agent-eligibility { display: flex; align-items: center; gap: var(--v5-space-2); min-height: 44px; box-sizing: border-box; padding-top: var(--ui-space-inline); border-top: 1px solid var(--v5-border); }
.agent-eligibility__icon { flex: none; color: var(--v5-success-ink); }
.agent-eligibility__text { flex: 1; min-width: 0; font: var(--ui-type-list-title-weight, 500) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.agent-path { display: flex; align-items: center; justify-content: center; flex: none; min-height: 44px; cursor: pointer; }
.agent-opening-badge { display: flex; align-items: center; gap: var(--v5-space-1); padding: var(--v5-space-1) var(--ui-space-row-y); border-radius: var(--v5-radius-full); background: var(--v5-surface-3); color: var(--v5-ink-3); font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); }
.agent-section { margin-top: var(--ui-space-section-gap); }
.agent-section__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--ui-space-inline); margin: 0 var(--v5-space-4) var(--ui-space-inline); }
.agent-section__title { font: var(--ui-type-section-weight, 600) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); color: var(--v5-ink); }
.agent-section__sub { min-width: 0; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); text-align: end; overflow-wrap: anywhere; }
.agent-link { display: inline-flex; align-items: center; gap: 2px; flex: none; padding: calc((44px - 18px) / 2) 0; margin: calc((18px - 44px) / 2) 0; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3); cursor: pointer; }
.agent-section > :deep(.amb-card) { margin: 0 var(--v5-space-4); }
.agent-latest { margin: 0 var(--v5-space-4); border-top: 1px solid var(--v5-border); border-bottom: 1px solid var(--v5-border); }
.agent-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ui-space-card-gap); margin: 0 var(--v5-space-4); }
.agent-tile { position: relative; display: flex; flex-direction: column; gap: var(--v5-space-2); min-height: 132px; box-sizing: border-box; padding: 14px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.agent-tile[role="radio"] { cursor: pointer; }
.agent-tile[aria-disabled="true"] { cursor: default; }
.agent-tile--selected { box-shadow: inset 0 0 0 1.5px var(--v5-brand), var(--v5-glass-shadow); }
.agent-tile > :deep(.amb-icon) { margin-bottom: auto; }
.agent-tile__check { position: absolute; top: 14px; right: 14px; color: var(--v5-brand); }
.agent-tile__title { display: block; font: var(--ui-type-subheading-weight, 500) 14px/20px var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.agent-tile__rule { display: block; margin-top: var(--v5-space-1); font: 400 11px/16px var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.agent-tile__range { display: block; font: 500 11px/16px var(--font-metric); color: var(--tint-ink); overflow-wrap: anywhere; }
.agent-tile:focus-visible, .agent-path:focus-visible, .agent-link:focus-visible, .agent-preview:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
.agent-hint { display: flex; gap: var(--v5-space-2); margin: var(--ui-space-inline) var(--v5-space-4) 0; font: var(--ui-type-note-weight, 400) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color: var(--v5-ink-3); }
.agent-hint > svg { flex: none; margin-top: var(--v5-space-1); }
.agent-section > .agent-hint { margin-top: var(--v5-space-4); }
.agent-preview { display: flex; align-items: center; justify-content: center; min-height: 48px; margin: var(--ui-space-section-gap) var(--v5-space-4) 0; padding: 0 var(--v5-space-5); border-radius: var(--v5-radius-full); font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); cursor: pointer; }
.agent-form { margin: 0 var(--v5-space-4); padding: var(--v5-space-1) var(--v5-space-4); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.agent-field { padding: 14px 0; border-bottom: 1px solid var(--v5-border); }
.agent-field:last-child { border-bottom: 0; }
.agent-field__label { display: flex; align-items: center; gap: var(--v5-space-2); margin-bottom: var(--v5-space-2); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.agent-control { display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-2); width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 var(--ui-space-inline); border-radius: var(--v5-radius-s); background: var(--v5-surface-3); font: var(--ui-type-input-weight, 400) var(--ui-type-input)/var(--ui-type-input-lh) var(--font-v5); color: var(--v5-ink); }
.agent-control__value { flex: 1; min-width: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.agent-control__input { min-height: 44px; background: transparent; color: var(--v5-ink); font: inherit; }
.agent-control__placeholder { color: var(--v5-ink-3); }
.agent-control__prefix { flex: none; font: var(--ui-type-compact-button-weight) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); color: var(--v5-ink-3); }
.agent-control > svg { flex: none; color: var(--v5-ink-3); }
.agent-control:focus-within, .agent-date-picker:focus-visible .agent-control { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.agent-field__help { display: block; margin-top: var(--v5-space-2); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.agent-discard { display: flex; justify-content: center; margin: var(--v5-space-1) var(--v5-space-4) 0; }
.agent-bar-space { height: calc(120px + env(safe-area-inset-bottom)); }
@media (max-width: 374px) { .agent-track__stop { width: 36px; } .agent-track__line { margin-inline: 2px; } .agent-opening-badge { padding-inline: 7px; } }
</style>
