<!--
  LiveFeedCard — ZONE 1 dual-tab live ticker (ported from mission-control.tsx
  LiveFeedCard). Activity tab = platform-wide job feed (3.2s, links to globe);
  Earnings tab = peer purchase feed (6.5s, taps through to /team/commissions).
  Segmented tab switch + live pulse. FEED_POOL mock data; names/job strings are
  proper nouns (untranslated, like the source). Chrome labels keyed for bilingual
  parity.
-->
<template>
  <view class="live-feed-card">
    <view class="live-feed-topbar">
      <view class="live-segment">
        <view
          v-for="tb in tabs"
          :key="tb.id"
          class="live-segment-item"
          :class="{ 'is-active': tab === tb.id }"
          @click="tab = tb.id"
        >
          <text>{{ tb.label }}</text>
        </view>
      </view>
      <view class="live-view-all" @click="goViewAll">
        <text>{{ t.home.liveFeedSeeAll }}</text>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </view>
    </view>

    <view v-if="tab === 'activity'" class="activity-list">
      <view
        v-for="(r, i) in activityRows"
        :key="r.k"
        class="activity-row"
        :class="{ 'is-new': i === 0, 'has-divider': i < activityRows.length - 1 }"
      >
        <text class="activity-time">{{ r.ts }}</text>
        <text class="activity-who" :class="whoClass(r)">{{ r.who }}</text>
        <text class="activity-msg">{{ r.msg }}</text>
        <text class="activity-val" :class="valClass(r)">{{ r.val }}</text>
      </view>
    </view>

    <view v-else class="earnings-list" @click="goCommissions">
      <view>
        <view
          v-for="(it, i) in earningsItems"
          :key="it.id"
          class="earnings-row"
          :class="{ 'is-new': i === 0, 'has-divider': i < earningsItems.length - 1 }"
        >
          <view class="earnings-dot" />
          <text class="earnings-name">{{ it.name }}</text>
          <text class="earnings-desc">{{ boughtText(it) }}</text>
          <text class="earnings-amount">+${{ it.amount.toFixed(2) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

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
const tab = ref<"activity" | "earnings">("activity");

const tabs = computed(() => [
  { id: "activity" as const, label: t.value.home.liveFeedTabActivity },
  { id: "earnings" as const, label: t.value.home.liveFeedTabEarnings },
]);

const activityRows = ref<FeedRow[]>(
  FEED_POOL.slice(0, 3).map((r, i) => ({
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
    activityRows.value = [{ ...next, k: activityCounter, ts: "+0:00" }, ...activityRows.value.slice(0, 2)];
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

function whoClass(r: FeedRow): string {
  if (r.lvl === "ok") return "is-you";
  if (r.lvl === "live") return "is-peer";
  return "is-lock";
}
function valClass(r: FeedRow): string {
  if (r.val === "locked") return "is-locked";
  if (r.who === "You") return "is-you";
  return "is-peer";
}
function boughtText(it: CommissionItem): string {
  return fmt(t.value.home.liveFeedBought, { product: it.product });
}
function goCommissions() {
  uni.navigateTo({ url: "/pages/team/commissions", fail: () => {} });
}
function goActivity() {
  uni.navigateTo({ url: "/pages/globe/globe", fail: () => {} });
}
function goViewAll() {
  if (tab.value === "activity") goActivity();
  else goCommissions();
}
</script>

<style scoped>
.live-feed-card {
  --v5-surface-bg: var(--v5-surface);
  color: var(--v5-ink);
}

.live-feed-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 4px 2px 10px;
}

.live-segment {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 9px;
  background: var(--v5-surface-3);
}

html[data-theme="dark"] .live-segment {
  background: linear-gradient(180deg, #111317 0%, #15181C 100%);
}

.live-segment-item {
  padding: 3px 11px;
  border-radius: 6px;
  background: transparent;
  color: var(--v5-ink-3);
  font-family: var(--font-v5);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.005em;
}

.live-segment-item:not(.is-active):active {
  opacity: 0.7;
}

.live-segment-item.is-active {
  color: var(--v5-ink);
  font-weight: 600;
  background: var(--v5-surface-bg);
  box-shadow: 0 1px 2px rgba(0,0,0,0.10), 0 0 0 0.5px var(--v5-border);
}

html[data-theme="dark"] .live-segment-item.is-active {
  background: rgba(30,50,16,0.88);
  box-shadow: none;
}

.live-view-all {
  box-sizing: border-box;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 7px;
  border-radius: 4px;
  color: var(--v5-success);
  font-family: var(--font-numbers);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.live-view-all text {
  color: currentColor;
}

.live-view-all svg {
  width: 14px;
  height: 14px;
  color: currentColor;
}

.activity-list {
  margin-top: 2px;
  padding: 0 2px 6px;
  font-family: var(--font-numbers);
  font-size: 11.5px;
}

.activity-row {
  display: grid;
  grid-template-columns: 44px 38px minmax(0, 1fr) auto;
  column-gap: 8px;
  align-items: center;
  min-height: 48px;
  padding: 8px 0;
  box-sizing: border-box;
  white-space: nowrap;
}

.activity-row.has-divider,
.earnings-row.has-divider {
  border-bottom: 1px solid var(--v5-border);
}

.activity-row.is-new,
.earnings-row.is-new {
  animation: v5-ledger-fade 0.5s ease;
}

.activity-time {
  font-size: 10.5px;
  color: #B8C0CC;
  font-variant-numeric: tabular-nums;
}

html[data-theme="dark"] .activity-time {
  color: #F5F7FA;
}

.activity-who {
  width: 38px;
  justify-self: center;
  box-sizing: border-box;
  padding: 1px 5px;
  border-radius: 3px;
  text-align: center;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.activity-who.is-you {
  background: var(--v5-success-soft);
  color: var(--v5-success);
}

.activity-who.is-peer {
  background: var(--v5-tech-cyan-soft);
  color: var(--v5-tech-cyan);
}

.activity-who.is-lock {
  background: var(--v5-warning-soft);
  color: var(--v5-warning);
}

.activity-msg {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-v5);
  font-size: 12.5px;
  font-weight: 400;
  color: var(--v5-ink-2);
}

.activity-val {
  text-align: right;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.activity-val.is-peer {
  color: var(--v5-success);
}

.activity-val.is-you {
  color: var(--v5-ink-3);
}

.activity-val.is-locked {
  color: var(--v5-ink-4);
}

.earnings-list {
  margin-top: 2px;
}

.earnings-list:active {
  opacity: 0.9;
}

.earnings-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px;
  box-sizing: border-box;
  font-size: 12px;
  white-space: nowrap;
}

.earnings-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--v5-success);
  flex-shrink: 0;
}

.earnings-name {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-v5);
  font-weight: 600;
  color: var(--v5-ink);
}

.earnings-desc {
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--v5-ink-3);
}

.earnings-amount {
  flex-shrink: 0;
  white-space: nowrap;
  font-family: var(--font-numbers);
  font-variant-numeric: tabular-nums;
  color: var(--v5-success);
  font-weight: 500;
}

</style>
