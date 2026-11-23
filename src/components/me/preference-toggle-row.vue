<!--
  PreferenceToggleRow — icon box + label/hint + iOS-style switch. Ported from the
  inline ToggleRow in Nexion-prototype me/preferences/page.tsx. Icon goes in the
  `icon` slot; tapping the whole row emits `toggle`. The switch face is the
  shared NxSwitch (03 §3.3).
-->
<template>
  <view v-if="value === null" class="flex items-start" :style="[rowStyle, { opacity: 1 }]" role="group" tabindex="-1" aria-disabled="true" :aria-label="label + ' · ' + unknownLabel">
    <view class="grid place-items-center shrink-0" :style="iconBoxStyle"><slot name="icon" /></view>
    <view class="min-w-0" style="flex: 1"><text class="block" :style="labelStyle">{{ label }}</text><text v-if="hint" class="block" :style="hintStyle">{{ hint }}</text></view>
    <NxSwitch :checked="null" />
  </view>
  <view
    v-else
    class="flex items-start transition"
    :class="locked ? '' : 'active:bg-[var(--v5-surface-2)]'"
    :style="rowStyle"
    role="switch"
    :tabindex="locked ? -1 : 0"
    :aria-label="label"
    :aria-checked="value ? 'true' : 'false'"
    :aria-disabled="locked ? 'true' : undefined"
    @click="locked ? undefined : emit('toggle')"
    @keydown.enter.prevent="locked ? undefined : emit('toggle')"
    @keydown.space.prevent="locked ? undefined : emit('toggle')"
  >
    <view class="grid place-items-center shrink-0" :style="iconBoxStyle">
      <slot name="icon" />
    </view>
    <view class="min-w-0" style="flex: 1">
      <text class="block" :style="labelStyle">{{ label }}</text>
      <text v-if="hint" class="block" :style="hintStyle">{{ hint }}</text>
    </view>
    <NxSwitch :checked="value" />
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import NxSwitch from "@/components/ui/nx-switch.vue";

const props = withDefaults(
  defineProps<{ label: string; hint?: string; value: boolean | null; last?: boolean; locked?: boolean; unknownLabel?: string }>(),
  { last: false, locked: false, unknownLabel: "—" },
);
const emit = defineEmits<{ toggle: [] }>();

const rowStyle = computed<CSSProperties>(() => ({
  gap: "12px",
  padding: "12px 14px",
  borderBottom: props.last ? "none" : "1px solid var(--v5-border)",
  // 锁定行整体降一档对比:它仍是信息(说明这类通知存在且强制开启),但明确不是可操作项。
  opacity: props.locked ? 0.72 : 1,
}));
const iconBoxStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "6px",
  background: "var(--v5-surface-2)",
};
// A settings row (03 §3.5, 10.1): list-title role at the menu-row weight 400; the hint is the list-subtitle role, 4px under it.
const labelStyle: CSSProperties = { fontSize: "var(--ui-type-list-title)", lineHeight: "var(--ui-type-list-title-lh)", fontWeight: 400, color: "var(--v5-ink)" };
const hintStyle: CSSProperties = { fontSize: "var(--ui-type-list-subtitle)", lineHeight: "var(--ui-type-list-subtitle-lh)", color: "var(--v5-ink-3)", marginTop: "4px" };
</script>
