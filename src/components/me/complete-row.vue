<!--
  CompleteRow — ported from me/wallet/topup/page.tsx CompleteRow.
  Key/value detail row for the KYC-complete card: muted key + right-aligned value
  (mono when `mono`, brand-accent when `accent`).
-->
<template>
  <view class="flex items-baseline justify-between" style="gap: 12px; font-size: 11.5px">
    <text style="color: var(--v5-ink-4)">{{ k }}</text>
    <text class="text-right truncate" :class="{ 'font-mono': mono }" :style="{ color: accent ? 'var(--v5-brand)' : 'var(--v5-ink)' }">{{ v }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ k: string; v: string; mono?: boolean; accent?: boolean }>(), {
  mono: false,
  accent: false,
});
</script>
