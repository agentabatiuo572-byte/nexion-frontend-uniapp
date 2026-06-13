<!--
  SectionHeader (me) — ported from me/page.tsx SectionHeader.
  Strict port of styles-v5.css .tech-sec-h: title (display 600 15 -0.012 ink) +
  optional count (mono 11.5 ink-3) + optional right link (display 500 13 ink-3 +
  chevron). The link navigates via `link` (uni route) with fail:()=>{} for
  not-yet-ported targets.
-->
<template>
  <view class="flex items-center justify-between" style="margin: 22px 2px 12px">
    <view class="inline-flex items-center" style="gap: 8px">
      <text style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); letter-spacing: -0.012em">{{ title }}</text>
      <text v-if="count" style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 11.5px; font-weight: 400; color: var(--v5-ink-3)">{{ count }}</text>
    </view>
    <view v-if="link && linkLabel" class="inline-flex items-center gap-0.5" style="font-family: var(--font-v5); font-weight: 500; font-size: 13px; color: var(--v5-ink-3)" @click="go">
      <text>{{ linkLabel }}</text>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  count?: string;
  link?: string;
  linkLabel?: string;
}>();

function go() {
  if (!props.link) return;
  uni.navigateTo({ url: props.link, fail: () => {} });
}
</script>
