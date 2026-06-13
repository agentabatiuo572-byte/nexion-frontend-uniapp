<!--
  Market — ported from Nexion-prototype/app/(main)/market/page.tsx.
  Crypto markets tab (Binance/OKX-style): NEX hero (price + 24h + timeframe +
  kline + buy/sell) → stats grid → exchange listings → category tabs → token
  list (NEX pinned) → footer note. Sub-page off home → <AppChassis active="home">
  with an in-page back row (back → home). Reuses market store is NOT needed here
  (page reads static TOKENS mock for the comparable-token board); NEX hero pulls
  from the same TOKENS[NEX] seed as the prototype.
  framer SegmentedControl → inline pill row; <Link>→uni.navigateTo; <button>→<view @click>.
-->
<template>
  <AppChassis active="home">
    <view class="nx-card-stagger pb-8" style="color: var(--v5-ink)">
      <!-- In-page header: back -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <text class="block" :style="headerTitleStyle">{{ t.marketPage.pageTitle }}</text>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- ───────── NEX HERO ───────── -->
        <view class="rounded-2xl" :style="heroStyle">
          <view class="flex items-center font-mono-tabular" :style="heroCapStyle">
            <text>{{ t.marketPage.nexHero.yourToken }}</text>
          </view>
          <view class="flex items-end justify-between" style="margin-top: 8px">
            <view class="flex items-center" style="gap: 8px">
              <view class="rounded-full grid place-items-center" :style="nexIconStyle">
                <text :style="{ fontSize: '14px', fontWeight: 600, color: 'var(--v5-ink)' }">N</text>
              </view>
              <view>
                <text class="block font-display" :style="nexPairStyle">NEX / USDT</text>
                <text class="block" :style="nexSubStyle">Nexion · #{{ NEX.rank }}</text>
              </view>
            </view>
            <view class="text-right">
              <text class="block font-display tabular-nums" :style="nexPriceStyle">{{ fmtPrice(NEX.priceUSD) }}</text>
              <text class="block font-mono-tabular tabular-nums" :style="nexChangeStyle">
                {{ nexUp ? "▲" : "▼" }} {{ Math.abs(NEX.change24h).toFixed(2) }}% (24h)
              </text>
            </view>
          </view>

          <!-- Timeframe segmented -->
          <view class="flex" :style="segWrapStyle">
            <view
              v-for="f in TIMEFRAMES"
              :key="f"
              class="flex-1 grid place-items-center active:opacity-80"
              :style="segItemStyle(f === tf)"
              @click="tf = f"
            >
              <text :style="{ fontSize: '12px', fontWeight: 600, color: f === tf ? 'var(--v5-on-brand)' : 'var(--v5-ink-3)' }">{{ f }}</text>
            </view>
          </view>

          <!-- chart -->
          <view class="rounded-xl overflow-hidden" :style="chartBoxStyle">
            <NexChart :data="nexChartData" :up="nexUp" />
          </view>

          <!-- buy / sell CTAs -->
          <view class="grid grid-cols-2" :style="ctaRowStyle">
            <view class="rounded-full flex items-center justify-center active:opacity-90" :style="buyBtnStyle" @click="goExchange">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 7 13.5 15.5l-5-5L2 17" /><path d="M16 7h6v6" /></svg>
              <text :style="buyTextStyle">{{ t.marketPage.nexHero.buy }}</text>
            </view>
            <view class="rounded-xl flex items-center justify-center active:opacity-90" :style="sellBtnStyle" @click="goExchange">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17 13.5 8.5l-5 5L2 7" /><path d="M16 17h6v-6" /></svg>
              <text :style="sellTextStyle">{{ t.marketPage.nexHero.sell }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── STATS GRID ───────── -->
        <view class="rounded-2xl border" :style="cardStyle">
          <view class="grid grid-cols-3" style="row-gap: 12px; column-gap: 8px">
            <view v-for="cell in statCells" :key="cell.label">
              <text class="block" :style="statLabelStyle">{{ cell.label }}</text>
              <text class="block font-mono-tabular tabular-nums" :style="statValueStyle">{{ cell.value }}</text>
            </view>
          </view>
          <view class="flex items-center justify-between border-t" :style="athRowStyle">
            <text :style="{ color: 'var(--v5-ink-3)' }">{{ t.marketPage.stats.ath }}</text>
            <text class="font-mono-tabular tabular-nums" :style="{ color: 'var(--v5-ink-2)' }">
              {{ fmtPrice(NEX.ath) }}
              <text :style="{ color: 'var(--v5-brand-2)' }">({{ athDeltaPct.toFixed(1) }}% {{ t.marketPage.stats.athFromNow }})</text>
            </text>
          </view>
        </view>

        <!-- ───────── EXCHANGE LISTINGS ───────── -->
        <view class="rounded-2xl border" :style="cardStyle">
          <text class="block font-mono-tabular" :style="listLabelStyle">{{ t.marketPage.listings.label }}</text>
          <text class="block" :style="listExStyle">{{ t.marketPage.listings.exchanges }}</text>
          <view class="inline-flex items-center" :style="pendingChipStyle">
            <text :style="{ color: 'var(--v5-warning)' }">⏳ {{ t.marketPage.listings.pending }}</text>
          </view>
        </view>

        <!-- ───────── CATEGORY TABS ───────── -->
        <view class="grid grid-cols-5 border" :style="catGridStyle">
          <view
            v-for="cat in CATEGORIES"
            :key="cat.id"
            class="grid place-items-center active:opacity-90"
            :style="catItemStyle(activeCat === cat.id)"
            @click="activeCat = cat.id"
          >
            <text :style="{ fontSize: '11.5px', fontWeight: 600, color: activeCat === cat.id ? 'var(--v5-on-brand)' : 'var(--v5-ink-3)' }">{{ cat.label }}</text>
          </view>
        </view>

        <!-- ───────── TOKEN LIST ───────── -->
        <view class="rounded-2xl border overflow-hidden" :style="cardFlushStyle">
          <view class="grid items-center border-b font-mono-tabular" :style="tableHeadStyle">
            <text></text>
            <text>{{ t.marketPage.columns.asset }}</text>
            <text class="text-right">{{ t.marketPage.columns.price }}</text>
            <text class="text-right">{{ t.marketPage.columns.change }}</text>
          </view>
          <view v-if="filtered.length === 0" class="text-center" :style="emptyStyle">
            <text>{{ t.marketPage.empty.watchlist }}</text>
          </view>
          <template v-else>
            <TokenRow
              v-for="tk in filtered"
              :key="tk.symbol"
              :token="tk"
              :starred="stars.has(tk.symbol)"
              @toggle-star="toggleStar(tk.symbol)"
            />
          </template>
        </view>

        <text class="block text-center" :style="noteStyle">{{ t.marketPage.note }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, reactive, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import NexChart from "@/components/market/nex-chart.vue";
import TokenRow from "@/components/market/token-row.vue";
import { useT } from "@/i18n/use-t";
import {
  TOKENS, CATEGORIES, TIMEFRAMES,
  type TokenCategory, type Timeframe,
} from "@/mock/tokens";

const t = useT();

const NEX = TOKENS.find((tk) => tk.symbol === "NEX")!;

type CatFilter = TokenCategory | "all" | "watchlist";
const activeCat = ref<CatFilter>("all");
const tf = ref<Timeframe>("24H");

// reactive Set replacement — track starred symbols.
const starState = reactive<Record<string, boolean>>(
  Object.fromEntries(TOKENS.filter((tk) => tk.starred).map((tk) => [tk.symbol, true])),
);
const stars = {
  has: (sym: string) => starState[sym] === true,
};
function toggleStar(sym: string) {
  starState[sym] = !starState[sym];
}

const filtered = computed(() => {
  let list = TOKENS;
  if (activeCat.value === "watchlist") {
    list = list.filter((tk) => starState[tk.symbol] === true);
  } else if (activeCat.value !== "all") {
    list = list.filter((tk) => tk.category === activeCat.value || tk.symbol === "NEX");
  }
  return [...list].sort((a, b) => {
    if (a.symbol === "NEX") return -1;
    if (b.symbol === "NEX") return 1;
    return b.marketCapUSD - a.marketCapUSD;
  });
});

const nexChartData = computed(() =>
  tf.value === "1M" || tf.value === "ALL" ? NEX.spark30d : NEX.spark24h,
);
const nexUp = NEX.change24h > 0;
const athDeltaPct = ((NEX.priceUSD - NEX.ath) / NEX.ath) * 100;

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
function fmtNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const statCells = computed(() => [
  { label: t.value.marketPage.stats.marketCap, value: fmtBig(NEX.marketCapUSD) },
  { label: t.value.marketPage.stats.vol24h, value: fmtBig(NEX.volume24hUSD) },
  { label: t.value.marketPage.stats.fdv, value: fmtBig(NEX.fdvUSD) },
  { label: t.value.marketPage.stats.circulating, value: fmtNumber(NEX.circulating) },
  { label: t.value.marketPage.stats.totalSupply, value: fmtNumber(NEX.totalSupply) },
  { label: t.value.marketPage.stats.rank, value: `#${NEX.rank}` },
]);

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/index/index", fail: () => {} }) });
}
function goExchange() {
  // Exchange route not yet ported (see PORT report §7) — degrade to no-op.
  uni.navigateTo({ url: "/pages/me/wallet", fail: () => {} });
}

// ─── styles ───
const headerStyle: CSSProperties = { gap: "8px", padding: "8px 14px 4px" };
const backBtnStyle: CSSProperties = { width: "36px", height: "36px", marginLeft: "-6px" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};
const heroStyle: CSSProperties = {
  padding: "16px",
  background:
    "radial-gradient(80% 60% at 80% 0%, color-mix(in srgb, var(--v5-brand) 16%, transparent) 0%, transparent 65%), linear-gradient(180deg, #131A0A 0%, #0E0E0E 100%)",
  border: "1px solid color-mix(in srgb, var(--v5-brand) 30%, transparent)",
};
const heroCapStyle: CSSProperties = {
  gap: "8px",
  fontSize: "10px",
  letterSpacing: "0.16em",
  color: "var(--v5-brand)",
};
const nexIconStyle: CSSProperties = { width: "36px", height: "36px", background: "var(--v5-brand)" };
const nexPairStyle: CSSProperties = { fontSize: "18px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const nexSubStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "2px" };
const nexPriceStyle: CSSProperties = { fontSize: "28px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const nexChangeStyle = computed<CSSProperties>(() => ({
  marginTop: "4px",
  fontSize: "12px",
  color: nexUp ? "var(--v5-brand)" : "var(--v5-brand-2)",
}));
const segWrapStyle: CSSProperties = {
  marginTop: "12px",
  gap: "0",
  padding: "3px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)",
  border: "1px solid var(--v5-border)",
};
function segItemStyle(active: boolean): CSSProperties {
  return {
    height: "38px",
    borderRadius: "999px",
    background: active ? "var(--v5-brand)" : "transparent",
    transition: "background 0.2s",
  };
}
const chartBoxStyle: CSSProperties = {
  marginTop: "12px",
  height: "120px",
  background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)",
};
const ctaRowStyle: CSSProperties = { marginTop: "12px", gap: "8px" };
const buyBtnStyle: CSSProperties = {
  height: "44px",
  gap: "6px",
  background: "var(--v5-brand)",
};
const buyTextStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-on-brand)" };
const sellBtnStyle: CSSProperties = {
  height: "44px",
  gap: "6px",
  background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)",
  border: "1px solid var(--v5-border)",
};
const sellTextStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };

const cardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
  padding: "16px",
};
const cardFlushStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const statLabelStyle: CSSProperties = { fontSize: "10px", color: "var(--v5-ink-3)" };
const statValueStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const athRowStyle: CSSProperties = {
  marginTop: "12px",
  paddingTop: "12px",
  borderColor: "var(--v5-border)",
  fontSize: "11px",
};
const listLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-ink-3)",
};
const listExStyle: CSSProperties = { marginTop: "8px", fontSize: "12.5px", color: "var(--v5-ink)" };
const pendingChipStyle: CSSProperties = {
  marginTop: "6px",
  gap: "6px",
  padding: "4px 8px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)",
  fontSize: "10.5px",
  fontWeight: 600,
};
const catGridStyle: CSSProperties = {
  gap: "4px",
  padding: "4px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
};
function catItemStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    borderRadius: "12px",
    background: active ? "var(--v5-brand)" : "transparent",
    transition: "background 0.2s",
  };
}
const tableHeadStyle: CSSProperties = {
  gridTemplateColumns: "32px 1fr 76px 72px",
  padding: "10px 12px",
  fontSize: "10px",
  color: "var(--v5-ink-3)",
  borderColor: "var(--v5-border)",
};
const emptyStyle: CSSProperties = {
  padding: "24px",
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.6,
};
const noteStyle: CSSProperties = {
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.6,
  paddingTop: "4px",
};
</script>
