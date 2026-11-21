<!--
  NetworkStatStrip — the home network snapshot strip, shared with the Global network page so both read
  the same: cells split by hairlines (equal unless a one-word label or a figure needs more room at 320px), a small label over a tabular figure. A cell with `count`
  shows the whole number and rolls the digits that change (NxTickNumber); a cell with `text` shows that
  text as given (a band, a rank, "—").
-->
<template>
  <view class="network-compact">
    <view v-for="m in cells" :key="m.key" class="network-compact__cell" :role="m.tap ? 'button' : undefined" :tabindex="m.tap ? 0 : -1" @click="m.tap?.()" @keydown.enter.prevent="m.tap?.()" @keydown.space.prevent="m.tap?.()">
      <text class="network-compact__label">{{ m.label }}</text>
      <NxTickNumber v-if="m.count !== undefined" class="network-compact__value" :value="m.count" />
      <text v-else class="network-compact__value" :style="m.vSize ? { fontSize: m.vSize } : {}">{{ m.text }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import NxTickNumber from "@/components/ui/nx-tick-number.vue";

export interface NetworkStatCell {
  key: string;
  label: string;
  /** A whole count; null shows "—". */
  count?: number | null;
  text?: string;
  vSize?: string;
  tap?: () => void;
}
defineProps<{ cells: NetworkStatCell[] }>();
</script>

<style scoped>
.network-compact {position:relative;overflow:hidden;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(min-content,1fr);padding:16px 0;border-radius:22px;border:1px solid var(--v5-border);background:var(--v5-surface);}
.network-compact::before {content:'';position:absolute;inset:0;background-image:radial-gradient(color-mix(in srgb,var(--v5-brand) 10%,transparent) 1px,transparent 1.2px);background-size:10px 10px;mask-image:radial-gradient(80% 120% at 70% 50%,#000,transparent 75%);pointer-events:none;}
.network-compact__cell {position:relative;min-width:0;padding:0 14px;border-left:1px solid var(--v5-border);}
.network-compact__cell:first-child {border:0;padding-left:16px;}
.network-compact__label {display:block;font:400 12.5px/18px var(--font-v5);color:var(--v5-ink-3);min-height:36px;}
.network-compact__value {display:block;margin-top:4px;font:600 18px/24px var(--font-metric);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
</style>
