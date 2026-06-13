<!--
  EmptySlotsHint — ported from Nexion-prototype/app/components/empty-slots-hint.tsx.
  Primary /earn → /store conversion entry, hero-tier card:
    aurora drift + 24px grid texture + 10 drifting particles + hero $N/day
    potential + 6-col slot grid (filled / trial / empty) + network-proof stats
    + lemon brand CTA. Capped state (6/6) shows a minimal locked frame.

  Slots reflect ACTIVE fleet only. Trial S1 reserves a slot (shadow device).
  CTA: the source opens a slot-action-sheet that, with no inventory devices to
  activate, only ever routes to /store — so here it navigates straight to
  /pages/store/store (faithful to the only reachable outcome in this mock;
  matches the shipped add-device-row pattern). When the inventory-activation
  flow (useApp.activateDevice + a sheet) is ported, swap this for the sheet.
-->
<template>
  <!-- Capped state — minimal frame -->
  <view v-if="empty <= 0" class="mx-4 rounded-2xl px-4 py-4" :style="cappedStyle">
    <view class="flex items-center gap-3">
      <view class="rounded-full grid place-items-center shrink-0" style="width: 44px; height: 44px; background: var(--v5-surface-2)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </view>
      <view class="flex-1 min-w-0">
        <text class="block" style="font-size: 13.5px; font-weight: 600; color: color-mix(in srgb, var(--v5-ink) 70%, transparent)">{{ t.earn.capTitle }}</text>
        <text class="block" style="font-size: 11.5px; color: var(--v5-ink-4); margin-top: 2px">{{ capHintText }}</text>
      </view>
    </view>
  </view>

  <!-- Active state — hero-tier conversion entry -->
  <view v-else class="mx-4">
    <view class="block w-full text-left relative overflow-hidden rounded-2xl active:scale-[0.998]" :style="rootStyle" @click="goStore">
      <!-- Aurora drift bg -->
      <view aria-hidden class="absolute inset-0 pointer-events-none" :style="auroraStyle" />
      <!-- 24px grid texture -->
      <view aria-hidden class="absolute inset-0 pointer-events-none" :style="gridStyle" />
      <!-- Particle drift -->
      <view aria-hidden class="absolute inset-0 pointer-events-none overflow-hidden">
        <view v-for="(d, i) in PARTICLES" :key="i" :style="particleStyle(d)" />
      </view>

      <view class="relative p-4">
        <!-- Eyebrow -->
        <view class="font-mono-tabular inline-flex items-center gap-1.5" :style="eyebrowStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
          <text style="color: var(--v5-brand)">{{ t.home.slotsHintPotentialDaily }}</text>
        </view>

        <!-- Hero number -->
        <view class="mt-2 flex items-baseline gap-2 flex-wrap">
          <view class="flex items-baseline tabular-nums" style="font-family: var(--font-v5); letter-spacing: -0.024em; line-height: 1">
            <text style="font-size: 26px; font-weight: 500; color: var(--v5-brand); opacity: 0.75">+$</text>
            <text style="font-size: 48px; font-weight: 600; color: var(--v5-brand)">{{ potentialDaily.toFixed(0) }}</text>
            <text style="font-size: 18px; font-weight: 500; color: var(--v5-ink-3); margin-left: 4px">/day</text>
          </view>
          <text class="font-mono-tabular shrink-0" :style="untappedTagStyle">{{ t.home.slotsHintUntapped }}</text>
        </view>

        <!-- Subtitle -->
        <text class="mt-2 block" style="font-size: 12.5px; line-height: 1.35; color: var(--v5-ink-3)">
          <text style="color: var(--v5-ink); font-weight: 600">{{ empty }}</text> × {{ promo.targetName }} @ ${{ promo.targetDaily.toFixed(2) }}/d<text v-if="showMultiplier"> · <text style="color: var(--v5-tech-cyan); font-weight: 600">{{ multiplierText }}×</text> {{ yourBaseText }}</text>
        </text>

        <!-- Slot grid -->
        <view class="mt-4 grid grid-cols-6 gap-1.5">
          <view v-for="(slot, i) in slotCells" :key="i" :style="slotTileStyle(slot)" class="relative grid place-items-center overflow-hidden">
            <!-- filled real device -->
            <template v-if="slot.kind === 'filled'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="deviceIconPath(slot.deviceKind)" /><template v-if="slot.deviceKind === 'phone'"><path d="M12 18h.01" /></template></svg>
              <view aria-hidden class="absolute" style="top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand); box-shadow: 0 0 6px var(--v5-brand); animation: v5-hb-pulse-success 2.4s ease-in-out infinite" />
            </template>
            <!-- trial slot -->
            <template v-else-if="slot.kind === 'trial'">
              <view class="absolute inset-x-0 top-0 grid place-items-center" style="bottom: 13px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
              </view>
              <view aria-hidden class="absolute" style="top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand-2); box-shadow: 0 0 6px var(--v5-brand-2); animation: v5-hb-pulse-success 2.4s ease-in-out infinite" />
              <text class="absolute inset-x-0 bottom-0 text-center font-mono-tabular" style="font-size: 10px; line-height: 13px; background: color-mix(in oklab, var(--v5-brand-2) 26%, transparent); color: var(--v5-brand-2)">{{ t.trial.slotTag }}</text>
            </template>
            <!-- empty slot -->
            <template v-else>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="color-mix(in srgb, var(--v5-tech-cyan) 70%, transparent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            </template>
          </view>
        </view>

        <!-- Stats row -->
        <view class="mt-4 grid grid-cols-3 gap-2 text-center" style="padding-top: 12px; border-top: 1px dashed var(--v5-border)">
          <view>
            <text class="block tabular-nums" style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); line-height: 1; letter-spacing: -0.008em">{{ count }}/{{ MAX_DEVICES }}</text>
            <text class="block font-mono-tabular" style="margin-top: 4px; font-size: 10.5px; color: var(--v5-ink-4); letter-spacing: 0.04em">{{ t.home.slotsHintFilled }}</text>
          </view>
          <view>
            <text class="block tabular-nums" style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-tech-cyan); line-height: 1; letter-spacing: -0.008em">${{ NETWORK_AVG_DAILY.toFixed(0) }}</text>
            <text class="block font-mono-tabular" style="margin-top: 4px; font-size: 10.5px; color: var(--v5-ink-4); letter-spacing: 0.04em">{{ t.home.slotsHintNetworkAvg }}</text>
          </view>
          <view>
            <text class="block tabular-nums" style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-brand); line-height: 1; letter-spacing: -0.008em">{{ rankText }}</text>
            <text class="block font-mono-tabular" style="margin-top: 4px; font-size: 10.5px; color: var(--v5-ink-4); letter-spacing: 0.04em">{{ t.home.slotsHintRankIfFilled }}</text>
          </view>
        </view>

        <!-- CTA -->
        <view class="mt-4 inline-flex items-center justify-center gap-1.5 w-full" :style="ctaStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>
          <text :style="ctaLabelStyle">{{ t.earn.fillSlots }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>

        <!-- Tiny note -->
        <text class="mt-2 block text-center font-mono-tabular" style="font-size: 10.5px; color: var(--v5-ink-4)">{{ currentFleetText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { useSlotActionSheet } from "@/store/slot-action-sheet";
import { MAX_DEVICES, derivePromoUpgrade } from "@/store/device-types";
import { trialReservesSlotNow } from "@/store/free-trial";
import type { DeviceKind } from "@/store/types";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const NETWORK_AVG_DAILY = 142.6; // mock network top tier daily (Rack P1)

const app = useApp();
const t = useT();

const activeDevices = computed(() => app.devices.filter((d) => d.activatedAt !== null));
const trialSlot = computed(() => (trialReservesSlotNow() ? 1 : 0));
const realCount = computed(() => activeDevices.value.length);
const count = computed(() => realCount.value + trialSlot.value);
const empty = computed(() => MAX_DEVICES - count.value);
const promo = computed(() => derivePromoUpgrade(app.devices));

const potentialDaily = computed(() => empty.value * promo.value.targetDaily);
const fleetCurrentDaily = computed(() => activeDevices.value.reduce((sum, d) => sum + d.baseRate, 0));
const fleetRankPctIfFilled = computed(() =>
  Math.max(8, Math.min(94, Math.round((potentialDaily.value / NETWORK_AVG_DAILY) * 70))),
);

const showMultiplier = computed(
  () => promo.value.baseDaily > 0 && potentialDaily.value / promo.value.baseDaily >= 2,
);
const multiplierText = computed(() => (potentialDaily.value / promo.value.baseDaily).toFixed(0));
const yourBaseText = computed(() => `your ${promo.value.baseName.replace(/^Your\s+/i, "")}`);

const capHintText = computed(() =>
  t.value.earn.capHint.replace("{n}", String(count.value)).replace("{max}", String(MAX_DEVICES)),
);
const rankText = computed(() => fmt(t.value.home.slotsHintTopPct, { pct: 100 - fleetRankPctIfFilled.value }));
const currentFleetText = computed(() =>
  fmt(t.value.home.slotsHintCurrentFleet, { amount: `$${fleetCurrentDaily.value.toFixed(2)}` }),
);

// ── slot grid cells ──
type SlotCell =
  | { kind: "filled"; deviceKind: DeviceKind }
  | { kind: "trial" }
  | { kind: "empty" };
const slotCells = computed<SlotCell[]>(() =>
  Array.from({ length: MAX_DEVICES }).map((_, i): SlotCell => {
    const device = activeDevices.value[i];
    if (device) return { kind: "filled", deviceKind: device.kind };
    if (trialSlot.value && i === realCount.value) return { kind: "trial" };
    return { kind: "empty" };
  }),
);

const DEVICE_ICON_PATHS: Record<DeviceKind, string> = {
  phone: "M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
  "stellarbox-s1": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "stellarbox-pro": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "stellarrack-p1": "M5 4h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z",
  "cloud-share": "M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3",
};
function deviceIconPath(kind: DeviceKind): string {
  return DEVICE_ICON_PATHS[kind] ?? DEVICE_ICON_PATHS["stellarbox-s1"];
}

// ── particles ──
interface Particle {
  left: string;
  delay: number;
  duration: number;
  size: number;
  color: string;
  opacity: number;
}
const PARTICLES: Particle[] = [
  { left: "7%", delay: 0, duration: 10, size: 4, color: "var(--v5-tech-cyan)", opacity: 0.35 },
  { left: "63%", delay: 0.9, duration: 11, size: 3, color: "var(--v5-brand)", opacity: 0.25 },
  { left: "22%", delay: 1.8, duration: 9, size: 4, color: "var(--v5-brand-2)", opacity: 0.38 },
  { left: "84%", delay: 2.6, duration: 12, size: 3, color: "var(--v5-tech-cyan)", opacity: 0.3 },
  { left: "47%", delay: 3.5, duration: 10, size: 4, color: "var(--v5-brand)", opacity: 0.35 },
  { left: "12%", delay: 4.4, duration: 11, size: 3, color: "var(--v5-brand-2)", opacity: 0.28 },
  { left: "73%", delay: 5.3, duration: 9, size: 4, color: "var(--v5-tech-cyan)", opacity: 0.35 },
  { left: "33%", delay: 6.1, duration: 12, size: 3, color: "var(--v5-brand)", opacity: 0.3 },
  { left: "92%", delay: 7.0, duration: 10, size: 4, color: "var(--v5-brand-2)", opacity: 0.32 },
  { left: "55%", delay: 7.9, duration: 11, size: 3, color: "var(--v5-tech-cyan)", opacity: 0.25 },
];
function particleStyle(d: Particle): CSSProperties {
  return {
    position: "absolute",
    bottom: "-6px",
    left: d.left,
    width: `${d.size}px`,
    height: `${d.size}px`,
    borderRadius: "50%",
    background: d.color,
    boxShadow: `0 0 2px ${d.color}`,
    opacity: 0,
    animation: `v5-dot-drift-tall ${d.duration}s linear infinite`,
    animationDelay: `${d.delay}s`,
    "--dot-peak-opacity": String(d.opacity),
  } as CSSProperties;
}

// Open the slot-action sheet (branches: activate an inactive inventory device
// vs route to /store), matching the prototype. (Was navigating straight to /store.)
function goStore() {
  useSlotActionSheet().show();
}

// ── styles ──
const cappedStyle: CSSProperties = {
  border: "2px dashed var(--v5-border-strong)",
  background: "color-mix(in srgb, var(--v5-bg) 40%, transparent)",
};
const rootStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const auroraStyle: CSSProperties = {
  background:
    "radial-gradient(50% 60% at 12% 18%, var(--v5-brand-soft) 0%, transparent 65%)," +
    "radial-gradient(45% 55% at 88% 82%, var(--v5-tech-cyan-soft) 0%, transparent 65%)",
  filter: "blur(12px)",
  opacity: 0.85,
  animation: "v5-aurora-drift 14s ease-in-out infinite alternate",
};
const gridStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)," +
    "linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 80%)",
  WebkitMaskImage: "radial-gradient(ellipse at center, #000 30%, transparent 80%)",
};
const eyebrowStyle: CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--v5-brand)",
  textTransform: "uppercase",
};
const untappedTagStyle: CSSProperties = {
  padding: "3px 8px",
  borderRadius: "999px",
  background: "var(--v5-brand-soft)",
  color: "var(--v5-brand)",
  fontSize: "10.5px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
function slotTileStyle(slot: SlotCell): CSSProperties {
  if (slot.kind === "filled") {
    return { height: "44px", borderRadius: "12px", background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)" };
  }
  if (slot.kind === "trial") {
    return { height: "44px", borderRadius: "12px", background: "color-mix(in oklab, var(--v5-brand-2) 16%, transparent)" };
  }
  return {
    height: "44px",
    borderRadius: "12px",
    border: "1px dashed color-mix(in srgb, var(--v5-tech-cyan) 45%, transparent)",
    background: "color-mix(in srgb, var(--v5-tech-cyan) 6%, transparent)",
  };
}
const ctaStyle: CSSProperties = {
  height: "48px",
  padding: "0 24px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
};
const ctaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "14px",
  letterSpacing: "-0.005em",
  color: "var(--v5-on-brand)",
};
</script>
