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

      <view v-else-if="loaded" class="nx-device-detail__empty mx-4" :style="emptyStyle">
        <text class="block" :style="emptyTitleStyle">{{ t.earn.deviceNotFound }}</text>
        <view
          class="nx-device-detail__back inline-flex items-center justify-center active:scale-[0.98]"
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
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import DeviceCardPC from "@/components/earn/device-card-pc.vue";
import { navTo } from "@/lib/route";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";

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
const deviceTitle = computed(() => {
  if (!device.value) return t.value.earn.deviceDetailTitle;
  return device.value.kind === "phone" ? t.value.earn.yourPhone : device.value.name;
});
const deviceSubtitle = computed(() => device.value?.gpu ?? "");

function goEarn() {
  navTo("/earn");
}

const emptyStyle: CSSProperties = {
  marginTop: "12px",
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
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
