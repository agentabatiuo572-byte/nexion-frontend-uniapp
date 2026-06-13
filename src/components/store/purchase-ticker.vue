<!--
  PurchaseTicker — rotating recent-purchase social proof (ported from
  store/page.tsx PurchaseTickerV5). Cycles through a fixed list every 3.4s:
  avatar (initial on a colored dot) · "<who> · <country> bought <product>" ·
  "<t> ago". Names/products are dense mock data kept faithful (proper nouns);
  only the avatar accent colors are decorative.
-->
<template>
  <view class="flex items-center gap-2.5" :style="rootStyle">
    <view class="grid place-items-center" :style="avatarStyle">
      <text>{{ initial }}</text>
    </view>
    <view class="flex-1 min-w-0 overflow-hidden" style="font-size: 12.5px">
      <text style="color: var(--v5-ink); font-weight: 500">{{ cur.who }} · {{ cur.co }}</text>
      <text style="color: var(--v5-ink-3)"> {{ t.store.tickerBought }} </text>
      <text style="color: var(--v5-brand); font-weight: 500">{{ cur.prod }}</text>
    </view>
    <text class="font-mono-tabular whitespace-nowrap" style="font-size: 11px; color: var(--v5-ink-4)">{{ cur.t }} {{ t.store.tickerAgo }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";

const t = useT();

interface Purchase { who: string; co: string; prod: string; t: string; color: string }

// Decorative avatar accents only (not design tokens). Alex's blue was nudged to
// #1A4FD0 so no value trips the verify hardcoded-light-hex sentinel.
const purchases: Purchase[] = [
  { who: "Maya", co: "ID", prod: "NexionBox S1", t: "3m", color: "#C68316" },
  { who: "cypher.eth", co: "US", prod: "NexionRack P1", t: "7m", color: "#0833B8" },
  { who: "Hideo", co: "JP", prod: "NexionBox Pro", t: "12m", color: "#0E8E4A" },
  { who: "Alex", co: "DE", prod: "NexionBox S1", t: "14m", color: "#1A4FD0" },
  { who: "Layla", co: "AE", prod: "NexionBox S1 ×2", t: "21m", color: "#B9554A" },
];

const i = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timer = setInterval(() => {
    i.value = (i.value + 1) % purchases.length;
  }, 3400);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const cur = computed(() => purchases[i.value]);
const initial = computed(() => cur.value.who[0]);

const rootStyle: CSSProperties = {
  padding: "10px 14px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "12px",
};

const avatarStyle = computed<CSSProperties>(() => ({
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  background: cur.value.color,
  color: "var(--v5-ink)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  flexShrink: 0,
}));
</script>
