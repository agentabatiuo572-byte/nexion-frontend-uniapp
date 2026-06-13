<!--
  VsPhoneHero — phone-vs-S1 yield contrast (ported from store/page.tsx
  VsPhoneHeroV5). $0.06/d ↔ 640× more ↔ $38.50/d, with NEX/d sublines. Brand +
  brand-2 radial ambient. Drives the core "640× your phone" conversion hook.
-->
<template>
  <view class="relative overflow-hidden" :style="rootStyle">
    <view aria-hidden :style="auroraStyle" />
    <view class="relative grid gap-2.5 items-center" style="grid-template-columns: 1fr auto 1fr">
      <!-- Your phone -->
      <view>
        <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-4)">{{ t.store.vsYourPhone }}</text>
        <view class="mt-1 tabular-nums whitespace-nowrap" :style="phoneNumStyle">
          <text>$0.06</text><text style="font-size: 13px; color: var(--v5-ink-4); font-weight: 500">{{ t.store.vsPerDay }}</text>
        </view>
        <text class="block mt-1 font-mono-tabular whitespace-nowrap" style="font-size: 12px; color: var(--v5-brand); font-weight: 500">{{ t.store.vsNexPerDay }}</text>
      </view>
      <!-- Arrow + 640× chip -->
      <view class="flex flex-col items-center gap-1 px-1">
        <text class="font-mono-tabular" style="font-size: 15px; color: var(--v5-brand-2); line-height: 1">→</text>
        <text class="whitespace-nowrap tabular-nums" :style="chipStyle">{{ t.store.vsMore }}</text>
      </view>
      <!-- S1 -->
      <view class="text-right">
        <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-4)">{{ t.store.vsPhoneS1 }}</text>
        <view class="mt-1 tabular-nums whitespace-nowrap" :style="s1NumStyle">
          <text>$38.50</text><text style="font-size: 13px; color: var(--v5-ink-4); font-weight: 500">{{ t.store.vsPerDay }}</text>
        </view>
        <text class="block mt-1 font-mono-tabular whitespace-nowrap" style="font-size: 12px; color: var(--v5-brand); font-weight: 500">{{ t.store.vsS1NexPerDay }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";

const t = useT();

const rootStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "14px 16px",
};

const auroraStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(40% 50% at 90% 50%, var(--v5-brand-soft) 0%, transparent 60%)," +
    "radial-gradient(40% 50% at 10% 50%, var(--v5-brand-2-soft) 0%, transparent 60%)",
  filter: "blur(12px)",
  opacity: 0.6,
  pointerEvents: "none",
};

const phoneNumStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "22px",
  color: "var(--v5-ink-2)",
  letterSpacing: "-0.020em",
  lineHeight: 1,
};

const s1NumStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "22px",
  color: "var(--v5-success)",
  letterSpacing: "-0.020em",
  lineHeight: 1,
};

const chipStyle: CSSProperties = {
  padding: "4px 10px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand-2)",
  borderRadius: "999px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  letterSpacing: "-0.005em",
};
</script>
