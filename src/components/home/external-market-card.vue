<template>
  <view v-if="!market.isMockMode" class="block" :style="cardStyle" role="link" tabindex="0" data-home-action="external-market-link" @click="goMarket" @keydown.enter.stop.prevent="goMarket" @keydown.space.stop.prevent="goMarket">
    <view class="flex items-start justify-between" style="gap: 12px">
      <view>
        <text class="block" :style="titleStyle">{{ t.home.externalMarketTitle }}</text>
        <text class="block" :style="subtitleStyle">{{ t.home.externalMarketSubtitle }}</text>
      </view>
      <text v-if="!ready" class="active:opacity-70" :style="retryStyle" role="button" tabindex="0" @click.stop="retry" @keydown.enter.stop.prevent="retry" @keydown.space.stop.prevent="retry">
        {{ market.externalError ? t.ui.retry : t.home.networkStatUpdating }}
      </text>
    </view>

    <view v-if="ready" style="margin-top: 12px">
      <view
        v-for="(quote, index) in quotes"
        :key="quote.symbol"
        class="grid items-center"
        :style="rowStyle(index === quotes.length - 1)"
      >
        <view class="min-w-0">
          <text class="block" :style="symbolStyle">{{ quote.symbol }}</text>
          <text class="block truncate" :style="nameStyle">{{ quote.name }}</text>
        </view>
        <view style="height: 28px">
          <HomeSparkline :data="quote.sparkline" :color="quote.change24hPct >= 0 ? 'var(--v5-success)' : 'var(--v5-danger)'" :height="28" />
        </view>
        <view style="text-align: right">
          <text class="block tabular-nums" :style="priceStyle">{{ formatPrice(quote.priceUsd) }}</text>
          <text class="block tabular-nums" :style="changeStyle(quote.change24hPct)">{{ formatChange(quote.change24hPct) }}</text>
        </view>
        <text class="block truncate" :style="volumeStyle">{{ fmt(t.home.externalMarketVolume, { n: formatVolume(quote.volume24hUsd) }) }}</text>
      </view>
    </view>
    <text v-else-if="market.externalError" class="block" :style="emptyStyle">{{ t.home.externalMarketUnavailable }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { selectHomepageExternalQuotes } from "@/lib/home-data-presenters";
import { useMarket } from "@/store/market";
import HomeSparkline from "./home-sparkline.vue";

const t = useT();
const market = useMarket();
const quotes = computed(() => selectHomepageExternalQuotes(market.externalQuotes));
const ready = computed(() => market.externalReady && quotes.value.length > 0);

function formatPrice(value: number): string {
  const digits = value < 1 ? 3 : 2;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatChange(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function retry() {
  void market.syncAll();
}

function goMarket() {
  uni.navigateTo({ url: "/pages/market/market", fail: () => {} });
}

onMounted(() => {
  if (!market.isMockMode) void market.syncAll();
});

watch(() => market.marketRunId, (next, previous) => {
  if (!market.isMockMode && previous !== null && next === null) void market.syncAll();
});

const cardStyle: CSSProperties = { padding: "14px", borderRadius: "16px", background: "var(--v5-surface)" };
const titleStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "var(--v5-ink)" };
const subtitleStyle: CSSProperties = { marginTop: "3px", fontSize: "12px", color: "var(--v5-ink-3)" };
const retryStyle: CSSProperties = { fontSize: "12px", fontWeight: 600, color: "var(--v5-brand)" };
const symbolStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const nameStyle: CSSProperties = { marginTop: "2px", fontSize: "11px", color: "var(--v5-ink-4)" };
const priceStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const volumeStyle: CSSProperties = { gridColumn: "1 / -1", marginTop: "5px", fontSize: "11px", color: "var(--v5-ink-4)" };
const emptyStyle: CSSProperties = { marginTop: "12px", fontSize: "12px", color: "var(--v5-ink-3)" };
const rowStyle = (last: boolean): CSSProperties => ({
  gridTemplateColumns: "72px 1fr 78px",
  columnGap: "10px",
  padding: "10px 0",
  borderBottom: last ? "none" : "1px solid var(--v5-border)",
});
const changeStyle = (value: number): CSSProperties => ({
  marginTop: "2px",
  fontSize: "11px",
  color: value >= 0 ? "var(--v5-success)" : "var(--v5-danger)",
});
</script>
