<!--
  Global Network map — ported from Nexion-prototype/app/(main)/globe/page.tsx.

  Top stat tiles → inline SVG dotmap (procedural continent silhouettes +
  region nodes w/ glow halos + SMIL pulse ring + connection lines from "you")
  → region cards list → bottom-sheet drawer on tap.

  Wrapped in <AppChassis active="me"> (reached from /me). SetPageHeader
  backHref="/me" → SubPageHeader back="/pages/me/me". Inline <svg> + <animate>
  carry over (P-013). Source dot hex (#1F2D1A bright olive / #101418 dim) →
  var(--v5-brand) low-opacity (matches "brighter green = denser cluster"
  legend) / var(--v5-ink-4). Drawer is position:fixed so it overlays the
  whole chassis. Mock Math.random pulse/uptime kept (no SSR in uni, no
  hydration concern → the source's mulberry32 seeding is unnecessary here,
  but retained for identical dot positions).
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" />

      <!-- Top stats -->
      <view class="mx-4 mb-3 grid grid-cols-2 gap-2">
        <view class="border rounded-2xl" :style="statTileStyle">
          <view class="flex items-center" style="gap: 6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
            <text style="font-size: 11px; letter-spacing: 0.16em; color: var(--v5-ink-3)">{{ t.globe.activeNodes }}</text>
          </view>
          <text class="block tabular-nums" :style="statValStyle">{{ activeNodesText }}</text>
        </view>
        <view class="border rounded-2xl" :style="statTileStyle">
          <view class="flex items-center" style="gap: 6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>
            <text style="font-size: 11px; letter-spacing: 0.16em; color: var(--v5-ink-3)">{{ t.globe.activeJobs }}</text>
          </view>
          <text class="block tabular-nums" :style="statValStyle">{{ activeJobsText }}</text>
        </view>
      </view>

      <!-- Map -->
      <view class="mx-4 border rounded-2xl relative overflow-hidden" :style="mapCardStyle">
        <svg :viewBox="`0 0 ${W} ${H}`" class="w-full block" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--v5-brand)" stop-opacity="0.9" />
              <stop offset="60%" stop-color="var(--v5-brand)" stop-opacity="0.2" />
              <stop offset="100%" stop-color="var(--v5-brand)" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="you-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--v5-tech-cyan)" stop-opacity="1" />
              <stop offset="100%" stop-color="var(--v5-tech-cyan)" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- Dot continents -->
          <circle
            v-for="(d, i) in dots"
            :key="`dot-${i}`"
            :cx="d.x"
            :cy="d.y"
            :r="d.r"
            :fill="d.bright ? 'var(--v5-brand)' : 'var(--v5-ink-4)'"
            :opacity="d.bright ? 0.5 : 0.25"
          />

          <!-- Connection lines from "you" → other regions -->
          <line
            v-for="r in otherRegions"
            :key="`line-${r.id}`"
            :x1="me.cx * W"
            :y1="me.cy * H"
            :x2="r.cx * W"
            :y2="r.cy * H"
            stroke="var(--v5-brand)"
            stroke-opacity="0.08"
            stroke-width="0.6"
            stroke-dasharray="2 3"
          />

          <!-- Region nodes -->
          <g v-for="r in REGIONS" :key="r.id" class="cursor-pointer" @click="select(r)">
            <circle :cx="r.cx * W" :cy="r.cy * H" r="18" :fill="`url(#${r.isYou ? 'you-glow' : 'globe-glow'})`" />
            <circle :cx="r.cx * W" :cy="r.cy * H" r="5" :fill="r.isYou ? 'var(--v5-tech-cyan)' : 'var(--v5-brand)'" />
            <!-- Pulse ring -->
            <circle
              v-if="pulseRegionId === r.id"
              :key="`pulse-${r.id}-${pulseTick}`"
              :cx="r.cx * W"
              :cy="r.cy * H"
              r="5"
              fill="none"
              :stroke="r.isYou ? 'var(--v5-tech-cyan)' : 'var(--v5-brand)'"
              stroke-width="1"
            >
              <animate attributeName="r" values="5;24" dur="1.6s" repeatCount="1" />
              <animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="1" />
            </circle>
            <text
              v-if="r.isYou"
              :x="r.cx * W + 8"
              :y="r.cy * H - 8"
              fill="var(--v5-tech-cyan)"
              font-size="10"
              font-weight="600"
              font-family="ui-monospace, monospace"
            >{{ t.globe.yourNodeBadge }}</text>
          </g>
        </svg>
        <text class="block text-center" style="font-size: 10.5px; color: var(--v5-ink-4); margin-top: 8px">{{ t.globe.tapHint }} · {{ t.globe.legend }}</text>
      </view>

      <!-- Region cards -->
      <view class="mx-4 mt-4 mb-6 space-y-2">
        <view
          v-for="r in REGIONS"
          :key="r.id"
          class="w-full border rounded-2xl flex items-center active:opacity-80"
          :style="regionCardStyle"
          @click="select(r)"
        >
          <view class="grid place-items-center shrink-0" :style="regionIconBox(r.isYou)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="r.isYou ? 'var(--v5-tech-cyan)' : 'var(--v5-brand)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <view class="flex items-center" style="gap: 8px">
              <text style="font-size: 13.5px; font-weight: 600; color: var(--v5-ink)">{{ regionName(r) }}</text>
              <text v-if="r.isYou" :style="youChipStyle">{{ t.globe.youAre }}</text>
            </view>
            <text class="block tabular-nums" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 2px">{{ regionDevicesText(r) }} · {{ regionLatencyText(r) }}</text>
          </view>
          <text class="shrink-0 tabular-nums" :style="regionRateStyle">{{ (r.jobsPerHour / 1000).toFixed(1) }}k/h</text>
        </view>
      </view>

      <!-- Drawer -->
      <view v-if="selected" class="nx-globe-drawer">
        <view class="nx-globe-scrim" @click="selected = null" />
        <view class="relative border rounded-2xl" :style="drawerCardStyle">
          <view class="absolute grid place-items-center active:opacity-70" :style="drawerCloseStyle" @click="selected = null">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
          <view class="flex items-center" style="gap: 12px">
            <view class="grid place-items-center" :style="drawerIconBox(selected.isYou)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" :stroke="selected.isYou ? 'var(--v5-tech-cyan)' : 'var(--v5-brand)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" style="font-size: 18px; font-weight: 600; color: var(--v5-ink)">{{ regionName(selected) }}</text>
              <text v-if="selected.isYou" class="block" style="font-size: 11px; color: var(--v5-brand-2); margin-top: 2px">{{ t.globe.youAre }}</text>
            </view>
          </view>
          <view class="grid grid-cols-3 gap-2 mt-4">
            <view class="rounded-xl text-center" :style="drawerStatStyle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
              <text class="block tabular-nums" :style="drawerStatValStyle">{{ selected.devices.toLocaleString() }}</text>
              <text class="block" :style="drawerStatLabelStyle">{{ t.globe.activeNodes }}</text>
            </view>
            <view class="rounded-xl text-center" :style="drawerStatStyle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>
              <text class="block tabular-nums" :style="drawerStatValStyle">{{ (selected.jobsPerHour / 1000).toFixed(1) }}k</text>
              <text class="block" :style="drawerStatLabelStyle">{{ t.globe.activeJobs }}</text>
            </view>
            <view class="rounded-xl text-center" :style="drawerStatStyle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /></svg>
              <text class="block tabular-nums" :style="drawerStatValStyle">{{ selected.avgLatencyMs }}ms</text>
              <text class="block" :style="drawerStatLabelStyle">Latency</text>
            </view>
          </view>
          <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 12px; line-height: 1.6">{{ regionJobsText(selected) }} · uptime {{ uptimeText }}</text>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { REGIONS, type RegionData } from "@/mock/globe-regions";
import { fmt } from "@/i18n/format";

const t = useT();
const app = useApp();

const W = 440;
const H = 240;

const selected = ref<RegionData | null>(null);
const pulseTick = ref(0);
let pulseTimer = 0;

const global = computed(() => app.global);
const activeNodesText = computed(() => global.value.activeDevices.toLocaleString());
const activeJobsText = computed(() => global.value.todayIncrement.toLocaleString());

const me = REGIONS.find((r) => r.isYou)!;
const otherRegions = computed(() => REGIONS.filter((r) => !r.isYou));

// Pick a random region to pulse each tick (client-only timer).
const pulseRegionId = computed<string | null>(() => {
  if (pulseTick.value === 0) return null;
  return REGIONS[Math.floor(Math.random() * REGIONS.length)].id;
});

// Per-region uptime — stable per open (computed from a ref so it doesn't churn).
const uptimeSeed = ref(0);
const uptimeText = computed(() => (99 + uptimeSeed.value).toFixed(2) + "%");

const dots = computed(() => generateDotMap(W, H));

function select(r: RegionData) {
  uptimeSeed.value = Math.random();
  selected.value = r;
}

function regionName(r: RegionData): string {
  const g = t.value.globe as Record<string, string>;
  return g[r.i18nKey] ?? r.id;
}
function regionDevicesText(r: RegionData): string {
  return fmt(t.value.globe.regionDevices, { n: r.devices.toLocaleString() });
}
function regionLatencyText(r: RegionData): string {
  return fmt(t.value.globe.regionLatency, { n: String(r.avgLatencyMs) });
}
function regionJobsText(r: RegionData): string {
  return fmt(t.value.globe.regionJobs, { n: r.jobsPerHour.toLocaleString() });
}

onMounted(() => {
  pulseTimer = setInterval(() => {
    pulseTick.value += 1;
  }, 1800) as unknown as number;
});
onUnmounted(() => {
  if (pulseTimer) clearInterval(pulseTimer);
});

// Procedural dot-map silhouette (loose continent blobs).
function generateDotMap(w: number, h: number): Array<{ x: number; y: number; r: number; bright: boolean }> {
  const out: Array<{ x: number; y: number; r: number; bright: boolean }> = [];
  const blobs = [
    { cx: 0.22, cy: 0.4, r: 0.13 },
    { cx: 0.3, cy: 0.7, r: 0.08 },
    { cx: 0.5, cy: 0.36, r: 0.11 },
    { cx: 0.55, cy: 0.62, r: 0.12 },
    { cx: 0.78, cy: 0.5, r: 0.16 },
    { cx: 0.85, cy: 0.72, r: 0.06 },
  ];
  const cols = 60;
  const rows = 30;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = (c + 0.5) / cols;
      const ny = (r + 0.5) / rows;
      let nearest = Infinity;
      for (const b of blobs) {
        const dx = nx - b.cx;
        const dy = ny - b.cy;
        const d = Math.sqrt(dx * dx + dy * dy) - b.r;
        if (d < nearest) nearest = d;
      }
      const rng = mulberry32(r * 1000 + c);
      if (nearest < 0.02) {
        out.push({
          x: Math.round(nx * w * 100) / 100,
          y: Math.round(ny * h * 100) / 100,
          r: Math.round((0.9 + rng() * 0.6) * 100) / 100,
          bright: rng() < 0.55,
        });
      } else if (nearest < 0.07 && rng() < 0.25) {
        out.push({
          x: Math.round(nx * w * 100) / 100,
          y: Math.round(ny * h * 100) / 100,
          r: 0.6,
          bright: false,
        });
      }
    }
  }
  return out;
}

function mulberry32(seed: number) {
  return function () {
    let s = (seed += 0x6d2b79f5);
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

// ── styles ──
const statTileStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "12px",
};
const statValStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  marginTop: "4px",
  color: "var(--v5-ink)",
};
const mapCardStyle: CSSProperties = {
  background: "var(--v5-surface-3)",
  borderColor: "var(--v5-border)",
  padding: "12px",
};
const regionCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "16px",
  gap: "12px",
  textAlign: "left",
};
function regionIconBox(isYou?: boolean): CSSProperties {
  return {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: isYou
      ? "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)"
      : "color-mix(in srgb, var(--v5-brand) 10%, transparent)",
  };
}
const youChipStyle: CSSProperties = {
  fontSize: "10px",
  padding: "1px 6px",
  borderRadius: "4px",
  background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)",
  color: "var(--v5-brand-2)",
};
const regionRateStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--v5-brand)",
};
const drawerCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "20px",
};
const drawerCloseStyle: CSSProperties = {
  top: "12px",
  right: "12px",
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
};
function drawerIconBox(isYou?: boolean): CSSProperties {
  return {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: isYou
      ? "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)"
      : "color-mix(in srgb, var(--v5-brand) 10%, transparent)",
  };
}
const drawerStatStyle: CSSProperties = {
  background: "var(--v5-surface-2)",
  padding: "10px",
};
const drawerStatValStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
  marginTop: "4px",
  color: "var(--v5-ink)",
};
const drawerStatLabelStyle: CSSProperties = {
  fontSize: "10px",
  color: "var(--v5-ink-4)",
  marginTop: "2px",
};
</script>

<style scoped>
.nx-globe-drawer {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 12px 16px;
}
.nx-globe-scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--v5-surface-3) 80%, transparent);
  backdrop-filter: blur(4px);
}
</style>
