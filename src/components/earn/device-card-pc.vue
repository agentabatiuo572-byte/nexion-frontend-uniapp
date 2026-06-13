<!--
  DeviceCardPC — ported from Nexion-prototype/app/components/device-card-pc.tsx.
  A single device card on /earn. Sections (conditional on kind + state):
    header (icon · name · gpu · status pill · lifecycle chip) →
    phone states (reconnecting / paused-no-charger / paused-no-network /
      waiting / current task with progress bar) →
    phone background-mode toggles (battery + network demo pills) →
    phone locked-tasks loss-ad →
    dual-currency earnings (today USDT + NEX, est this hour).
  Long-press (480ms) opens a quick menu (Stats / Trade-in). framer-motion
  progress bar → CSS width transition; sub-blocks inlined (each small).

  TickerNumber (source) → plain reactive values (interval re-render ramps them;
  uni has no tween component). Long-press uses touchstart/touchend (uni has no
  pointer events). onPressStart/End also clear on touchcancel.
-->
<template>
  <view class="mx-4 rounded-2xl overflow-hidden select-none" :style="cardStyle" @touchstart="onPressStart" @touchend="onPressEnd" @touchcancel="onPressEnd">
    <!-- Long-press quick menu -->
    <view v-if="menuOpen" class="absolute inset-0 flex items-end" style="z-index: 70; background: rgba(0,0,0,0.55)" @click="menuOpen = false">
      <view class="w-full rounded-t-2xl p-3" style="background: var(--v5-surface); border-top: 1px solid var(--v5-border)" @click.stop>
        <view class="mx-auto mb-2" style="width: 40px; height: 4px; border-radius: 3px; background: var(--v5-border-strong)" />
        <text class="block px-2 py-1.5 truncate font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ device.name }}</text>
        <view class="space-y-1">
          <view class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg active:opacity-70" @click="goStatsMenu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
            <text style="font-size: 13.5px; color: var(--v5-ink)">{{ t.earn.quickMenu.stats }}</text>
          </view>
          <view v-if="degradable" class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg active:opacity-70" @click="goTradeinMenu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            <text style="font-size: 13.5px; color: var(--v5-ink)">{{ t.earn.quickMenu.tradein }}</text>
          </view>
        </view>
        <view class="mt-2 w-full grid place-items-center" style="height: 40px; border-radius: 999px; background: var(--v5-surface-2)" @click="menuOpen = false">
          <text style="font-size: 12.5px; color: var(--v5-ink-2)">{{ t.earn.quickMenu.cancel }}</text>
        </view>
      </view>
    </view>

    <!-- Header -->
    <view class="flex items-start justify-between" style="padding: 16px 20px 12px">
      <view class="flex items-center gap-3">
        <view class="rounded-lg grid place-items-center" style="width: 36px; height: 36px; background: var(--v5-surface-2)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="kindIconPath" /></svg>
        </view>
        <view>
          <text class="block" style="font-size: 14px; font-weight: 600; color: var(--v5-ink)">{{ device.name }}</text>
          <text class="block" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ device.gpu }}<text v-if="device.location"><text style="color: var(--v5-ink-4); margin: 0 6px">·</text>{{ device.location }}</text></text>
        </view>
      </view>
      <view class="flex flex-col items-end gap-1">
        <view class="flex items-center gap-1.5">
          <view :style="{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor, boxShadow: statusGlow ? `0 0 6px ${statusColor}` : 'none' }" />
          <text style="font-size: 11.5px" :style="{ color: statusColor }">{{ statusLabel }}</text>
        </view>
        <!-- Lifecycle chip -->
        <view v-if="degradable && lifecycle" class="inline-flex items-center gap-1 active:opacity-70" :style="chipStyle" @click="goDevices">
          <text>{{ (lifecycle.efficiency * 100).toFixed(0) }}%</text>
          <text style="opacity: 0.65">·</text>
          <text style="opacity: 0.9">{{ monthsLabel }}</text>
        </view>
      </view>
    </view>

    <!-- Phone: reconnecting -->
    <view v-if="reconnecting && device.kind === 'phone'" style="padding: 0 20px 16px">
      <text class="block mb-2" :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      <view class="rounded-xl p-3" :style="warnBoxStyle">
        <view class="flex items-start gap-2.5">
          <view class="rounded-lg grid place-items-center shrink-0" :style="warnIconStyle">
            <svg class="nx-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" style="font-size: 12.5px; font-weight: 600; color: var(--v5-ink); line-height: 1.2">{{ t.earn.reconnecting }}</text>
            <text class="block" style="font-size: 11px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.35">{{ reconnectHoldText }}</text>
          </view>
        </view>
        <text v-if="device.currentTask" class="block truncate tabular-nums" style="margin-top: 8px; padding-left: 42px; font-size: 11px; color: var(--v5-ink-4); font-family: var(--font-v5)">#{{ device.currentTask.id }} · {{ device.currentTask.model }}</text>
      </view>
    </view>

    <!-- Phone: paused (no task) -->
    <view v-else-if="!task && device.kind === 'phone' && device.pausedReason" style="padding: 0 20px 16px">
      <text class="block mb-2" :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      <view class="rounded-xl p-3 flex items-start gap-2.5" :style="warnBoxStyle">
        <view class="rounded-lg grid place-items-center shrink-0" :style="warnIconStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="pausedIconPath" /></svg>
        </view>
        <view class="flex-1 min-w-0">
          <text class="block" style="font-size: 12.5px; font-weight: 600; color: var(--v5-ink); line-height: 1.2">{{ pausedTitle }}</text>
          <text class="block" style="font-size: 11px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.35">{{ pausedHint }}</text>
        </view>
      </view>
    </view>

    <!-- Phone: waiting placeholder -->
    <view v-else-if="!task && device.kind === 'phone' && !device.pausedReason" style="padding: 0 20px 16px">
      <text class="block mb-2" :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      <view class="flex items-center gap-2" style="font-size: 12.5px; color: color-mix(in srgb, var(--v5-ink) 85%, transparent)">
        <svg class="nx-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        <text>{{ t.earn.phoneWaitingTask }}</text>
      </view>
      <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 4px">{{ t.earn.phoneWaitingHint }}</text>
    </view>

    <!-- Current task (non-reconnecting) -->
    <view v-if="task && !reconnecting" style="padding: 0 20px 16px">
      <text class="block mb-2" :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      <text class="block" style="font-size: 13.5px; font-weight: 500; color: color-mix(in srgb, var(--v5-ink) 95%, transparent); line-height: 1.2">{{ task.model }}<text style="color: var(--v5-ink-4); margin: 0 6px">·</text>{{ task.type }}</text>
      <view class="mt-0.5 flex items-center gap-1.5 flex-wrap" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-brand)">#{{ task.id }}</text>
        <text style="color: var(--v5-ink-4)">·</text>
        <text style="color: color-mix(in srgb, var(--v5-ink) 80%, transparent)">{{ task.client }}</text>
        <text style="color: var(--v5-ink-4)">·</text>
        <text>{{ task.location }}</text>
      </view>
      <view class="mt-3 flex items-center gap-3">
        <view class="flex-1 h-1 rounded-full overflow-hidden" style="background: var(--v5-surface-2)">
          <view class="h-full" :style="progressBarStyle" />
        </view>
        <text class="tabular-nums text-right" style="font-family: var(--font-v5); font-size: 11.5px; color: color-mix(in srgb, var(--v5-ink) 80%, transparent); width: 48px">{{ progressPct }}%</text>
      </view>
      <view class="mt-1.5 flex items-center justify-between" style="font-size: 12px; color: var(--v5-ink-3)">
        <text>~{{ elapsedRemaining }} {{ t.earn.remaining }}</text>
        <text style="color: var(--v5-brand)">{{ t.earn.reward }} +${{ task.reward.toFixed(3) }}</text>
      </view>
    </view>

    <!-- Phone: background mode toggles -->
    <view v-if="device.kind === 'phone'" style="padding: 0 20px 12px">
      <view class="flex items-center gap-1.5 mb-2">
        <text style="font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3)">{{ t.earn.phoneSettingsTitle }}</text>
        <view class="grid place-items-center rounded-full active:opacity-60" style="width: 20px; height: 20px" @click="showHelp = !showHelp">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
        </view>
      </view>
      <view v-if="showHelp" class="mb-2.5 rounded-lg px-3 py-2" style="background: var(--v5-surface-2)"><text style="font-size: 11px; color: var(--v5-ink-2); line-height: 1.35">{{ t.earn.phoneRequirementsHint }}</text></view>
      <view class="flex items-center gap-1.5 mb-2.5">
        <view class="flex items-center gap-1 active:opacity-80" :style="togglePillStyle(isCharging)" @click="toggleCharger">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="isCharging ? 'var(--v5-brand)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="isCharging" d="m11 7-3 5h4l-3 5" /><rect x="1" y="6" width="16" height="12" rx="2" /><path d="M22 11v2" /></svg>
          <text class="font-mono-tabular tabular-nums" :style="{ color: isCharging ? 'var(--v5-brand)' : 'var(--v5-ink-3)' }">{{ device.batteryLevel ?? 0 }}%</text>
        </view>
        <view class="flex items-center gap-1 active:opacity-80" :style="togglePillStyle(isOnline)" @click="toggleNetwork">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="isOnline ? 'var(--v5-brand)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="isOnline" d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 20 0M12 20h.01" /><path v-else d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M1.42 1.42l21.16 21.16" /></svg>
          <text :style="{ color: isOnline ? 'var(--v5-brand)' : 'var(--v5-ink-3)' }">{{ isOnline ? t.earn.phoneNetOnline : t.earn.phoneNetOffline }}</text>
        </view>
      </view>
    </view>

    <!-- Phone: locked-tasks loss-ad -->
    <view v-if="device.kind === 'phone' && phoneLockedVisible" style="padding: 12px 20px 4px">
      <view class="flex items-center gap-1.5 mb-1.5" style="font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-4)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        <text>{{ t.earn.lockedTasksTitle }}</text>
      </view>
      <view class="flex items-baseline gap-1.5 mb-2.5">
        <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 20px; font-weight: 600; color: var(--v5-brand-2); line-height: 1">−${{ lockedTotalDaily }}</text>
        <text style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.earn.lockedMissedDaily }}</text>
      </view>
      <view class="space-y-1.5">
        <view v-for="(it, i) in LOCKED_ITEMS" :key="i" class="flex items-center justify-between" style="font-size: 11.5px; color: var(--v5-ink-2)">
          <view class="flex items-center gap-1.5 min-w-0">
            <svg class="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <text class="truncate">{{ it.model }}</text>
          </view>
          <view class="flex items-center gap-2 shrink-0 ml-2">
            <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 13.5px; color: var(--v5-brand); font-weight: 600; line-height: 1">+${{ it.daily }}<text style="font-size: 10.5px; color: var(--v5-ink-3); font-weight: 400; margin-left: 2px">/d</text></text>
            <text class="tabular-nums text-right" style="font-size: 10.5px; color: var(--v5-ink-4); font-family: var(--font-v5); width: 40px">{{ it.vram }}</text>
          </view>
        </view>
      </view>
      <view class="mt-3 w-full grid place-items-center active:scale-[0.98]" :style="unlockCtaStyle" @click="goUnlock">
        <text :style="unlockCtaLabelStyle">{{ unlockText }}</text>
      </view>
    </view>

    <!-- Earnings — dual currency -->
    <view style="padding: 16px 20px 20px; border-top: 1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)">
      <view class="flex items-end justify-between">
        <view>
          <text class="block" :style="sectionLabelStyle">{{ t.earn.todayEarnings }}</text>
          <text class="block tabular-nums" style="font-family: var(--font-v5); margin-top: 4px; font-size: 30px; line-height: 1; font-weight: 600; color: var(--v5-brand); letter-spacing: -0.014em">${{ device.todayEarnings.toFixed(3) }}</text>
          <view class="font-mono-tabular mt-1 flex items-center gap-1 tabular-nums" style="font-size: 12px; color: var(--v5-tech-cyan); font-weight: 600">
            <text style="font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: color-mix(in srgb, var(--v5-tech-cyan) 75%, transparent)">+</text>
            <text>{{ device.todayEarningsNEX.toFixed(1) }} NEX</text>
          </view>
        </view>
        <view class="text-right">
          <text class="block" :style="sectionLabelStyle">{{ t.earn.estThisHour }}</text>
          <text class="block tabular-nums" style="font-family: var(--font-v5); margin-top: 4px; font-size: 18px; line-height: 1; font-weight: 600; color: color-mix(in srgb, var(--v5-ink) 95%, transparent)">+${{ (device.baseRate / 24).toFixed(2) }}</text>
          <text class="block font-mono-tabular tabular-nums" style="margin-top: 4px; font-size: 11px; color: color-mix(in srgb, var(--v5-tech-cyan) 85%, transparent)">+{{ (device.baseRateNEX / 24).toFixed(1) }} NEX</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { derivePromoUpgrade } from "@/store/device-types";
import type { Device, DeviceKind } from "@/store/types";
import { getLifecycleSummary, isDegradable } from "@/store/device-lifecycle";
import { interruptInfo, INTERRUPT_MAX_RETRIES } from "@/store/interrupt";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const props = defineProps<{ device: Device }>();
const app = useApp();
const t = useT();

// 1s re-render so progress + countdown tick.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const KIND_ICON_PATHS: Record<DeviceKind, string> = {
  phone: "M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 18h.01",
  "stellarbox-s1": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "stellarbox-pro": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "stellarrack-p1": "M5 4h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z",
  "cloud-share": "M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3",
};
const kindIconPath = computed(() => KIND_ICON_PATHS[props.device.kind] ?? KIND_ICON_PATHS.phone);

const task = computed(() => props.device.currentTask);
const reconnecting = computed(() => props.device.kind === "phone" && props.device.interruptedAt != null);
const elapsedRatio = computed(() => {
  const tk = task.value;
  if (!tk) return 0;
  return Math.min(1, (now.value - tk.startedAt) / 1000 / tk.totalSec);
});
const progressPct = computed(() => Math.round(elapsedRatio.value * 100));

const idleGated = computed(
  () => props.device.kind === "phone" && !!props.device.pausedReason && !reconnecting.value && !task.value,
);

const statusLabel = computed(() => {
  if (reconnecting.value) return t.value.earn.reconnecting;
  if (idleGated.value) return t.value.earn.idle;
  return t.value.earn.online;
});
const statusColor = computed(() => {
  if (reconnecting.value) return "var(--v5-warning)";
  if (idleGated.value) return "var(--v5-ink-3)";
  return "var(--v5-brand)";
});
const statusGlow = computed(() => !reconnecting.value && !idleGated.value);

const elapsedRemaining = computed(() => {
  const tk = task.value;
  if (!tk) return "0m 00s";
  const elapsed = Math.floor((now.value - tk.startedAt) / 1000);
  const remaining = Math.max(0, tk.totalSec - elapsed);
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  return `${min}m ${String(sec).padStart(2, "0")}s`;
});

// Reconnecting hold copy
const reconnectHoldText = computed(() => {
  const at = props.device.interruptedAt;
  if (at == null) return "";
  const info = interruptInfo(at, now.value);
  return fmt(t.value.earn.reconnectHold, { n: info.retries, max: INTERRUPT_MAX_RETRIES, s: info.remainingSec });
});

// Paused block
const pausedIconPath = computed(() =>
  props.device.pausedReason === "no-network"
    ? "M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M8.5 16.5a5 5 0 0 1 7 0M12 20h.01M1.42 1.42l21.16 21.16"
    : "M22 11v2M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2M12 18h.01M9 22h6",
);
const pausedTitle = computed(() =>
  props.device.pausedReason === "no-network" ? t.value.earn.phonePausedNoNetwork : t.value.earn.phonePausedNoCharger,
);
const pausedHint = computed(() =>
  props.device.pausedReason === "no-network" ? t.value.earn.phonePausedNoNetworkHint : t.value.earn.phonePausedNoChargerHint,
);

// Background-mode toggles
const showHelp = ref(false);
const isCharging = computed(() => props.device.isCharging !== false);
const isOnline = computed(() => props.device.isWifiConnected !== false);
function toggleCharger() {
  app.setPhoneRuntime(props.device.id, { isCharging: !isCharging.value });
}
function toggleNetwork() {
  app.setPhoneRuntime(props.device.id, { isWifiConnected: !isOnline.value });
}

// Phone locked-tasks loss-ad
const promo = computed(() => derivePromoUpgrade(app.devices));
const phoneLockedVisible = computed(() => promo.value.baseKind === "phone");
const LOCKED_ITEMS: { model: string; daily: number; vram: string }[] = [
  { model: "Llama 70B inference", daily: 110, vram: "16 GB" },
  { model: "Flux.1 [dev] HD", daily: 38, vram: "12 GB" },
  { model: "SDXL Turbo bulk", daily: 9, vram: "8 GB" },
];
const lockedTotalDaily = computed(() => LOCKED_ITEMS.reduce((s, it) => s + it.daily, 0));
const unlockText = computed(() => t.value.earn.unlockNMoreTasks.replace("{n}", "142"));
function goUnlock() {
  uni.navigateTo({ url: `/pages/store/detail?id=${promo.value.targetKind}`, fail: () => {} });
}

// Lifecycle chip
const degradable = computed(() => isDegradable(props.device.kind));
const lifecycle = computed(() => {
  if (!degradable.value) return null;
  const s = getLifecycleSummary(props.device, now.value);
  return s.isDegradable ? s : null;
});
const chipColor = computed(() => {
  const s = lifecycle.value;
  if (!s) return "var(--v5-tech-cyan)";
  return s.efficiency >= 0.85 ? "var(--v5-tech-cyan)" : s.efficiency >= 0.65 ? "var(--v5-warning)" : "var(--v5-brand-2)";
});
const monthsLabel = computed(() => {
  const s = lifecycle.value;
  if (!s) return "";
  return s.monthsOwned < 1 ? `${Math.floor(s.monthsOwned * 30)}d` : `${s.monthsOwned.toFixed(1)}mo`;
});

// Long-press quick menu
const menuOpen = ref(false);
let longPress: ReturnType<typeof setTimeout> | null = null;
function onPressStart() {
  if (longPress) clearTimeout(longPress);
  longPress = setTimeout(() => {
    menuOpen.value = true;
  }, 480);
}
function onPressEnd() {
  if (longPress) {
    clearTimeout(longPress);
    longPress = null;
  }
}
function goStatsMenu() {
  menuOpen.value = false;
  // Source routes to /earn (a detailed-stats view); we're already on earn, so
  // close the menu (the dedicated stats page isn't a separate route in uni yet).
}
function goTradeinMenu() {
  menuOpen.value = false;
  uni.navigateTo({ url: "/pages/me/devices", fail: () => {} });
}
function goDevices() {
  uni.navigateTo({ url: "/pages/me/devices", fail: () => {} });
}

// ── styles ──
const cardStyle: CSSProperties = {
  position: "relative",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const sectionLabelStyle: CSSProperties = {
  fontSize: "11.5px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--v5-ink-3)",
};
const warnBoxStyle: CSSProperties = {
  background: "color-mix(in oklab, var(--v5-warning) 8%, transparent)",
  border: "1px solid color-mix(in oklab, var(--v5-warning) 24%, transparent)",
};
const warnIconStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  background: "color-mix(in oklab, var(--v5-warning) 18%, transparent)",
  color: "var(--v5-warning)",
};
const chipStyle = computed<CSSProperties>(() => ({
  padding: "2px 6px",
  borderRadius: "4px",
  fontSize: "10.5px",
  fontFamily: "var(--font-v5)",
  background: `color-mix(in srgb, ${chipColor.value} 12%, transparent)`,
  color: chipColor.value,
}));
const progressBarStyle = computed<CSSProperties>(() => ({
  width: `${progressPct.value}%`,
  background: "color-mix(in srgb, var(--v5-brand) 40%, transparent)",
  transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
}));
function togglePillStyle(on: boolean): CSSProperties {
  return {
    height: "28px",
    padding: "0 8px",
    borderRadius: "999px",
    fontSize: "10.5px",
    fontWeight: 500,
    background: on ? "color-mix(in oklab, var(--v5-brand) 14%, transparent)" : "var(--v5-surface-2)",
    border: "1px solid var(--v5-border)",
  };
}
const unlockCtaStyle: CSSProperties = {
  height: "48px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, var(--v5-tech-cyan), var(--v5-brand))",
};
const unlockCtaLabelStyle: CSSProperties = {
  color: "var(--v5-on-brand)",
  fontSize: "13.5px",
  fontWeight: 600,
};
</script>

<style scoped>
.nx-spin {
  animation: spin 1s linear infinite;
}
</style>
