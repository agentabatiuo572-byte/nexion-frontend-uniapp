<template>
  <NativeSvg class="nx-icon" :width="dimension" :height="dimension" viewBox="0 0 24 24" :fill="shape.fill ? 'currentColor' : 'none'" :stroke="shape.fill ? 'none' : 'currentColor'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
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
} as const satisfies Record<string, { d: readonly string[]; fill?: boolean }>;
export type NxIconName = keyof typeof ICONS;
const props = defineProps<{ name: NxIconName; size?: number }>();
const shape = computed<{ d: readonly string[]; fill?: boolean }>(() => ICONS[props.name]);
const dimension = computed(() => props.size ? String(props.size) : "1em");
</script>
