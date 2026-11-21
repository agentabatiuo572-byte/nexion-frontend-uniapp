<!-- Appearance choices apply immediately; the shared bottom sheet owns dismissal. -->
<template>
  <NxSheet :open="open" :title="t.me.themePickerTitle" native-back class="nx-theme-picker-root" @close="emit('close')">
        <GlassSegments :model-value="theme.mode" :options="glassOptions" layout="vertical" semantics="radio" class="nx-theme-options" :label="t.me.themePickerTitle" @select="choose">
          <template #option="{ option, selected }">
            <view class="grid place-items-center shrink-0" :style="iconChipStyle(option.value as ThemeMode)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="selected ? 'var(--v5-brand)' : 'var(--v5-ink-2)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path v-for="d in (option.paths as string[])" :key="d" :d="d" />
              </svg>
            </view>
            <text class="flex-1" :style="labelStyle(option.value as ThemeMode)">{{ option.label }}</text>
            <svg v-if="selected" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </template>
        </GlassSegments>
  </NxSheet>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import NxSheet from "@/components/ui/nx-sheet.vue";
import { useT } from "@/i18n/use-t";
import { useTheme, type ThemeMode } from "@/store/theme";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const t = useT();
const theme = useTheme();

const SUN = ["M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8"];
const MOON = ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"];
const MONITOR = ["M3 4h18v12H3z", "M8 20h8", "M12 16v4"];

const options = computed<{ mode: ThemeMode; label: string; paths: string[] }[]>(() => [
  { mode: "light", label: t.value.me.themeLight, paths: SUN },
  { mode: "dark", label: t.value.me.themeDark, paths: MOON },
  { mode: "system", label: t.value.me.themeSystem, paths: MONITOR },
]);

function isActive(m: ThemeMode): boolean {
  return theme.mode === m;
}

function choose(next: ThemeMode, reason = "activation") {
  theme.setMode(next);
  if (reason !== "arrow") emit("close");
}

function iconChipStyle(m: ThemeMode): CSSProperties {
  const on = isActive(m);
  return {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    background: on ? "color-mix(in srgb, var(--v5-brand) 16%, transparent)" : "var(--v5-surface-3)",
  };
}
function labelStyle(m: ThemeMode): CSSProperties {
  const on = isActive(m);
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "var(--ui-type-body)",
    fontWeight: on ? 600 : 500,
    color: on ? "var(--v5-ink)" : "var(--v5-ink-2)",
  };
}

import GlassSegments from "@/components/glass-segments.vue";
const glassOptions = computed(() => options.value.map(option => ({ ...option, value: option.mode })));
</script>

<style scoped>
.nx-theme-options :deep(.nx-glass-option) { gap: 12px; min-height: 56px; }
</style>
