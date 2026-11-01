<!-- DayOneQuestCard — homepage newcomer task card. -->
<template>
  <view
    id="home-newcomer-task-card"
    class="nx-glass-card newcomer-task"
    :class="{ 'newcomer-task--expanded': expanded, 'newcomer-task--mission': missionLayout }"
    :style="rootStyle"
    :aria-hidden="!props.active"
  >
    <view class="newcomer-task__summary">
      <view class="newcomer-task__top" style="display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-3)">
        <view style="min-width: 0">
          <view style="display: flex; align-items: center; flex-wrap: wrap; gap: 7px">
            <view class="newcomer-task__mark" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="m13 2-9 12h8l-1 8 9-12h-8z" />
              </svg>
            </view>
            <text class="newcomer-task__eyebrow">{{ t.home.dayOneFirstDayReward }}</text>
            <text class="newcomer-task__count">{{ taskCountText }}</text>
          </view>
          <view v-if="!claimState.empty" class="newcomer-task__reward">
            <text class="newcomer-task__reward-value">{{ rewardText === "—" ? "—" : `+${rewardText}` }}</text>
            <text class="newcomer-task__unit" style="font-size: 13px; color: var(--v5-nex); font-family: var(--font-jet-mono), ui-monospace, monospace; font-weight: 500; margin-left: 2px">UVT</text>
          </view>
        </view>
        <view v-if="!claimState.empty && !questUnavailable && (!remoteApiEnabled || dayOneWindow)" class="newcomer-task__clock" style="text-align: right; flex-shrink: 0">
          <text v-if="!dayOneExpired" class="block" style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; color: var(--v5-ink-4); letter-spacing: 0.04em">{{ t.home.dayOneEndsIn }}</text>
          <text class="block" :style="{ marginTop: dayOneExpired ? '0' : '4px' }" style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-weight: 500; font-size: 15px; color: var(--v5-quest-violet-ink); font-variant-numeric: tabular-nums; line-height: 1" :aria-label="dayOneExpired ? t.home.dayOneExpired : undefined">{{ dayOneExpired ? t.quest.expired : remainingLabel }}</text>
        </view>
      </view>

      <view v-if="!claimState.empty" style="margin-top: 10px">
        <view v-if="!missionLayout" ref="elRef" style="height: 6px; border-radius: var(--v5-radius-full); overflow: hidden; background: var(--v5-surface-2); position: relative">
          <view v-if="!visibility.hidden" :style="barStyle" />
        </view>
        <view v-if="missionLayout" class="newcomer-task__segments" role="progressbar" :aria-label="t.home.dayOneFirstDayReward" :aria-valuenow="visibility.hidden || questUnavailable ? undefined : completedCount" aria-valuemin="0" :aria-valuemax="total">
          <view v-for="(_, segment) in tasks" :key="segment" :class="{'newcomer-task__segment--done': !visibility.hidden && !questUnavailable && segment < completedCount}" :style="{animationDelay: segment * 40 + 'ms'}" />
        </view>
        <view class="newcomer-task__progress-copy" style="margin-top: 5px; display: flex; justify-content: space-between; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px">
          <text v-if="questUnavailable" style="color: var(--v5-ink-4)">{{ unavailableLabel }}</text>
          <template v-else>
            <text style="color: var(--v5-ink-4)"><text style="color: var(--v5-ink); font-weight: 500">{{ visibility.mask(completedCount) }}</text> / {{ visibility.mask(total) }} {{ t.home.dayOneDoneSuffix }}<text v-if="missionLayout && !claimState.claimed && !claimState.unverified"> · {{ t.home.dayOneCompleteAllHint }}</text></text>
            <text v-if="remoteApiEnabled" style="color: var(--v5-nex)">{{ claimState.empty ? t.home.dayOneNoActiveTasks : claimState.claimed ? t.home.dayOneRewardClaimed : claimState.unverified ? t.home.dayOneSnapshotUnverified : t.home.dayOneRewardUnclaimed }}</text>
            <text v-else style="color: var(--v5-nex); font-variant-numeric: tabular-nums">{{ visibility.mask(nexEarnedText === "—" ? "—" : `+${nexEarnedText}`) }} {{ t.home.dayOneEarnedSuffix }}</text>
          </template>
        </view>
      </view>

      <!-- 去线(主人 2026-08-17 全站令):总间距沿用有线时代的 12+12 -->
      <text v-if="claimState.empty" class="block" style="margin-top:var(--v5-space-3);color:var(--v5-ink-3);font-size:var(--ui-type-list-subtitle)">{{ t.home.dayOneNoActiveTasks }}</text>
      <view v-if="expanded && !claimState.empty" style="margin-top: var(--v5-space-6); display: flex; flex-direction: column; gap: var(--v5-space-1)">
        <text v-if="!missionLayout && remoteApiEnabled && !questUnavailable && !claimState.unverified && !claimState.claimed && !dayOneExpired" class="newcomer-task__reward-hint">{{ t.home.dayOneCompleteAllHint }}</text>
        <view
          v-for="task in tasks"
          :key="task.id"
          :class="isActionable(task) ? 'active:scale-[0.98] active:opacity-80 transition-transform' : ''"
          :style="rowStyle(task)"
          role="button"
          :tabindex="props.active && isActionable(task) ? 0 : -1"
          :aria-disabled="!isActionable(task)"
          @click="onRowTap(task)"
        >
          <view :style="circleStyle(task)">
            <!-- 勾色按填充色配对(task.onColor),不能一刀切:quest 两色双主题恒浅
                 → on-quest 恒深墨(6.32/6.64);brand 随主题翻转 → on-brand。
                 两次实测教训:一刀切 on-brand 亮色白勾压浅紫=2.98;一刀切 on-quest
                 深墨压亮色品牌蓝=2.77。 -->
            <svg v-if="isDone(task)" width="10" height="10" viewBox="0 0 24 24" fill="none" :stroke="missionLayout ? 'var(--v5-on-brand)' : task.onColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
            <text v-else style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; font-weight: 500" :style="{ color: missionLayout ? 'var(--v5-ink-3)' : task.color }">{{ task.order }}</text>
          </view>
          <view style="display: flex; align-items: baseline; gap: 6px; min-width: 0">
            <text class="truncate" :style="labelStyle(task)">{{ task.label }}</text>
            <text :style="catStyle(task)">{{ task.cat }}</text>
          </view>
          <text v-if="task.nex !== null && !missionLayout" :style="rewardStyle(task)">{{ `+${formatAmount(task.nex)} UVT` }}<text v-if="task.usdt" :style="{ color: isDone(task) ? 'var(--v5-ink-4)' : 'var(--v5-brand-2)', marginLeft: '4px' }">+${{ formatAmount(task.usdt) }}</text></text>
          <view>
            <svg v-if="isActionable(task)" :width="missionLayout ? 16 : 11" :height="missionLayout ? 16 : 11" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" :stroke-width="missionLayout ? 2 : 2.4" stroke-linecap="round" stroke-linejoin="round" :style="{opacity: missionLayout ? 1 : .7}">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </view>
        </view>
      </view>
    </view>

    <NxButton v-if="remoteApiEnabled && !questUnavailable && !claimState.empty && (claimState.claimCode || quest.dayOneClaiming)" class="newcomer-task__claim" variant="brand" size="medium" :disabled="!props.active" :busy="quest.dayOneClaiming" :label="quest.dayOneClaiming ? t.home.dayOneClaiming : t.home.dayOneClaimReward" @click="onClaim" />
    <view v-if="expanded && observationNotices.length" class="newcomer-task__observation">
      <view v-for="notice in observationNotices" :key="notice.task.id" class="newcomer-task__observation-item">
        <text role="status">{{ notice.task.label }} · {{ observationMessage(notice.reason) }}</text>
        <view class="newcomer-task__observation-actions">
          <view v-if="notice.reason !== 'unconfirmed'" role="button" :tabindex="props.active ? 0 : -1"
            :aria-disabled="!props.active" class="newcomer-task__observation-action"
            @click="recoverObservation(notice.task)">
            <text>{{ notice.reason === 'terms' ? t.home.dayOneObservationTermsAction : t.home.dayOneObservationSetupAction }}</text>
          </view>
          <view role="button" :tabindex="props.active ? 0 : -1" :aria-disabled="!props.active"
            class="newcomer-task__observation-action" @click="recoverObservation(notice.task, true)">
            <text>{{ t.home.dayOneObservationRetry }}</text>
          </view>
        </view>
      </view>
    </view>
    <text v-if="remoteApiEnabled && quest.dayOneClaimError" role="status" class="newcomer-task__claim-error">
      {{ quest.claimNotice ? t.questClaim[quest.claimNotice] : t.home.dayOneClaimUnconfirmed }}
    </text>

    <view
      v-if="(!missionLayout || !expanded || questLoadError) && (!claimState.empty || questLoadError)"
      class="nx-glass-action newcomer-task__toggle"
      :style="toggleStyle"
      role="button"
      :tabindex="props.active && (!questUnavailable || questLoadError) ? 0 : -1"
      :aria-expanded="expanded"
      :aria-disabled="questUnavailable && !questLoadError"
      :aria-label="toggleLabel"
      @click="toggleExpanded"
    >
      <text style="font-family: var(--font-v5); font-size: var(--ui-type-list-subtitle); font-weight: 500; color: var(--v5-ink-3)">{{ toggleLabel }}</text>
      <svg v-if="!questUnavailable" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path :d="expanded ? 'M19 15l-7-7-7 7' : 'M5 9l7 7 7-7'" />
      </svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import NxButton from "@/components/ui/nx-button.vue";
import { useDataVisibility } from "@/store/data-visibility";
import { formatAmount } from "@/lib/amount-display";
import { isStakingVisibilityRoute, navTo } from "@/lib/route";
import { computed, ref, watch, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNow } from "@/composables/use-now";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";
import { useQuest } from "@/store/quest";
import { useLocaleStore } from "@/store/locale";
import { remoteApiEnabled } from "@/api/runtime";
import type { QuestTaskCategory } from "@/api/quest-api";
import { selectHomeQuestRows } from "./home-quest-source";
import { dayOneClaimState } from "@/lib/day-one-claim-state";
import { dayOneQuestDisplayName } from "@/lib/quest-presentation";
import { dayOneObservationRecovery, observationRecoveryRoute, type DayOneObservationReason } from "@/lib/day-one-observation-recovery";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";

interface QuestTask {
  id: string;
  order: number;
  label: string;
  nex: number | null;
  usdt?: number;
  href: string;
  cat: string;
  color: string;
  /** 该填充色之上的前景色(勾/序号)。quest 两色恒浅 → on-quest 恒深墨;
   *  brand 随主题翻转 → 必须配同样翻转的 on-brand。用错会在某一主题糊掉。 */
  onColor: string;
  eligible: boolean;
}

const visibility = useDataVisibility();
const props = withDefaults(defineProps<{ missionLayout?: boolean; active?: boolean; expanded?: boolean }>(), {
  active: true,
  expanded: false,
});
const emit = defineEmits<{
  (event: "update:expanded", value: boolean): void;
  (event: "content-resize"): void;
}>();
const expanded = computed({
  get: () => props.expanded,
  set: (value: boolean) => emit("update:expanded", value),
});

const t = useT();
const locale = useLocaleStore();
const nowTick = useNow();
const { elRef, inView } = useScrollGrowProgress();
const quest = useQuest();
const app = useApp();
const stakingDisplay = useConfig();
const mockReward = 500;

const categoryLabel = (category: QuestTaskCategory): string => ({
  wallet: t.value.home.dayOneCatWallet,
  explore: t.value.home.dayOneCatExplore,
  recommend: t.value.home.dayOneCatRecommend,
  identity: t.value.home.dayOneCatIdentity,
  social: t.value.home.dayOneCatSocial,
})[category];

const fallbackTasks = computed<QuestTask[]>(() => [
  { id: "bind_bank_card", order: 1, label: t.value.home.dayOneTaskBindCard, nex: 50, href: "/pages/me/wallet-cards-new", cat: t.value.home.dayOneCatWallet, color: "var(--v5-quest-violet)", onColor: "var(--v5-on-quest)", eligible: true },
  { id: "visit_earn", order: 2, label: t.value.home.dayOneTaskVisitEarn, nex: 30, href: "/pages/earn/earn", cat: t.value.home.dayOneCatExplore, color: "var(--v5-quest-ember)", onColor: "var(--v5-on-quest)", eligible: true },
  { id: "visit_store", order: 3, label: t.value.home.dayOneTaskVisitStore, nex: 50, href: "/pages/store/store", cat: t.value.home.dayOneCatExplore, color: "var(--v5-quest-ember)", onColor: "var(--v5-on-quest)", eligible: true },
  { id: "view_product_roi", order: 4, label: t.value.home.dayOneTaskSeeRoi, nex: 100, href: "/pages/store/detail?id=stellarbox-s1", cat: t.value.home.dayOneCatRecommend, color: "var(--v5-brand)", onColor: "var(--v5-on-brand)", eligible: true },
  { id: "setup_profile", order: 5, label: t.value.home.dayOneTaskSetupProfile, nex: 80, href: "/pages/me/profile", cat: t.value.home.dayOneCatIdentity, color: "var(--v5-quest-violet)", onColor: "var(--v5-on-quest)", eligible: true },
  { id: "invite_friend", order: 6, label: t.value.home.dayOneTaskInviteFriend, nex: 200, usdt: 1, href: "/pages/team/team", cat: t.value.home.dayOneCatSocial, color: "var(--v5-quest-ember)", onColor: "var(--v5-on-quest)", eligible: true },
]);
const remoteTasks = computed<QuestTask[]>(() => {
  const palette = [
    { color: "var(--v5-quest-violet)", onColor: "var(--v5-on-quest)" },
    { color: "var(--v5-quest-ember)", onColor: "var(--v5-on-quest)" },
    { color: "var(--v5-brand)", onColor: "var(--v5-on-brand)" },
  ];
  return quest.remoteQuests
    .filter((row) => row.layer === "DAY_ONE"
      && (stakingDisplay.isEnabled("stakingVisible") || !isStakingVisibilityRoute(row.actionRoute)))
    .map((row, index) => ({
      id: row.questCode,
      order: index + 1,
      label: dayOneQuestDisplayName(row, locale.code, t.value),
      nex: null,
      href: row.actionRoute,
      cat: categoryLabel(row.category),
      eligible: row.eligible,
      ...palette[index % palette.length],
    }));
});
const questUnavailable = computed(() => remoteApiEnabled && quest.remoteStatus !== "ready");
const questLoadError = computed(() => remoteApiEnabled && quest.remoteStatus === "error");
const unavailableLabel = computed(() => questLoadError.value
  ? t.value.home.dayOneUnavailable : t.value.home.dayOneLoading);
const tasks = computed<QuestTask[]>(() => selectHomeQuestRows(
  remoteApiEnabled,
  quest.remoteStatus === "ready",
  remoteTasks.value,
  fallbackTasks.value,
));

const total = computed(() => tasks.value.length);
function observationIdentity(task: QuestTask) {
  const row = quest.remoteQuests.find(row => row.layer === "DAY_ONE" && row.questCode === task.id);
  return row ? { scope: remoteAccountScope.snapshot(), questCode: task.id, instanceKey: row.instanceKey } : null;
}
const observationNotices = computed(() => {
  app.accountKey; app.accountBindingEpoch;
  return remoteApiEnabled ? tasks.value.flatMap(task => {
    const identity = observationIdentity(task);
    const reason = identity && isActionable(task) ? dayOneObservationRecovery.notice(identity) : undefined;
    return reason ? [{ task, reason }] : [];
  }) : [];
});
function observationMessage(reason: DayOneObservationReason): string {
  return reason === "onboarding" ? t.value.home.dayOneObservationSetup
    : reason === "terms" ? t.value.home.dayOneObservationTerms : t.value.home.dayOneObservationUnconfirmed;
}
function recoverObservation(task: QuestTask, retryOnly = false): void {
  if (!props.active || !isActionable(task)) return;
  const identity = observationIdentity(task);
  const reason = identity && dayOneObservationRecovery.notice(identity);
  if (!identity || !reason) return;
  dayOneObservationRecovery.retry(identity);
  let web = false;
  // #ifdef H5
  web = true;
  // #endif
  navTo(retryOnly ? task.href : observationRecoveryRoute(reason, web, task.href));
}
const claimState = computed(() => dayOneClaimState(
  quest.remoteQuests, quest.dayOneRequiredTaskCount, quest.dayOneSnapshotStatus, nowTick.value * 1000,
));
watch(() => [expanded.value, props.active, claimState.value.claimCode, claimState.value.empty, quest.dayOneClaiming,
  quest.dayOneClaimError, tasks.value.length, t.value.home.dayOneClaimReward, t.value.home.dayOneClaimUnconfirmed,
  t.value.home.dayOneNoActiveTasks, t.value.home.dayOneFirstDayReward],
  () => emit("content-resize"), { flush: "post", immediate: true });
const completedCount = computed(() => tasks.value.filter(isDone).length);
const progressPct = computed(() => total.value > 0 ? (completedCount.value / total.value) * 100 : 0);
const nexEarned = computed(() => {
  const completed = tasks.value.filter((task) => quest.isComplete(task.id));
  if (remoteApiEnabled && quest.remoteStatus !== "ready") return null;
  if (remoteApiEnabled) return total.value > 0 && completed.length === total.value ? quest.dayOneRewardNex : 0;
  return completed.reduce((sum, task) => sum + (task.nex ?? 0), 0);
});
const nexEarnedText = computed(() => nexEarned.value === null ? "—" : formatAmount(nexEarned.value));
const viewTasksText = computed(() => fmt(t.value.home.dayOneViewTasks, { n: visibility.mask(total.value) }));
const taskCountText = computed(() => questUnavailable.value
  ? "-"
  : fmt(t.value.home.dayOneTaskCount, { n: visibility.mask(total.value) }));
const toggleLabel = computed(() => questLoadError.value
  ? t.value.home.dayOneRetryLoad
  : questUnavailable.value ? t.value.home.dayOneLoading
  : expanded.value ? t.value.home.dayOneHideTasks : viewTasksText.value);
const rewardText = computed(() => {
  if (!remoteApiEnabled) return formatAmount(mockReward);
  if (quest.remoteStatus !== "ready") return "—";
  return quest.dayOneRewardNex > 0 ? formatAmount(quest.dayOneRewardNex) : "—";
});
const dayOneWindow = computed(() => quest.remoteQuests.find((row) => row.layer === "DAY_ONE") ?? null);

const remainingMs = computed(() => remoteApiEnabled
    ? Date.parse(dayOneWindow.value?.eligibleUntil ?? "") - nowTick.value * 1000
    : 18 * 60 * 60 * 1000 + 24 * 60 * 1000 - ((nowTick.value * 1000) % 60_000));
const dayOneExpired = computed(() => remoteApiEnabled && Number.isFinite(remainingMs.value) && remainingMs.value <= 0);
watch(dayOneExpired, () => emit("content-resize"), { flush: "post" });
const remainingLabel = computed(() => {
  const remaining = remainingMs.value;
  if (!Number.isFinite(remaining)) return "—";
  if (remaining <= 0) return t.value.home.dayOneExpired;
  const hours = Math.floor(remaining / 3600_000);
  const minutes = Math.floor((remaining % 3600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

function isDone(task: QuestTask) {
  return remoteApiEnabled ? claimState.value.completedCodes.includes(task.id) : quest.isComplete(task.id);
}

function onClaim() {
  if (!props.active || questUnavailable.value || !claimState.value.claimCode || quest.dayOneClaiming) return;
  void quest.claimDayOne();
}

function isActionable(task: QuestTask) {
  return task.eligible && !dayOneExpired.value && !isDone(task);
}

function onRowTap(task: QuestTask) {
  if (!isActionable(task)) return;
  navTo(task.href);
}

function toggleExpanded() {
  if (questLoadError.value) {
    void quest.refreshRemote();
    return;
  }
  if (questUnavailable.value) return;
  expanded.value = !expanded.value;
}

const progressEntered = ref(false);
watch(inView, value => { if (value) progressEntered.value = true; }, {immediate: true});
const barStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${progressPct.value}%`,
  transform: progressEntered.value ? "scaleX(1)" : "scaleX(0)",
  transformOrigin: "left",
  transition: "transform 1400ms cubic-bezier(.16,1,.3,1)",

  background: "linear-gradient(90deg, var(--v5-brand) 0%, var(--v5-tech-cyan) 100%)",
  borderRadius: "4px",

}));

function rowStyle(task: QuestTask): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: props.missionLayout ? "22px minmax(0, 1fr) 16px" : task.nex === null ? "20px minmax(0, 1fr) 14px" : "20px minmax(0, 1fr) auto 14px",
    gap: props.missionLayout ? "12px" : "10px",
    alignItems: "center",
    padding: "8px 0",
    cursor: isActionable(task) ? "pointer" : "default",
  };
}

function circleStyle(task: QuestTask): CSSProperties {
  const done = isDone(task);
  return {
    width: props.missionLayout ? "22px" : "18px",
    height: props.missionLayout ? "22px" : "18px",
    borderRadius: "50%",
    background: done ? (props.missionLayout ? "var(--v5-brand)" : task.color) : "transparent",
    border: done ? "none" : props.missionLayout ? "1.5px solid var(--v5-ink-4)" : `1px solid color-mix(in srgb, ${task.color} 33%, transparent)`,
    display: "grid",
    placeItems: "center",
  };
}

function labelStyle(task: QuestTask): CSSProperties {
  const done = isDone(task);
  return {
    fontFamily: "var(--font-v5)",
    fontSize: props.missionLayout ? "15px" : "var(--ui-type-list-subtitle)",
    color: done ? (props.missionLayout ? "var(--v5-ink-3)" : "var(--v5-ink-4)") : "var(--v5-ink)",
    fontWeight: 500,
    textDecoration: done && !props.missionLayout ? "line-through" : "none",
  };
}

function catStyle(task: QuestTask): CSSProperties {
  const done = isDone(task);
  if (props.missionLayout) return {font:'400 12px/16px var(--font-v5)', color: task.cat === t.value.home.dayOneCatIdentity ? 'var(--v5-nex-ink)' : task.cat === t.value.home.dayOneCatSocial ? 'var(--v5-success-ink)' : 'var(--v5-warning-ink)'};
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "12px",
    color: done ? "var(--v5-ink-4)" : task.color,
    opacity: done ? 0.5 : 0.8,
    letterSpacing: "0.04em",
  };
}

function rewardStyle(task: QuestTask): CSSProperties {
  const done = isDone(task);
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "12px",
    color: done ? "var(--v5-ink-4)" : "var(--v5-nex)",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
  };
}

const rootStyle = computed<CSSProperties>(() => ({ boxShadow: "var(--nx-glass-edge)",
  position: "relative",
  boxSizing: "border-box",
  height: "auto",
  minHeight: "var(--home-task-card-height, 184px)",
  borderRadius: "var(--nx-glass-radius)",
  background: "var(--nx-glass-fill)",
  overflow: "hidden",
  color: "var(--v5-ink)",
  display: "flex",
  flexDirection: "column",
}));

const toggleStyle: CSSProperties = {
  margin: "14px 16px",
  width: "auto",
  minHeight: "44px",
  borderRadius: "var(--nx-glass-radius)",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
};


</script>

<style scoped>
.newcomer-task__reward-hint { margin-bottom: var(--v5-space-2); font-size: 12px; color: var(--v5-ink-3); }
.newcomer-task__observation { margin-top: var(--v5-space-3); color: var(--v5-ink-2); font-size: var(--ui-type-body); }
.newcomer-task__observation-item { margin-top: var(--v5-space-2); }
.newcomer-task__observation-actions { display: flex; flex-wrap: wrap; gap: var(--v5-space-2); }
.newcomer-task__observation-action { min-height: 44px; display: flex; align-items: center; padding: 0 12px; cursor: pointer; color: var(--v5-ink); }
.newcomer-task__observation-action:focus-visible { outline: 2px solid var(--v5-ink); outline-offset: 2px; }
.newcomer-task__claim {
  margin: var(--v5-space-3) 16px 0;
  padding: var(--v5-space-3);
  border-radius: var(--v5-radius-s);
  text-align: center;
  background: var(--v5-brand);
  color: var(--v5-on-brand);
  cursor: pointer;
}
.newcomer-task__claim[aria-disabled="true"] { opacity: 0.6; }
.newcomer-task__claim-error { margin: var(--v5-space-2) 16px 0; font-size: 12px; color: var(--v5-ink-3); }
.newcomer-task__summary {
  box-sizing: border-box;
  min-height: 112px;
  padding: 14px 16px 0;
}

.newcomer-task__mark {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  place-items: center;
  border-radius: 6px;
  background: var(--v5-brand-soft);
}

.newcomer-task__eyebrow {
  font-family: var(--font-v5);
  font-size: var(--ui-type-list-subtitle);
  font-weight: 500;
  color: var(--v5-ink-2);
  letter-spacing: 0.01em;
}

.newcomer-task__count {
  padding: 2px 6px;
  border-radius: var(--v5-radius-full);
  background: var(--v5-surface-2);
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-size: 12px;
  color: var(--v5-ink-4);
  white-space: nowrap;
}

.newcomer-task__reward {
  display: flex;
  align-items: baseline;
  gap: var(--v5-space-1);
  margin-top: 5px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.newcomer-task__reward-value {
  font-family: var(--font-amount);
  font-size: 34px;
  font-weight: 500;
  color: var(--v5-nex);
  letter-spacing: -0.022em;
}

.newcomer-task__toggle {
  flex: 0 0 44px;
  cursor: pointer;
  transition: opacity 0.15s;
}
/* 《08》§2:展开/收起是这张卡的主要交互,按下去原先零反馈 */
.newcomer-task__toggle:active {
  opacity: 0.7;
}

.newcomer-task--expanded .newcomer-task__toggle {
  margin-top: 14px;
}
.newcomer-task--mission { padding: 18px 16px 6px !important; border-radius: var(--ui-radius-surface); background: var(--v5-surface) !important; box-shadow: inset 0 1px 0 color-mix(in srgb,var(--v5-nex) 70%,transparent) !important; }
.newcomer-task--mission .newcomer-task__eyebrow { font: 600 16px/22px var(--font-v5); color: var(--v5-ink); }
.newcomer-task--mission .newcomer-task__mark { display: none; }
.newcomer-task--mission .newcomer-task__reward-value { font: 500 36px/44px var(--font-amount); font-variant-numeric:tabular-nums; color: var(--v5-nex-ink); }
.newcomer-task--mission .newcomer-task__count { font: 500 12px/16px var(--font-metric); }
.newcomer-task--mission .newcomer-task__reward-hint { background: transparent; padding: 0; font: 400 12px/16px var(--font-v5); }
.newcomer-task--mission .newcomer-task__summary > view:nth-child(3) { margin-top: 10px !important; gap: 0 !important; }
.newcomer-task--mission .newcomer-task__summary > view:nth-child(3) > view { min-height: 52px; border-top: 1px solid var(--v5-border); }
.newcomer-task--mission .newcomer-task__claim { display: flex; margin-top: var(--v5-space-2); background: transparent; padding: 0; }
@media (prefers-reduced-motion: reduce) { .newcomer-task :deep(*) { transition: none !important; animation: none !important; } }
.newcomer-task__segments { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:var(--v5-space-1); margin-top:var(--v5-space-3); }.newcomer-task__segments > view { height:6px; border-radius:3px; background:var(--v5-surface-3); }.newcomer-task__segments > .newcomer-task__segment--done { background:var(--v5-brand); animation:nx-viz-light 320ms cubic-bezier(.2,.8,.2,1) both; }
@media (prefers-reduced-motion:reduce) { .newcomer-task__segments > view { animation:none !important; } }
.newcomer-task--mission .newcomer-task__summary {padding:0;}.newcomer-task--mission .newcomer-task__reward {margin-top:10px;}.newcomer-task--mission .newcomer-task__summary > view:nth-child(3) > view:first-of-type {border-top:0;}

/* Approved growth board geometry and material. */
 .newcomer-task--mission { position:relative; padding:25px 16px 5px !important; box-shadow:var(--v5-glass-shadow) !important; overflow:visible; }
.newcomer-task--mission::before { content:''; position:absolute; inset:0; border-radius:inherit; padding:1.5px; background:conic-gradient(from 200deg,transparent 0 45%,color-mix(in srgb,var(--v5-warning) 85%,transparent) 70%,transparent 92%); -webkit-mask:linear-gradient(var(--v5-ink) 0 0) content-box,linear-gradient(var(--v5-ink) 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; }
.newcomer-task--mission .newcomer-task__reward { margin-top:17px; }
.newcomer-task--mission .newcomer-task__count { background:var(--v5-surface-3); color:var(--v5-ink-2); font:500 12px/16px var(--font-v5); }
.newcomer-task--mission .newcomer-task__unit { font:500 12px/16px var(--font-v5) !important; color:var(--v5-nex-ink) !important; margin-left:6px !important; }
.newcomer-task--mission .newcomer-task__clock > text:first-child { font:400 12px/16px var(--font-v5) !important; color:var(--v5-ink-3) !important; letter-spacing:normal !important; }
.newcomer-task--mission .newcomer-task__clock > text:last-child { font:500 15px/20px var(--font-metric) !important; color:var(--v5-ink) !important; margin-top:0 !important; }
.newcomer-task--mission .newcomer-task__progress-copy { margin-top:8px !important; font:400 12px/16px var(--font-v5) !important; gap:4px; align-items:baseline; }
.newcomer-task--mission .newcomer-task__progress-copy > text { color:var(--v5-ink-3) !important; }
.newcomer-task--mission .newcomer-task__progress-copy > text:last-child { color:var(--v5-nex-ink) !important; white-space:nowrap; }
.newcomer-task--mission .newcomer-task__summary > view:nth-child(3) > view { box-sizing:border-box; min-height:53px; }


.newcomer-task--mission .newcomer-task__count { display:inline-flex; align-items:center; height:24px; min-width:38px; box-sizing:border-box; justify-content:center; padding:0 8px; }
.newcomer-task--mission .newcomer-task__reward { gap:6px; margin-top:17.5px; }
.newcomer-task--mission .newcomer-task__unit { margin-left:0!important; }
.newcomer-task--mission .newcomer-task__top { position:relative; }
.newcomer-task--mission .newcomer-task__clock { position:absolute; right:0; top:12px; transform:translateY(-50%); }
.newcomer-task--mission .newcomer-task__progress-copy { margin-top:9.5px!important; }
.newcomer-task--mission .newcomer-task__summary > view:nth-child(3) > view > view:last-child { display:flex; align-items:center; justify-content:flex-end; }

</style>
