<template>
  <AppChassis active="earn">
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/earn/earn" :title="deviceTitle" :subtitle="deviceSubtitle" />

      <DeviceCardPC v-if="device" :device="device" />

      <view v-else class="mx-4" :style="emptyStyle">
        <text class="block" :style="emptyTitleStyle">{{ t.earn.deviceNotFound }}</text>
        <view class="inline-flex items-center justify-center active:scale-[0.98]" :style="backButtonStyle" @click="goEarn">
          <text>{{ t.earn.backToEarn }}</text>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import DeviceCardPC from "@/components/earn/device-card-pc.vue";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";

const app = useApp();
const t = useT();
const id = ref("");

onLoad((options) => {
  const o = (options || {}) as Record<string, string>;
  id.value = o.id ? decodeURIComponent(o.id) : "";
});

const device = computed(() => app.visibleDevices.find((d) => d.id === id.value) ?? null);
const deviceTitle = computed(() => {
  const d = device.value;
  if (!d) return t.value.earn.deviceDetailTitle;
  return d.kind === "phone" ? t.value.earn.yourPhone : d.name;
});
const deviceSubtitle = computed(() => device.value?.gpu ?? "");

function goEarn() {
  uni.reLaunch({ url: "/pages/earn/earn", fail: () => {} });
}

const emptyStyle: CSSProperties = {
  marginTop: "12px",
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface-bg)",
};
const emptyTitleStyle: CSSProperties = {
  fontSize: "14px",
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
  fontSize: "14px",
  fontWeight: 500,
};
</script>
