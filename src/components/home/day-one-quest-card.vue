<!--
  DayOneQuestCard — ZONE 1 first-day onboarding quest ("100% faithful v5 design
  draft", exact per-task hex). Ported from mission-control.tsx DayOneQuestCard.
  Reward + countdown header · scroll-grow progress bar · collapsible 6-task list
  (each task taps to its route) · expand/collapse toggle.
-->
<template>
  <view :style="rootStyle">
    <view :style="accentStyle" />

    <view style="padding: 16px 18px 4px">
      <!-- Reward + countdown -->
      <view style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px">
        <view>
          <text class="block" style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; color: var(--v5-ink-4); letter-spacing: 0.04em">{{ t.home.dayOneFirstDayReward }}</text>
          <view style="margin-top: 4px; display: flex; align-items: baseline; gap: 4px; font-family: var(--font-v5); font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.022em; color: var(--v5-ink); line-height: 1">
            <text style="font-size: 14px; color: var(--v5-ink-4); font-weight: 500">+</text>
            <text style="font-size: 30px">{{ reward }}</text>
            <text style="font-size: 13px; color: var(--v5-brand); font-family: var(--font-jet-mono), ui-monospace, monospace; font-weight: 500; margin-left: 2px">NEX</text>
          </view>
        </view>
        <view style="text-align: right">
          <text class="block" style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; color: var(--v5-ink-4); letter-spacing: 0.04em">{{ t.home.dayOneEndsIn }}</text>
          <text class="block" style="margin-top: 4px; font-family: var(--font-jet-mono), ui-monospace, monospace; font-weight: 500; font-size: 16px; color: #9B89E0; font-variant-numeric: tabular-nums; line-height: 1">{{ remainingLabel }}</text>
        </view>
      </view>

      <!-- Progress -->
      <view style="margin-top: 16px">
        <view ref="elRef" style="height: 8px; border-radius: 4px; overflow: hidden; background: var(--v5-surface-2); position: relative">
          <view :style="barStyle" />
        </view>
        <view style="margin-top: 6px; display: flex; justify-content: space-between; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px">
          <text style="color: var(--v5-ink-4)"><text style="color: var(--v5-ink); font-weight: 500">{{ completedCount }}</text>/{{ total }} {{ t.home.dayOneDoneSuffix }}</text>
          <text style="color: var(--v5-brand); font-variant-numeric: tabular-nums">+{{ nexEarned }} {{ t.home.dayOneEarnedSuffix }}</text>
        </view>
      </view>

      <!-- Tasks list (collapsible) -->
      <view v-if="expanded" style="margin-top: 12px; display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 1px dashed var(--v5-border)">
        <view
          v-for="task in tasks"
          :key="task.id"
          :class="isDone(task) ? '' : 'active:scale-[0.98] active:opacity-80 transition-transform'"
          :style="rowStyle(task)"
          @click="onRowTap(task)"
        >
          <view :style="circleStyle(task)">
            <svg v-if="isDone(task)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0F0F0F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
            <text v-else style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 11px; font-weight: 500" :style="{ color: task.color }">{{ task.order }}</text>
          </view>
          <view style="display: flex; align-items: baseline; gap: 6px; min-width: 0">
            <text class="truncate" :style="labelStyle(task)">{{ task.label }}</text>
            <text :style="catStyle(task)">{{ task.cat }}</text>
          </view>
          <text :style="rewardStyle(task)">+{{ task.nex }} NEX<text v-if="task.usdt" :style="{ color: isDone(task) ? 'var(--v5-ink-4)' : 'var(--v5-brand-2)', marginLeft: '4px' }">+${{ task.usdt }}</text></text>
          <view>
            <svg v-if="!isDone(task)" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </view>
        </view>
      </view>
    </view>

    <!-- Expand toggle -->
    <view :style="toggleStyle" @click="expanded = !expanded">
      <text style="font-family: var(--font-v5); font-size: 11.5px; font-weight: 500; color: var(--v5-ink-3)">{{ expanded ? t.home.dayOneHideTasks : viewTasksText }}</text>
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

interface QuestTask {
  id: string;
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

const expanded = ref(true);
const reward = 500;
const done = ["connect_wallet", "visit_earn", "visit_store"];

const tasks = computed<QuestTask[]>(() => [
  { id: "connect_wallet", order: 1, label: t.value.home.dayOneTaskConnectWallet, nex: 50, href: "/pages/me/wallet-topup", cat: t.value.home.dayOneCatWallet, color: "#9B89E0" },
  { id: "visit_earn", order: 2, label: t.value.home.dayOneTaskVisitEarn, nex: 30, href: "/pages/earn/earn", cat: t.value.home.dayOneCatExplore, color: "#FF6B35" },
  { id: "visit_store", order: 3, label: t.value.home.dayOneTaskVisitStore, nex: 50, href: "/pages/store/store", cat: t.value.home.dayOneCatExplore, color: "#FF6B35" },
  { id: "view_product_roi", order: 4, label: t.value.home.dayOneTaskSeeRoi, nex: 100, href: "/pages/store/detail?id=stellarbox-s1", cat: t.value.home.dayOneCatConvert, color: "#C6FF3A" },
  { id: "setup_profile", order: 5, label: t.value.home.dayOneTaskSetupProfile, nex: 80, href: "/pages/me/profile", cat: t.value.home.dayOneCatIdentity, color: "#9B89E0" },
  { id: "invite_friend", order: 6, label: t.value.home.dayOneTaskInviteFriend, nex: 200, usdt: 1, href: "/pages/team/team", cat: t.value.home.dayOneCatSocial, color: "#FF6B35" },
]);

const total = computed(() => tasks.value.length);
const completedCount = done.length;
const progressPct = computed(() => (completedCount / total.value) * 100);
const nexEarned = computed(() => tasks.value.filter((x) => done.includes(x.id)).reduce((a, x) => a + x.nex, 0));
const viewTasksText = computed(() => fmt(t.value.home.dayOneViewTasks, { n: total.value }));

const remainingLabel = computed(() => {
  const remainingMs = 18 * 3600_000 + 24 * 60_000 - ((nowTick.value * 1000) % 60_000);
  const h = Math.floor(remainingMs / 3600_000);
  const m = Math.floor((remainingMs % 3600_000) / 60_000);
  const s = Math.floor((remainingMs % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
});

function isDone(task: QuestTask) {
  return done.includes(task.id);
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
  background: "linear-gradient(90deg, var(--v5-brand) 0%, var(--v5-tech-cyan) 100%)",
  borderRadius: "4px",
  boxShadow: "0 0 8px rgba(198,255,58,0.55)",
}));

function rowStyle(task: QuestTask): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "20px 1fr auto 14px",
    gap: "10px",
    alignItems: "center",
    padding: "8px 0",
    cursor: isDone(task) ? "default" : "pointer",
  };
}
function circleStyle(task: QuestTask): CSSProperties {
  const d = isDone(task);
  return {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: d ? task.color : "transparent",
    border: d ? "none" : `1px solid ${task.color}55`,
    display: "grid",
    placeItems: "center",
  };
}
function labelStyle(task: QuestTask): CSSProperties {
  const d = isDone(task);
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "13px",
    color: d ? "var(--v5-ink-4)" : "var(--v5-ink)",
    fontWeight: 500,
    textDecoration: d ? "line-through" : "none",
  };
}
function catStyle(task: QuestTask): CSSProperties {
  const d = isDone(task);
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "10.5px",
    color: d ? "var(--v5-ink-4)" : task.color,
    opacity: d ? 0.5 : 0.8,
    letterSpacing: "0.04em",
  };
}
function rewardStyle(task: QuestTask): CSSProperties {
  const d = isDone(task);
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "12px",
    color: d ? "var(--v5-ink-4)" : task.color,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
  };
}

const rootStyle: CSSProperties = {
  marginTop: "12px",
  position: "relative",
  borderRadius: "16px",
  background:
    "radial-gradient(50% 60% at 0% 0%, var(--v5-brand-soft), transparent 70%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  overflow: "hidden",
  color: "var(--v5-ink)",
  boxShadow: "var(--v5-card-shadow-lift)",
};
const accentStyle: CSSProperties = {
  position: "absolute",
  left: "0",
  right: "0",
  top: "0",
  height: "1px",
  background: "linear-gradient(90deg, transparent, var(--v5-brand), transparent)",
  opacity: 0.45,
};
const toggleStyle: CSSProperties = {
  marginTop: "14px",
  width: "100%",
  height: "32px",
  borderTop: "1px solid var(--v5-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
};
</script>
