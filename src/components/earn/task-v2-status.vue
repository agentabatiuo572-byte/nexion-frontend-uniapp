<template>
  <view v-if="task.protocolVersion === 2 || task.protocolVersion === 3" class="compute-task-status" data-compute-v2-task="true">
    <text class="block" style="font-weight:500">{{ paused ? copy.statuses.PAUSED : task.executionMode === 'SIMULATED' && task.status === 'RUNNING' ? copy.running : task.status ? copy.statuses[task.status] : copy.unknown }}<template v-if="task.settlementStatus && task.settlementStatus !== 'NONE'"> · {{ copy.statuses[task.settlementStatus] }}</template></text>
    <view v-if="task.executionMode !== 'SIMULATED' && task.settlementBatchNo" class="compute-task-code"><text class="compute-task-code__label">{{ copy.batch }}</text><NxCodeValue class="compute-task-code__value" fill :value="visibility.mask(task.settlementBatchNo)" :label="copy.batch" :copyable="!visibility.hidden" /></view>
    <text v-if="task.executionMode !== 'SIMULATED' && task.configVersion" class="block">{{ copy.configVersion }} {{ visibility.mask(task.configVersion) }}</text>
  </view>
</template>

<script setup lang="ts">
import type { CurrentTask } from "@/store/types";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import { useComputeV2Copy } from "@/i18n/compute-v2";
import { useDataVisibility } from "@/store/data-visibility";
defineProps<{ task: CurrentTask; paused?: boolean }>();
const copy = useComputeV2Copy();
const visibility = useDataVisibility();
</script>

<style scoped>
.compute-task-status { margin-top:8px; font-size:12px; line-height:1.6; color:var(--v5-ink-3); overflow-wrap:break-word; }
/* Settlement batch number is a long code (03 §3.6.1): label | NxCodeValue, the code gives way first. */
.compute-task-code { display:flex; align-items:center; gap:8px; }
.compute-task-code__label { flex:0 1 auto; min-width:0; }
.compute-task-code__value { color:inherit; font-size:inherit; line-height:inherit; }
</style>
