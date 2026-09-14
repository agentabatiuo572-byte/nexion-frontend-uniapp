<template>
  <AppChassis active="earn">
    <view class="nx-device-detail pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/earn/earn" :title="deviceTitle" :subtitle="deviceSubtitle" />

      <DeviceCardPC
        v-if="device"
        :device="device"
        :expanded="expanded"
        @toggle="expanded = !expanded"
      />

      <!-- A valid deep link starts from an empty remote account snapshot. Keep
           it visibly loading until this account's fleet authority settles. -->
      <view v-else-if="waitingForFleet" class="nx-device-detail__loading mx-4" role="status" aria-live="polite" :style="loadingStyle">
        <view :style="loadingBarStyle" />
        <view :style="loadingBarStyle" />
        <text :style="loadingTextStyle">{{ t.earn.deviceLoading }}</text>
      </view>
      <EmptyState
        v-else-if="fleetFailed"
        class="nx-device-detail__error mx-4"
        kind="recoverable-error"
        :title="t.empty.errorTitle"
        :desc="t.empty.errorDesc"
        :cta-label="t.empty.errorCta"
        emphasis
        @cta="retryFleet"
      />
      <!-- A not-found result is only meaningful after the current fleet is
           ready. This class remains the explicit route-check anchor. -->
      <EmptyState
        v-else-if="showNotFound"
        class="nx-device-detail__empty mx-4"
        kind="recoverable-error"
        :title="t.earn.deviceNotFound"
        :desc="t.empty.errorDesc"
      />
      <!-- back 按钮独立保留:走查脚本 r7-device-detail-runtime.mjs 按 .nx-device-detail__back 定位它 -->
      <view
        v-if="showNotFound"
        class="nx-device-detail__back mx-4 inline-flex items-center justify-center active:scale-[0.98] transition-transform"
        :style="backButtonStyle"
        role="button"
        tabindex="0"
        :aria-label="t.earn.backToEarn"
        @click="goEarn"
        @keydown.enter.prevent="goEarn"
        @keydown.space.prevent="goEarn"
      >
        <text>{{ t.earn.backToEarn }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import EmptyState from "@/components/empty-state.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import DeviceCardPC from "@/components/earn/device-card-pc.vue";
import { navTo } from "@/lib/route";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { deviceName, deviceGpuLabel } from "@/lib/device-copy";
import { remoteApiEnabled } from "@/api/runtime";

const app = useApp();
const t = useT();
const id = ref("");
const loaded = ref(false);
const expanded = ref(true);

onLoad((options) => {
  const rawId = ((options || {}) as Record<string, string>).id ?? "";
  try {
    id.value = decodeURIComponent(rawId);
  } catch {
    id.value = rawId;
  }
  loaded.value = true;
});

const device = computed(
  () => app.visibleDevices.find((item) => item.id === id.value && item.activatedAt !== null) ?? null,
);
const hasDeviceId = computed(() => id.value.trim().length > 0);
const waitingForFleet = computed(() => remoteApiEnabled && hasDeviceId.value
  && loaded.value
  && (app.remoteFleetStatus === "idle" || app.remoteFleetStatus === "loading"));
const fleetFailed = computed(() => remoteApiEnabled && hasDeviceId.value
  && loaded.value
  && app.remoteFleetStatus === "error");
const showNotFound = computed(() => loaded.value && !device.value
  && (!remoteApiEnabled || !hasDeviceId.value || app.remoteFleetStatus === "ready"));
const deviceTitle = computed(() =>
  device.value ? deviceName(t.value, device.value) : t.value.earn.deviceDetailTitle,
);
const deviceSubtitle = computed(() =>
  device.value ? deviceGpuLabel(t.value, device.value) : "",
);

function goEarn() {
  navTo("/earn");
}

function retryFleet() {
  if (!remoteApiEnabled || !hasDeviceId.value) return;
  // The request captures the active account epoch. The store ignores every
  // late response after an account switch, and this page performs no writes.
  const request = app.captureRemoteAccountRequest();
  void app.refreshRemoteFleet(request).catch(() => undefined);
}

const loadingStyle: CSSProperties = {
  marginTop: "12px",
  padding: "24px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
};
const loadingBarStyle: CSSProperties = {
  height: "14px",
  marginBottom: "10px",
  borderRadius: "7px",
  background: "var(--v5-surface-2)",
};
const loadingTextStyle: CSSProperties = {
  display: "block",
  marginTop: "16px",
  fontSize: "13px",
  color: "var(--v5-ink-3)",
};

const emptyStyle: CSSProperties = {
  marginTop: "12px",
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
};
const emptyTitleStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 500,
  color: "var(--v5-ink)",
};
const backButtonStyle: CSSProperties = {
  height: "44px",
  marginTop: "14px",
  padding: "0 18px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontSize: "15px",
  fontWeight: 500,
};
</script>
