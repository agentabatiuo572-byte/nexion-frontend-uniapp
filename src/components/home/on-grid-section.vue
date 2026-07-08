<!--
  OnGridSection — ZONE 2 "what the network is computing now" (ported from
  mission-control.tsx OnGridSection). Header (On Nexion grid · now · Map) + 3
  client rows (id badge · model · client·city · GPUs) + live footer. Client list
  is mock data (proper nouns, untranslated).
-->
<template>
  <view class="on-grid-section">
    <view class="on-grid-header">
      <text class="on-grid-title">{{ t.home.onGridTitle }}</text>
      <view class="on-grid-map active:opacity-70" @click="goGlobe">
        <text>{{ t.home.onGridMap }}</text>
        <ChevronRightIcon />
      </view>
    </view>

    <view class="on-grid-card">
      <view
        v-for="(c, i) in GRID_CLIENTS"
        :key="c.id"
        class="on-grid-row"
        :class="{ 'has-divider': i < GRID_CLIENTS.length - 1 }"
      >
        <view class="on-grid-icon" :style="iconBoxStyle(c.color)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="iconStroke(c.icon)" stroke-linecap="round" stroke-linejoin="round">
            <path v-for="d in iconPaths(c.icon)" :key="d" :d="d" />
          </svg>
        </view>
        <view class="on-grid-main">
          <text class="on-grid-model">{{ c.model }}</text>
          <text class="on-grid-meta">
            <text class="on-grid-client">{{ c.name }}</text>
            <text class="on-grid-city"> · {{ c.city }}</text>
          </text>
        </view>
        <text class="on-grid-gpus">{{ gpusText(i) }}</text>
      </view>
      <view class="on-grid-summary">
        <text>
          <text class="on-grid-online-num">28,432</text>
          <text> {{ t.home.onGridOnline }}</text>
        </text>
        <text class="on-grid-rate">+$215/sec</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import ChevronRightIcon from "@/components/icons/chevron-right-icon.vue";
import type { CSSProperties } from "vue";

const t = useT();

const GRID_CLIENTS = [
  { id: "P", name: "Pocket Studios", model: "SDXL Turbo", icon: "IMG" as const, color: "var(--v5-brand)", city: "柏林" },
  { id: "H", name: "Helix Labs", model: "Llama 3.2 3B", icon: "LLM" as const, color: "var(--v5-success)", city: "旧金山" },
  { id: "E", name: "Echo Earbuds", model: "Whisper tiny", icon: "STT" as const, color: "var(--v5-tech-cyan)", city: "东京" },
];

type GridIcon = "IMG" | "LLM" | "STT";

const ICONS: Record<GridIcon, string[]> = {
  IMG: [
    "M6.5 8a2 2 0 1 0 4 0a2 2 0 0 0-4 0m14.427 1.99c-6.61-.908-12.31 4-11.927 10.51",
    "M3 13.066c2.78-.385 5.275.958 6.624 3.1",
    "M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z",
  ],
  LLM: ["M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719", "M8 12h.01", "M12 12h.01", "M16 12h.01"],
  STT: [
    "M11.5 6C7.022 6 4.782 6 3.391 7.172S2 10.229 2 14s0 5.657 1.391 6.828S7.021 22 11.5 22c4.478 0 6.718 0 8.109-1.172S21 17.771 21 14c0-1.17 0-2.158-.041-3",
    "m18.5 2 .258.697c.338.914.507 1.371.84 1.704.334.334.791.503 1.705.841L22 5.5l-.697.258c-.914.338-1.371.507-1.704.84-.334.334-.503.791-.841 1.705L18.5 9l-.258-.697c-.338-.914-.507-1.371-.84-1.704-.334-.334-.791-.503-1.705-.841L15 5.5l.697-.258c.914-.338 1.371-.507 1.704-.84.334-.334.503-.791.841-1.705z",
    "M12 10v8m-3-6v4m-3-3v2m9-3v4m3-3v2",
  ],
};

function iconPaths(icon: GridIcon) {
  return ICONS[icon];
}

function iconStroke(icon: GridIcon) {
  if (icon === "LLM") return 2.25;
  return icon === "IMG" || icon === "STT" ? 1.5 : 2;
}

function iconBoxStyle(color: string): CSSProperties {
  return {
    color,
    background: `color-mix(in srgb, ${color} 14%, var(--v5-surface-2))`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 34%, transparent)`,
  };
}

function gpusText(i: number) {
  return fmt(t.value.home.onGridGpus, { n: 30 + i * 27 });
}
function goGlobe() {
  uni.navigateTo({ url: "/pages/globe/globe", fail: () => {} });
}
</script>

<style scoped>
.on-grid-section {
  --v5-surface-bg: #FFFFFF;
}

.on-grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 2px 16px;
}

.on-grid-title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--v5-ink);
}

.on-grid-map {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: var(--font-numbers);
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-brand);
}

.on-grid-card {
  border-radius: 16px;
  overflow: hidden;
  background: var(--v5-surface-bg);
}

html[data-theme="dark"] .on-grid-card {
  background: linear-gradient(180deg, #111317 0%, #15181C 100%);
}

.on-grid-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) max-content;
  column-gap: 12px;
  align-items: center;
  min-height: 64px;
  box-sizing: border-box;
  padding: 8px 16px;
}

.on-grid-row.has-divider {
  border-bottom: 1px solid var(--v5-border);
}

.on-grid-icon {
  display: grid;
  place-items: center;
  justify-self: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--v5-brand-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v5-brand) 14%, transparent);
}

.on-grid-icon svg {
  width: 20px;
  height: 20px;
}

.on-grid-main {
  min-width: 0;
}

.on-grid-model {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-v5);
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.008em;
  color: var(--v5-ink);
}

.on-grid-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
  font-family: var(--font-numbers);
  font-size: 11.5px;
}

.on-grid-client {
  color: var(--v5-ink-3);
}

.on-grid-city {
  color: var(--v5-ink-4);
}

.on-grid-gpus {
  text-align: right;
  white-space: nowrap;
  font-family: var(--font-numbers);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--v5-success);
}

.on-grid-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid var(--v5-border);
  background: var(--v5-surface-2);
  font-family: var(--font-numbers);
  font-size: 11px;
  color: var(--v5-ink-3);
}

html[data-theme="dark"] .on-grid-summary {
  background: #1B1F24;
}

.on-grid-online-num {
  color: var(--v5-ink);
  font-weight: 500;
}

.on-grid-rate {
  color: var(--v5-success);
  font-weight: 500;
}

@media (max-width: 390px) {
  .on-grid-icon {
    width: 34px;
    height: 34px;
  }

  .on-grid-icon svg {
    width: 19px;
    height: 19px;
  }
}
</style>
