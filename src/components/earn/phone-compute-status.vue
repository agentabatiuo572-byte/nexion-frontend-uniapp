<template>
  <view class="phone-compute-status" role="status" aria-live="polite" data-phone-compute-eligibility="true">
    <text class="block phone-compute-status__title">{{ copy.title }}</text>
    <text v-if="!nativePhone" class="block">{{ copy.web }}</text>
    <template v-else>
      <text class="block">{{ copy.engine }} · {{ copy.states[runtime.status] }}</text>
      <text v-if="runtime.status === 'downloading'" class="block">{{ copy.download }} · {{ runtime.downloadPercent }}% · 90.4 MB</text>
      <text v-else-if="runtime.modelSource === 'cache' && runtime.status !== 'error'" class="block">{{ copy.cached }}</text>
      <template v-if="runtime.status === 'error'">
        <text class="block">{{ runtime.modelSource === 'download' ? copy.downloadFailure : copy.engineFailure }}</text>
        <view class="phone-compute-status__retry" role="button" tabindex="0" @click.stop="retryEngine" @keydown.enter.stop.prevent="retryEngine" @keydown.space.stop.prevent="retryEngine">{{ copy.retryEngine }}</view>
      </template>
    </template>
    <text v-if="loading" class="block">{{ copy.loading }}</text>
    <template v-else-if="failed">
      <text class="block">{{ copy.unavailable }}</text>
      <view class="phone-compute-status__retry" role="button" tabindex="0" @click.stop="load" @keydown.enter.stop.prevent="load" @keydown.space.stop.prevent="load">{{ copy.retry }}</view>
    </template>
    <template v-else-if="phone">
      <text v-if="phone.eligible" class="block">{{ copy.ready }}</text>
      <text v-for="reason in phone.blockers" :key="reason" class="block" :data-phone-compute-blocker="reason">{{ copy.blockers[reason] }}</text>
    </template>
    <text v-else class="block">{{ copy.missing }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { apiClient, expectedApiEnvironment, sessionVault } from "@/api/runtime";
import { createPhoneComputeEligibilityApi, type PhoneComputeEligibility } from "@/api/phone-compute-eligibility-api";
import { hasNativePhoneRuntime } from "@/lib/native-phone-runtime";
import { usePhoneComputeCopy } from "@/i18n/phone-compute";
import { useApp } from "@/store/app";
import { phoneComputeRuntime as runtime, retryNativePhoneCompute as retryEngine } from "@/services/phone-compute";

const props = defineProps<{ deviceId: string }>();
const app = useApp();
const copy = usePhoneComputeCopy();
const nativePhone = hasNativePhoneRuntime();
const api = createPhoneComputeEligibilityApi(apiClient, expectedApiEnvironment);
const state = ref<PhoneComputeEligibility | null>(null);
const phone = computed(() => state.value?.devices.find(row => String(row.deviceId) === props.deviceId));
const loading = ref(false);
const failed = ref(false);
let generation = 0;
async function load() {
  const version = ++generation;
  const scope = app.captureRemoteAccountRequest();
  const deviceId = props.deviceId;
  state.value = null;
  failed.value = false;
  loading.value = false;
  if (scope.accountKey !== `user:${sessionVault.read()?.user.userId}`) return;
  loading.value = true;
  const current = () => {
    const latest = app.captureRemoteAccountRequest();
    return version === generation && deviceId === props.deviceId
      && scope.accountKey === latest.accountKey && scope.epoch === latest.epoch;
  };
  try {
    const result = await api.read();
    if (current()) state.value = result;
  } catch {
    if (current()) failed.value = true;
  } finally {
    if (current()) loading.value = false;
  }
}
watch(() => [app.accountKey, props.deviceId], () => { void load(); });
watch(() => runtime.status, status => { if (["running", "error", "paused"].includes(status)) void load(); });
useVisibleInterval(() => { void load(); }, 60_000);
</script>

<style scoped>
.phone-compute-status { margin: 0 20px 16px; padding: 12px; border-radius: 12px; background: var(--v5-brand-soft); color: var(--v5-ink-2); font-size: 12px; line-height: 1.55; }
.phone-compute-status__title { margin-bottom: 4px; font-size: 13px; font-weight: 600; color: var(--v5-ink); }
.phone-compute-status__retry { display: inline-flex; align-items: center; min-height: 44px; color: var(--v5-brand); }
</style>
