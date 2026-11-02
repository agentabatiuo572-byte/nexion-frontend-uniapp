<template>
  <view class="phone-compute-status" role="status" aria-live="polite" data-phone-task-status="true">
    <text class="block phone-compute-status__title">{{ copy.title }}</text>
    <text v-if="!nativePhone" class="block">{{ copy.web }}</text>
    <text v-if="loading" class="block">{{ copy.loading }}</text>
    <text v-else-if="failed" class="block">{{ copy.unavailable }}</text>
    <template v-else-if="phone">
      <text v-if="expired" class="block">{{ copy.expired }}</text>
      <text v-else-if="phone.simulationState === 'CLOSING'" class="block">{{ copy.restoring }}</text>
      <text v-else class="block">{{ phone.currentTask?.status === 'RUNNING' ? copy.running : copy.waiting }}</text>
      <text v-if="!expired && phone.simulationState !== 'CLOSING' && phone.phoneValidUntil != null" class="block">{{ copy.validUntil }} {{ visibility.mask(validUntilText) }}</text>
    </template>
    <text v-else class="block">{{ copy.missing }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { projectServerNow, readMonotonicNowMs } from "@/lib/server-deadline-clock";
import { formatDisplayDateTime } from "@/lib/display-date";
import { dateLocale } from "@/i18n/format";
import { hasNativePhoneRuntime } from "@/lib/native-phone-runtime";
import { usePhoneComputeCopy } from "@/i18n/phone-compute";
import { useApp } from "@/store/app";
import { useDataVisibility } from "@/store/data-visibility";

const props = defineProps<{ deviceId: string }>();
const app = useApp();
const copy = usePhoneComputeCopy();
const nativePhone = hasNativePhoneRuntime();
const visibility = useDataVisibility();
const phone = computed(() => app.devices.find(row => row.id === props.deviceId));
const monotonicNow = ref(readMonotonicNowMs());
useVisibleInterval(() => { monotonicNow.value = readMonotonicNowMs(); }, 1000);
const expired = computed(() => phone.value?.simulationState === 'EXPIRED' || (phone.value?.phoneValidUntil != null
  && phone.value.taskServerNow != null && phone.value.taskServerNowReceivedAt != null
  && projectServerNow(phone.value.taskServerNow, phone.value.taskServerNowReceivedAt, monotonicNow.value) >= phone.value.phoneValidUntil));
const validUntilText = computed(() => phone.value?.phoneValidUntil == null ? '' : formatDisplayDateTime(phone.value.phoneValidUntil, dateLocale()));
const loading = computed(() => !app.remoteAssignmentHasSnapshot && ['idle', 'loading'].includes(app.remoteAssignmentStatus));
const failed = computed(() => app.remoteAssignmentStatus === 'error');
</script>

<style scoped>
.phone-compute-status { margin: 0 20px 16px; padding: 12px; border-radius: 12px; background: var(--v5-brand-soft); color: var(--v5-ink-2); font-size: 12px; line-height: 1.55; }
.phone-compute-status__title { margin-bottom: 4px; font-size: 13px; font-weight: 600; color: var(--v5-ink); }
</style>
