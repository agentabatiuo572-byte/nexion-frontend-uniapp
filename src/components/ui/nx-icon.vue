<template>
  <NativeSvg class="nx-icon" :width="dimension" :height="dimension" viewBox="0 0 24 24" :fill="shape.fill ? 'currentColor' : 'none'" :stroke="shape.fill ? 'none' : 'currentColor'" :stroke-width="shape.stroke ?? 2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="d in shape.d" :key="d" :d="d" />
  </NativeSvg>
</template>
<script setup lang="ts">
// Shared UI glyphs (design system 03 icons): currentColor, hidden from screen readers, 1em by default so
// the icon follows the label's size. The stroke style matches the nx-list-row chevron. Text characters
// (› → + ✓ ▾) are never used as icons: they change shape with the font.
import { computed } from "vue";
import NativeSvg from "@/components/native-svg.vue";
const ICONS = {
  "chevron-right": { d: ["m9 6 6 6-6 6"] },
  "chevron-down": { d: ["m6 9 6 6 6-6"] },
  "arrow-right": { d: ["M5 12h14", "m13 6 6 6-6 6"] },
  "arrow-left": { d: ["M19 12H5", "m11 6-6 6 6 6"] },
  "arrow-left-right": { d: ["M4 12h16", "m8 8-4 4 4 4", "m16 8 4 4-4 4"] },
  "arrow-down": { d: ["M12 5v14", "m6 13 6 6 6-6"] },
  "arrow-up": { d: ["M12 19V5", "m6 11 6-6 6 6"] },
  "arrow-up-right": { d: ["M7 17 17 7", "M8 7h9v9"] },
  plus: { d: ["M12 5v14", "M5 12h14"] },
  close: { d: ["M6 6l12 12", "M18 6 6 18"] },
  minus: { d: ["M5 12h14"] },
  check: { d: ["m5 12.5 4.5 4.5L19 7"] },
  "caret-up": { d: ["M12 7.5 18.5 16h-13z"], fill: true },
  "caret-down": { d: ["M12 16.5 5.5 8h13z"], fill: true },
  more: { d: ["M3.2 12a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0", "M10.2 12a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0", "M17.2 12a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0"], fill: true },
  clock: { d: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"] },
  sparkle: { d: ["M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z"], fill: true },
  star: { d: ["M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"] },
  flame: { d: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"] },
  "trending-up": { d: ["M16 7h6v6", "m22 7-8.5 8.5-5-5L2 17"] },
  "chevrons-up": { d: ["m17 11-5-5-5 5", "m17 18-5-5-5 5"] },
  crown: { d: ["M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z", "M5 21h14"] },
  sprout: { d: ["M7 20h10", "M10 20c5.5-2.5.8-6.4 3-10", "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z", "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"] },
  send: { d: ["M20.5 3.5 10.6 13.4", "M20.5 3.5 14.3 20.5l-3.7-7.1-7.1-3.7z"] },
  bag: { d: ["M5.2 8h13.6l-1.1 11.1a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9z", "M9 10.5V7a3 3 0 0 1 6 0v3.5"] },
  gift: { d: ["M4.5 11.5h15V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z", "M3.5 7.5h17v4h-17z", "M12 7.5V21", "M12 7.5C10.8 4.6 8.9 3.4 7.6 3.9c-1.5.6-.9 3.6 4.4 3.6z", "M12 7.5c1.2-2.9 3.1-4.1 4.4-3.6 1.5.6.9 3.6-4.4 3.6z"] },
  // 提示气泡的图标（03 §3.5.1）：中性说明 i、警示感叹号；线宽 1.9 同画板。
  "hint-info": { d: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M12 11v5.5", "M12 7.6h.01"], stroke: 1.9 },
  "hint-warn": { d: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M12 7v6", "M12 16.6h.01"], stroke: 1.9 },
  // 我的等级权益和条件的图形（team-rank DESIGN 第 9 节 glyph-*.svg，线宽 1.8 同原图），由 NxIconTile 着色。
  "rank-rate-l1": { d: ["M12.2 8a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0z", "M3.5 19c.6-3 2.8-4.8 5.5-4.8 1.3 0 2.4.4 3.3 1", "m15.5 19.5 5-7.5", "M17.3 13a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0z", "M21.3 18.6a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0z"], stroke: 1.8 },
  "rank-rate-l2": { d: ["M10.1 9a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z", "M3 18.5c.5-2.6 2.2-4 4.5-4", "M15.1 6.5a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z", "M9 14.2c.9-1.4 2.1-2.2 3.5-2.2", "m15.5 19.5 5-7.5", "M17.3 13a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0z", "M21.3 18.6a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0z"], stroke: 1.8 },
  "rank-uvt": { d: ["m12 3 8 4.5v9L12 21l-8-4.5v-9z", "M9 8.5v4a3 3 0 0 0 6 0v-4"], stroke: 1.8 },
  "rank-salary": { d: ["M6.5 5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z", "M3.5 10h17M8 3v4M16 3v4", "M14 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"], stroke: 1.8 },
  "rank-letter": { d: ["M5.5 5.5h13A2.5 2.5 0 0 1 21 8v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V8a2.5 2.5 0 0 1 2.5-2.5z", "m4 7 8 6 8-6"], stroke: 1.8 },
  "rank-review": { d: ["M12 3 5 6v5.5c0 4.2 2.9 7.8 7 9.5 4.1-1.7 7-5.3 7-9.5V6z", "m8.8 12.2 2.3 2.3 4.3-4.6"], stroke: 1.8 },
} as const satisfies Record<string, { d: readonly string[]; fill?: boolean; stroke?: number }>;
export type NxIconName = keyof typeof ICONS;
const props = defineProps<{ name: NxIconName; size?: number }>();
const shape = computed<{ d: readonly string[]; fill?: boolean; stroke?: number }>(() => ICONS[props.name]);
const dimension = computed(() => props.size ? String(props.size) : "1em");
</script>
