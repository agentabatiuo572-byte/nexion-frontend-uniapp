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
  send: { d: ["M20.5 3.5 10.6 13.4", "M20.5 3.5 14.3 20.5l-3.7-7.1-7.1-3.7z"] },
  bag: { d: ["M5.2 8h13.6l-1.1 11.1a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9z", "M9 10.5V7a3 3 0 0 1 6 0v3.5"] },
  gift: { d: ["M4.5 11.5h15V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z", "M3.5 7.5h17v4h-17z", "M12 7.5V21", "M12 7.5C10.8 4.6 8.9 3.4 7.6 3.9c-1.5.6-.9 3.6 4.4 3.6z", "M12 7.5c1.2-2.9 3.1-4.1 4.4-3.6 1.5.6.9 3.6-4.4 3.6z"] },
} as const satisfies Record<string, { d: readonly string[]; fill?: boolean }>;
export type NxIconName = keyof typeof ICONS;
const props = defineProps<{ name: NxIconName; size?: number }>();
const shape = computed<{ d: readonly string[]; fill?: boolean }>(() => ICONS[props.name]);
const dimension = computed(() => props.size ? String(props.size) : "1em");
</script>
