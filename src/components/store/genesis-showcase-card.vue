<!--
  GenesisShowcaseCard — 商城「尊享席位」创世节点入口卡（规格 FEAT-GEN07）。

  Design Read:给商城浏览用户的创世入口,处升级阶梯顶端压轴环,传达「稀缺高端
  OG 资产」克制质感 —— 对齐 genesis 页 obsidian-gold hero 的金色身份,
  不套 product-card 设备卡模板（转化卡模板疲劳规则）。

  ⚠️ Hardcoded gold (#D4AF5A / rgba(212,175,90,*)) is the genesis-domain design
  exception (same as pages/genesis/genesis.vue file header), not a v5 token slip.

  三态:🔒 锁定（资格未达 → 打开内嵌资格 sheet）/ ✓ 解锁（→ /pages/genesis/genesis）
  / 售罄（→ /pages/genesis/marketplace）。live 档价与余席接 useGenesis（不跑
  tickSales,persisted 值足够 — 预售页在跑）。文案高端克制线,零吆喝。
-->
<template>
  <view>
    <view class="relative overflow-hidden active:scale-[0.99]" :style="cardStyle" @click="onCardTap">
      <!-- Gold aurora wash（装饰,卡内合法光晕:bg+overflow-hidden）-->
      <view aria-hidden :style="auroraStyle" />

      <view class="relative" style="z-index: 1">
        <!-- Eyebrow -->
        <view class="flex items-center justify-between" style="gap: 10px">
          <view class="inline-flex items-center" style="gap: 6px; color: var(--v5-genesis-gold)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
            <text class="font-mono-tabular" :style="eyebrowStyle">{{ eyebrowText }}</text>
          </view>
          <text v-if="!soldOut" class="font-mono-tabular tabular-nums nowrap" :style="leftChipStyle">{{ leftText }}</text>
        </view>

        <!-- Title + perks line -->
        <text class="block font-display" :style="titleStyle">{{ t.store.genesisCardTitle }}</text>
        <text class="block" :style="perksStyle">{{ t.store.genesisCardPerks }}</text>

        <!-- Live tier price row(预售态优先显倒计时/即将开售)-->
        <view class="flex items-end justify-between" style="margin-top: 14px; gap: 10px">
          <view v-if="preSale">
            <text class="block" :style="tierLabelStyle">{{ t.genesisEligibility.comingSoon }}</text>
            <text v-if="showTime" class="block font-display tabular-nums nowrap" :style="priceStyle">{{ countdownDisplay }}</text>
          </view>
          <view v-else-if="!soldOut">
            <text class="block" :style="tierLabelStyle">{{ t.store.genesisCardTierLabel }}</text>
            <text class="block font-display tabular-nums nowrap" :style="priceStyle">${{ priceText }}</text>
          </view>
          <text v-else :style="soldOutStyle">{{ t.store.genesisCardSoldOut }}</text>

          <!-- CTA pill -->
          <view class="inline-flex items-center justify-center" :style="ctaStyle">
            <text :style="ctaTextStyle">{{ ctaText }}</text>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </view>
        </view>

        <!-- Locked state line（资格未达:可见不藏,克制表述）-->
        <view v-if="locked" :style="lockRowStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <text :style="lockTextStyle">{{ lockedLineText }}</text>
          <text class="font-mono-tabular tabular-nums nowrap" :style="lockMetStyle">{{ lockedMetText }}</text>
        </view>
      </view>
    </view>

    <!-- 内嵌资格 sheet（锁定态点卡打开;输码达标后 CTA → 预售页）-->
    <GenesisEligibilitySheet v-model:open="eligSheetOpen" @subscribe="goGenesis" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import GenesisEligibilitySheet from "@/components/genesis/eligibility-sheet.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useGenesis, GENESIS_ELIGIBILITY } from "@/store/genesis";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";

const t = useT();
const genesis = useGenesis();
const { gate, eligible } = useGenesisEligibility();
const { preSale, showTime, countdownDays, countdownClock } = useGenesisSaleGate();

const eligSheetOpen = ref(false);

const soldOut = computed(() => genesis.totalSlots - genesis.soldSlots <= 0);
// 预售未开是最外层态(优先于售罄/锁定);到点自动解锁。
const locked = computed(() => !preSale.value && !soldOut.value && !eligible.value);
const countdownDisplay = computed(() => {
  if (!showTime.value) return "";
  const dayPart = countdownDays.value > 0 ? fmt(t.value.genesisEligibility.countdownDay, { n: countdownDays.value }) + " " : "";
  return `${dayPart}${countdownClock.value}`;
});
const priceText = computed(() => genesis.unitPriceUSDT.toLocaleString());
const eyebrowText = computed(() => fmt(t.value.store.genesisCardEyebrow, { n: genesis.totalSlots.toLocaleString() }));
const leftText = computed(() => fmt(t.value.store.genesisCardLeft, { n: genesis.totalSlots - genesis.soldSlots }));
const lockedLineText = computed(() =>
  GENESIS_ELIGIBILITY.mode === "all-of" ? t.value.genesisEligibility.cardLockedLineAll : t.value.genesisEligibility.cardLockedLine,
);
const lockedMetText = computed(() => {
  const met = gate.value.conditions.filter((c) => c.met).length;
  return fmt(t.value.genesisEligibility.cardLockedMet, { met, total: gate.value.conditions.length });
});
const ctaText = computed(() => {
  if (preSale.value) return t.value.genesisEligibility.comingSoon;
  if (soldOut.value) return t.value.store.genesisCardCtaMarket;
  if (locked.value) return t.value.genesisEligibility.cardCtaLocked;
  return t.value.genesisEligibility.cardCta;
});

function goGenesis() {
  eligSheetOpen.value = false;
  uni.navigateTo({ url: "/pages/genesis/genesis", fail: () => {} });
}
function onCardTap() {
  // 预售未开:不跳不开 sheet(整卡不可认购,只展示倒计时/即将开售)。
  if (preSale.value) return;
  if (soldOut.value) {
    uni.navigateTo({ url: "/pages/genesis/marketplace", fail: () => {} });
    return;
  }
  if (locked.value) {
    eligSheetOpen.value = true;
    return;
  }
  goGenesis();
}

// ── styles（金色 = genesis 域例外,见文件头;其余走 --v5-* token,零 border 卡）──
const cardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderRadius: "18px",
  padding: "18px 16px 16px",
};
const auroraStyle: CSSProperties = {
  position: "absolute",
  top: "-46px",
  right: "-36px",
  width: "220px",
  height: "170px",
  background: "radial-gradient(closest-side, color-mix(in srgb, var(--v5-genesis-gold) 16%, transparent), transparent 72%)",
  pointerEvents: "none",
};
const eyebrowStyle: CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
};
const leftChipStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: "12px",
  color: "var(--v5-warning-ink)",
  padding: "3px 9px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-warning) 12%, transparent)",
};
const titleStyle: CSSProperties = {
  marginTop: "10px",
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.016em",
  color: "var(--v5-ink)",
  lineHeight: 1.2,
};
const perksStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "13px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.45,
  textWrap: "pretty" as CSSProperties["textWrap"],
};
const tierLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-4)", lineHeight: 1.2 };
const priceStyle: CSSProperties = {
  marginTop: "3px",
  fontSize: "26px",
  fontWeight: 600,
  letterSpacing: "-0.024em",
  color: "var(--v5-genesis-gold)",
  lineHeight: 1.05,
};
const soldOutStyle: CSSProperties = {
  fontSize: "13px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.4,
  textWrap: "pretty" as CSSProperties["textWrap"],
};
const ctaStyle: CSSProperties = {
  flexShrink: 0,
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  gap: "5px",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--v5-genesis-gold) 22%, transparent), color-mix(in srgb, var(--v5-genesis-gold) 10%, transparent))",
  color: "var(--v5-genesis-gold)",
};
const ctaTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
};
const lockRowStyle: CSSProperties = {
  marginTop: "13px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "var(--v5-surface-2)",
  borderRadius: "11px",
  padding: "9px 12px",
};
const lockTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.4,
  textWrap: "pretty" as CSSProperties["textWrap"],
};
const lockMetStyle: CSSProperties = { flexShrink: 0, fontSize: "12px", color: "var(--v5-genesis-gold)" };
</script>
