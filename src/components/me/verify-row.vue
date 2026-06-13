<!--
  VerifyRow — ported from me/wallet/topup/page.tsx VerifyRow (KYC verifying step).
  3-state row (done / active / pending): tinted bg + step badge (check or "{n}/3")
  + label + optional active spinner. `enabled` gates the active vs pending look;
  `pendingHint` shows a "(finalizing)" suffix on the active-but-not-done step.
-->
<template>
  <view class="flex items-center" :style="rowStyle">
    <view class="grid place-items-center tabular-nums" :style="badgeStyle">
      <svg v-if="done" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      <text v-else style="font-size: 11px; font-weight: 600">{{ step }}/3</text>
    </view>
    <view class="flex-1" style="margin-left: 12px; font-size: 12.5px">
      <text :style="labelStyle">{{ label }}</text>
      <text v-if="pendingHint && isActive" style="margin-left: 6px; font-size: 10.5px; color: var(--v5-ink-4)">({{ pendingHint }})</text>
    </view>
    <view v-if="isActive" :style="spinnerStyle" />
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{ step: number; label: string; done: boolean; enabled?: boolean; pendingHint?: string }>(),
  { enabled: true },
);

const isActive = computed(() => props.enabled && !props.done);
const isPending = computed(() => !props.enabled);

const rowStyle = computed<CSSProperties>(() => ({
  padding: "10px 12px",
  borderRadius: "12px",
  background: props.done
    ? "color-mix(in srgb, var(--v5-brand) 8%, transparent)"
    : isActive.value
      ? "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)"
      : "var(--v5-surface)",
  border: `1px solid ${
    props.done
      ? "var(--v5-brand-border)"
      : isActive.value
        ? "var(--v5-brand-2-border)"
        : "var(--v5-border)"
  }`,
}));
const badgeStyle = computed<CSSProperties>(() => ({
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  flexShrink: 0,
  background: props.done ? "var(--v5-brand)" : isActive.value ? "var(--v5-brand-2)" : "var(--v5-surface-2)",
  color: props.done || isActive.value ? "var(--v5-ink)" : "var(--v5-ink-4)",
}));
const labelStyle = computed<CSSProperties>(() => ({
  color: props.done ? "var(--v5-ink-2)" : isPending.value ? "var(--v5-ink-4)" : "var(--v5-ink)",
}));
const spinnerStyle: CSSProperties = {
  width: "14px",
  height: "14px",
  borderRadius: "50%",
  border: "2px solid color-mix(in srgb, var(--v5-brand-2) 30%, transparent)",
  borderTopColor: "var(--v5-brand-2)",
  animation: "spin 1s linear infinite",
  flexShrink: 0,
};
</script>
