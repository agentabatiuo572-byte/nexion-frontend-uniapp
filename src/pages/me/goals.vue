<!--
  Earning goals — ported from Nexion-prototype/app/(main)/me/goals/page.tsx.
  Set a USDT target + deadline; remote/sandbox modes ask the server for a
  catalog-backed recommendation, while mock mode retains the demo fallback.

  Wrapped in <AppChassis active="me">; SubPageHeader (back chevron) scrolls
  with content. <input> → uni <input>; per-goal bar extracted to
  GoalProgressBar (own IntersectionObserver per row). On-warning text uses
  var(--v5-on-brand) (project convention); the source's #14130A/#0F0F0F hero
  gradient is rebuilt from tokens.
-->
<template>
  <AppChassis active="me">
    <view class="growth-goals" :class="{ 'growth-goals--featured': !!featuredGoal }" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.goals.navTitle" />

      <view v-if="featuredGoal" class="goal-hero nx-soft-glass mx-4">
        <view class="goal-hero__heading"><text>{{ fmt(t.growthUi.goalTerm, {days: Math.max(1, Math.round((featuredGoal.deadlineMs - featuredGoal.createdAt) / ONE_DAY_MS)), amount:formatAmount(featuredGoal.targetUSDT)}) }}</text><text class="goal-hero__term">{{ deadlineLine(featuredGoal.deadlineMs) }}</text></view>
        <GrowthProgress ring :size="176" :radius="45.4545" :stroke="7" :value="goalPct(featuredGoal.targetUSDT)" :label="`${formatAmount(lifeTimeEarnings)} / ${formatAmount(featuredGoal.targetUSDT)}`">
          <text class="goal-hero__amount"><text class="amount-cur">$</text>{{ formatAmount(lifeTimeEarnings).split('.')[0] }}<text class="amount-dec">{{ '.' + formatAmount(lifeTimeEarnings).split('.')[1] }}</text></text><text class="goal-hero__of">/ ${{ formatAmount(featuredGoal.targetUSDT) }}</text><text class="goal-hero__pct">{{ goalPct(featuredGoal.targetUSDT).toFixed(0) }}%</text>
        </GrowthProgress>
      </view>
      <view class="goal-intro mx-4" :style="heroStyle">
        <text class="block" :style="heroTitleStyle">{{ t.growthUi.goalHeading }}</text>
        <text v-if="editorDisplayReady" class="block" :style="heroSubStyle">{{ heroSubLine }}</text>
      </view>

      <view v-if="remoteApiEnabled && !editorDisplayReady" class="mx-4" :style="emptyStateStyle" role="status" :aria-busy="goalsStore.status !== 'error'">
        <text>{{ goalsStore.status === 'error' ? t.goals.serverUnavailable : t.goals.loading }}</text>
        <view v-if="goalsStore.status === 'error'" class="inline-flex items-center active:opacity-80" :style="recCtaStyle" role="button" tabindex="0" :aria-label="t.ui.retry" @click="retryGoals"><text :style="[recCtaLabelStyle, { font: '600 13px/20px var(--font-v5)' }]">{{ t.ui.retry }}</text></view>
      </view>

      <!-- Setter — de-carded: labels + L1-filled input sit on the page floor -->
      <view class="mx-4 goal-builder" :style="setterWrapStyle">
        <text class="block goal-target-label" :style="fieldLabelStyle">{{ t.goals.targetLabel }}</text>
        <view class="flex items-center goal-input-row" :style="inputBoxStyle">
          <text :style="dollarStyle">$</text>
          <input class="flex-1" :style="targetInputStyle" type="text" inputmode="decimal" :value="editorDisplayReady ? formatAmount(target).replace(/\.00$/, '') : ''" placeholder="—" :disabled="editorBlocked" :aria-label="t.goals.targetLabel" @input="onTarget" />
        </view>
        <view class="grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 15px" role="radiogroup" :aria-label="t.goals.targetPresetsLabel">
          <view
            v-for="(p, pi) in PRESET_TARGETS"
            :key="p"
            :class="{ 'nx-frosted-button': editorDisplayReady && target === p }" class="nx-goal-target-preset flex items-center justify-center active:opacity-70"
            :style="presetTargetStyle(p)"
            role="radio"
            :aria-disabled="editorBlocked"
            :tabindex="target === p || (pi === 0 && !PRESET_TARGETS.includes(target)) ? 0 : -1"
            :aria-checked="editorDisplayReady && target === p ? 'true' : 'false'"
            :aria-label="fmt(t.goals.targetPresetOption, { amount: formatAmount(p) })"
            @click="selectTarget(p)" @keydown.left.prevent="moveTarget(pi, -1)" @keydown.right.prevent="moveTarget(pi, 1)"
          >
            <text :style="presetTargetLabelStyle(p)">${{ p >= 1000 ? `${formatAmount(p / 1000)}K` : String(p) }}</text>
          </view>
        </view>

        <text class="block" :style="[fieldLabelStyle, { marginTop: '18px' }]">{{ t.goals.deadlineLabel }}</text>
        <view class="grid goal-deadlines nx-frosted-button" :style="{gridTemplateColumns: `repeat(${editorDisplayReady && savedCustomDeadline !== null ? 5 : 4}, minmax(0, 1fr))`, gap: '3px'}" role="radiogroup" :aria-label="t.goals.deadlineLabel">
          <view v-if="editorDisplayReady && savedCustomDeadline !== null" class="nx-goal-deadline-preset nx-goal-current-deadline flex items-center justify-center" :style="presetDeadlineStyle(savedCustomDeadline)" role="radio" :tabindex="days === savedCustomDeadline ? 0 : -1" :aria-checked="days === savedCustomDeadline" :aria-disabled="editorBlocked" :aria-label="fmt(t.goals.deadlinePresetOption, {days:String(savedCustomDeadline)})" @click="selectDays(savedCustomDeadline)" @keydown.left.prevent="moveDays(-1, -1)" @keydown.right.prevent="moveDays(-1, 1)"><text :style="presetDeadlineLabelStyle(savedCustomDeadline)">{{ fmt(t.goals.deadlinePresetLabel, {days:String(savedCustomDeadline)}) }}</text></view>
          <view
            v-for="(d, di) in PRESET_DEADLINES_DAYS"
            :key="d"
            class="nx-goal-deadline-preset flex items-center justify-center active:opacity-70"
            :style="presetDeadlineStyle(d)"
            role="radio"
            :aria-disabled="editorBlocked"
            :tabindex="days === d || (!editorDisplayReady && di === 0) ? 0 : -1"
            :aria-checked="editorDisplayReady && days === d ? 'true' : 'false'"
            :aria-label="fmt(t.goals.deadlinePresetOption, { days: String(d) })"
            @click="selectDays(d)" @keydown.left.prevent="moveDays(di, -1)" @keydown.right.prevent="moveDays(di, 1)"
          >
            <text :style="presetDeadlineLabelStyle(d)">{{ fmt(t.goals.deadlinePresetLabel, { days: String(d) }) }}</text>
          </view>
        </view>
      </view>

      <!-- Recommendation -->
      <view v-if="recommendationWarmDisplay" class="mx-4" :style="recCardStyle">
        <text class="block" :style="recHeaderStyle">{{ t.goals.recHeader }}</text>
        <text class="block" :style="recPathStyle">{{ recommendationWarmDisplay }}</text>
        <view class="inline-flex items-center" :style="recCtaStyle" aria-hidden="true"><text :style="recCtaLabelStyle">{{ t.goals.shopCta }} →</text></view>
      </view>
      <view v-else-if="editorHasSnapshot && target > 0 && remoteApiEnabled && goalsStore.recommendationStatus === 'loading'" class="nx-glass-card mx-4" :style="recCardStyle">
        <text class="block" :style="recHeaderStyle">{{ t.goals.recHeader }}</text>
        <text class="block" :style="recReasonStyle">{{ t.goals.loading }}</text>
      </view>
      <view v-else-if="editorHasSnapshot && target > 0 && remoteApiEnabled && goalsStore.recommendationStatus === 'error'" class="mx-4" :style="recCardStyle">
        <text class="block" :style="recHeaderStyle">{{ t.goals.recHeader }}</text>
        <text class="block" :style="recReasonStyle">{{ goalsStore.recommendationError === 'GOAL_NO_ELIGIBLE_PRODUCT' ? t.goals.noEligibleProduct : t.goals.serverUnavailable }}</text>
        <view v-if="goalsStore.recommendationError !== 'GOAL_NO_ELIGIBLE_PRODUCT'" class="inline-flex items-center active:opacity-80" :style="recCtaStyle" role="button" tabindex="0" :aria-label="t.ui.retry" @click="retryGoals">
          <text :style="[recCtaLabelStyle, { font: '600 13px/20px var(--font-v5)' }]">{{ t.ui.retry }}</text>
        </view>
      </view>
      <view v-else-if="target > 0 && (!remoteApiEnabled || (!editorBlocked && goalsStore.recommendationStatus === 'ready' && goalsStore.recommendation?.purchaseRequired === true && goalsStore.recommendation.targetUsdt === target))" class="mx-4 goal-recommendation" :style="recCardStyle">
        <text class="block" :style="recHeaderStyle">{{ t.goals.recHeader }}</text>
        <text v-if="remoteApiEnabled && goalsStore.recommendation" class="goal-daily">{{ fmt(t.goals.dailyNeeded, {amount: formatGoalDailyRate(goalsStore.recommendation.requiredDaily)}) }}</text>
        <text v-else class="block" :style="recPathStyle">{{ recPathLine }}</text>
        <text v-if="recommendation.reason" class="block" :style="recReasonStyle">{{ recommendation.reason }}</text>
        <view class="goal-device-well flex items-center active:opacity-80" :style="recCtaStyle" role="button" tabindex="0" :aria-label="t.goals.shopCta" @click="goStore">
          <view class="goal-device-copy"><text class="goal-device-label">{{ t.growthUi.recommendedDevice }}</text><text class="goal-device-name">{{ recommendation.tier }}</text></view><text :style="recCtaLabelStyle">{{ t.goals.shopCta }} →</text>
        </view>
      </view>

      <!-- Active goals — de-carded: transparent hairline group on the page floor -->
      <view v-if="goals.length > 0">
        <text class="block" :style="sectionLabelStyle">{{ t.goals.activeGoals }}</text>
        <view :style="goalGroupStyle">
          <view v-for="(g, gi) in goals" :key="g.id" class="goal-list-row" :style="goalRowStyle(gi === goals.length - 1)">
            <view class="goal-list-row__body">
              <view class="goal-list-row__heading"><text :style="goalTargetStyle">${{ formatAmount(g.targetUSDT) }}</text><text v-if="!g.achieved" :style="goalDeadlineStyle">{{ deadlineLine(g.deadlineMs) }}</text><text v-else class="goal-achieved">{{ t.goals.achievedBadge }}</text></view>
              <GoalProgressBar :pct="goalPct(g.targetUSDT)" />
              <view class="flex items-center justify-between" style="margin-top:6px"><text :style="goalFootMutedStyle">${{ formatAmount(lifeTimeEarnings) }} / ${{ formatAmount(g.targetUSDT) }}</text><text :style="goalFootPctStyle">{{ goalPct(g.targetUSDT).toFixed(0) }}%</text></view>
            </view>
            <view class="goal-delete nx-frosted-button grid place-items-center" role="button" tabindex="0" :aria-label="fmt(t.goals.removeGoalLabel, { amount: formatAmount(g.targetUSDT) })" @click="remove(g.id)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg></view>
          </view>
        </view>
      </view>
    </view>
    <template #pageFixed>
      <view class="goal-sticky nx-glass-bar"><NxButton variant="primary" size="large" :label="t.goals.saveCta" :disabled="saveBlocked" :busy="savePending" @click="onSave"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg><text>{{ t.goals.saveCta }}</text></NxButton></view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { formatGroupedAmount as formatAmount } from "@/lib/amount-display";
import { navReset } from "@/lib/route";
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type CSSProperties } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NxButton from "@/components/ui/nx-button.vue";
import GrowthProgress from "@/components/ui/growth-progress.vue";
import GoalProgressBar from "@/components/me/goal-progress-bar.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useGoals, type Goal } from "@/store/goals";
import { useApp } from "@/store/app";
import { useUI } from "@/store/ui";
import { remoteApiEnabled, apiRuntimeConfig } from "@/api/runtime";

const PRESET_TARGETS = [500, 1000, 5000, 10000];
const PRESET_DEADLINES_DAYS = [30, 90, 180, 365];
const ONE_DAY_MS = 86400000;

const t = useT();
const goalsStore = useGoals();
const app = useApp();
const ui = useUI();

const lifeTimeEarnings = computed(() => remoteApiEnabled ? goalsStore.lifetimeEarningsUsdt : app.earnings.total);
const goals = computed(() => !remoteApiEnabled || editorDisplayReady.value ? goalsStore.goals : []);
const featuredGoal = computed(() => goals.value.find(goal => !goal.achieved) ?? goals.value[0]);
const target = ref(1000);
const days = ref(90);
const savePending = ref(false);
const restoredGoal = ref<{ id: string; targetUSDT: number; days: number } | null>(null);
const savedCustomDeadline = computed(() => restoredGoal.value && !PRESET_DEADLINES_DAYS.includes(restoredGoal.value.days) ? restoredGoal.value.days : null);
const editorDisplayReady = ref(!remoteApiEnabled);
let editorEnvironmentInvalidated = false;
watch(() => apiRuntimeConfig?.environment, () => { editorEnvironmentInvalidated = true; editorDisplayReady.value = false; editorReadEpoch += 1; }, { flush: 'sync' });
watch(() => goalsStore.status, status => { if (status === 'error') editorDisplayReady.value = false; }, { flush: 'sync' });
const editorReadPending = ref(remoteApiEnabled && goalsStore.status !== "ready");
const editorHasSnapshot = computed(() => !remoteApiEnabled || (!editorReadPending.value && goalsStore.status === "ready"));
const editorBlocked = computed(() => savePending.value || !editorHasSnapshot.value || !editorDisplayReady.value);
const saveBlocked = computed(() => editorBlocked.value || (remoteApiEnabled && restoredGoal.value !== null
    && target.value === restoredGoal.value.targetUSDT && days.value === restoredGoal.value.days));
type GoalSaveIntent = { targetUSDT: number; days: number; deadlineMs: number; idempotencyKey: string };
const retryableSaveIntents = new Map<string, GoalSaveIntent>();
let saveEpoch = 0;
let editorReadEpoch = 0;
let restoringEditor = false;
let deleteFeedbackVisible = true;
let deleteFeedbackGeneration = 0;

const recommendation = computed(() => {
  if (remoteApiEnabled && goalsStore.recommendation?.purchaseRequired) {
    return {
      tier: (goalsStore.recommendation.productName ?? ""),
      reason: "",
    };
  }
  if (remoteApiEnabled) return { tier: "", reason: "" };
  const perDay = target.value / days.value;
  if (perDay <= 7) return { tier: "UVELBox S1", reason: t.value.goals.recS1 };
  if (perDay <= 13) return { tier: "UVELBox Pro", reason: t.value.goals.recPro };
  return { tier: "UVELRack P1", reason: t.value.goals.recRack };
});

const heroSubLine = computed(() => {
  if (!editorDisplayReady.value) return "";
  return fmt(t.value.goals.heroSubtitle, { current: formatAmount(lifeTimeEarnings.value) });
});
const recPathLine = computed(() =>
  fmt(t.value.goals.recPath, {
    target: formatAmount(goalsStore.recommendation?.targetUsdt ?? target.value),
    days: goalsStore.recommendation?.days ?? days.value,
    tier: recommendation.value.tier,
    perDay: formatGoalDailyRate(goalsStore.recommendation?.requiredDaily ?? target.value / days.value),
  }),
);

const recommendationPresentation = ref<{ target: number; days: number; path: string } | null>(null);
const recommendationWarmDisplay = computed(() => editorDisplayReady.value && recommendationPresentation.value?.target === target.value
  && recommendationPresentation.value.days === days.value && (editorReadPending.value || goalsStore.recommendationStatus === 'loading')
  ? recommendationPresentation.value.path : '');
watch(() => goalsStore.recommendationStatus, status => {
  if (status === 'error') recommendationPresentation.value = null;
  if (status === 'ready' && editorDisplayReady.value && goalsStore.recommendation?.purchaseRequired
    && goalsStore.recommendation.targetUsdt === target.value)
    recommendationPresentation.value = {target: target.value, days: days.value, path: recPathLine.value};
}, {flush:'sync'});
watch(() => [app.accountKey, app.accountBindingEpoch, t.value] as const, () => {
  editorReadEpoch += 1; editorDisplayReady.value = false; recommendationPresentation.value = null;
  void refreshRemoteGoals();
}, {flush:'sync'});

function formatGoalDailyRate(value: number): string {
  return formatAmount(value);
}

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onTarget(e: Event) {
  if (editorBlocked.value) return;
  target.value = Math.max(0, parseFloat(detailVal(e).replace(/,/g, "")) || 0);
}
function selectTarget(value: number) {
  if (!editorBlocked.value) target.value = value;
}
function selectDays(value: number) {
  if (!editorBlocked.value) days.value = value;
}
/**
 * roving tabindex 的标准行为:方向键移一格并选上,焦点跟到新选中项。
 *
 * 🔴 两个必须点(否则方向键要么跳组、要么把焦点丢掉):
 *  ① 聚焦选择器必须**限定在本组内** —— 本页有两组档位(目标 / 期限),全局
 *     `[role="radio"]` 会命中另一组,方向键一按焦点就跳到隔壁。
 *  ② 锚点按 `tabindex="0"` 取,不按 `aria-checked="true"` —— 用户手输的自定义值
 *     (如 $1500)不在档位里时**没有任何一格是 checked**,按 aria-checked 取到 null,
 *     焦点直接掉回 body,键盘用户被踢出表单(zentao #223)。
 */
function movePreset(selector: string, list: number[], index: number, delta: number, apply: (value: number) => void): void {
  const next = list[(index + delta + list.length) % list.length];
  if (next === undefined) return;
  apply(next);
  void nextTick(() => {
    if (typeof document === "undefined") return;
    document.querySelector<HTMLElement>(`${selector}[tabindex="0"]`)?.focus();
  });
}
function moveTarget(index: number, delta: number): void { movePreset(".nx-goal-target-preset", PRESET_TARGETS, index, delta, selectTarget); }
function moveDays(index: number, delta: number): void {
  const custom = savedCustomDeadline.value;
  const list = custom === null ? PRESET_DEADLINES_DAYS : [custom, ...PRESET_DEADLINES_DAYS];
  movePreset(".nx-goal-deadline-preset", list, index + (custom === null ? 0 : 1), delta, selectDays);
}

watch(() => goalsStore.accountEpoch, () => {
  editorReadEpoch += 1;
  editorDisplayReady.value = false;
  editorReadPending.value = remoteApiEnabled;
  restoringEditor = true;
  target.value = 1000;
  days.value = 90;
  restoredGoal.value = null;
  restoringEditor = false;
  saveEpoch += 1;
  savePending.value = false;
  retryableSaveIntents.clear();
}, { flush: "sync" });

// A same-account bind also replaces the store's pending read.
watch(() => goalsStore.readBindingEpoch, () => {
  editorDisplayReady.value = false; recommendationPresentation.value = null;
  void refreshRemoteGoals();
}, { flush: 'sync' });

function restoreEditorFromGoal(goal: Goal | undefined): void {
  restoringEditor = true;
  target.value = goal?.targetUSDT ?? 1000;
  // The selected term is fixed at creation; remaining days are shown only in the goal row.
  days.value = goal ? Math.max(1, Math.round((goal.deadlineMs - goal.createdAt) / ONE_DAY_MS)) : 90;
  restoredGoal.value = goal ? { id: goal.id, targetUSDT: target.value, days: days.value } : null;
  restoringEditor = false;
}

function latestActiveGoal(): Goal | undefined {
  return goalsStore.goals.filter((goal) => !goal.achieved)
    .sort((left, right) => right.createdAt - left.createdAt)[0];
}

if (remoteApiEnabled && goalsStore.status === "ready") restoreEditorFromGoal(latestActiveGoal());

async function refreshRemoteGoals(force = false): Promise<void> {
  if (!remoteApiEnabled || editorEnvironmentInvalidated) return;
  const expectedReadEpoch = ++editorReadEpoch;
  const expectedAccountEpoch = goalsStore.accountEpoch;
  const owner = [app.accountKey, app.accountBindingEpoch, t.value] as const;
  editorReadPending.value = true;
  const binding = goalsStore.captureReadBinding();
  if (binding.accountKey !== String(app.accountKey).trim().toLowerCase()) { editorReadPending.value = false; return; }
  const successRevision = goalsStore.readSuccessRevision;
  const list = force ? goalsStore.refresh() : goalsStore.ensure();
  await list;
  if (expectedReadEpoch !== editorReadEpoch || expectedAccountEpoch !== goalsStore.accountEpoch
    || owner[0] !== app.accountKey || owner[1] !== app.accountBindingEpoch || owner[2] !== t.value
    || goalsStore.captureReadBinding().epoch !== binding.epoch) return;
  if (goalsStore.status !== "ready" || goalsStore.readSuccessRevision <= successRevision
    || goalsStore.readSuccessScope?.accountKey !== binding.accountKey || goalsStore.readSuccessScope?.epoch !== binding.epoch || savePending.value) {
    editorReadPending.value = false;
    return;
  }
  editorDisplayReady.value = true;
  const latestActive = latestActiveGoal();
  restoreEditorFromGoal(latestActive);
  editorReadPending.value = false;
  await goalsStore.refreshRecommendation(target.value, latestActive?.deadlineMs ?? Date.now() + days.value * ONE_DAY_MS);
}

function retryGoals() {
  void refreshRemoteGoals(true);
}

onMounted(() => {
  void refreshRemoteGoals();
});

onShow(() => {
  deleteFeedbackVisible = true;
  void refreshRemoteGoals();
});

function invalidateDeleteFeedback(): void {
  deleteFeedbackVisible = false;
  deleteFeedbackGeneration += 1;
}
onHide(invalidateDeleteFeedback);
onUnmounted(invalidateDeleteFeedback);

watch([target, days], () => {
  if (!restoringEditor && remoteApiEnabled && goalsStore.status === "ready" && target.value >= 100 && days.value > 0) {
    void goalsStore.refreshRecommendation(target.value, Date.now() + days.value * ONE_DAY_MS);
  }
}, { flush: "sync" });



function deadlineLine(deadlineMs: number): string {
  const daysLeft = Math.max(0, Math.ceil((deadlineMs - Date.now()) / ONE_DAY_MS));
  return fmt(t.value.goals.deadlineRow, { n: daysLeft });
}
function goalPct(targetUSDT: number): number {
  return Math.min(100, (lifeTimeEarnings.value / targetUSDT) * 100);
}

async function onSave() {
  if (saveBlocked.value) return;
  if (target.value < 100) {
    ui.pushToast({ kind: "warn", title: t.value.goals.minTargetWarn });
    return;
  }
  const intentKey = `${target.value}|${days.value}`;
  const expectedAccountEpoch = goalsStore.accountEpoch;
  const expectedSaveEpoch = ++saveEpoch;
  const isCurrentSave = () => expectedAccountEpoch === goalsStore.accountEpoch && expectedSaveEpoch === saveEpoch;
  const intent = retryableSaveIntents.get(intentKey)
    ?? {
        targetUSDT: target.value,
        days: days.value,
        // Use the server's DATETIME second precision from the first POST; retries retain this deadline.
        deadlineMs: Math.floor(Date.now() / 1000) * 1000 + days.value * ONE_DAY_MS,
        // IDEMPOTENCY-FRESH-OK:首次创建后立即写入 retryableSaveIntents；失败重试按同一 intentKey 复用，成功才删除。
        idempotencyKey: `goal-save-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
      };
  retryableSaveIntents.set(intentKey, intent);
  savePending.value = true;
  try {
    const outcome = await goalsStore.setGoal(intent);
    if (!isCurrentSave() || outcome === "stale") return;
    retryableSaveIntents.delete(intentKey);
    restoreEditorFromGoal(goalsStore.goals[goalsStore.goals.length - 1]);
    void goalsStore.refreshRecommendation(target.value, goalsStore.goals[goalsStore.goals.length - 1]?.deadlineMs ?? Date.now() + days.value * ONE_DAY_MS);
    ui.pushToast({ kind: "success", title: fmt(t.value.goals.savedToast, { amount: formatAmount(target.value), days: days.value }) });
  } catch {
    if (!isCurrentSave()) return;
    ui.pushToast({ kind: "warn", title: t.value.goals.serverUnavailable });
  } finally {
    if (isCurrentSave()) savePending.value = false;
  }
}

async function remove(id: string) {
  if (!deleteFeedbackVisible) return;
  const removedGoal = goalsStore.goals.find((goal) => goal.id === id);
  const expectedAccountKey = app.accountKey;
  const expectedBindingEpoch = app.accountBindingEpoch;
  const expectedAccountEpoch = goalsStore.accountEpoch;
  const expectedGeneration = deleteFeedbackGeneration;
  const isCurrentDelete = () => deleteFeedbackVisible && expectedGeneration === deleteFeedbackGeneration
    && expectedAccountKey === app.accountKey && expectedBindingEpoch === app.accountBindingEpoch
    && expectedAccountEpoch === goalsStore.accountEpoch;
  try {
    await goalsStore.remove(id);
    if (!isCurrentDelete() || goalsStore.goals.some((goal) => goal.id === id)) return;
    if (restoredGoal.value?.id === id) restoredGoal.value = null;
    // A confirmed deletion ends only the exact recovered save, not other unknown POST outcomes.
    if (removedGoal) {
      for (const [intentKey, intent] of retryableSaveIntents) {
        if (intent.targetUSDT === removedGoal.targetUSDT && intent.deadlineMs === removedGoal.deadlineMs) {
          retryableSaveIntents.delete(intentKey);
        }
      }
    }
  } catch {
    if (!isCurrentDelete()) return;
    ui.pushToast({ kind: "warn", title: t.value.goals.serverUnavailable });
  }
}

// Carry the server's recommended SKU into the store so the landing page can
// locate/highlight it instead of silently featuring the generic first product
// (BUG 71). The name travels along so a recommendation that is no longer
// purchasable can still be named in the change explanation.
function goStore() {
  if (remoteApiEnabled && (editorBlocked.value || goalsStore.recommendationStatus !== "ready"
      || goalsStore.recommendation?.purchaseRequired !== true || goalsStore.recommendation.targetUsdt !== target.value)) return;
  const productNo = goalsStore.recommendation?.productNo;
  const name = recommendation.value.tier;
  const query = productNo
    ? `?focus=${encodeURIComponent(productNo)}${name ? `&focusName=${encodeURIComponent(name)}` : ""}`
    : "";
  navReset({ url: `/pages/store/store${query}`, fail: () => {} });
}

// ── styles ──
function presetTargetStyle(p: number): CSSProperties {
  const selected = editorDisplayReady.value && target.value === p;
  return {height: '36px', borderRadius: '999px', background: selected ? undefined : 'color-mix(in srgb, var(--v5-ink) 6%, transparent)',
    '--ui-button-fill': 'color-mix(in srgb, var(--v5-brand) 14%, transparent)', '--ui-button-ink': 'var(--v5-brand)'} as CSSProperties;
}
function presetTargetLabelStyle(p: number): CSSProperties {
  return {font: '500 13px/18px var(--font-metric)', color: editorDisplayReady.value && target.value === p ? 'var(--v5-brand)' : 'var(--v5-ink-2)'};
}
function presetDeadlineStyle(d: number): CSSProperties {
  return {height: '32px', minWidth: 0, padding: '0 4px', boxSizing: 'border-box', borderRadius: '999px',
    background: editorDisplayReady.value && days.value === d ? 'var(--ui-growth-selection)' : 'transparent'};
}
function presetDeadlineLabelStyle(d: number): CSSProperties {
  return {font: '500 14px/20px var(--font-v5)', whiteSpace: 'nowrap', textAlign: 'center',
    color: editorDisplayReady.value && days.value === d ? 'var(--v5-brand)' : 'var(--v5-ink-3)'};
}

// De-carded: hero intro sits on the page floor — surface/border + the warning
// radial dropped (a page-floor aura per owner call: deleted, not re-tuned).
// The 4px inset aligns the intro with the board's 20px section text.
const heroStyle: CSSProperties = { padding: "0 4px" };
const heroLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  lineHeight: "18px",
  letterSpacing: "0.04em",
  color: "var(--v5-brand)",
};
const heroTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  lineHeight: "24px",
  textWrap: "balance",
  wordBreak: "normal",
};
const heroSubStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-list-subtitle)",
  color: "var(--v5-ink-3)",
  lineHeight: 1.6,
};
// Setter — de-carded floor block; the $ input box sits on the page floor at L1
// surface (de-card white-list: input = filled box, no border).
const setterWrapStyle: CSSProperties = { marginTop: "12px", padding: "16px", borderRadius: "var(--ui-radius-surface)", background: "var(--v5-surface)" };
const fieldLabelStyle: CSSProperties = {
  marginBottom: "8px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const inputBoxStyle: CSSProperties = {
  gap: "2px",
  height: "44px",
  fontSize: "32px",
  alignItems: "baseline",
  padding: "0",
  borderRadius: "var(--v5-radius-s)",
  // 输入框直接坐在页面底上,surface-3 对页面底亮色 ΔE 2.7 不可辨(内凹读不出来)→ 改 L1 surface。
  background: "var(--v5-surface)",
};
const dollarStyle: CSSProperties = {
  fontFamily: "var(--font-amount)",
  fontSize: ".55em",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const targetInputStyle: CSSProperties = {
  height: "40px",
  background: "transparent",
  fontFamily: "var(--font-amount)",
  fontSize: "32px",
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-.02em",
  color: "var(--v5-ink)",
};
const recCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "var(--ui-radius-surface)",
  padding: "16px",
  background: "var(--v5-surface)",
};
const recHeaderStyle: CSSProperties = {
  marginBottom: "6px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  lineHeight: "16px",
  letterSpacing: "normal",
  color: "var(--v5-brand)",
};
const recPathStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  lineHeight: 1.375,
};
const recReasonStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-list-subtitle)",
  color: "var(--v5-ink-2)",
  lineHeight: 1.6,
};
const recCtaStyle: CSSProperties = {
  marginTop: "12px",
  gap: "4px",
  minHeight: "44px",
  alignItems: "center",
};
const recCtaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 500,
  color: "var(--v5-brand)",
};
const saveBtnStyle: CSSProperties = {
  gap: "6px",
  height: "48px",
  borderRadius: "var(--v5-radius-full)",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
};
const saveBtnPendingStyle: CSSProperties = { background: "var(--v5-surface-2)", color: "var(--v5-ink-3)" };
const saveLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-button)",
  fontWeight: "var(--ui-type-button-weight)",
  color: "inherit",
};
const sectionLabelStyle: CSSProperties = {
  margin: "32px 20px 12px",
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-section)",
  fontWeight: 600,
  letterSpacing: "-0.012em",
  color: "var(--v5-ink)",
};
// Active goals — transparent hairline group (leaderboard rest-list idiom): the
// container border-top opens the group, each row carries its own divider.
const goalGroupStyle: CSSProperties = {
  margin: "0 16px",
  padding: "0",
  borderRadius: "var(--ui-radius-surface)",
  background: "var(--v5-surface)",
};
function goalRowStyle(isLast: boolean): CSSProperties {
  return {
    padding: "14px 0",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
const goalTargetStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 500,
  color: "var(--v5-ink)",
};
const goalRemoveStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  flexShrink: 0,
  borderRadius: "var(--v5-radius-full)",
  background: "var(--v5-surface-2)",
};
const goalDeadlineStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const goalFootMutedStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const goalFootPctStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const achievedBadgeStyle: CSSProperties = {
  marginTop: "8px",
  gap: "4px",
  padding: "2px 8px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
};
const achievedLabelStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontSize: "12px",
  color: "var(--v5-brand)",
};
const emptyStateStyle: CSSProperties = {
  marginTop: "20px", padding: "16px", color: "var(--v5-ink-3)", textAlign: "center",
};


</script>

<style scoped>
.growth-goals { --ui-growth-selection: color-mix(in srgb,var(--v5-bg) 50%,transparent); padding-bottom: calc(112px + env(safe-area-inset-bottom)); }
:global([data-theme="light"]) .growth-goals { --ui-growth-selection: color-mix(in srgb,var(--v5-ink) 7%,transparent); }
.goal-hero { position: relative; padding: 18px 16px 20px; border-radius: var(--ui-radius-surface); }
.goal-hero__heading { display: flex; justify-content: space-between; gap: var(--v5-space-2); align-items: center; font: 500 15px/22px var(--font-v5); }
.goal-hero__term { flex: none; color: var(--v5-brand); background: var(--v5-brand-soft); padding: var(--v5-space-1) 8px; border-radius: var(--v5-radius-full); font: 500 12px/16px var(--font-v5); }
.goal-hero :deep(.growth-progress) { margin: var(--v5-space-3) auto 0; }
.goal-hero__amount { font: 500 28px/34px var(--font-amount); letter-spacing: -.02em; }.goal-hero__of { font: 500 13px/18px var(--font-metric); color: var(--v5-ink-3); }.goal-hero__pct { margin-top: var(--v5-space-1); color: var(--v5-brand); font: 500 15px/20px var(--font-metric); }
.goal-intro { margin-top: var(--v5-space-8); }.goal-deadlines { padding: var(--v5-space-1); border-radius: var(--v5-radius-full); position: relative; }
.nx-goal-target-preset, .nx-goal-deadline-preset { position: relative; cursor: pointer; }.nx-goal-target-preset::after, .nx-goal-deadline-preset::after { content:''; position:absolute; inset:-6px 0; }
.nx-goal-target-preset:focus-visible, .nx-goal-deadline-preset:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.goal-sticky { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; display: flex; padding: var(--v5-space-3) 16px calc(30px + env(safe-area-inset-bottom)); }.goal-sticky > * { flex: 1; }
.goal-daily { display:block; margin-top:6px; font:500 24px/30px var(--font-metric); letter-spacing:-.01em; }.goal-device-name { flex:1; font:500 15px/22px var(--font-v5); color:var(--v5-ink); }
.goal-device-name {margin-right:12px;}.goal-builder ~ view [aria-label] .goal-device-name {font-weight:500;}

/* Approved growth board geometry and material. */
 .amount-cur { font-size:.55em; color:var(--v5-ink-3); margin-right:2px; letter-spacing:0; }.amount-dec { color:var(--v5-ink-3); }
.goal-hero { overflow:hidden; }
.goal-hero :deep(.growth-progress) { position:relative; z-index:1; }
.goal-device-well { box-sizing:border-box; width:100%; min-height:66px !important; gap:12px !important; padding:10px 12px; border-radius:14px; background:color-mix(in srgb,var(--v5-ink) 4%,transparent); box-shadow:inset 0 2px 8px color-mix(in srgb,var(--v5-bg) 45%,transparent),inset 0 0 0 1px var(--v5-border); }
.goal-device-copy { flex:1; min-width:0; }.goal-device-label { display:block; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }.goal-device-name { display:block; margin:0; font:500 15px/22px var(--font-v5); }
.goal-list-row { display:flex; align-items:center; gap:12px; box-sizing:border-box; min-height:86px; padding:14px 16px !important; }
.goal-list-row__body { flex:1; min-width:0; }.goal-list-row__heading { display:flex; align-items:center; gap:8px; min-height:22px; }.goal-list-row__heading > text { margin-top:0 !important; }.goal-achieved { padding:4px 8px; border-radius:var(--v5-radius-full); background:var(--v5-success-soft); color:var(--v5-success-ink); font:500 12px/16px var(--font-v5); }
.goal-delete { flex:none; width:36px; height:36px; border-radius:50%; color:var(--v5-ink-3); }.goal-sticky :deep(.nx-button--disabled) { opacity:1; }.goal-sticky { padding-bottom:30px; }

.growth-goals--featured :deep(.spv) { margin-bottom:0; padding-bottom:13px; }
.goal-hero {margin-top:8px;}.goal-recommendation {min-height:167.5px;box-sizing:border-box;}

.goal-hero__amount { font-variant-numeric:tabular-nums; }

.goal-hero :deep(.growth-progress__center) { transform:none; }
.goal-target-label { margin-bottom:var(--v5-space-1)!important; }
.goal-builder { padding-top:20px!important; }
.goal-device-well { margin-top:14px!important; }
.goal-recommendation { padding-top:20px!important; }

</style>
