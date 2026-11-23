<!--
  MarketBoardCard — canonical Java workload prices rendered with the same
  five-column visual hierarchy as the high-fidelity App. Missing market facts
  stay explicit instead of being replaced with local mock movement or volume.
-->
<template>
  <view class="home-market" data-home-section="compute-market">
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: var(--ui-type-card-title-weight); font-size: var(--ui-type-card-title); color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.marketBoardTitle }} <text class="home-market__title-note">{{ t.home.marketBoardPrices }}</text></text>
      <!-- Opens the next level (the market page): a text link, ink-3 with a chevron (03 §3.1, §3.9). -->
      <text
        class="market-board-open inline-flex items-center active:opacity-70 nx-after-chevron"
        style="min-height: 44px; padding-left: 12px; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3)"
        role="link"
        tabindex="0"
        data-home-action="compute-market-open"
        @click="marketNavigation.openMarket"
        @keydown.enter.stop.prevent="marketNavigation.openMarketFromKeyboard"
      >{{ t.home.marketBoardOpen }}</text>
    </view>

    <view v-if="homeMarketRows.length" class="home-market-table" lang="en">
      <view class="home-market-grid home-market-head grid">
        <text>{{ en.home.mbColTag }}</text>
        <text>{{ en.home.mbColModel }}</text>
        <text class="home-market-spark text-right">{{ en.home.mbCol1h }}</text>
        <text class="text-right">{{ en.home.mbColPrice }}</text>
        <text class="text-right">{{ en.home.mbCol24h }}</text>
      </view>

      <view
        v-for="row in homeMarketRows"
        :key="row.code"
        data-home-market-row="true"
        class="home-market-grid home-market-row grid items-center"
        role="link"
        tabindex="0"
        @click="goEarn"
        @keydown.enter.stop.prevent="goEarn"
      >
        <NxTag class="home-market-row__tag" tone="brand" :label="displayRow(row).tag" />
        <text class="home-market-row__name">{{ displayRow(row).name }}</text>
        <view class="home-market-spark min-w-0 text-right">
          <HomeSparkline v-if="displayRow(row).sparkline" :data="displayRow(row).sparkline!" :color="deltaColor(row)" :height="18" :fill="false" />
          <text v-else class="home-market-row__meta">{{ marketBoardUnavailable }}</text>
        </view>
        <view class="text-right">
          <text class="home-market-row__price">{{ displayRow(row).priceText }}</text>
          <text class="home-market-row__meta block">{{ displayRow(row).unitText }}</text>
        </view>
        <text class="home-market-row__delta" :style="{ color: deltaColor(row) }">{{ displayRow(row).deltaText }}</text>
      </view>
    </view>
    <!-- Empty market (a read that succeeded with no workloads): one short line (03 §3.4). -->
    <view v-else-if="marketBoardState === 'empty'" class="home-market-empty">
      <text>{{ t.empty.listTitle }}</text>
    </view>
    <!-- First read in progress or failed: the table keeps its size with still placeholders and no status text; a failed
         read recovers on its own (03 §3.4, §3.5.2; the home earnings card owns the retry). -->
    <view v-else class="home-market-table" aria-hidden="true" :aria-busy="marketBoardState === 'loading' ? 'true' : undefined" data-home-market-placeholder="true">
      <view class="home-market-grid home-market-head grid"><view class="home-market-bar" style="width: 24px" /></view>
      <view v-for="n in MARKET_PLACEHOLDER_ROWS" :key="n" class="home-market-grid home-market-row home-market-row--placeholder grid items-center">
        <view class="home-market-bar home-market-bar--tag" />
        <view class="home-market-bar" style="width: 72%" />
        <view class="home-market-spark" />
        <view class="home-market-bar" style="width: 48px; justify-self: end" />
        <view class="home-market-bar" style="width: 36px; justify-self: end" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { navTo } from "@/lib/route";
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { en } from "@/i18n/messages/en";
import type { AppHomeWorkload } from "@/api/app-home-api";
import { useApp } from "@/store/app";
import HomeSparkline from "./home-sparkline.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import { presentHomeMarketWorkload } from "./home-market-board";
import { createMarketBoardNavigation } from "./market-board-navigation";

const t = useT();
const app = useApp();
const marketBoardUnavailable = "—";
const homeMarketRows = computed(() => app.homeTruth?.marketBoard.workloads ?? []);
// The six workload codes are the most the board can list, so the placeholder holds the full table's height.
const MARKET_PLACEHOLDER_ROWS = 6;
// Only a read that succeeded with no workloads is empty; loading and a failed first read keep the placeholder.
const marketBoardState = computed(() => app.homeTruthStatus === "ready" ? "empty" : app.homeTruthStatus === "error" ? "failed" : "loading");
const marketNavigation = createMarketBoardNavigation(navTo);

function displayRow(row: AppHomeWorkload) {
  return presentHomeMarketWorkload(row, en);
}
function deltaColor(row: AppHomeWorkload) {
  const tone = displayRow(row).deltaTone;
  return tone === "positive"
    ? "var(--v5-success-ink)"
    : tone === "negative" ? "var(--v5-danger)" : "var(--v5-ink-3)";
}
function goEarn() {
  void navTo("/pages/earn/earn");
}


</script>

<style scoped>
/* Columns: NxTag (03 §3.8) · name · 1h line · price · 24h change. The price column fits a list-title-sized mono price. */
.home-market { --home-market-columns: 44px minmax(0, 1fr) 40px 68px 50px; }
.home-market-grid { grid-template-columns: var(--home-market-columns); gap: 6px; }
.home-market__title-note { font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); letter-spacing: 0; }
/* A solid content card (01 §1.1.2): surface, light theme adds the soft shadow. */
.home-market-table { overflow: hidden; border-radius: 16px; background: var(--v5-surface); }
[data-theme="light"] .home-market-table { box-shadow: var(--v5-glass-shadow); }
.home-market-head { align-items: center; min-height: 34px; box-sizing: border-box; padding: 9px 12px; background: var(--v5-surface-2); border-bottom: 1px solid var(--v5-border); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.home-market-row { padding: 10px 12px; min-width: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: opacity .16s ease; }
.home-market-row + .home-market-row { border-top: 1px solid var(--v5-border); }
/* Rows give press feedback by opacity, never by scaling (03 §3.1, 07 §7.1.1). */
.home-market-row:active { opacity: .6; transition-duration: .08s; }
.home-market-row:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; }
.home-market-row__tag { justify-self: start; }
.home-market-row__name { min-width: 0; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
/* Market list price: list-title size and line height, JetBrains Mono 500 (10.1, 01 §1.2); unit in the aux figure role. */
.home-market-row__price { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-metric); color: var(--v5-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.home-market-row__meta { font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.home-market-row__delta { text-align: right; font: 500 var(--ui-type-inline-figure, var(--ui-type-list-subtitle))/var(--ui-type-inline-figure-lh, var(--ui-type-list-subtitle-lh)) var(--font-metric); white-space: nowrap; font-variant-numeric: tabular-nums; }
.home-market-empty { display: flex; align-items: center; min-height: 60px; box-sizing: border-box; padding: 14px 16px; border-radius: 16px; background: var(--v5-surface); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
[data-theme="light"] .home-market-empty { box-shadow: var(--v5-glass-shadow); }
/* Still placeholders (no shimmer): the same row height as a loaded row. */
.home-market-row--placeholder { min-height: 56px; box-sizing: border-box; cursor: default; }
.home-market-bar { height: 10px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.home-market-bar--tag { width: 40px; height: 24px; }
@media (max-width: 360px) {
  .home-market { --home-market-columns: 44px minmax(0, 1fr) 68px 50px; }
  .home-market-spark { display: none; }
}
.market-board-open:focus,
.market-board-open:focus-visible {
  outline: 2px solid var(--v5-brand);
  outline-offset: 3px;
  border-radius: 6px;
}
</style>
