<!--
  DayOneQuestCard — ZONE 1 first-day onboarding quest ("100% faithful v5 design
  draft", exact per-task hex). Ported from mission-control.tsx DayOneQuestCard.
  Reward + countdown header · scroll-grow progress bar · collapsible 6-task list
  (each task taps to its route) · expand/collapse toggle.
-->
<template>
  <view class="day-one-card">
    <view class="day-one-main">
      <!-- Reward + countdown -->
      <view class="day-one-head">
        <view>
          <text class="day-one-title">{{ t.home.dayOneFirstDayReward }}</text>
          <view class="day-one-amount-row">
            <text class="day-one-amount">+{{ reward }}</text>
            <text class="day-one-unit">NEX</text>
          </view>
        </view>
        <view class="day-one-countdown">
          <text class="day-one-countdown-label">{{ t.home.dayOneEndsIn }}</text>
          <text class="day-one-countdown-time">{{ remainingLabel }}</text>
        </view>
      </view>

      <!-- Progress -->
      <view class="day-one-progress">
        <view ref="elRef" class="day-one-progress-track">
          <view class="day-one-progress-fill" :style="barStyle" />
        </view>
        <view class="day-one-progress-meta">
          <text class="day-one-progress-left"><text>{{ completedCount }}</text>/{{ total }} {{ t.home.dayOneDoneSuffix }}</text>
          <text class="day-one-progress-right">+{{ nexEarned }} {{ t.home.dayOneEarnedSuffix }}</text>
        </view>
      </view>

      <!-- Tasks list (collapsible) -->
      <view v-if="expanded" class="day-one-task-list">
        <view
          v-for="task in tasks"
          :key="task.id"
          class="day-one-task-row"
          :class="isDone(task) ? 'day-one-task-row--done' : 'active:scale-[0.98] active:opacity-80'"
          :style="rowStyle(task)"
          @click="onRowTap(task)"
        >
          <view class="day-one-task-index" :class="{ 'day-one-task-index--done': isDone(task) }" :style="taskColorStyle(task)">
            <text class="day-one-task-index-text">{{ task.order }}</text>
          </view>
          <view class="day-one-task-copy">
            <text class="day-one-task-label" :class="{ 'day-one-task-label--done': isDone(task) }">{{ task.label }}</text>
            <text class="day-one-task-cat" :class="{ 'day-one-task-cat--done': isDone(task) }">{{ task.cat }}</text>
          </view>
          <text class="day-one-task-reward" :class="{ 'day-one-task-reward--done': isDone(task) }">+{{ task.nex }} NEX<text v-if="task.usdt" class="day-one-task-usdt">+${{ task.usdt }}</text></text>
          <view>
            <svg v-if="!isDone(task)" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </view>
        </view>
      </view>
    </view>

    <!-- Expand toggle -->
    <view class="day-one-toggle" @click="expanded = !expanded">
      <text class="day-one-toggle-text">{{ expanded ? t.home.dayOneHideTasks : viewTasksText }}</text>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path :d="expanded ? 'M19 15l-7-7-7 7' : 'M5 9l7 7 7-7'" />
      </svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNow } from "@/composables/use-now";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";
import { useQuest, type QuestTaskId } from "@/store/quest";

interface QuestTask {
  id: QuestTaskId;
  order: number;
  label: string;
  nex: number;
  usdt?: number;
  href: string;
  cat: string;
  color: string;
}

const t = useT();
const nowTick = useNow();
const { elRef, inView } = useScrollGrowProgress();
const quest = useQuest();

const expanded = ref(true);
const reward = 500;

const tasks = computed<QuestTask[]>(() => [
  { id: "connect_wallet", order: 1, label: t.value.home.dayOneTaskConnectWallet, nex: 50, href: "/pages/me/wallet-topup", cat: t.value.home.dayOneCatWallet, color: "#9B89E0" },
  { id: "visit_earn", order: 2, label: t.value.home.dayOneTaskVisitEarn, nex: 30, href: "/pages/earn/earn", cat: t.value.home.dayOneCatExplore, color: "#FF6B35" },
  { id: "visit_store", order: 3, label: t.value.home.dayOneTaskVisitStore, nex: 50, href: "/pages/store/store", cat: t.value.home.dayOneCatExplore, color: "#FF6B35" },
  { id: "view_product_roi", order: 4, label: t.value.home.dayOneTaskSeeRoi, nex: 100, href: "/pages/store/detail?id=stellarbox-s1", cat: t.value.home.dayOneCatRecommend, color: "#C6FF3A" },
  { id: "setup_profile", order: 5, label: t.value.home.dayOneTaskSetupProfile, nex: 80, href: "/pages/me/profile", cat: t.value.home.dayOneCatIdentity, color: "#9B89E0" },
  { id: "invite_friend", order: 6, label: t.value.home.dayOneTaskInviteFriend, nex: 200, usdt: 1, href: "/pages/team/team", cat: t.value.home.dayOneCatSocial, color: "#FF6B35" },
]);

const total = computed(() => tasks.value.length);
// Real completion state from the quest store. App.vue's route watcher marks
// visit_earn/visit_store/view_product_roi on navigation; action tasks complete
// at their own action points. Reactive — the card fills in as quests complete.
const completedCount = computed(() => tasks.value.filter((x) => quest.isComplete(x.id)).length);
const progressPct = computed(() => (completedCount.value / total.value) * 100);
const nexEarned = computed(() => tasks.value.filter((x) => quest.isComplete(x.id)).reduce((a, x) => a + x.nex, 0));
const viewTasksText = computed(() => fmt(t.value.home.dayOneViewTasks, { n: total.value }));

const remainingLabel = computed(() => {
  const remainingMs = 18 * 3600_000 + 24 * 60_000 - ((nowTick.value * 1000) % 60_000);
  const h = Math.floor(remainingMs / 3600_000);
  const m = Math.floor((remainingMs % 3600_000) / 60_000);
  const s = Math.floor((remainingMs % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
});

function isDone(task: QuestTask) {
  return quest.isComplete(task.id);
}
function onRowTap(task: QuestTask) {
  if (isDone(task)) return;
  uni.navigateTo({ url: task.href, fail: () => {} });
}

const barStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${inView.value ? progressPct.value : 0}%`,
  transition: inView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));

function rowStyle(task: QuestTask): CSSProperties {
  return {
    "--task-color": task.color,
    cursor: isDone(task) ? "default" : "pointer",
  } as CSSProperties;
}
function taskColorStyle(task: QuestTask): CSSProperties {
  return { "--task-color": task.color } as CSSProperties;
}
</script>

<style scoped>
.day-one-card {
  --v5-surface-bg: var(--v5-surface);
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  color: var(--v5-ink);
  box-shadow: var(--v5-card-shadow-lift);
  background:
    radial-gradient(50% 60% at 0% 0%, var(--v5-brand-soft), transparent 70%),
    var(--v5-surface-bg);
}
html[data-theme="dark"] .day-one-card {
  background:
    radial-gradient(50% 60% at 0% 0%, var(--v5-brand-soft), transparent 70%),
    linear-gradient(180deg, #111317 0%, #15181C 100%);
}
.day-one-main {
  padding: 16px 16px 4px;
}
.day-one-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.day-one-title {
  display: block;
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--v5-ink);
}
.day-one-amount-row {
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.day-one-amount {
  font-family: var(--font-amount);
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -0.024em;
  line-height: 1;
  color: var(--v5-ink);
  font-variant-numeric: tabular-nums;
}
.day-one-unit {
  font-family: var(--font-numbers);
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-brand);
}
.day-one-countdown {
  text-align: right;
}
.day-one-countdown-label {
  display: block;
  font-family: var(--font-numbers);
  font-size: 12px;
  font-weight: 500;
  color: #9B89E0;
  letter-spacing: 0.04em;
}
.day-one-countdown-time {
  display: block;
  margin-top: 4px;
  font-family: var(--font-numbers);
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
  color: #9B89E0;
  font-variant-numeric: tabular-nums;
}
.day-one-progress {
  margin-top: 16px;
}
.day-one-progress-track {
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--v5-surface-2);
  position: relative;
}
.day-one-progress-fill {
  border-radius: 4px;
  background: linear-gradient(90deg, #2F35FF 0%, #126BFF 46%, #18C8FF 100%);
  box-shadow: 0 0 8px rgba(18,107,255,0.42);
}
html[data-theme="dark"] .day-one-progress-fill {
  background: linear-gradient(90deg, var(--v5-brand) 0%, var(--v5-tech-cyan) 100%);
  box-shadow: 0 0 8px rgba(198,255,58,0.55);
}
.day-one-progress-meta {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  font-family: var(--font-numbers);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.day-one-progress-left {
  color: var(--v5-ink);
}
.day-one-progress-right {
  color: var(--v5-brand);
}
.day-one-task-list {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--v5-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.day-one-task-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) max-content 14px;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 8px 8px;
  margin: 0 -8px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--task-color) 10%, transparent);
  transition: transform 0.12s ease, opacity 0.12s ease;
}
.day-one-task-row--done {
  background: transparent;
}
.day-one-task-index {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--task-color) 55%, transparent);
  display: grid;
  place-items: center;
}
.day-one-task-index--done {
  background: var(--task-color);
  border: none;
}
.day-one-task-index--done .day-one-task-index-text {
  color: #0F0F0F;
}
.day-one-task-index-text {
  font-family: var(--font-numbers);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--task-color);
  text-align: center;
}
.day-one-task-copy {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.day-one-task-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: var(--font-v5);
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
  color: var(--v5-ink);
}
.day-one-task-label--done {
  color: var(--v5-ink-4);
  text-decoration: line-through;
}
.day-one-task-cat {
  max-width: 42px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex-shrink: 0;
  font-family: var(--font-numbers);
  font-size: 10.5px;
  line-height: 14px;
  letter-spacing: 0.04em;
  color: var(--task-color);
  opacity: 0.8;
}
.day-one-task-cat--done {
  color: var(--v5-ink-4);
  opacity: 0.5;
}
.day-one-task-reward {
  font-family: var(--font-numbers);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  color: var(--task-color);
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.day-one-task-reward--done {
  color: var(--v5-ink-4);
}
.day-one-task-usdt {
  margin-left: 4px;
  color: inherit;
}
.day-one-toggle {
  margin-top: 14px;
  width: 100%;
  height: 32px;
  border-top: 1px solid var(--v5-border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.day-one-toggle-text {
  font-family: var(--font-v5);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--v5-ink-3);
}

@media (max-width: 390px) {
  .day-one-task-copy {
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
  }
}
</style>
