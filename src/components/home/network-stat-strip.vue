<!--
  NetworkStatStrip — the home network snapshot strip, shared with the Global network page so both read
  the same: cells split by hairlines (equal unless a one-word label or a figure needs more room at 360px), a small label over a tabular figure. A cell with `roll`
  shows its band text through NxTickNumber, so a band change rolls the changed digits; other cells show their
  text as given (a rank, "—"). A `live` cell with a figure carries the breathing online dot, paused off-screen.
-->
<template>
  <view ref="elRef" class="network-compact" :class="{ 'nx-loops-paused': !running }">
    <view v-for="m in cells" :key="m.key" class="network-compact__cell" :role="m.tap ? 'button' : undefined" :tabindex="m.tap ? 0 : -1" @click="m.tap?.()" @keydown.enter.prevent="m.tap?.()" @keydown.space.prevent="m.tap?.()">
      <text class="network-compact__label">{{ m.label }}</text>
      <view class="network-compact__value-row">
        <view v-if="m.live && m.text !== null && m.text !== '—'" class="network-compact__dot nx-online-dot" aria-hidden="true" />
        <NxTickNumber v-if="m.roll" class="network-compact__value" :text="m.text" />
        <text v-else class="network-compact__value" :style="m.vSize ? { fontSize: m.vSize } : {}">{{ m.text }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import NxTickNumber from "@/components/ui/nx-tick-number.vue";
import { useLoopsInView } from "@/composables/use-loops-in-view";

export interface NetworkStatCell {
  key: string;
  label: string;
  /** The shown figure; null shows "—". */
  text: string | null;
  /** Roll changed digits (platform bands). */
  roll?: boolean;
  /** An online figure: breathing dot beside the value. */
  live?: boolean;
  vSize?: string;
  tap?: () => void;
}
defineProps<{ cells: NetworkStatCell[] }>();
const { elRef, running } = useLoopsInView(".network-compact");
</script>

<style scoped>
.network-compact {position:relative;overflow:hidden;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(min-content,1fr);padding:16px 0;border-radius:22px;border:1px solid var(--v5-border);background:var(--v5-surface);}
.network-compact::before {content:'';position:absolute;inset:0;background-image:radial-gradient(color-mix(in srgb,var(--v5-brand) 10%,transparent) 1px,transparent 1.2px);background-size:10px 10px;mask-image:radial-gradient(80% 120% at 70% 50%,#000,transparent 75%);pointer-events:none;}
.network-compact__cell {position:relative;min-width:0;padding:0 14px;border-left:1px solid var(--v5-border);}
.network-compact__cell:first-child {border:0;padding-left:16px;}
.network-compact__label {display:block;font:var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5);color:var(--v5-ink-3);min-height:36px;}
.network-compact__value-row {display:flex;align-items:center;gap:6px;margin-top:4px;min-width:0;}
.network-compact__dot {flex:none;width:6px;height:6px;border-radius:50%;background:var(--v5-success);}
.network-compact__value {display:block;font:var(--ui-type-metric-value-weight) var(--ui-type-metric-value)/var(--ui-type-metric-value-lh) var(--font-metric);font-variant-numeric:tabular-nums;color:var(--v5-ink);overflow-wrap:break-word;}
</style>
