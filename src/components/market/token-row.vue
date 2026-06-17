<!--
  TokenRow — one row in the market token list (ported from market/page.tsx
  TokenRow + MiniSpark). Star toggle (watchlist), icon, symbol+name+cap,
  price + mini sparkline, 24h change. NEX is highlighted (OURS badge + tint).
  <button>→<view @click>; <div>→<view>; all text wrapped in <text>.
-->
<template>
  <view class="grid items-center nx-tr" :class="{ 'nx-tr--nex': isNEX }" :style="rowStyle">
    <!-- star toggle (44pt tap target) -->
    <view class="grid place-items-center active:opacity-60" :style="starBtnStyle" @click="emit('toggleStar')">
      <svg width="16" height="16" viewBox="0 0 24 24"
        :fill="starred ? '#FFC83D' : 'none'"
        :stroke="starred ? 'var(--v5-warning)' : 'var(--v5-ink-4)'"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z" />
      </svg>
    </view>

    <!-- asset -->
    <view class="flex items-center min-w-0" style="gap: 10px">
      <view class="rounded-full grid place-items-center shrink-0" :style="iconStyle">
        <text :style="iconTextStyle">{{ token.symbol.charAt(0) }}</text>
      </view>
      <view class="min-w-0">
        <view class="flex items-center" style="gap: 6px">
          <text class="truncate" :style="symbolStyle">{{ token.symbol }}</text>
          <text v-if="isNEX" class="font-mono-tabular" :style="oursStyle">OURS</text>
        </view>
        <text class="block truncate" :style="subStyle">{{ token.name }} · {{ fmtBig(token.marketCapUSD) }}</text>
      </view>
    </view>

    <!-- price + spark -->
    <view class="text-right">
      <text class="block font-mono-tabular tabular-nums" :style="priceStyle">{{ fmtPrice(token.priceUSD) }}</text>
      <view style="margin-top: 2px">
        <svg :width="SPARK_W" :height="SPARK_H" style="display: block; margin-left: auto">
          <polyline
            :points="sparkPoints"
            fill="none"
            :stroke="up ? 'var(--v5-brand)' : 'var(--v5-brand-2)'"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.9"
          />
        </svg>
      </view>
    </view>

    <!-- 24h change -->
    <text class="text-right font-mono-tabular tabular-nums" :style="changeStyle">
      {{ up ? "+" : "" }}{{ token.change24h.toFixed(2) }}%
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { Token } from "@/mock/tokens";

const props = defineProps<{ token: Token; starred: boolean }>();
const emit = defineEmits<{ (e: "toggleStar"): void }>();

const SPARK_W = 60;
const SPARK_H = 14;

const isNEX = computed(() => props.token.symbol === "NEX");
const up = computed(() => props.token.change24h > 0);

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}
function fmtBig(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const sparkPoints = computed(() => {
  const data = props.token.spark24h;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = SPARK_W / (data.length - 1);
  return data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(SPARK_H - ((v - min) / range) * (SPARK_H - 2) - 1).toFixed(1)}`)
    .join(" ");
});

const rowStyle = computed<CSSProperties>(() => ({
  gridTemplateColumns: "32px 1fr 76px 72px",
  padding: "10px 12px",
  fontSize: "12px",
  borderBottom: "1px solid var(--v5-border)",
}));
const starBtnStyle: CSSProperties = { width: "44px", height: "44px", marginLeft: "-8px" };
const iconStyle = computed<CSSProperties>(() => ({
  width: "28px",
  height: "28px",
  background: props.token.color,
}));
const iconTextStyle = computed<CSSProperties>(() => {
  const dark =
    props.token.color === "#000000" || props.token.color === "#222326" || props.token.color === "#181EA9";
  return {
    fontSize: "10px",
    fontWeight: 600,
    color: dark ? "var(--v5-ink)" : "var(--v5-on-brand)",
  };
});
const symbolStyle: CSSProperties = {
  fontWeight: 600,
  color: "var(--v5-ink)",
  fontSize: "12.5px",
};
const oursStyle: CSSProperties = {
  fontSize: "10px",
  padding: "0 4px",
  borderRadius: "4px",
  background: "color-mix(in srgb, var(--v5-brand) 20%, transparent)",
  color: "var(--v5-brand)",
};
const subStyle: CSSProperties = {
  fontSize: "10px",
  color: "var(--v5-ink-4)",
  marginTop: "2px",
};
const priceStyle: CSSProperties = { color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)" };
const changeStyle = computed<CSSProperties>(() => ({
  fontWeight: 600,
  color: up.value ? "var(--v5-brand)" : "var(--v5-brand-2)",
}));
</script>

<style scoped>
.nx-tr:last-child {
  border-bottom: none !important;
}
.nx-tr--nex {
  background: color-mix(in srgb, var(--v5-brand) 4%, transparent);
}
</style>
