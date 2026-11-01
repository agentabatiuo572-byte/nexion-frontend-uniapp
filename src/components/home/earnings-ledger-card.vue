<!--
  EarningsLedgerCard — ZONE 5 recent micro-earnings ledger (ported from
  mission-control.tsx EarningsLedgerCard). One card: header (Earnings ledger ·
  View all) + 5 rows of "model · client" and the settled amount, no time column
  (design system 04.6). Remote rows come from the Home canonical projection;
  only the local demo uses mock rows.
-->
<template>
  <view class="earnings-ledger-card" data-home-section="earnings-ledger" :data-ledger-mode="app.homeTruth?.earningsLedgerMode ?? 'UNAVAILABLE'">
    <view class="earnings-ledger-card__head">
      <text class="earnings-ledger-card__title">{{ t.home.earningsLedgerTitle }}<text v-if="app.homeTruthStatus === 'error' && app.homeTruth" class="earnings-ledger-card__stale"> · {{ t.home.networkStale }}</text></text>
      <text class="earnings-ledger-card__all active:opacity-70" role="link" tabindex="0" data-home-action="earnings-ledger-all" @click="goAll" @keydown.enter.stop.prevent="goAll">{{ t.home.earningsLedgerViewAll }} →</text>
    </view>

    <view v-for="r in rows" :key="r.id" data-home-ledger-row="true" class="earnings-ledger-card__row">
      <text class="earnings-ledger-card__identity" :title="`${r.model} · ${r.who}`">{{ r.model }}<text class="earnings-ledger-card__client"> · {{ r.who }}</text></text>
      <text class="earnings-ledger-card__amount" :class="{ 'earnings-ledger-card__amount--masked': visibility.hidden }">{{ visibility.mask(r.amt) }}</text>
    </view>
    <view v-if="remoteApiEnabled && rows.length === 0" class="earnings-ledger-card__row">
      <text class="earnings-ledger-card__status">{{ ledgerStatusText }}</text>
      <text v-if="app.homeTruthStatus === 'error'" class="earnings-ledger-card__retry active:opacity-70" role="button" tabindex="0" data-home-action="earnings-ledger-retry" @click="retryHome" @keydown.enter.stop.prevent="retryHome" @keydown.space.stop.prevent="retryHome">{{ t.ui.retry }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useDataVisibility } from "@/store/data-visibility";
import { formatUsd } from "@/lib/usd-display";
import { navTo } from "@/lib/route";
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { remoteApiEnabled } from "@/api/runtime";
import { useApp } from "@/store/app";
import { parseServerTimestamp } from "@/api/server-time";

const visibility = useDataVisibility();
const t = useT();
const app = useApp();
const ROWS = [
  { id: 1, who: "Pocket Studios", model: "SDXL Turbo", amt: formatUsd(0.00032, "detail", true) },
  { id: 2, who: "Echo Earbuds", model: "Whisper tiny", amt: formatUsd(0.00005, "detail", true) },
  { id: 3, who: "Helix Labs", model: "Llama 3.2 3B", amt: formatUsd(0.00021, "detail", true) },
  { id: 4, who: "Mosaic Studios", model: "Flux Schnell", amt: formatUsd(0.00048, "detail", true) },
  { id: 5, who: "Vector Foundry", model: "MobileBERT", amt: formatUsd(0.00009, "detail", true) },
];

const remoteRows = computed(() => (app.homeTruth?.earningsLedger ?? [])
  .slice()
  .sort((a, b) => (parseServerTimestamp(b.completedAt) ?? 0) - (parseServerTimestamp(a.completedAt) ?? 0))
  .slice(0, 5)
  .map((entry) => ({
    id: entry.id,
    who: entry.client,
    model: entry.model,
    amt: formatUsd(entry.rewardUsdt, "detail", !entry.synthetic),
  })));
const rows = computed(() => remoteApiEnabled ? remoteRows.value : ROWS);
const ledgerStatusText = computed(() => {
  if (app.homeTruthStatus === "loading" || app.homeTruthStatus === "idle") return t.value.home.networkStatUpdating;
  if (app.homeTruthStatus === "error") return t.value.uiChrome.unavailable;
  return t.value.home.ledgerEmpty;
});

function retryHome() {
  void app.refreshHomeTruth();
}

function goAll() {
  navTo("/pages/me/wallet-bills");
}
</script>
<style scoped>
.earnings-ledger-card { margin-top:12px; padding:4px 16px; border-radius:var(--ui-radius-surface); background:var(--v5-surface); border:1px solid var(--v5-border); box-shadow:var(--v5-glass-shadow); }
.earnings-ledger-card__head { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:48px; }
.earnings-ledger-card__title { min-width:0; font:600 16px/22px var(--font-v5); color:var(--v5-ink); }
.earnings-ledger-card__stale { font-size:12px; color:var(--v5-warning); }
.earnings-ledger-card__all { flex-shrink:0; display:inline-flex; align-items:center; min-height:44px; padding-left:12px; font:500 13px/18px var(--font-v5); color:var(--v5-brand); cursor:pointer; }
/* 44px of content plus the 1px top border (border-box). */
.earnings-ledger-card__row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; min-height:45px; border-top:1px solid var(--v5-border); }
.earnings-ledger-card__identity { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:500 14px/20px var(--font-v5); color:var(--v5-ink); }
.earnings-ledger-card__identity :deep(*) { white-space:nowrap; }
.earnings-ledger-card__client { font-weight:400; color:var(--v5-ink-3); }
.earnings-ledger-card__amount { font:500 13px/18px var(--font-jet-mono); color:var(--v5-success-ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
.earnings-ledger-card__amount--masked { color:var(--v5-ink-3); }
.earnings-ledger-card__status { min-width:0; font:400 14px/20px var(--font-v5); color:var(--v5-ink-3); overflow-wrap:anywhere; }
.earnings-ledger-card__retry { display:inline-flex; align-items:center; min-height:44px; padding-left:12px; font:500 13px/18px var(--font-v5); color:var(--v5-brand); cursor:pointer; }
</style>
