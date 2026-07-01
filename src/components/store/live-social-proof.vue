<!--
  LiveSocialProof — live-activity danmaku overlay anchored to the product image
  bottom-left (parent must be position:relative). Ported from
  Nexion-prototype/app/components/live-social-proof.tsx.

  Rows (deterministic from product.id seed, then jitter every 12s):
    1. {viewing} viewing right now
    2. {sold24h} sold · 24h
    3. {sold30m} sold · 30m
    4. only {stock} left  (only if product.stock < 50)

  3 visible rows; the list is duplicated and scrolled with @keyframes dnk-scroll
  (in tokens.css) so translateY(-50%) wraps seamlessly. Top/bottom fade mask
  softens entering/exiting rows.
-->
<template>
  <view class="absolute" :style="rootStyle" :aria-label="w.label">
    <view :style="listStyle">
      <view v-for="(r, i) in doubled" :key="i" class="flex items-baseline" :style="rowStyle">
        <view aria-hidden class="shrink-0" :style="dotStyle(r.color)" />
        <text class="shrink-0 tabular-nums" :style="numStyle(r.color)">{{ r.n.toLocaleString() }}</text>
        <text class="truncate" :style="labelStyle">{{ r.label }}</text>
        <text v-if="r.hot" class="shrink-0" style="color: var(--v5-brand-2); font-size: 11px; margin-left: 1px">⚡</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import type { Product } from "@/mock/products";
import { useT } from "@/i18n/use-t";

const props = defineProps<{ product: Product }>();
const t = useT();
const w = computed(() => t.value.store.liveProof);

function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t2 = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2;
    return ((t2 ^ (t2 >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const rng = seeded(hashId(props.product.id));
const baseViewing = 24 + Math.floor(rng() * 92); // 24-115
const baseSold24h = Math.max(8, Math.floor(props.product.sold * 0.024));
const baseSold30m = Math.max(1, Math.floor(baseSold24h * 0.022));

const viewing = ref(baseViewing);
const sold24h = ref(baseSold24h);
const sold30m = ref(baseSold30m);
const mounted = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  mounted.value = true;
  timer = setInterval(() => {
    viewing.value = baseViewing + Math.floor(Math.random() * 12) - 5;
    if (Math.random() < 0.3) sold24h.value += 1;
    if (Math.random() < 0.06) sold30m.value += 1;
  }, 12_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

type FlatRow = { n: number; label: string; color: string; hot?: boolean };
const flat = computed<FlatRow[]>(() => {
  const rows: FlatRow[] = [
    { n: viewing.value, label: w.value.viewingLabel, color: "var(--v5-tech-cyan)" },
    { n: sold24h.value, label: w.value.sold24hLabel, color: "var(--v5-brand)" },
    { n: sold30m.value, label: w.value.sold30mLabel, color: "var(--v5-brand-2)", hot: sold30m.value > 0 },
  ];
  const stock = props.product.stock;
  if (stock !== undefined && stock < 50) {
    rows.push({ n: stock, label: w.value.stockShortLabel, color: "var(--v5-brand-2)", hot: true });
  }
  return rows;
});
const doubled = computed(() => [...flat.value, ...flat.value]);
const duration = computed(() => flat.value.length * 2);

const rootStyle: CSSProperties = {
  left: "4px",
  bottom: "12px",
  width: "156px",
  height: "66px", // 3 rows × 22px
  overflow: "hidden",
  maskImage: "linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
  WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
  pointerEvents: "none",
  zIndex: 5,
};
const listStyle = computed<CSSProperties>(() => ({
  animation: mounted.value ? `dnk-scroll ${duration.value}s linear infinite` : "none",
}));
const rowStyle: CSSProperties = {
  gap: "5px",
  height: "22px",
  lineHeight: "22px",
  whiteSpace: "nowrap",
  overflow: "hidden",
};
function dotStyle(color: string): CSSProperties {
  return {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: color,
    marginRight: "1px",
    alignSelf: "center",
  };
}
function numStyle(color: string): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: "13px",
    color,
    letterSpacing: "-0.005em",
  };
}
const labelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-3)",
};
</script>
