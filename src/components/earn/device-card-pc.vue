<!--
  DeviceCardPC — ported from Nexion-prototype/app/components/device-card-pc.tsx.
  A single device card on /earn. Sections (conditional on kind + state):
    header (icon · name · gpu · status pill) →
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
    <!-- Long-press quick menu (full-viewport bottom sheet) -->
    <view v-if="menuOpen" class="flex items-end" style="position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.55)" @click.stop="menuOpen = false">
      <view class="w-full rounded-t-2xl p-3" style="background: var(--v5-surface-bg); border-top: 1px solid var(--v5-border)" @click.stop>
        <view class="mx-auto mb-2" style="width: 40px; height: 4px; border-radius: 3px; background: var(--v5-border-strong)" />
        <text class="block px-2 py-1.5 truncate font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ device.name }}</text>
        <view class="space-y-1">
          <view class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg active:opacity-70" @click.stop="goStatsMenu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
            <text style="font-size: 13.5px; color: var(--v5-ink)">{{ t.earn.quickMenu.stats }}</text>
          </view>
          <view v-if="degradable" class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg active:opacity-70" @click.stop="goTradeinMenu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            <text style="font-size: 13.5px; color: var(--v5-ink)">{{ t.earn.quickMenu.tradein }}</text>
          </view>
        </view>
        <view class="mt-2 w-full grid place-items-center" style="height: 40px; border-radius: 999px; background: var(--v5-surface-2)" @click.stop="menuOpen = false">
          <text style="font-size: 12.5px; color: var(--v5-ink-2)">{{ t.earn.quickMenu.cancel }}</text>
        </view>
      </view>
    </view>

    <!-- Header (always visible; details stay expanded) -->
    <view class="flex items-start justify-between" style="padding: 20px 20px 18px">
      <view class="flex items-start min-w-0" style="flex: 1; gap: 14px">
        <view v-if="deviceArt" class="relative shrink-0" :style="deviceArtWrapStyle">
          <image :src="deviceArt" mode="aspectFit" :style="deviceArtStyle" />
          <view v-if="deviceRowOnline" :style="deviceArtDotStyle" />
        </view>
        <view v-else class="grid place-items-center shrink-0" style="width: 36px; height: 36px; border-radius: 10px; background: var(--v5-surface-2)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="kindIconPath" /></svg>
        </view>
        <view class="min-w-0" style="flex: 1">
          <text class="block truncate" style="font-size: 16px; font-weight: 600; color: var(--v5-ink); line-height: 23px">{{ displayDeviceName }}</text>
          <text class="block truncate" style="font-size: 12.5px; color: var(--v5-ink-3); margin-top: 4px; white-space: nowrap">{{ device.gpu }}</text>
        </view>
      </view>
      <view class="shrink-0">
        <view class="grid place-items-center shrink-0" style="width: 48px; height: 24px; border-radius: 999px; background: var(--v5-brand-soft)">
          <text style="font-size: 10.5px; font-weight: 500" :style="{ color: statusColor }">{{ statusLabel }}</text>
        </view>
      </view>
    </view>

    <!-- Detail body -->
    <view>
      <view :style="cardDividerStyle" />

    <!-- Phone: live hashpower (effective vs calibrated capability ceiling) -->
    <view v-if="detailRunning" style="padding: 14px 20px 12px">
      <view class="flex items-center justify-between" style="margin-bottom: 8px">
        <view class="flex items-center gap-2">
          <view :style="hashDotStyle" />
          <text :style="sectionLabelStyle">{{ t.earn.hashLabel }}</text>
        </view>
        <view class="flex items-center gap-1" :style="capChipStyle">
          <text style="color: var(--v5-ink-3)">{{ t.earn.hashCapability }}</text>
          <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-ink-2); font-weight: 600">{{ baselineTops.toFixed(1) }} TOPS</text>
          <text style="color: var(--v5-ink-4)">·</text>
          <text style="color: var(--v5-brand)">{{ fmt(t.earn.hashTier, { n: capTier }) }}</text>
        </view>
      </view>
      <view class="flex items-end justify-between">
        <view class="flex items-baseline" style="gap: 4px">
          <text class="tabular-nums" style="font-family: var(--font-amount); font-size: 36px; line-height: 1; font-weight: 600; color: var(--v5-brand); letter-spacing: 0">{{ live.effectiveTops.toFixed(1) }}</text>
          <text style="font-size: 12.5px; font-weight: 600; color: var(--v5-ink-3)">TOPS</text>
        </view>
        <svg width="110" height="28" viewBox="0 0 110 28" preserveAspectRatio="none" fill="none">
          <polyline :points="sparkPoints" fill="none" stroke="var(--v5-brand)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </view>
      <view class="flex items-center justify-between" style="margin-top: 6px">
        <text style="font-size: 12.5px; color: var(--v5-ink-3)">{{ factorLabel }}</text>
        <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 12.5px; color: var(--v5-ink-3)">{{ fmt(t.earn.hashOutput, { n: live.effectivePct }) }}</text>
      </view>
      <!-- SPEC-1 §4.3 + R7 在线分层叙事: 设备无心跳(离线/H5 tab)→ 基础托管档,弱引导升级 App 拿在线加成(转化钩子,信息态非死按钮) -->
      <view v-if="!deviceOnline" class="flex items-center" style="gap: 6px; margin-top: 8px; padding: 7px 10px; border-radius: 8px; background: color-mix(in srgb, var(--v5-tech-cyan) 10%, transparent)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
        <text style="font-size: 11px; line-height: 1.35; color: var(--v5-ink-2); text-wrap: pretty">{{ t.earn.hashCarrierH5Network }} · {{ t.earn.hashCarrierUpgradeHook }}</text>
      </view>
    </view>

    <view v-if="detailRunning" :style="cardDividerStyle" />

    <!-- Reconnecting -->
    <view v-if="reconnecting" style="padding: 14px 20px 16px">
      <view class="flex items-center gap-1.5 mb-2">
        <view :style="currentTaskDotStyle" />
        <text :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      </view>
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

    <!-- Paused (no task) -->
    <view v-else-if="!task && device.pausedReason" style="padding: 14px 20px 16px">
      <view class="flex items-center gap-1.5 mb-2">
        <view :style="currentTaskDotStyle" />
        <text :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      </view>
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

    <!-- Waiting placeholder -->
    <view v-else-if="!task && !device.pausedReason" style="padding: 14px 20px 16px">
      <view class="flex items-center gap-1.5 mb-2">
        <view :style="currentTaskDotStyle" />
        <text :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      </view>
      <view class="flex items-center gap-2" style="font-size: 12.5px; color: color-mix(in srgb, var(--v5-ink) 85%, transparent)">
        <svg class="nx-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        <text>{{ waitingTaskText }}</text>
      </view>
      <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 4px">{{ waitingHintText }}</text>
    </view>

    <!-- Current task (non-reconnecting) -->
    <view v-if="task && !reconnecting" style="padding: 14px 20px 16px">
      <view class="flex items-center gap-1.5 mb-2">
        <view :style="currentTaskDotStyle" />
        <text :style="sectionLabelStyle">{{ t.earn.currentTask }}</text>
      </view>
      <text class="block" style="font-size: 15px; font-weight: 500; color: color-mix(in srgb, var(--v5-ink) 95%, transparent); line-height: 1.35">{{ task.model }}<text style="color: var(--v5-ink-4); margin: 0 6px">·</text>{{ task.type }}</text>
      <view class="mt-0.5 flex items-center gap-1.5 flex-wrap" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-brand)">#{{ task.id }}</text>
        <text style="color: var(--v5-ink-4)">·</text>
        <text style="color: color-mix(in srgb, var(--v5-ink) 80%, transparent)">{{ task.client }}</text>
        <text style="color: var(--v5-ink-4)">·</text>
        <text>{{ task.location }}</text>
      </view>
      <view class="mt-3 flex items-center gap-3">
        <view class="flex-1 rounded-full overflow-hidden" style="height: 4px; background: rgba(255,255,255,0.08)">
          <view class="h-full" :style="progressBarStyle" />
        </view>
        <text class="tabular-nums text-right" style="font-family: var(--font-v5); font-size: 11.5px; color: color-mix(in srgb, var(--v5-ink) 80%, transparent); width: 48px">{{ progressPct }}%</text>
      </view>
      <view class="mt-1.5 flex items-center justify-between" style="font-size: 12px; color: var(--v5-ink-3)">
        <text>~{{ elapsedRemaining }} {{ t.earn.remaining }}</text>
        <text style="color: var(--v5-brand)">{{ t.earn.reward }} +${{ task.reward.toFixed(3) }}</text>
      </view>
    </view>

    <view v-if="task && !reconnecting" :style="cardDividerStyle" />

    <!-- Runtime conditions -->
    <view style="padding: 14px 20px 12px">
      <view class="flex items-center gap-1.5 mb-2">
        <view :style="backgroundModeDotStyle" />
        <text :style="sectionLabelStyle">{{ runtimeTitle }}</text>
        <view class="grid place-items-center rounded-full active:opacity-60" style="width: 20px; height: 20px" @click.stop="showHelp = !showHelp">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
        </view>
      </view>
      <view v-if="showHelp" class="mb-2.5 rounded-lg px-3 py-2" style="background: var(--v5-surface-2)"><text style="font-size: 11px; color: var(--v5-ink-2); line-height: 1.35">{{ runtimeHint }}</text></view>
      <view class="flex items-center gap-1.5 mb-2.5">
        <view class="flex items-center gap-1 active:opacity-80" :style="togglePillStyle(isCharging)" @click.stop="toggleCharger">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="isCharging ? 'var(--v5-brand)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="isCharging" d="m11 7-3 5h4l-3 5" /><rect x="1" y="6" width="16" height="12" rx="2" /><path d="M22 11v2" /></svg>
          <text class="font-mono-tabular tabular-nums" :style="{ color: isCharging ? 'var(--v5-brand)' : 'var(--v5-ink-3)' }">{{ powerPillText }}</text>
        </view>
        <view class="flex items-center gap-1 active:opacity-80" :style="togglePillStyle(isOnline)" @click.stop="toggleNetwork">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="isOnline ? 'var(--v5-brand)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="isOnline" d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 20 0M12 20h.01" /><path v-else d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M1.42 1.42l21.16 21.16" /></svg>
          <text :style="{ color: isOnline ? 'var(--v5-brand)' : 'var(--v5-ink-3)' }">{{ isOnline ? t.earn.phoneNetOnline : t.earn.phoneNetOffline }}</text>
        </view>
      </view>
    </view>

    <view :style="cardDividerStyle" />

    <!-- Locked-tasks loss-ad -->
    <view v-if="lockedTasksVisible" style="padding: 14px 20px 4px">
      <view class="flex items-center gap-2" style="font-size: 13px; color: var(--v5-ink-3); margin-bottom: 8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        <text>{{ t.earn.lockedTasksTitle }}</text>
      </view>
      <view class="flex items-baseline gap-4" style="margin-bottom: 12px">
        <text class="tabular-nums" style="font-family: var(--font-amount); font-size: 30px; font-weight: 600; color: #FF7A3D; line-height: 1">-${{ lockedTotalDaily }}</text>
        <text style="font-size: 13px; color: var(--v5-ink-3)">{{ t.earn.lockedMissedDaily }}</text>
      </view>
      <view>
        <view v-for="(it, i) in lockedItems" :key="i" class="flex items-center justify-between" :style="lockedRowStyle(i)">
          <view class="flex items-center gap-2 min-w-0">
            <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B6DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <text class="truncate">{{ it.model }}</text>
          </view>
          <view class="flex items-center gap-2 shrink-0 ml-2">
            <text class="tabular-nums" style="font-family: var(--font-amount); font-size: 15px; color: var(--v5-brand); font-weight: 600; line-height: 1">+${{ it.daily }}<text style="font-size: 11px; color: var(--v5-ink-3); font-weight: 400; margin-left: 2px">/d</text></text>
            <text class="tabular-nums text-right" style="font-size: 12.5px; color: var(--v5-ink-4); font-family: var(--font-v5); width: 48px">{{ it.vram }}</text>
          </view>
        </view>
      </view>
      <view class="mt-4 w-full flex items-center justify-center active:scale-[0.98]" :style="unlockCtaStyle" @click.stop="goUnlock">
        <text :style="unlockCtaLabelStyle">{{ unlockText }}</text>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07110C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 10px"><path d="m9 18 6-6-6-6" /></svg>
      </view>
    </view>

    </view>

    <!-- Earnings -->
    <view :style="earningsSectionStyle">
      <view aria-hidden :style="earningsDividerStyle" />
      <view aria-hidden :style="earningsMidlineStyle" />
      <view style="display: grid; grid-template-columns: 1fr 1fr">
        <view>
          <text class="block" :style="sectionLabelStyle">{{ t.earn.todayEarnings }}</text>
          <text class="block tabular-nums" :style="todayAmountStyle">${{ device.todayEarnings.toFixed(3) }}</text>
          <text class="block tabular-nums" :style="nexLineStyle">+{{ device.todayEarningsNEX.toFixed(1) }} NEX</text>
        </view>
        <view style="padding-left: 40px">
          <text class="block" :style="sectionLabelStyle">{{ t.earn.estThisHour }}</text>
          <text class="block tabular-nums" :style="hourAmountStyle">+${{ hourlyUsd }}</text>
          <text class="block tabular-nums" :style="nexLineStyle">+{{ hourlyNex }} NEX</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import type { Device, DeviceKind } from "@/store/types";
import { isDegradable } from "@/store/device-lifecycle";
import { interruptInfo, INTERRUPT_MAX_RETRIES } from "@/store/interrupt";
import { computeLiveHashpower, isDeviceOnline } from "@/lib/hashpower";
import { fallbackCapability } from "@/lib/device-capability";
import { rankingDeviceImage } from "@/lib/device-art";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const props = defineProps<{ device: Device; divider?: boolean }>();
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
  "pc-gpu": "M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l1 3H9l1-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 21h8",
  "stellarbox-s1": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "stellarbox-pro": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "stellarbox-pro-v2": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "stellarrack-p1": "M5 4h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z",
  "stellarrack-p2": "M5 4h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z",
  "cloud-share": "M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3",
};
const kindIconPath = computed(() => KIND_ICON_PATHS[props.device.kind] ?? KIND_ICON_PATHS.phone);
const isPhoneDevice = computed(() => props.device.kind === "phone");
const deviceArt = computed(() => rankingDeviceImage(props.device.kind));
const deviceArtWrapStyle = computed<CSSProperties>(() => ({
  width: isPhoneDevice.value ? "48px" : "44px",
  height: isPhoneDevice.value ? "48px" : "44px",
  flexShrink: 0,
}));
const deviceArtStyle = computed<CSSProperties>(() => ({
  width: isPhoneDevice.value ? "48px" : "44px",
  height: isPhoneDevice.value ? "48px" : "44px",
  borderRadius: isPhoneDevice.value ? "0" : "6px",
}));
const deviceRowOnline = computed(() => props.device.status === "online" && props.device.activatedAt !== null);
const deviceArtDotStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  right: "-2px",
  bottom: "-2px",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "var(--v5-success)",
  border: "2px solid var(--v5-bg)",
  animation: "v5-hb-pulse-success 1.6s ease-in-out infinite",
}));

const task = computed(() => props.device.currentTask);
const displayDeviceName = computed(() => (isPhoneDevice.value ? t.value.earn.yourPhone : props.device.name));
const reconnecting = computed(() => props.device.interruptedAt != null);
const elapsedRatio = computed(() => {
  const tk = task.value;
  if (!tk) return 0;
  return Math.min(1, (now.value - tk.startedAt) / 1000 / tk.totalSec);
});
const progressPct = computed(() => Math.round(elapsedRatio.value * 100));

const idleGated = computed(
  () => !!props.device.pausedReason && !reconnecting.value && !task.value,
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
const hourlyUsd = computed(() => (props.device.baseRate / 24).toFixed(2));
const hourlyNex = computed(() => (props.device.baseRateNEX / 24).toFixed(1));

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
const isCharging = computed(() => (isPhoneDevice.value ? props.device.isCharging !== false : true));
const isOnline = computed(() =>
  isPhoneDevice.value ? props.device.isWifiConnected !== false : props.device.status === "online",
);
const runtimeTitle = computed(() => (isPhoneDevice.value ? t.value.earn.phoneSettingsTitle : t.value.earn.deviceRuntimeTitle));
const runtimeHint = computed(() => (isPhoneDevice.value ? t.value.earn.phoneRequirementsHint : t.value.earn.deviceRuntimeHint));
const waitingTaskText = computed(() => (isPhoneDevice.value ? t.value.earn.phoneWaitingTask : t.value.earn.deviceWaitingTask));
const waitingHintText = computed(() => (isPhoneDevice.value ? t.value.earn.phoneWaitingHint : t.value.earn.deviceWaitingHint));
const powerPillText = computed(() =>
  isPhoneDevice.value ? `${props.device.batteryLevel ?? 0}%` : `${Math.round(props.device.gpuPower || props.device.basePower)}W`,
);
function toggleCharger() {
  if (!isPhoneDevice.value) return;
  app.setPhoneRuntime(props.device.id, { isCharging: !isCharging.value });
}
function toggleNetwork() {
  if (!isPhoneDevice.value) return;
  app.setPhoneRuntime(props.device.id, { isWifiConnected: !isOnline.value });
}

// ── Live hashpower (effective = capability × condition factors) ──
// The stable capability (TOPS·Tier) is the comparable identity number; the live
// effective value oscillates beneath that ceiling with the phone's current
// condition (continuous-online stability bonus, thermal, jitter). Only shown
// while running (charging + online + no interrupt) — paused/reconnect states use
// their own blocks. Toggling charger/network visibly moves the number.
const detailRunning = computed(
  () => props.device.status === "online" && !reconnecting.value && !props.device.pausedReason,
);
// Phones always carry capability fields (createDevice seeds them); fall back to
// the lib's single-source default rather than duplicating the literal here.
const FALLBACK_CAP = fallbackCapability();
const baselineTops = computed(() => props.device.capabilityTops ?? props.device.hashRate ?? props.device.gpuUsage ?? FALLBACK_CAP.tops);
const cfg = useConfig();
const capTier = computed(() => props.device.capabilityTier ?? props.device.generation ?? FALLBACK_CAP.tier);
// SPEC-1 R7: 因子档由设备真在线态驱动(isDeviceOnline — 设备心跳),NOT 查看载体。
// 无心跳设备(H5 tab / 被杀 App / 离线)→ 基础托管; 在线设备 → 全因子在线加成. Mirrors lib/hashpower.ts.
const deviceOnline = computed(() => isDeviceOnline(props.device, now.value));
const live = computed(() =>
  computeLiveHashpower({
    baselineTops: baselineTops.value,
    online: deviceOnline.value,
    isCharging: isCharging.value,
    isOnline: isOnline.value,
    thermalState: props.device.thermalState,
    continuityMs: Math.max(0, now.value - (props.device.miningSince ?? props.device.activatedAt ?? props.device.purchasedAt)),
    nowSeed: now.value,
    onlineBonus: cfg.config.onlineBonus,
  }),
);
const factorLabel = computed(() => {
  // SPEC-1 §4.3 + R7: 设备离线(无心跳)走基础托管档 → 标「基础托管模式」而非在线因子标签.
  if (!deviceOnline.value) return t.value.earn.hashCarrierH5Mode;
  switch (live.value.dominant) {
    case "continuity":
      return t.value.earn.hashFactorContinuity;
    case "thermal":
      return t.value.earn.hashFactorThermal;
    case "battery":
      return t.value.earn.hashFactorBattery;
    case "offline":
      return t.value.earn.hashFactorOffline;
    default:
      return t.value.earn.hashFactorPeak;
  }
});

// Rolling sparkline buffer — one sample per 1s `now` tick (≈28s window).
const SPARK_LEN = 28;
const sparkBuf = ref<number[]>([]);
watch(
  now,
  () => {
    if (!detailRunning.value) return;
    const next = [...sparkBuf.value, live.value.effectiveTops];
    sparkBuf.value = next.length > SPARK_LEN ? next.slice(-SPARK_LEN) : next;
  },
  { immediate: true },
);
const sparkPoints = computed(() => {
  const buf = sparkBuf.value;
  if (buf.length < 2) return "";
  const W = 110;
  const H = 28;
  const base = baselineTops.value || 1;
  const n = buf.length;
  return buf
    .map((v, i) => {
      const x = (i / (n - 1)) * W;
      const ratio = Math.max(0, Math.min(1, v / base));
      const y = H - (0.12 + ratio * 0.82) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});

// Locked task ladder stays visible on all owned-device detail cards.
const lockedTasksVisible = computed(() => true);
const lockedItems = computed<{ model: string; daily: number; vram: string }[]>(() => [
  { model: t.value.earn.lockedTaskLlama, daily: 110, vram: "16 GB" },
  { model: t.value.earn.lockedTaskFlux, daily: 38, vram: "12 GB" },
  { model: t.value.earn.lockedTaskSdxl, daily: 9, vram: "8 GB" },
]);
const lockedTotalDaily = computed(() => lockedItems.value.reduce((s, it) => s + it.daily, 0));
const unlockText = computed(() => t.value.earn.unlockNMoreTasks.replace("{n}", "142").replace(/[→›]/g, "").trim());
function goUnlock() {
  uni.navigateTo({ url: "/pages/store/detail?id=stellarbox-s1", fail: () => {} });
}

// Lifecycle chip
const degradable = computed(() => isDegradable(props.device.kind));
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
// ── styles ──
const cardStyle: CSSProperties = {
  position: "relative",
  background: "linear-gradient(180deg, #111317 0%, #15181C 100%)",
  borderRadius: "16px",
};
const sectionLabelStyle: CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink-3)",
};
const cardDividerStyle: CSSProperties = {
  height: "1px",
  margin: "0 20px",
  background: "color-mix(in srgb, var(--v5-border) 64%, transparent)",
};
const hashDotStyle: CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "var(--v5-brand)",
  boxShadow: "0 0 6px var(--v5-brand)",
};
const capChipStyle: CSSProperties = {
  padding: "7px 12px",
  borderRadius: "9999px",
  fontSize: "12px",
  background: "rgba(255,255,255,0.06)",
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
const progressBarStyle = computed<CSSProperties>(() => ({
  width: `${progressPct.value}%`,
  background: "linear-gradient(90deg, #2ED7E6 0%, #55DDBD 52%, var(--v5-brand) 100%)",
  transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
}));
function togglePillStyle(on: boolean): CSSProperties {
  return {
    height: "32px",
    minWidth: "82px",
    padding: "0 14px",
    borderRadius: "999px",
    fontSize: "12.5px",
    fontWeight: 500,
    background: on ? "color-mix(in srgb, var(--v5-brand) 18%, transparent)" : "rgba(255,255,255,0.06)",
    border: on ? "1px solid color-mix(in srgb, var(--v5-brand) 38%, transparent)" : "1px solid transparent",
    boxSizing: "border-box",
  };
}
const unlockCtaStyle: CSSProperties = {
  height: "50px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #2ED7E6 0%, #7FE3A8 52%, #9BE414 100%)",
};
const unlockCtaLabelStyle: CSSProperties = {
  color: "#07110C",
  fontSize: "15px",
  fontWeight: 600,
};
const currentTaskDotStyle: CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "#2ED7E6",
};
const backgroundModeDotStyle: CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "#8B6DFF",
};
function lockedRowStyle(index: number): CSSProperties {
  return {
    minHeight: "36px",
    fontSize: "13.5px",
    color: "var(--v5-ink-3)",
    borderTop: index === 0 ? "none" : "1px solid color-mix(in srgb, var(--v5-border) 58%, transparent)",
  };
}
const earningsSectionStyle: CSSProperties = {
  position: "relative",
  padding: "16px 20px 20px",
};
const earningsDividerStyle: CSSProperties = {
  position: "absolute",
  top: "0",
  left: "20px",
  right: "20px",
  height: "1px",
  background: "color-mix(in srgb, var(--v5-border) 64%, transparent)",
};
const earningsMidlineStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "16px",
  width: "1px",
  height: "56px",
  background: "color-mix(in srgb, var(--v5-border) 64%, transparent)",
  transform: "translateX(-0.5px)",
};
const todayAmountStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-amount)",
  fontSize: "30px",
  lineHeight: "1",
  fontWeight: 600,
  color: "var(--v5-brand)",
};
const hourAmountStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-amount)",
  fontSize: "30px",
  lineHeight: "1",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const nexLineStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "#8B6DFF",
};
</script>

<style scoped>
.nx-spin {
  animation: spin 1s linear infinite;
}
</style>
