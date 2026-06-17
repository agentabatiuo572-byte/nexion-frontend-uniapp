<!-- ListingCard — marketplace listing tile + Buy CTA (marketplace/page.tsx ListingCard). -->
<template>
  <view class="overflow-hidden" :style="cardStyle">
    <!-- NFT visual -->
    <view class="relative flex items-center justify-center" :style="artStyle">
      <view class="text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
        <text class="block tabular-nums" :style="tokenIdStyle">#{{ l.tokenId }}</text>
        <text class="block" :style="founderStyle">{{ t.marketplace.founderLabel }}</text>
      </view>
      <view class="mc-pulse" :style="dotStyle" />
    </view>
    <!-- Meta -->
    <view style="padding: 12px">
      <text class="block" :style="priceLabelStyle">{{ t.marketplace.price }}</text>
      <text class="block tabular-nums" :style="priceStyle">${{ priceText }}</text>
      <view class="flex items-center justify-between" style="margin-top: 6px">
        <text :style="lastSaleStyle">{{ lastSaleText }}</text>
        <text class="tabular-nums" :style="deltaStyle">{{ isUp ? "+" : "" }}{{ deltaPct }}%</text>
      </view>
      <view class="w-full flex items-center justify-center active:scale-[0.98]" :style="buyBtnStyle" role="button" tabindex="0" :aria-label="t.marketplace.buyCta" @click="emit('buy')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; pointer-events: none"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
        <text style="pointer-events: none" @click.stop="emit('buy')">{{ t.marketplace.buyCta }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

export interface Listing {
  tokenId: number;
  priceUSDT: number;
  lastSaleUSDT: number;
  seller: string;
  listedAt: number;
  traits: { tier: string; boost: string; mintYear: number };
}

const props = defineProps<{ l: Listing }>();
const emit = defineEmits<{ buy: [] }>();

const t = useT();

const delta = computed(() => props.l.priceUSDT - props.l.lastSaleUSDT);
const deltaPct = computed(() =>
  (props.l.lastSaleUSDT > 0 ? (delta.value / props.l.lastSaleUSDT) * 100 : 0).toFixed(0),
);
const isUp = computed(() => delta.value > 0);
const priceText = computed(() => props.l.priceUSDT.toLocaleString());
const lastSaleText = computed(() => fmt(t.value.marketplace.lastSale, { k: (props.l.lastSaleUSDT / 1000).toFixed(1) }));

const cardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const artStyle: CSSProperties = {
  aspectRatio: "1 / 1",
  background:
    "radial-gradient(80% 80% at 50% 30%, rgba(255,107,53,0.18) 0%, transparent 65%), linear-gradient(135deg, #1F1408 0%, var(--v5-on-brand) 100%)",
};
const tokenIdStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const founderStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-warning)",
};
const dotStyle: CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
  width: "6px",
  height: "6px",
  borderRadius: "999px",
  background: "var(--v5-success)",
};
const priceLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.04em",
};
const priceStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const lastSaleStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const deltaStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  fontWeight: 600,
  color: isUp.value ? "var(--v5-success)" : "var(--v5-brand-2)",
}));
const buyBtnStyle: CSSProperties = {
  marginTop: "10px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  letterSpacing: "-0.005em",
};
</script>
