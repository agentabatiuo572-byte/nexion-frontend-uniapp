<!--
  TaskCenter — ported from Nexion-prototype/app/components/task-center.tsx.
  Single merged view (no tabs): "Upgrade Unlocks" locked-tier teasers
  (VRAM-gated, route to /store) on top, followed by the task History list
  (last 10 completed across devices). The currently-processing section and the
  Current/History tab switcher were removed per product direction.

  Receipt detail: each completed row and its document icon open the ported
  ReceiptModal. Formal remote mode resolves receiptNo through the authenticated
  Java receipt-detail endpoint; prototype mode keeps its local receipt lookup.
-->
<template>
  <view class="nx-earn-task-center">
    <view class="earn-tc__head">
      <text class="earn-tc__title" role="heading" aria-level="2">{{ t.earn.taskCenter }}</text>
      <view class="earn-tc__pulse">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; color: var(--v5-tech-cyan)"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
        <text class="earn-tc__count">{{ activeJobsText }}</text>
        <text>{{ t.earn.jobsLive }}</text>
      </view>
    </view>
    <view class="earn-tc__card">
    <view class="earn-tc__row" role="button" tabindex="0" :aria-expanded="historyOpen ? 'true' : 'false'" @click="historyOpen = !historyOpen" @keydown.enter.stop.prevent="historyOpen = !historyOpen" @keydown.space.stop.prevent="historyOpen = !historyOpen">
      <view class="earn-tc__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg></view>
      <view class="earn-tc__copy"><text class="earn-tc__row-title">{{ t.earn.taskHistoryTitle }}</text><text class="earn-tc__row-sub">{{ historyHintText }}</text></view>
      <view class="earn-tc__arrow" :class="{ 'earn-tc__arrow--open': historyOpen }" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg></view>
    </view>
    <view v-if="historyOpen" class="earn-tc__panel">

    <!-- Upgrade Unlocks -->
    <view v-if="lockedTeasers.length > 0">
      <view class="pt-1 pb-1">
        <view class="flex items-center gap-1.5" style="font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <text>{{ t.earn.upgradeUnlocks }}</text>
        </view>
        <text class="block" style="font-size: 12px; color: var(--v5-ink-4); margin-top: 2px">{{ t.earn.upgradeUnlocksHint }}</text>
      </view>
      <view class="pt-1.5 pb-2 space-y-1">
        <view
          v-for="teaser in lockedTeasers"
          :key="teaser.category"
          class="flex items-center gap-3 py-2 rounded-lg active:opacity-80"
          @click="goStore"
        >
          <view class="rounded-lg grid place-items-center shrink-0" style="width: 32px; height: 32px; background: color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="categoryIconPath(teaser.category)" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block truncate" style="font-size: var(--ui-type-list-subtitle); font-weight: 500; color: var(--v5-ink-2)">{{ teaser.type }}</text>
            <text class="block truncate" style="font-size: 12px; color: var(--v5-ink-4); margin-top: 2px">{{ t.earn.requires }} <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-tech-cyan-ink)">{{ teaser.minVRAM }}GB VRAM</text><template v-if="!remoteApiEnabled"> · {{ teaser.unlockTier }}</template></text>
          </view>
          <view class="text-right shrink-0">
            <view class="flex items-center justify-end gap-0.5" style="font-size: 12px; color: var(--v5-ink-4); margin-top: 4px">
              <text>{{ t.earn.upgradeNow }}</text>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Task History (merged single list) -->
    <view class="pb-2" :style="historyHeadStyle">
      <view class="flex items-center justify-between">
        <text style="font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3)">{{ t.taskHistory.tabHistory }}</text>
        <view class="earn-history-all flex items-center active:opacity-60" style="gap: 2px; padding: 0 0 0 16px; min-height: 44px" role="button" tabindex="0" @click="goReceipts"  @keydown.enter.stop.prevent="goReceipts" @keydown.space.stop.prevent="goReceipts">
          <text style="font-size: 12px; font-weight: 500; color: var(--v5-brand)">{{ t.taskHistory.viewAll }}</text>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>
    <view
      v-if="remoteApiEnabled && app.remoteAssignmentStatus === 'error'"
      class="mb-3 rounded-xl nx-inline-recovery"
      style="padding: 12px; background: var(--v5-danger-soft); color: var(--v5-danger)"
    >
      <view class="nx-inline-recovery__copy">
        <text class="block" style="font-size: 12px; font-weight: 600">{{ t.wallet.assignmentsUnavailableTitle }}</text>
        <text class="block" style="font-size: 12px; margin-top: 4px">{{ t.wallet.assignmentsUnavailableBody }}</text>
      </view>
      <view
        class="nx-inline-recovery__action active:opacity-70"
        style="color: var(--v5-brand)"
        role="button"
        tabindex="0"
        @click="retryAssignments"
      >
        <text>{{ t.ui.retry }}</text>
      </view>
    </view>
    <view
      v-else-if="remoteApiEnabled && (app.remoteAssignmentStatus === 'idle' || (app.remoteAssignmentStatus === 'loading' && !app.remoteAssignmentHasSnapshot))"
      class="pb-4" role="status" aria-live="polite"
    >
      <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.taskHistory.loading }}</text>
    </view>
    <view v-else-if="allRecent.length === 0" class="pb-4">
      <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.home.ledgerEmpty }}</text>
    </view>
    <view v-else class="earn-history-list pb-3 space-y-1.5">
      <view
        v-for="task in allRecent"
        :key="task.id"
        class="earn-history-row active:opacity-80"
        :data-task-id="task.id" style="font-size: 12px; min-height: 44px"
        :role="canOpenTaskReceipt(task) ? 'button' : undefined"
        :tabindex="canOpenTaskReceipt(task) ? 0 : undefined"
        @click.stop="openTaskReceipt(task)"

        @keydown.enter.stop.prevent="openTaskReceipt(task)" @keydown.space.stop.prevent="openTaskReceipt(task)"
      >
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
        <text class="earn-history-description" :title="task.type" style="color: var(--v5-ink-2)">{{ task.type }}</text>
        <text class="earn-history-amount tabular-nums" style="font-family: var(--font-v5)" :style="{ color: task.settlementStatus && task.settlementStatus !== 'POSTED' ? 'var(--v5-warning-ink)' : 'var(--v5-success-ink)' }">{{ visibility.mask(formatTaskReward(task, true)) }}<text v-if="task.settlementStatus" class="block">{{ computeCopy.statuses[task.settlementStatus] }}</text></text>
        <text class="earn-history-time" style="font-size: 12px; color: var(--v5-ink-3)">{{ completedTime(task.completedAt) }}</text>
        <view v-if="canOpenTaskReceipt(task)" class="earn-history-document shrink-0 grid place-items-center" style="width: 22px; height: 22px; border-radius: 6px; color: var(--v5-ink-4)" :title="task.receiptNo ?? task.id" @click.stop="openTaskReceipt(task)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M14 8H8" /><path d="M16 12H8" /><path d="M13 16H8" /></svg>
        </view>
        <view v-else class="earn-history-document shrink-0" style="width: 22px; height: 22px" />
      </view>
    </view>
    <view v-if="selectedTask" style="padding:12px;background:var(--v5-surface-2);border-radius:12px" data-compute-task-detail="true">
      <view class="flex items-center justify-between"><text>{{ computeCopy.details }} #{{ visibility.mask(selectedTask.id) }}</text><view role="button" tabindex="0" @click="selectedTask = null" @keydown.enter.stop.prevent="selectedTask = null" @keydown.space.stop.prevent="selectedTask = null"><text>{{ computeCopy.close }}</text></view></view>
      <TaskV2Status :task="selectedTask" />
      <view v-if="selectedTask.receiptNo && selectedTask.settlementStatus === 'POSTED'" role="button" tabindex="0" @click="openTaskReceipt(selectedTask, true)" @keydown.enter.stop.prevent="openTaskReceipt(selectedTask, true)" @keydown.space.stop.prevent="openTaskReceipt(selectedTask, true)"><text>{{ computeCopy.receipt }} #{{ visibility.mask(selectedTask.receiptNo) }}</text></view>
    </view>
    </view>
    <view v-if="legacySettlementsEnabled" v-show="settlementsAvailable" class="earn-tc__row" role="button" tabindex="0" :aria-expanded="settlementsOpen ? 'true' : 'false'" @click="settlementsOpen = !settlementsOpen" @keydown.enter.stop.prevent="settlementsOpen = !settlementsOpen" @keydown.space.stop.prevent="settlementsOpen = !settlementsOpen">
      <view class="earn-tc__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M8 14h4" /></svg></view>
      <view class="earn-tc__copy"><text class="earn-tc__row-title">{{ computeCopy.batch }}</text><text class="earn-tc__row-sub">{{ t.earn.settlementBatchesHint }}</text></view>
      <view class="earn-tc__arrow" :class="{ 'earn-tc__arrow--open': settlementsOpen }" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg></view>
    </view>
    <!-- Kept mounted so it reads on page show; the row appears only when the server offers settlement batches. -->
    <view v-if="legacySettlementsEnabled" v-show="settlementsAvailable && settlementsOpen" class="earn-tc__panel"><ComputeSettlements @availability="settlementsAvailable = $event" /></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useDataVisibility } from "@/store/data-visibility";
import { formatTaskReward } from "@/lib/task-reward-display";
import { navTo } from "@/lib/route";
import { computed, inject, onUnmounted, ref, watch, type CSSProperties } from "vue";
import { onHide, onShow } from "@/composables/use-tab-page-lifecycle";
import { formatDisplayDateTime } from "@/lib/display-date";
import { dateLocale } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { prepareEarnConfig, useEarnConfig } from "@/store/earn-config";
import type { TaskCategory, CompletedTask } from "@/store/types";
import { taskCenterReceiptKey, useReceipts } from "@/store/receipts";
import type { Receipt } from "@/mock/receipt";
import { remoteApiEnabled, taskAssignmentApi } from "@/api/runtime";
import { useComputeV2Copy } from "@/i18n/compute-v2";
import TaskV2Status from "@/components/earn/task-v2-status.vue";
import ComputeSettlements from "@/components/earn/compute-settlements.vue";

import { toast } from "@/store/ui";

const visibility = useDataVisibility();
const app = useApp();
const t = useT();
const computeCopy = useComputeV2Copy();
const selectedTask = ref<CompletedTask | null>(null);
const historyOpen = ref(false);
const settlementsOpen = ref(false);
const settlementsAvailable = ref(false);
const receipts = remoteApiEnabled ? null : useReceipts();
const openReceipt = inject(taskCenterReceiptKey)!;
let receiptRequestEpoch = 0;
let receiptPageVisible = true;
let receiptPageEpoch = 0;
onShow(() => {
  receiptPageVisible = true;
  receiptPageEpoch += 1;
});
onHide(() => {
  receiptPageVisible = false;
  openReceipt.value = null;
  receiptPageEpoch += 1;
  receiptRequestEpoch += 1;
});
prepareEarnConfig();
const earnConfig = useEarnConfig();
/**
 * The Home overview reports `activeJobs` as `null` when the period has no
 * settled receipts — "no value" — while the fleet snapshot defines the same
 * day's realized total as a genuine 0. When that snapshot proves today
 * realized exactly 0 USDT and 0 NEX, the null job count is the confirmed 0
 * rather than unknown, so the header agrees with the device cards. #128
 */
const activeJobsText = computed(() => {
  if (!remoteApiEnabled) return app.global.activeJobs.toLocaleString();
  const value = app.homeTruth?.onGrid.activeJobs ?? null;
  if (value !== null) return value.toLocaleString();
  const fleet = app.remoteRealizedToday;
  return fleet && fleet.usdt === 0 && fleet.nex === 0 ? "0" : "—";
});
function receiptFor(id: string): Receipt | undefined {
  return receipts?.byId(id);
}

function canOpenTaskReceipt(task: CompletedTask): boolean {
  return remoteApiEnabled ? task.protocolVersion === 2 || !!task.receiptNo : !!receiptFor(task.id);
}

async function openTaskReceipt(task: CompletedTask, receiptOnly = false): Promise<void> {
  if (remoteApiEnabled && task.protocolVersion === 2 && !receiptOnly) {
    if (receiptPageVisible) selectedTask.value = task;
    return;
  }
  if (!remoteApiEnabled) {
    openReceipt.value = receiptFor(task.id) ?? null;
    return;
  }
  if (!task.receiptNo || !receiptPageVisible) return;
  const requestEpoch = ++receiptRequestEpoch;
  const expectedPageEpoch = receiptPageEpoch;
  const expectedAccountKey = app.accountKey;
  const expectedBindingEpoch = app.accountBindingEpoch;
  const isCurrent = () => receiptPageVisible
    && expectedPageEpoch === receiptPageEpoch
    && requestEpoch === receiptRequestEpoch
    && expectedAccountKey === app.accountKey
    && expectedBindingEpoch === app.accountBindingEpoch;
  try {
    const detail = await taskAssignmentApi.receipt(task.receiptNo);
    if (task.protocolVersion === 2 && (detail.taskNo !== task.id || detail.receiptNo !== task.receiptNo)) {
      throw new Error("TASK_RECEIPT_IDENTITY_MISMATCH");
    }
    if (isCurrent()) openReceipt.value = task.protocolVersion === 2 && task.settledAt != null
      ? { ...detail, settledAt: task.settledAt } : detail;
  } catch {
    if (isCurrent()) {
      toast.error(t.value.wallet.receiptsUnavailableTitle, t.value.wallet.receiptsUnavailableBody);
    }
  }
}

watch(() => app.accountBindingEpoch, () => {
  receiptRequestEpoch += 1;
  openReceipt.value = null;
  selectedTask.value = null;
});

onUnmounted(() => {
  receiptPageVisible = false;
  openReceipt.value = null;
  receiptPageEpoch += 1;
  receiptRequestEpoch += 1;
});

// History list: completed tasks across all devices, most-recent first (last 20).
const allRecent = computed(() =>
  app.visibleDevices
    .flatMap((d) => d.recentTasks)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 20),
);
const legacySettlementsEnabled = computed(() => app.remoteComputeProtocolVersion === 2
  || app.devices.some(device => device.currentTask?.protocolVersion === 2
    || device.recentTasks.some(task => task.protocolVersion === 2))
  || app.remotePendingEarned?.some(row => row.taskCount > 0) === true);
watch(allRecent, (tasks) => {
  if (selectedTask.value) selectedTask.value = tasks.find((task) => task.id === selectedTask.value?.id) ?? selectedTask.value;
});

// Cloud Share has no user-owned physical VRAM, but the server routes its
// rented pool as an 8 GB equivalent for task eligibility and claim execution.
const CLOUD_SHARE_ROUTING_VRAM_GB = 8;
const maxVram = computed(() => app.visibleDevices.reduce(
  (m, d) => Math.max(m, d.kind === "cloud-share" ? CLOUD_SHARE_ROUTING_VRAM_GB : d.vramTotal),
  0,
));
const lockedTeasers = computed(() => app.remoteComputeProtocolVersion === 3 ? [] : earnConfig.lockedTeasers(maxVram.value, 3));

const historyHintText = computed(() =>
  t.value.taskHistory.historyHint.replace("{n}", visibility.mask(allRecent.value.length)),
);

// Divider above History only when the Upgrade Unlocks block precedes it.
const historyHeadStyle = computed<CSSProperties>(() => ({
  borderTop:
    lockedTeasers.value.length > 0
      ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)"
      : "none",
}));

const CATEGORY_ICON_PATHS: Record<TaskCategory, string> = {
  IG: "M3 3h18v18H3zM3 16l5-5 4 4 5-5 4 4", // image
  VG: "M14 4v16M10 4v16M4 8h4M4 16h4M16 8h4M16 16h4M4 4h16v16H4z", // film
  LL: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", // message
  FT: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.7-2.7z", // wrench
  EM: "M3 5a9 3 0 0 0 18 0a9 3 0 0 0-18 0M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0", // database
  SP: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3M19 10v2a7 7 0 0 1-14 0v-2M12 19v3", // mic
};
function categoryIconPath(category: TaskCategory): string {
  return CATEGORY_ICON_PATHS[category] ?? CATEGORY_ICON_PATHS.IG;
}

function goStore() {
  navTo("/pages/store/store");
}

function goReceipts() {
  navTo("/pages/me/receipts");
}

function retryAssignments() {
  void app.refreshVisibleTaskAssignments();
}

function completedTime(ts: number): string {
  return formatDisplayDateTime(ts, dateLocale());
}


</script>

<style scoped>
.nx-earn-task-center { margin: 0 16px; color: var(--v5-ink); }
.earn-tc__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0 12px; min-height: 44px; margin: 0 2px 8px; }
.earn-tc__title { font: 600 17px/24px var(--font-v5); color: var(--v5-ink); white-space: nowrap; }
.earn-tc__pulse { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.earn-tc__count { font: 500 12px/16px var(--font-metric); color: var(--v5-tech-cyan-ink); font-variant-numeric: tabular-nums; }
.earn-tc__card { padding: 2px 16px; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); font-size: 12px; }
[data-theme="light"] .earn-tc__card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.earn-tc__row { display: flex; align-items: center; gap: 12px; min-height: 60px; box-sizing: content-box; cursor: pointer; }
.earn-tc__card > .earn-tc__row ~ .earn-tc__row, .earn-tc__panel + .earn-tc__row { border-top: 1px solid var(--v5-border); }
.earn-tc__row:active { opacity: .8; }
.earn-tc__row:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 12px; }
.earn-tc__icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 12px; background: var(--v5-surface-2); color: var(--v5-tech-cyan); }
[data-theme="light"] .earn-tc__icon { background: var(--v5-bg); }
.earn-tc__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.earn-tc__row-title { font: 500 15px/20px var(--font-v5); color: var(--v5-ink); }
.earn-tc__row-sub { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.earn-tc__arrow { display: grid; place-items: center; flex: none; color: var(--v5-ink-4); transition: transform .2s ease; }
.earn-tc__arrow--open { transform: rotate(90deg); }
.earn-tc__panel { padding-bottom: 4px; }
@media (prefers-reduced-motion: reduce) { .earn-tc__arrow { transition: none; } }
.earn-history-row { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto 76px 22px; align-items: center; gap: 6px; }
.earn-history-description { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.earn-history-description :deep(*) { white-space: nowrap; }
.earn-history-amount { min-width: 0; max-width: 120px; text-align: right; overflow-wrap: anywhere; }
.earn-history-time { min-width: 0; white-space: normal; overflow-wrap: anywhere; line-height: 16px; text-align: right; }
.earn-history-document { grid-column: 5; }
</style>
