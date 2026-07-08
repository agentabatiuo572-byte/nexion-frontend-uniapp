<!--
  EarningsLedgerCard — ZONE 5 recent micro-earnings ledger (ported from
  mission-control.tsx EarningsLedgerCard). Header (Earnings ledger · N of total)
  + 5 mock rows (model · client · amount · age). Rows are mock data (proper
  nouns, untranslated).
-->
<template>
  <view class="earnings-ledger">
    <view class="earnings-ledger__header">
      <text class="earnings-ledger__title">{{ t.home.earningsLedgerTitle }}</text>
      <view class="earnings-ledger__link" @click="goAll">
        <text>{{ t.home.earningsLedgerViewAll }}</text>
        <ChevronRightIcon />
      </view>
    </view>

    <view class="earnings-ledger__list">
      <view
        v-for="(r, i) in ROWS"
        :key="r.id"
        class="earnings-ledger__row"
        :class="{ 'earnings-ledger__row--last': i === ROWS.length - 1 }"
      >
        <view class="earnings-ledger__main">
          <text class="earnings-ledger__text">
            <text class="earnings-ledger__model">{{ r.model }}</text><text class="earnings-ledger__client"> · {{ r.who }}</text>
          </text>
        </view>
        <text class="earnings-ledger__amount">{{ r.amt }}</text>
        <text class="earnings-ledger__time">{{ r.t }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useT } from "@/i18n/use-t";
import ChevronRightIcon from "@/components/icons/chevron-right-icon.vue";

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

<style scoped>
.earnings-ledger__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 2px 6.5px;
}

.earnings-ledger__title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--v5-ink);
}

.earnings-ledger__link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--v5-brand);
}

.earnings-ledger__link:active {
  opacity: 0.7;
}

.earnings-ledger__list {
  padding: 0 2px;
  border-top: 1px solid var(--v5-border);
  background: transparent;
}

.earnings-ledger__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content 36px;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 0;
  border-bottom: 1px solid var(--v5-border);
}

.earnings-ledger__row--last {
  border-bottom: 0;
}

.earnings-ledger__main {
  min-width: 0;
}

.earnings-ledger__text {
  display: block;
  overflow: hidden;
  font-family: var(--font-v5);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.earnings-ledger__model {
  color: var(--v5-ink);
}

.earnings-ledger__client {
  color: var(--v5-ink-3);
}

.earnings-ledger__amount {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--v5-success);
  white-space: nowrap;
}

.earnings-ledger__time {
  width: 36px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--v5-ink-4);
  text-align: right;
  white-space: nowrap;
}
</style>
