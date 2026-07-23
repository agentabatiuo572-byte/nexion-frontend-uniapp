<!--
  EarningsLedgerCard — ZONE 5 recent micro-earnings ledger (ported from
  mission-control.tsx EarningsLedgerCard). Header (Earnings ledger · N of total)
  + 5 mock rows (model · client · amount · age). Rows are mock data (proper
  nouns, untranslated).
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.earningsLedgerTitle }}</text>
      <text class="font-mono-tabular inline-flex items-center active:opacity-70" style="min-height: 44px; font-size: 13px; color: var(--v5-brand); font-weight: 500" @click="goAll">{{ t.home.earningsLedgerViewAll }} →</text>
    </view>

    <view style="padding: 0 2px; border-top: 1px solid var(--v5-border)">
      <view
        v-for="(r, i) in ROWS"
        :key="r.id"
        class="grid items-center gap-2.5"
        :style="{ gridTemplateColumns: '1fr auto 36px', padding: '10px 0', borderBottom: i < ROWS.length - 1 ? '1px solid var(--v5-border)' : 'none' }"
      >
        <view class="min-w-0">
          <text class="block truncate" style="font-family: var(--font-v5); font-weight: 500; font-size: 13px; color: var(--v5-ink)">{{ r.model }}<text style="color: var(--v5-ink-3)"> · {{ r.who }}</text></text>
        </view>
        <text class="font-mono-tabular tabular-nums" style="font-size: 12px; color: var(--v5-success); font-weight: 500">{{ r.amt }}</text>
        <text class="font-mono-tabular text-right" style="font-size: 12px; color: var(--v5-ink-4)">{{ r.t }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useT } from "@/i18n/use-t";

const t = useT();

const ROWS = [
  { id: 1, who: "Pocket Studios", model: "SDXL Turbo", amt: "+$0.00032", t: "2s" },
  { id: 2, who: "Echo Earbuds", model: "Whisper tiny", amt: "+$0.00005", t: "14s" },
  { id: 3, who: "Helix Labs", model: "Llama 3.2 3B", amt: "+$0.00021", t: "38s" },
  { id: 4, who: "Mosaic Studios", model: "Flux Schnell", amt: "+$0.00048", t: "52s" },
  { id: 5, who: "Vector Foundry", model: "MobileBERT", amt: "+$0.00009", t: "1m" },
];

function goAll() {
  uni.navigateTo({ url: "/pages/me/wallet-bills", fail: () => {} });
}
</script>
