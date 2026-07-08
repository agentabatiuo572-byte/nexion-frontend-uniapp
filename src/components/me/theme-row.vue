<!--
  ThemeRow — ported from me/page.tsx ThemeRow.
  Light/Dark appearance toggle: label + 2-segment iOS-style pill bound to the
  theme store (setMode applies data-theme on H5).
-->
<template>
  <view class="flex items-center" :style="rowStyle">
    <text class="flex-1 truncate" :style="labelStyle">{{ t.me.themeRow }}</text>

    <!-- 2-segment pill -->
    <view class="shrink-0 inline-flex items-center" :style="pillWrapStyle">
      <view class="inline-flex items-center active:opacity-80" :style="segStyle('light')" @click="set('light')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="mode === 'light' ? 'var(--v5-ink)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
        <text style="margin-left: 4px">{{ t.me.themeLight }}</text>
      </view>
      <view class="inline-flex items-center active:opacity-80" :style="segStyle('dark')" @click="set('dark')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="mode === 'dark' ? 'var(--v5-ink)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
        <text style="margin-left: 4px">{{ t.me.themeDark }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useTheme, type ThemeMode } from "@/store/theme";

const t = useT();
const theme = useTheme();
const props = withDefaults(defineProps<{ last?: boolean }>(), { last: false });
const mode = computed(() => theme.mode);

function set(next: ThemeMode) {
  theme.setMode(next);
}

const rowStyle = computed<CSSProperties>(() => ({
  gap: "12px",
  padding: "8px 14px",
  borderBottom: props.last ? "none" : "1px solid var(--v5-border)",
}));
const labelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  color: "var(--v5-ink)",
  whiteSpace: "nowrap",
};
const pillWrapStyle: CSSProperties = {
  padding: "3px",
  gap: "2px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
};
function segStyle(seg: ThemeMode): CSSProperties {
  const on = mode.value === seg;
  return {
    gap: "4px",
    height: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    background: on ? "var(--v5-surface)" : "transparent",
    color: on ? "var(--v5-ink)" : "var(--v5-ink-3)",
    fontFamily: "var(--font-v5)",
    fontWeight: on ? 600 : 500,
    fontSize: "12px",
    letterSpacing: "-0.005em",
  };
}
</script>
