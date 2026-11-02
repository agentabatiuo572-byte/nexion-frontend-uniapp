<!-- Running tasks on the account's devices, shown above settled rows in the home activity feed. -->
<template>
  <view v-for="row in rows" :key="row.id" class="nx-feed-row nx-feed-row--running" data-home-running-task="true">
    <view class="nx-feed-icon nx-feed-icon--running" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg>
    </view>
    <view class="nx-feed-copy">
      <text class="nx-feed-title">{{ visibility.mask(row.name) }}</text>
      <text class="nx-feed-sub">{{ row.confirming ? computeCopy.confirming : row.simulated && row.status === 'RUNNING' ? computeCopy.running : row.status ? computeCopy.statuses[row.status] : computeCopy.running }}</text>
    </view>
    <view class="nx-feed-figure">
      <text class="nx-feed-pct font-mono-tabular">{{ visibility.mask(row.pct == null ? '—' : `${row.pct}%`) }}</text>
      <text class="nx-feed-est font-mono-tabular">{{ computeCopy.reward }} {{ visibility.mask(row.rewardText) }}</text>
    </view>
    <view class="nx-feed-progress" role="progressbar" :aria-label="t.earn.currentTask" :aria-valuenow="visibility.hidden || row.pct == null ? undefined : row.pct" aria-valuemin="0" aria-valuemax="100">
      <view v-if="!visibility.hidden && row.pct != null" class="nx-feed-progress__fill nx-viz-grow" :style="{ width: `${row.pct}%` }" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useDataVisibility } from "@/store/data-visibility";
import { remoteApiEnabled } from "@/api/runtime";
import { formatTaskReward } from "@/lib/task-reward-display";
import { taskProgressPercent } from "@/lib/task-progress";
import { advanceMonotonicHighWater, projectServerNow, readMonotonicNowMs } from "@/lib/server-deadline-clock";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { useComputeV2Copy } from "@/i18n/compute-v2";

const props = defineProps<{ limit: number }>();
const emit = defineEmits<{ (event: "count", count: number): void }>();
const t = useT();
const app = useApp();
const visibility = useDataVisibility();
const computeCopy = useComputeV2Copy();
const now = ref(Date.now());
const monotonicNow = ref(readMonotonicNowMs());
useVisibleInterval(() => {
  now.value = Date.now();
  monotonicNow.value = advanceMonotonicHighWater(monotonicNow.value, readMonotonicNowMs());
}, 1000);
// Same readiness rule as the home fleet rows: a retained snapshot may show while it refreshes.
const tasksReady = computed(() => !remoteApiEnabled || app.remoteAssignmentHasSnapshot);
const rows = computed(() => !tasksReady.value ? [] : app.visibleDevices.filter(device => device.kind !== "phone").flatMap((device) => {
  const task = device.currentTask;
  if (!task) return device.recoveryPending ? [{ id: `${device.id}:recovery`, name: device.name, rewardText: "—", pct: null, simulated: false, confirming: false, status: "RECOVERING" as const }] : [];
  const taskNow = device.taskServerNow != null && device.taskServerNowReceivedAt != null
    ? projectServerNow(device.taskServerNow, device.taskServerNowReceivedAt, monotonicNow.value) : now.value;
  const pct = taskProgressPercent(task, taskNow, device.interruptedAt);
  const simulated = task.executionMode === "SIMULATED";
  const confirming = simulated && task.status === "RUNNING" && task.completableAt != null && taskNow >= task.completableAt;
  return task.protocolVersion === undefined && (pct === null || pct >= 100) ? []
    : [{ id: `${device.id}:${task.id}`, name: task.type, rewardText: formatTaskReward(task, true), pct, simulated, confirming,
      status: task.protocolVersion ? task.status : undefined }];
}).slice(0, props.limit));
watch(() => rows.value.length, count => emit("count", count), { immediate: true });
</script>

<style scoped>
.nx-feed-row { display:flex;align-items:center;gap:10px;position:relative;padding:14px 2px 18px;border-bottom:1px solid var(--v5-border); }
.nx-feed-icon { color:var(--v5-brand);flex:none; }.nx-feed-copy { flex:1;min-width:0; }.nx-feed-title,.nx-feed-sub,.nx-feed-pct,.nx-feed-est { display:block; }.nx-feed-title { font-size:13px;overflow-wrap:anywhere; }.nx-feed-sub,.nx-feed-est { font-size:12px;color:var(--v5-ink-3); }.nx-feed-figure { text-align:right;flex:none; }.nx-feed-progress { position:absolute;bottom:6px;left:28px;right:2px;height:3px;background:var(--v5-surface-3);border-radius:3px;overflow:hidden; }.nx-feed-progress__fill { height:100%;background:var(--v5-brand); }
</style>
