<template>
  <AppChassis active="earn">
    <view v-if="enabled" class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/devices" :title="downloadTitle" />

      <view class="mx-4" :style="heroStyle" data-proof="compute-share-download-page">
        <text class="block" :style="eyebrowStyle">{{ t.computeShare.downloadEyebrow }}</text>
        <text class="block" :style="headlineStyle">{{ downloadTitle }}</text>
        <text class="block" :style="bodyStyle">{{ downloadGuide }}</text>

        <view :style="urlBoxStyle">
          <text :style="urlLabelStyle">{{ t.computeShare.urlLabel }}</text>
          <text class="block" :style="urlValueStyle">{{ downloadUrl || t.computeShare.urlPending }}</text>
        </view>

        <view class="flex items-center" style="gap: 8px; margin-top: 12px">
          <view :style="downloadButtonStyle" @click="copyDownloadUrl">
            <text>{{ downloadUrl ? t.computeShare.downloadCta : t.computeShare.downloadPending }}</text>
          </view>
          <view :style="devicesButtonStyle" @click="goDevices">
            <text>{{ t.computeShare.goDevicesCta }}</text>
          </view>
        </view>
      </view>

      <view class="mx-4" :style="demoStyle">
        <view class="flex items-start justify-between" style="gap: 12px">
          <view class="min-w-0">
            <text class="block" :style="demoLabelStyle">{{ t.computeShare.demoLabel }}</text>
            <text class="block" :style="demoTitleStyle">{{ t.computeShare.demoTitle }}</text>
            <text class="block" :style="demoBodyStyle">{{ t.computeShare.demoBody }}</text>
          </view>
          <text :style="tierPillStyle">{{ selectedTierLabel }}</text>
        </view>

        <text class="block" :style="modelLabelStyle">{{ t.computeShare.modelLabel }}</text>
        <view class="grid" style="grid-template-columns: 1fr 1fr; gap: 8px">
          <view
            v-for="model in GPU_MODEL_PRESETS"
            :key="model"
            :style="modelButtonStyle(model)"
            @click="selectedModel = model"
          >
            <text>{{ model }}</text>
          </view>
        </view>

        <view class="mt-3" :style="tierSummaryStyle">
          <text>{{ tierSummary }}</text>
        </view>

        <view
          :style="connectButtonStyle"
          :data-disabled="slotsFull"
          data-proof="compute-share-demo-connect"
          @click="connectDemoComputer"
        >
          <text>{{ slotsFull ? t.computeShare.slotsFullCta : t.computeShare.connectCta }}</text>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import { useLocaleStore } from "@/store/locale";
import { MAX_DEVICES } from "@/store/device-types";
import { trialReservesSlotNow } from "@/store/free-trial";
import { toast } from "@/store/ui";
import { matchGpuTier } from "@/lib/gpu-tiers";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const GPU_MODEL_PRESETS = [
  "Intel Iris Xe",
  "NVIDIA RTX 3060",
  "NVIDIA RTX 4070",
  "NVIDIA RTX 4090",
];

const app = useApp();
const cfg = useConfig();
const locale = useLocaleStore();
const t = useT();

const selectedModel = ref(GPU_MODEL_PRESETS[2]);
const enabled = computed(() => cfg.isEnabled("computeShareEnabled"));
const downloadUrl = computed(() => cfg.config.computeShare.downloadUrl.trim());
const downloadTitle = computed(() => {
  const content = cfg.config.computeShare.content;
  const configured = (locale.code === "zh" ? content.zhTitle : content.enTitle).trim();
  return configured || t.value.computeShare.downloadTitle;
});
const downloadGuide = computed(() => {
  const content = cfg.config.computeShare.content;
  const configured = (locale.code === "zh" ? content.zhGuide : content.enGuide).trim();
  return configured || t.value.computeShare.downloadBody;
});
const selectedTier = computed(() => matchGpuTier(selectedModel.value, cfg.config.computeShare.gpuTiers));
const tierLabels = computed(() => ({
  G1: t.value.computeShare.gpuTierG1,
  G2: t.value.computeShare.gpuTierG2,
  G3: t.value.computeShare.gpuTierG3,
  G4: t.value.computeShare.gpuTierG4,
  G5: t.value.computeShare.gpuTierG5,
  G6: t.value.computeShare.gpuTierG6,
}));
const selectedTierLabel = computed(() => tierLabels.value[selectedTier.value.id]);
const trialSlot = computed(() => (trialReservesSlotNow() ? 1 : 0));
const slotsFull = computed(() => app.activeSlotCount + trialSlot.value >= MAX_DEVICES);
const tierSummary = computed(() =>
  fmt(t.value.computeShare.tierSummary, {
    tier: selectedTierLabel.value,
    tops: selectedTier.value.tops,
  }),
);

function guardDisabled() {
  if (enabled.value) return;
  toast.info(t.value.computeShare.disabledToast);
  uni.redirectTo({ url: "/pages/me/devices", fail: () => uni.reLaunch({ url: "/pages/me/devices", fail: () => {} }) });
}

onMounted(guardDisabled);
watch(enabled, guardDisabled);

function copyDownloadUrl() {
  if (!enabled.value) {
    toast.info(t.value.computeShare.disabledToast);
    return;
  }
  if (!downloadUrl.value) {
    toast.info(t.value.computeShare.urlPending);
    return;
  }
  uni.setClipboardData({
    data: downloadUrl.value,
    success: () => toast.success(t.value.computeShare.downloadCopiedToast),
    fail: () => toast.info(downloadUrl.value),
  });
}

function connectDemoComputer() {
  if (!enabled.value) {
    toast.warn(t.value.computeShare.disabledToast);
    return;
  }
  if (slotsFull.value) {
    toast.warn(fmt(t.value.computeShare.slotsFullToast, { max: MAX_DEVICES }));
    return;
  }
  const result = app.connectComputeShareDevice(selectedModel.value, trialSlot.value);
  if (!result.ok) {
    const msg = result.reason === "disabled"
      ? t.value.computeShare.disabledToast
      : fmt(t.value.computeShare.slotsFullToast, { max: MAX_DEVICES });
    toast.warn(msg);
    return;
  }
  toast.success(fmt(t.value.computeShare.connectedToast, { tier: selectedTierLabel.value }));
  uni.navigateTo({ url: "/pages/me/devices", fail: () => {} });
}

function goDevices() {
  uni.navigateTo({ url: "/pages/me/devices", fail: () => {} });
}

const heroStyle: CSSProperties = {
  borderRadius: "16px",
  border: "1px solid color-mix(in srgb, var(--v5-tech-cyan) 26%, transparent)",
  background: "linear-gradient(160deg, color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent), var(--v5-surface) 68%)",
  padding: "16px",
};
const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-tech-cyan)",
  letterSpacing: "0.08em",
};
const headlineStyle: CSSProperties = {
  marginTop: "8px",
  fontFamily: "var(--font-v5)",
  fontSize: "22px",
  lineHeight: 1.12,
  fontWeight: 650,
  color: "var(--v5-ink)",
};
const bodyStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "12.5px",
  lineHeight: 1.45,
  color: "var(--v5-ink-3)",
};
const urlBoxStyle: CSSProperties = {
  marginTop: "14px",
  borderRadius: "10px",
  background: "var(--v5-surface-2)",
  padding: "10px 12px",
};
const urlLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-ink-4)",
};
const urlValueStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  lineHeight: 1.35,
  color: "var(--v5-ink-2)",
  wordBreak: "break-all",
};
const downloadButtonStyle: CSSProperties = {
  flex: 1,
  minHeight: "44px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "var(--v5-tech-cyan)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 650,
};
const devicesButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  fontWeight: 600,
};
const demoStyle: CSSProperties = {
  marginTop: "14px",
  borderRadius: "16px",
  border: "1px solid var(--v5-border)",
  background: "var(--v5-surface)",
  padding: "16px",
};
const demoLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-brand)",
  letterSpacing: "0.06em",
};
const demoTitleStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 650,
  color: "var(--v5-ink)",
};
const demoBodyStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  lineHeight: 1.45,
  color: "var(--v5-ink-3)",
};
const tierPillStyle: CSSProperties = {
  borderRadius: "999px",
  padding: "5px 8px",
  background: "color-mix(in srgb, var(--v5-tech-cyan) 14%, transparent)",
  color: "var(--v5-tech-cyan)",
  fontFamily: "var(--font-v5)",
  fontSize: "11px",
  fontWeight: 650,
  flexShrink: 0,
};
const modelLabelStyle: CSSProperties = {
  marginTop: "14px",
  marginBottom: "8px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-ink-2)",
};
function modelButtonStyle(model: string): CSSProperties {
  const on = selectedModel.value === model;
  return {
    minHeight: "42px",
    borderRadius: "10px",
    border: on ? "1px solid var(--v5-tech-cyan)" : "1px solid var(--v5-border)",
    background: on ? "color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent)" : "var(--v5-surface-2)",
    color: on ? "var(--v5-tech-cyan)" : "var(--v5-ink-2)",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    fontFamily: "var(--font-v5)",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 8px",
  };
}
const tierSummaryStyle: CSSProperties = {
  padding: "9px 10px",
  borderRadius: "10px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-3)",
  fontSize: "11.5px",
  lineHeight: 1.35,
};
const connectButtonStyle = computed<CSSProperties>(() => ({
  marginTop: "12px",
  minHeight: "48px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: slotsFull.value ? "var(--v5-surface-3)" : "var(--v5-brand)",
  color: slotsFull.value ? "var(--v5-ink-4)" : "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 650,
}));
</script>
