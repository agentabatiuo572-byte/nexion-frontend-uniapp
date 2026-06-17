<!--
  DeviceRow — ZONE 2 fleet device card (ported from mission-control.tsx DeviceRow
  + PhoneTaskProgress inline). Icon by kind (phone/box/server/cpu) + online pulse,
  name + earning badge + spec, today earnings. Active phone shows a live task
  progress block (model · client · % · streak) — a faithful mock snapshot.
-->
<template>
  <view class="block" :style="{ padding: '14px 0', borderBottom: divider ? '1px solid var(--v5-border)' : 'none' }" @click="go">
    <view class="grid items-center gap-3" style="grid-template-columns: 40px 1fr auto">
      <!-- Icon + online dot -->
      <view class="grid place-items-center relative" style="width: 38px; height: 38px; border-radius: 10px; background: var(--v5-brand-soft); color: var(--v5-brand)">
        <svg v-if="iconKind === 'smartphone'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
        <svg v-else-if="iconKind === 'server'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>
        <svg v-else-if="iconKind === 'cpu'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
        <view v-if="isOnline" style="position: absolute; bottom: -2px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background: var(--v5-success); border: 2px solid var(--v5-surface); animation: v5-hb-pulse-success 1.6s ease-in-out infinite" />
      </view>

      <!-- Name + spec -->
      <view class="min-w-0">
        <view class="flex items-center gap-1.5">
          <text style="font-family: var(--font-v5); font-weight: 600; font-size: 14px; color: var(--v5-ink); letter-spacing: -0.012em">{{ device.name }}</text>
          <text v-if="isOnline" class="font-mono-tabular" style="font-size: 10px; padding: 1px 5px; border-radius: 4px; background: var(--v5-success-soft); color: var(--v5-success); font-weight: 500">{{ t.home.deviceEarning }}</text>
        </view>
        <text class="block font-mono-tabular mt-0.5" style="font-size: 12px; color: var(--v5-ink-3)">{{ device.gpu }}</text>
      </view>

      <!-- Today earnings -->
      <view class="tabular-nums text-right whitespace-nowrap">
        <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-success)">${{ todayText }}</text>
        <text class="block font-mono-tabular" style="font-size: 10.5px; color: var(--v5-ink-3); font-weight: 500">{{ t.home.deviceToday }}</text>
      </view>
    </view>

    <!-- Active phone task progress (faithful mock snapshot) -->
    <view v-if="isPhone && isOnline" class="mt-3" style="padding: 10px 12px; background: var(--v5-surface-2); border-radius: 10px">
      <view class="flex justify-between items-start gap-2">
        <view class="min-w-0">
          <view class="flex items-center gap-1.5" style="font-family: var(--font-v5); font-weight: 500; font-size: 13px; color: var(--v5-ink)">
            <PulseDot color="var(--v5-success)" :size="6" />
            <text>SDXL Turbo</text>
          </view>
          <text class="block mt-0.5" style="font-size: 12px; color: var(--v5-ink-3)"><text style="color: var(--v5-ink-2); font-weight: 500">Pocket Studios</text><text style="color: var(--v5-ink-4)"> · Berlin</text></text>
        </view>
        <text class="font-mono-tabular tabular-nums whitespace-nowrap" style="font-size: 12px; color: var(--v5-success)">+$0.00032</text>
      </view>
      <view class="mt-2 relative overflow-hidden" style="height: 5px; background: var(--v5-surface-3); border-radius: 3px">
        <view class="absolute left-0 top-0 bottom-0 overflow-hidden" style="width: 28%; background: linear-gradient(90deg, var(--v5-success), var(--v5-tech-cyan)); border-radius: 3px">
          <view class="absolute inset-0" style="background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%); transform: translateX(-100%); animation: v5-lane-shimmer 1.8s ease-in-out infinite" />
        </view>
      </view>
      <view class="mt-1.5 flex justify-between font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-3)">
        <text><text style="color: var(--v5-ink-2); font-weight: 500">28%</text><text style="color: var(--v5-ink-4)"> · 28s left</text></text>
        <text style="color: var(--v5-success); font-weight: 500">7d streak</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import type { Device } from "@/store/types";
import PulseDot from "./pulse-dot.vue";

const props = defineProps<{ device: Device; divider: boolean }>();
const t = useT();

const isPhone = computed(() => props.device.kind === "phone");
const isOnline = computed(() => props.device.status === "online");
const iconKind = computed(() => {
  const k = props.device.kind;
  if (k === "phone") return "smartphone";
  if (k.startsWith("stellarrack")) return "server";
  if (k === "cloud-share") return "cpu";
  return "box";
});
const todayText = computed(() =>
  props.device.todayEarnings.toFixed(props.device.todayEarnings < 1 ? 3 : 2),
);

function go() {
  const url = isPhone.value ? "/pages/earn/earn" : `/pages/store/detail?id=${props.device.kind}`;
  uni.navigateTo({ url, fail: () => {} });
}
</script>
