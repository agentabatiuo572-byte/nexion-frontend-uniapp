<!--
  EarningsLedgerCard — the Earn page's recent micro-earnings ledger (P-62 style): a section title with
  "View all" outside the card, then 5 rows of "model · client" and the settled amount, no time column
  (design system 04.6). Remote rows come from the Home canonical projection; only the local demo uses mock rows.
-->
<template>
  <view class="earnings-ledger" data-home-section="earnings-ledger" :data-ledger-mode="app.homeTruth?.earningsLedgerMode ?? 'UNAVAILABLE'">
    <view class="earnings-ledger__head">
      <text class="earnings-ledger__title" role="heading" aria-level="2">{{ t.home.earningsLedgerTitle }}<text v-if="app.homeTruthStatus === 'error' && app.homeTruth" class="earnings-ledger__stale"> · {{ t.home.networkStale }}</text></text>
      <view class="earnings-ledger__all" role="link" tabindex="0" data-home-action="earnings-ledger-all" @click="goAll" @keydown.enter.stop.prevent="goAll"><text>{{ t.home.earningsLedgerViewAll }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></view>
    </view>
    <view class="earnings-ledger__card">
      <view v-for="r in rows" :key="r.id" data-home-ledger-row="true" class="earnings-ledger__row">
        <text class="earnings-ledger__identity" :title="`${r.model} · ${r.who}`">{{ r.model }}<text class="earnings-ledger__client"> · {{ r.who }}</text></text>
        <text class="earnings-ledger__amount" :class="{ 'earnings-ledger__amount--masked': visibility.hidden }">{{ visibility.mask(r.amt) }}</text>
      </view>
      <view v-if="remoteApiEnabled && rows.length === 0" class="earnings-ledger__row">
        <text class="earnings-ledger__status">{{ statusText }}</text>
        <text v-if="app.homeTruthStatus === 'error'" class="earnings-ledger__retry" role="button" tabindex="0" data-home-action="earnings-ledger-retry" @click="retryHome" @keydown.enter.stop.prevent="retryHome" @keydown.space.stop.prevent="retryHome">{{ t.ui.retry }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useDataVisibility } from "@/store/data-visibility";
import { navTo } from "@/lib/route";
import { useT } from "@/i18n/use-t";
import { remoteApiEnabled } from "@/api/runtime";
import { useApp } from "@/store/app";
import { useEarningsLedger } from "@/composables/use-earnings-ledger";

const visibility = useDataVisibility();
const t = useT();
const app = useApp();
const { rows, statusText } = useEarningsLedger();

function retryHome() {
  void app.refreshHomeTruth();
}

function goAll() {
  navTo("/pages/me/wallet-bills");
}
</script>
<style scoped>
.earnings-ledger { color: var(--v5-ink); }
.earnings-ledger__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; margin: 0 2px 8px; }
.earnings-ledger__title { min-width: 0; font: 600 17px/24px var(--font-v5); color: var(--v5-ink); }
.earnings-ledger__stale { font-size: 12px; font-weight: 400; color: var(--v5-warning-ink); }
.earnings-ledger__all { flex-shrink: 0; display: inline-flex; align-items: center; gap: 2px; min-height: 44px; font: 500 13px/18px var(--font-v5); color: var(--v5-ink-3); cursor: pointer; }
.earnings-ledger__all:focus-visible, .earnings-ledger__retry:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.earnings-ledger__card { padding: 2px 16px; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .earnings-ledger__card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.earnings-ledger__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 44px; }
.earnings-ledger__row + .earnings-ledger__row { border-top: 1px solid var(--v5-border); }
.earnings-ledger__identity { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 14px/20px var(--font-v5); color: var(--v5-ink); }
.earnings-ledger__identity :deep(*) { white-space: nowrap; }
.earnings-ledger__client { font-weight: 400; color: var(--v5-ink-3); }
.earnings-ledger__amount { font: 500 14px/20px var(--font-metric); color: var(--v5-success-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.earnings-ledger__amount--masked { color: var(--v5-ink-3); }
.earnings-ledger__status { min-width: 0; font: 400 14px/20px var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.earnings-ledger__retry { display: inline-flex; align-items: center; min-height: 44px; padding-left: 12px; font: 500 13px/18px var(--font-v5); color: var(--v5-brand); cursor: pointer; }
</style>
