<!--
  LiveFeedCard — ZONE 1 dual-tab live ticker (ported from mission-control.tsx
  LiveFeedCard). Activity tab = platform-wide job feed (3.2s); Earnings tab =
  peer purchase feed (6.5s, taps through to /team/commissions). Segmented tab
  switch + live pulse. FEED_POOL mock data; names/job strings are proper nouns
  (untranslated, like the source). Chrome labels keyed for bilingual parity.
-->
<template>
  <view class="live-feed-card">
    <!-- Tab switcher + live pulse -->
    <view class="px-0.5 pt-1 pb-2.5 flex items-center justify-between gap-2">
      <view class="flex gap-0.5" style="padding: 3px; background: linear-gradient(180deg, #111317 0%, #15181C 100%); border-radius: 9px">
        <view
          v-for="tb in tabs"
          :key="tb.id"
          :class="tab === tb.id ? '' : 'active:opacity-70 transition-opacity'"
          :style="tabStyle(tb.id)"
          @click="tab = tb.id"
        >
          <text :style="{ color: tab === tb.id ? 'var(--v5-ink)' : 'var(--v5-ink-3)', fontWeight: tab === tb.id ? 600 : 500, fontFamily: 'var(--font-v5)', fontSize: '12px', letterSpacing: '-0.005em' }">{{ tb.label }}</text>
        </view>
      </view>
      <view class="inline-flex items-center font-mono-tabular" style="gap: 6px; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; font-weight: 500" :style="{ background: pulseBg, color: pulseColor }">
        <PulseDot :color="pulseColor" :size="5" />
        <text :style="{ color: pulseColor }">{{ t.home.liveFeedLive }}</text>
      </view>
    </view>

    <!-- Activity tab -->
    <view v-if="tab === 'activity'" class="font-mono-tabular" style="margin-top: -6px; padding: 0 2px 6px; font-size: 11.5px">
      <view
        v-for="(r, i) in activityRows"
        :key="r.k"
        class="grid items-center py-2 whitespace-nowrap"
        :style="{ gridTemplateColumns: '44px 38px 1fr auto', columnGap: '8px', borderBottom: i < activityRows.length - 1 ? '1px solid var(--v5-border)' : 'none', animation: i === 0 ? 'v5-ledger-fade 0.5s ease' : 'none' }"
      >
        <text class="tabular-nums" style="font-size: 10.5px; color: var(--home-live-feed-time)">{{ r.ts }}</text>
        <text class="text-center" :style="whoBadgeStyle(r)">{{ r.who }}</text>
        <text class="truncate" style="font-family: var(--font-v5); font-weight: 400; font-size: 12.5px; color: var(--v5-ink-2)">{{ r.msg }}</text>
        <text class="tabular-nums text-right" style="font-weight: 500" :style="{ color: valColor(r) }">{{ r.val }}</text>
      </view>
    </view>

    <!-- Earnings tab -->
    <view v-else class="block active:opacity-90 transition-opacity" style="margin-top: -6px" @click="goCommissions">
      <view>
        <view
          v-for="(it, i) in earningsItems"
          :key="it.id"
          class="px-0.5 py-2 flex items-center gap-2"
          :style="{ fontSize: '12px', borderBottom: i < earningsItems.length - 1 ? '1px solid var(--v5-border)' : 'none', animation: i === 0 ? 'v5-ledger-fade 0.5s ease' : 'none' }"
        >
          <view style="width: 5px; height: 5px; border-radius: 50%; background: var(--v5-success); flex-shrink: 0" />
          <text style="font-family: var(--font-v5); font-weight: 600; color: var(--v5-ink)">{{ it.name }}</text>
          <text class="truncate flex-1" style="color: var(--v5-ink-3)">{{ boughtText(it) }}</text>
          <text class="font-mono-tabular tabular-nums whitespace-nowrap" style="color: var(--v5-success); font-weight: 500">+${{ it.amount.toFixed(2) }}</text>
        </view>
      </view>
      <view class="px-0.5 py-2 flex items-center justify-end gap-1 font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-3); border-top: 1px solid var(--v5-border)">
        <text style="color: var(--v5-ink-3)">{{ t.home.liveFeedSeeAll }}</text>
        <svg style="color: var(--v5-ink-4)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useTheme } from "@/store/theme";
import PulseDot from "./pulse-dot.vue";

interface FeedRow {
  k: number;
  lvl: "ok" | "live" | "warn";
  who: string;
  msg: string;
  val: string;
  ts: string;
}
interface CommissionItem {
  id: number;
  name: string;
  product: string;
  amount: number;
}

const FEED_POOL: Omit<FeedRow, "k" | "ts">[] = [
  { lvl: "ok", who: "You", msg: "SDXL Turbo @ Pocket Studios", val: "+$0.00032" },
  { lvl: "live", who: "Peer", msg: "Maya · ID — Llama 70B @ Helix Labs", val: "+$0.247" },
  { lvl: "live", who: "Peer", msg: "cypher.eth — Sora 8s @ Atrium AI", val: "+$0.612" },
  { lvl: "ok", who: "You", msg: "Whisper tiny @ Echo Earbuds", val: "+$0.00009" },
  { lvl: "live", who: "Peer", msg: "Hideo · JP — Flux dev @ Mosaic", val: "+$0.182" },
  { lvl: "live", who: "Peer", msg: "Layla · AE — Llama 405B @ Conduit AI", val: "+$1.204" },
  { lvl: "warn", who: "Lock", msg: "Llama 70B LoRA @ Vector — needs 192GB", val: "locked" },
  { lvl: "ok", who: "You", msg: "MobileBERT @ Vector Foundry", val: "+$0.00007" },
];

const t = useT();
const theme = useTheme();
const tab = ref<"activity" | "earnings">("activity");

const tabs = computed(() => [
  { id: "activity" as const, label: t.value.home.liveFeedTabActivity },
  { id: "earnings" as const, label: t.value.home.liveFeedTabEarnings },
]);

const activityRows = ref<FeedRow[]>(
  FEED_POOL.slice(0, 6).map((r, i) => ({
    ...r,
    k: i + 1,
    ts: `+${Math.floor((i * 4) / 60)}:${String((i * 4) % 60).padStart(2, "0")}`,
  })),
);
let activityCounter = 100;

const earningsItems = ref<CommissionItem[]>([
  { id: 1, name: "Tom Wang", product: "NexionBox Pro", amount: 89.9 },
  { id: 2, name: "Lisa Park", product: "NexionBox S1", amount: 29.9 },
  { id: 3, name: "Sara L.", product: "NexionRack P1", amount: 349.9 },
]);
let earningsId = 100;

let actTimer: ReturnType<typeof setInterval> | null = null;
let earnTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  actTimer = setInterval(() => {
    const next = FEED_POOL[Math.floor(Math.random() * FEED_POOL.length)];
    activityCounter += 1;
    activityRows.value = [{ ...next, k: activityCounter, ts: "+0:00" }, ...activityRows.value.slice(0, 5)];
  }, 3200);
  const names = ["Sarah K.", "Tom Wang", "Lisa Park", "Diego P.", "Yuki H.", "Mehmet A.", "Mila V."];
  const products = [
    { p: "NexionBox S1", a: 29.9 },
    { p: "NexionBox Pro", a: 89.9 },
    { p: "NexionRack P1", a: 349.9 },
  ];
  earnTimer = setInterval(() => {
    const n = names[Math.floor(Math.random() * names.length)];
    const pr = products[Math.floor(Math.random() * products.length)];
    earningsId += 1;
    earningsItems.value = [{ id: earningsId, name: n, product: pr.p, amount: pr.a }, ...earningsItems.value.slice(0, 2)];
  }, 6500);
});
onUnmounted(() => {
  if (actTimer) clearInterval(actTimer);
  if (earnTimer) clearInterval(earnTimer);
});

const pulseColor = computed(() => (theme.mode === "dark" ? "#8e72ff" : "var(--v5-success)"));
const pulseBg = computed(() => (theme.mode === "dark" ? "rgba(142, 114, 255, 0.2)" : "var(--v5-success-soft)"));

function tabStyle(id: "activity" | "earnings"): CSSProperties {
  const on = tab.value === id;
  const darkOn = on && theme.mode === "dark";
  return {
    padding: "3px 11px",
    borderRadius: "6px",
    background: darkOn ? "rgba(30, 50, 16, 0.88)" : on ? "var(--v5-surface-bg)" : "transparent",
    boxShadow: darkOn
      ? "none"
      : on
        ? "0 1px 2px rgba(0,0,0,0.10), 0 0 0 0.5px var(--v5-border)"
        : "none",
  };
}
function whoBadgeStyle(r: FeedRow): CSSProperties {
  const bg = r.lvl === "ok" ? "var(--v5-success-soft)" : r.lvl === "live" ? "var(--v5-tech-cyan-soft)" : "var(--v5-warning-soft)";
  const color = r.lvl === "ok" ? "var(--v5-success)" : r.lvl === "live" ? "var(--v5-tech-cyan)" : "var(--v5-warning)";
  return { fontSize: "10.5px", fontWeight: 500, padding: "1px 5px", borderRadius: "3px", letterSpacing: "0.04em", background: bg, color };
}
function valColor(r: FeedRow): string {
  return r.val === "locked" ? "var(--v5-ink-4)" : r.who === "You" ? "var(--v5-ink-3)" : "var(--v5-success)";
}
function boughtText(it: CommissionItem): string {
  return fmt(t.value.home.liveFeedBought, { product: it.product });
}
function goCommissions() {
  uni.navigateTo({ url: "/pages/team/commissions", fail: () => {} });
}
</script>

<style scoped>
.live-feed-card {
  --home-live-feed-live-color: var(--v5-success);
  --home-live-feed-live-bg: var(--v5-success-soft);
}

:global(html[data-theme="dark"]) .live-feed-card {
  --home-live-feed-live-color: #8e72ff;
  --home-live-feed-live-bg: rgba(142, 114, 255, 0.2);
}
</style>
