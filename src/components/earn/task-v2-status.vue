<template>
  <view v-if="task.protocolVersion === 2 || task.protocolVersion === 3" class="compute-task-status" data-compute-v2-task="true">
    <text class="block" style="font-weight:600">{{ paused ? copy.statuses.PAUSED : task.executionMode === 'SIMULATED' && task.status === 'RUNNING' ? copy.running : task.status ? copy.statuses[task.status] : copy.unknown }}<template v-if="task.settlementStatus && task.settlementStatus !== 'NONE'"> · {{ copy.statuses[task.settlementStatus] }}</template></text>
    <text class="block">{{ task.executionMode === 'SIMULATED' ? copy.duration : copy.estimated }} {{ visibility.mask(`${task.totalSec} ${copy.seconds}`) }}<template v-if="task.executionMode !== 'SIMULATED'"> · {{ copy.actual }} {{ visibility.mask(task.actualDurationSec == null ? copy.unknown : `${task.actualDurationSec} ${copy.seconds}`) }}</template></text>
    <text class="block">{{ task.executionMode === 'SIMULATED' ? copy.reward : copy.frozenReward }} {{ visibility.mask(formatTaskReward(task)) }}</text>
    <text v-if="task.executionMode !== 'SIMULATED' && task.settlementBatchNo" class="block">{{ copy.batch }} #{{ visibility.mask(task.settlementBatchNo) }}</text>
    <text v-if="task.executionMode !== 'SIMULATED' && task.configVersion" class="block">{{ copy.configVersion }} {{ visibility.mask(task.configVersion) }}</text>
  </view>
</template>

<script setup lang="ts">
import type { CurrentTask } from "@/store/types";
import { useComputeV2Copy } from "@/i18n/compute-v2";
import { formatTaskReward } from "@/lib/task-reward-display";
import { useDataVisibility } from "@/store/data-visibility";
defineProps<{ task: CurrentTask; paused?: boolean }>();
const copy = useComputeV2Copy();
const visibility = useDataVisibility();
</script>

<style scoped>
.compute-task-status { margin-top:8px; font-size:12px; line-height:1.6; color:var(--v5-ink-3); overflow-wrap:anywhere; }
</style>
