<template>
  <view v-if="available" class="compute-settlements" data-compute-settlements="true">
    <view v-if="app.remoteComputeProtocolVersion === 2 || pendingAvailable">
    <text class="block" style="font-weight:600">{{ copy.pending }}</text>
    <template v-if="assignmentsReady && app.remotePendingEarned">
      <text v-for="row in app.remotePendingEarned" :key="row.asset" class="block font-mono-tabular">{{ visibility.mask(formatAmount(row.amount, 6)) }} {{ row.asset === 'NEX' ? 'UVT' : row.asset }} · {{ visibility.mask(row.taskCount) }} {{ copy.tasks }}</text>
    </template>
    <text v-else class="block">{{ copy.unknown }}</text>
    <text class="block" style="color:var(--v5-ink-3);margin-top:4px">{{ copy.pendingHint }}</text>
    </view>
    <text class="block" style="margin-top:16px;font-weight:600">{{ copy.batch }}</text>
    <text v-if="error && !batches.length" class="block">—</text>
    <text v-if="loading" class="block" role="status">{{ copy.loading }}</text>
    <text v-else-if="!error && !batches.length" class="block">{{ copy.empty }}</text>
    <view v-for="batch in batches" :key="batch.batchNo" class="compute-settlements__row" role="button" tabindex="0" @click="openBatch(batch.batchNo)" @keydown.enter.stop.prevent="openBatch(batch.batchNo)" @keydown.space.stop.prevent="openBatch(batch.batchNo)">
      <text class="block">#{{ visibility.mask(batch.batchNo) }} · {{ copy.statuses[batch.status] }}</text>
      <text class="block font-mono-tabular">{{ visibility.mask(formatAmount(batch.amount, 6)) }} {{ batch.asset === 'NEX' ? 'UVT' : batch.asset }} · {{ visibility.mask(batch.taskCount) }} {{ copy.tasks }}</text>
      <text class="block" style="color:var(--v5-ink-3)">{{ copy.window }} {{ date(batch.windowStart) }} – {{ date(batch.windowEnd) }}</text>
    </view>
    <view v-if="nextCursor" role="button" :tabindex="loading ? -1 : 0" :aria-disabled="loading" @click="load(true)" @keydown.enter.stop.prevent="load(true)" @keydown.space.stop.prevent="load(true)" style="padding:12px 0;color:var(--v5-brand)"><text>{{ copy.more }}</text></view>
    <text v-if="detailLoading" class="block" role="status">{{ copy.loading }}</text>
    <text v-if="detailError" class="block" role="alert" style="color:var(--v5-danger)">{{ copy.unavailable }}</text>
    <view v-if="detail" class="compute-settlements__detail">
      <view class="flex items-center justify-between"><text>{{ copy.batch }} #{{ visibility.mask(detail.batchNo) }}</text><view role="button" tabindex="0" @click="detail = null" @keydown.enter.stop.prevent="detail = null" @keydown.space.stop.prevent="detail = null"><text style="color:var(--v5-brand)">{{ copy.close }}</text></view></view>
      <text class="block">{{ copy.statuses[detail.status] }} · {{ visibility.mask(formatAmount(detail.amount, 6)) }} {{ detail.asset === 'NEX' ? 'UVT' : detail.asset }}</text>
      <text class="block">{{ copy.postedAt }} {{ detail.postedAt == null ? copy.unknown : date(detail.postedAt) }}</text>
      <text class="block">{{ copy.accountBatchHint }}</text>
      <view v-for="item in detail.items" :key="item.taskNo" class="compute-settlements__row"><text class="block">#{{ visibility.mask(item.taskNo) }} · {{ item.taskType }}</text><text class="block font-mono-tabular">{{ visibility.mask(formatAmount(item.amount, 6)) }} {{ detail.asset === 'NEX' ? 'UVT' : detail.asset }} · {{ date(item.completedAt) }}</text><text v-if="item.receiptNo" class="block">{{ copy.receipt }} #{{ visibility.mask(item.receiptNo) }}</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { toast } from "@/store/ui";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, onUnmounted, ref, watch } from "vue";
import { onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { taskAssignmentApi, remoteApiEnabled } from "@/api/runtime";
import type { ComputeSettlementBatch, ComputeSettlementDetail } from "@/api/task-assignment-api";
import { useApp } from "@/store/app";
import { useComputeV2Copy } from "@/i18n/compute-v2";
import { useDataVisibility } from "@/store/data-visibility";
import { formatDisplayDateTime } from "@/lib/display-date";
import { dateLocale } from "@/i18n/format";
import { formatAmount } from "@/lib/amount-display";
import { ApiError } from "@/api/errors";
const app = useApp();
const copy = useComputeV2Copy();
const visibility = useDataVisibility();
const batches = ref<ComputeSettlementBatch[]>([]);
const nextCursor = ref<string | null>(null);
const detail = ref<ComputeSettlementDetail | null>(null);
const loading = ref(false), error = ref(false), detailLoading = ref(false), detailError = ref(false);
const historyAvailable = ref(false);
useAutoRecovery({ failed: () => error.value && !loading.value, retry: () => load(false) });
const pendingAvailable = computed(() => app.remotePendingEarned?.some(row => row.taskCount > 0) === true);
// Settlement batches exist only when the server offers them; the Task Center shows its entry row on this signal.
const available = computed(() => remoteApiEnabled && (app.remoteComputeProtocolVersion === 2 || pendingAvailable.value || historyAvailable.value));
const emit = defineEmits<{ (event: "availability", available: boolean): void }>();
watch(available, (value) => emit("availability", value), { immediate: true });
const assignmentsReady = computed(() => app.remoteAssignmentStatus === "ready" || (app.remoteAssignmentStatus === "loading" && app.remoteAssignmentHasSnapshot));
let visible = false, pageEpoch = 0, listEpoch = 0, detailEpoch = 0;
const date = (value: number) => visibility.mask(formatDisplayDateTime(value, dateLocale()));
function scope() {
  const accountKey = app.accountKey, bindingEpoch = app.accountBindingEpoch, visit = pageEpoch;
  return () => visible && accountKey === app.accountKey && bindingEpoch === app.accountBindingEpoch && visit === pageEpoch;
}
async function load(append: boolean) {
  if (!remoteApiEnabled || !visible || loading.value || (append && !nextCursor.value)) return;
  const current = scope(), request = ++listEpoch;
  loading.value = true; error.value = false;
  try {
    const result = await taskAssignmentApi.settlements(append ? nextCursor.value : null);
    if (!current() || request !== listEpoch) return;
    historyAvailable.value = true;
    batches.value = append ? Array.from(new Map([...batches.value, ...result.records].map(row => [row.batchNo, row])).values()) : result.records;
    nextCursor.value = result.nextCursor;
  } catch (cause) {
    if (current() && request === listEpoch) {
      const unavailable = cause instanceof ApiError && cause.kind === 'http' && (cause.status === 404 || cause.status === 501);
      if (!unavailable || app.remoteComputeProtocolVersion === 2) {
        if (append) toast.error(copy.value.unavailable); else error.value = true;
        historyAvailable.value = true;
      }
    }
  }
  finally { if (current() && request === listEpoch) loading.value = false; }
}
async function openBatch(batchNo: string) {
  if (!visible) return;
  const current = scope(), request = ++detailEpoch;
  detail.value = null; detailLoading.value = true; detailError.value = false;
  try {
    const result = await taskAssignmentApi.settlement(batchNo);
    if (current() && request === detailEpoch) detail.value = result;
  } catch { if (current() && request === detailEpoch) detailError.value = true; }
  finally { if (current() && request === detailEpoch) detailLoading.value = false; }
}
function reset() {
  pageEpoch++; listEpoch++; detailEpoch++;
  batches.value = []; nextCursor.value = null; detail.value = null;
  loading.value = false; error.value = false; detailLoading.value = false; detailError.value = false;
  historyAvailable.value = false;
}
onShow(() => { visible = true; pageEpoch++; void load(false); });
onHide(() => { visible = false; reset(); });
onUnmounted(() => { visible = false; reset(); });
watch(() => [app.accountKey, app.accountBindingEpoch], () => { reset(); void load(false); });
watch(() => app.remoteComputeProtocolVersion, () => { reset(); void load(false); });
</script>

<style scoped>
.compute-settlements { padding:16px 0; font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
.compute-settlements__row { padding:10px 0; border-bottom:1px solid var(--v5-border); min-height:44px; }
.compute-settlements__detail { margin-top:12px; padding:12px; background:var(--v5-surface-2); border-radius:12px; }
</style>
