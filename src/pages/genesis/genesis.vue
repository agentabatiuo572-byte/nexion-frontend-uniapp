<!--
  Genesis Node — creator-node presale (1000 slots / $9,999 / sales ticker /
  dividend). Ported from Nexion-prototype/app/(main)/genesis/page.tsx.

  Wrapped in <AppChassis active="me"> (sub-page reached from /me). The source's
  chassis-level GenesisDockHost (sticky gold CTA) + GenesisSheetHost (confirm
  sheet) are folded into the page: the dock is a fixed bottom bar inside the
  chassis, the sheet is <GenesisPurchaseSheet v-model:open>.

  Decorative gold-obsidian hero (rgba gold values are decorative, not v5 light
  hex tokens — kept faithful to the .genesis-hero design exception); shared
  gen-* keyframes live in tokens.css (P-023). Holder perks + live-market cards
  are faithful English data arrays (matching the source's inline PERKS /
  LIVE_MARKET), not i18n.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink); padding-bottom: 120px">
      <SubPageHeader back="/pages/me/me" />

      <!-- Top-right "How it works →" pill -->
      <view class="px-4 flex items-center justify-end" style="padding-top: 8px; padding-bottom: 8px">
        <view class="inline-flex items-center active:opacity-80" :style="howPillStyle" @click="goHowItWorks">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
          <text style="margin: 0 6px">{{ t.genesis.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- ════ HERO — dark obsidian gold ════ -->
        <view class="relative overflow-hidden" :style="heroStyle">
          <!-- Gold dust particles -->
          <view aria-hidden class="absolute inset-0 overflow-hidden" style="pointer-events: none; z-index: 0">
            <view v-for="(d, i) in dust" :key="i" class="gen-anim" :style="d" />
          </view>
          <!-- Diagonal pinstripe -->
          <view aria-hidden class="gen-anim" :style="engraveStyle" />
          <!-- Top-right glow blob -->
          <view aria-hidden class="gen-anim" :style="glowStyle" />
          <!-- Sweeping light pass -->
          <view aria-hidden class="gen-anim" :style="sheenStyle" />

          <view class="relative" style="z-index: 2">
            <!-- Crown chip -->
            <view class="inline-flex items-center" :style="crownChipStyle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
              <text>{{ t.genesis.heroCrown }}</text>
            </view>

            <!-- Title (two block lines = guaranteed break on H5 + App) -->
            <view :style="titleStyle">
              <text class="block">
                <text class="tabular-nums" style="color: #D4AF5A">{{ totalText }}</text>
                <text> {{ t.genesis.heroTitleA }}</text>
              </text>
              <text class="block">{{ t.genesis.heroTitleB }}</text>
            </view>

            <!-- Price row -->
            <view class="flex items-baseline justify-between" :style="priceRowStyle">
              <text class="tabular-nums" :style="priceStyle">${{ priceText }}</text>
              <text :style="priceUnitStyle">{{ t.genesis.heroUnit }}</text>
            </view>

            <!-- Sub -->
            <text class="block" :style="heroSubStyle">{{ t.genesis.heroDescription }}</text>

            <!-- Sales bar -->
            <view style="margin-top: 18px">
              <view ref="salesBarRef" :style="barTrackStyle">
                <view class="relative overflow-hidden" :style="barFillStyle">
                  <view aria-hidden class="gen-anim" :style="barShimmerStyle" />
                </view>
              </view>
              <view class="flex items-center justify-between tabular-nums" :style="barMetaStyle">
                <text>
                  <text>{{ soldText }}</text>
                  <text style="color: #D4AF5A; font-weight: 500"> / {{ totalText }} {{ t.genesis.soldOf }}</text>
                </text>
                <text class="gen-anim" :style="urgentStyle">{{ remaining }} {{ t.genesis.leftSuffix }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- ════ Live social proof ════ -->
        <view v-if="latest" :key="latest.ago" class="rounded-xl flex items-center mc-ledger-in" :style="socialStyle">
          <view class="mc-pulse shrink-0" :style="socialDotStyle" />
          <text style="color: var(--v5-ink-2); flex: 1">
            <text style="font-weight: 600">{{ latest.buyer }}</text>
            <text style="color: var(--v5-ink-3)"> {{ t.genesis.socialBought }} </text>
            <text style="font-weight: 600; color: var(--v5-warning)">{{ latest.qty }} Genesis Node{{ latest.qty > 1 ? "s" : "" }}</text>
          </text>
          <text class="shrink-0" :style="socialTimeStyle">{{ t.genesis.justNow }}</text>
        </view>

        <!-- ════ Holder perks ════ -->
        <view class="flex items-center justify-between" :style="secHeaderStyle">
          <text :style="secTitleStyle">{{ t.genesis.secHolderPerks }}</text>
          <text :style="secLinkStyle" @click="goHolder">Holder dashboard →</text>
        </view>
        <view :style="perksCardStyle">
          <PerkRow v-for="(p, i) in PERKS" :key="p.title" :ico="p.ico" :name="p.title" :desc="p.desc" :is-last="i === PERKS.length - 1" />
        </view>

        <!-- ════ My holdings ════ -->
        <view :style="holdingsCardStyle">
          <view class="flex items-center justify-between">
            <view>
              <text class="block" :style="holdingsLabelStyle">{{ t.genesis.yourHoldings }}</text>
              <view class="tabular-nums" :style="holdingsValueStyle">
                <text>{{ owned }}</text>
                <text style="font-size: 13.5px; font-weight: 500; color: var(--v5-ink-3); margin-left: 6px">/ unlimited</text>
              </view>
            </view>
            <view class="text-right">
              <text class="block" :style="holdingsLabelStyle">{{ t.genesis.yourDaily }}</text>
              <text class="block tabular-nums" :style="holdingsDailyStyle">+${{ ownedDailyText }}</text>
            </view>
          </view>
        </view>

        <!-- ════ Live market ════ -->
        <view class="flex items-center justify-between active:opacity-80" :style="secHeaderStyle" role="button" tabindex="0" aria-label="View marketplace" @click="goMarketplace">
          <text :style="secTitleStyle">{{ t.genesis.secLiveMarket }}</text>
          <text :style="secLinkStyle" style="pointer-events: none">View marketplace →</text>
        </view>
        <view class="grid grid-cols-2" style="gap: 10px">
          <NftCard v-for="n in LIVE_MARKET" :key="n.id" :id="n.id" :price="n.price" :ago="n.ago" />
        </view>

        <!-- ════ FAQ snippet ════ -->
        <view :style="faqCardStyle">
          <view v-for="k in faqKeys" :key="k">
            <text class="block">
              <text style="color: var(--v5-ink); font-weight: 600">Q.</text>
              <text> {{ t.genesis.faq[k] }}</text>
            </text>
            <text class="block">{{ t.genesis.faq[answerKey(k)] }}</text>
          </view>
        </view>

        <!-- ════ Secondary market link ════ -->
        <view class="flex items-center justify-between active:opacity-80" :style="openseaStyle" role="button" tabindex="0" :aria-label="t.genesis.openseaLine" @click="goMarketplace">
          <text style="pointer-events: none">
            <text>{{ t.genesis.openseaLine }} </text>
            <text class="tabular-nums" style="font-weight: 600; color: var(--v5-warning)">$25,000</text>
          </text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
        </view>
      </view>
    </view>

    <!-- Sticky gold dock (folds source GenesisDockHost into the page) -->
    <view class="nx-genesis-dock" :style="dockWrapStyle">
      <view class="relative w-full overflow-hidden active:scale-[0.99]" :style="dockBtnStyle" @click="openSheet">
        <template v-if="remaining > 0">
          <view aria-hidden :style="dockSpecularStyle" />
          <view aria-hidden :style="dockRimStyle" />
          <view aria-hidden class="gen-anim" :style="dockSheenStyle" />
        </template>
        <view class="relative inline-flex items-center" style="z-index: 1; gap: 6px; color: #D4AF5A">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
          <text :style="dockLabelStyle">{{ remaining > 0 ? t.genesis.ctaReserve : t.genesis.ctaSoldOut }}</text>
          <template v-if="remaining > 0">
            <view :style="dockDividerStyle" />
            <text class="tabular-nums">${{ priceText }}</text>
          </template>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>

    <!-- Confirm sheet -->
    <GenesisPurchaseSheet v-model:open="sheetOpen" />
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import PerkRow from "@/components/genesis/perk-row.vue";
import NftCard from "@/components/genesis/nft-card.vue";
import GenesisPurchaseSheet from "@/components/genesis/purchase-sheet.vue";
import { useT } from "@/i18n/use-t";
import { useGenesis } from "@/store/genesis";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";

const t = useT();
const genesis = useGenesis();

const sheetOpen = ref(false);

// Holder perks — faithful English data (matches source inline PERKS array).
const PERKS = [
  { ico: "🪙", title: "Daily dividend", desc: "0.1% of platform volume per node · ~$24/day" },
  { ico: "🎟", title: "Monthly raffle", desc: "Auto-entry · winners get NFT prize + USDT" },
  { ico: "🗳", title: "DAO governance", desc: "1 node = 1 vote on platform proposals" },
  { ico: "🎁", title: "Annual airdrop", desc: "Loyalty NFT + physical merch" },
  { ico: "💎", title: "Floor & liquidity", desc: "OpenSea floor $25K · 2.5× mint" },
];

const LIVE_MARKET = [
  { id: 247, price: 25.5, ago: "12m" },
  { id: 481, price: 28.2, ago: "34m" },
];

const BUYER_NAMES = [
  "Alex from SF", "Marina from Berlin", "Tom from Tokyo", "Sara from Singapore",
  "Carlos from Madrid", "Yuki from Seoul", "Diego from São Paulo", "Lena from Frankfurt",
];

const faqKeys = ["q1", "q2", "q3"] as const;
function answerKey(k: "q1" | "q2" | "q3"): "a1" | "a2" | "a3" {
  return k === "q1" ? "a1" : k === "q2" ? "a2" : "a3";
}

const sold = computed(() => genesis.soldSlots);
const total = computed(() => genesis.totalSlots);
const owned = computed(() => genesis.myOwned);
const price = computed(() => genesis.unitPriceUSDT);
const remaining = computed(() => total.value - sold.value);
const soldPct = computed(() => (sold.value / total.value) * 100);
// Q14 single source — store-owned formula shared by sheet + holder.
const dailyDividend = computed(() => genesis.currentDailyDividendPerNodeUSDT());

const totalText = computed(() => total.value.toLocaleString());
const soldText = computed(() => sold.value.toLocaleString());
const priceText = computed(() => price.value.toLocaleString());
const ownedDailyText = computed(() => (owned.value * dailyDividend.value).toFixed(2));

const { elRef: salesBarRef, inView: salesBarInView } = useScrollGrowProgress();

// Rolling social proof + sales ticker.
const latest = ref<{ buyer: string; qty: number; ago: number } | null>(null);
let socialId: ReturnType<typeof setTimeout> | null = null;
let tickId: ReturnType<typeof setInterval> | null = null;

function emitSocial() {
  const buyer = BUYER_NAMES[Math.floor(Math.random() * BUYER_NAMES.length)];
  const qty = 1 + Math.floor(Math.random() * 3);
  latest.value = { buyer, qty, ago: Date.now() };
  socialId = setTimeout(emitSocial, 8_000 + Math.random() * 6_000);
}

function openSheet() {
  if (remaining.value === 0) return;
  sheetOpen.value = true;
}
function goHowItWorks() {
  uni.navigateTo({ url: "/pages/genesis/how-it-works", fail: () => {} });
}
function goHolder() {
  uni.navigateTo({ url: "/pages/genesis/holder", fail: () => {} });
}
function goMarketplace() {
  uni.navigateTo({ url: "/pages/genesis/marketplace", fail: () => {} });
}

onMounted(() => {
  emitSocial();
  tickId = setInterval(() => genesis.tickSales(), 30_000);
});
onUnmounted(() => {
  if (socialId) clearTimeout(socialId);
  if (tickId) clearInterval(tickId);
});

// ── styles ──
const howPillStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  background: "var(--v5-brand-soft)",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--v5-brand)",
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
};
const heroStyle: CSSProperties = {
  padding: "24px 22px 22px",
  borderRadius: "16px",
  background:
    "radial-gradient(circle at 90% 0%, rgba(212,175,90,0.20) 0%, transparent 55%)," +
    "radial-gradient(circle at 0% 100%, rgba(132,90,42,0.30) 0%, transparent 60%)," +
    "linear-gradient(160deg, #1B140A 0%, #0E0A05 60%, #1A1208 100%)",
  border: "1px solid rgba(212,175,90,0.35)",
  boxShadow:
    "inset 0 1px 0 rgba(212,175,90,0.22)," +
    "inset 0 -1px 0 rgba(0,0,0,0.45)," +
    "0 12px 32px rgba(0,0,0,0.20)",
  color: "#F4E5C2",
};
const dustPos = ["12%", "32%", "54%", "72%", "86%"];
const dustDur = [7, 8, 6.5, 9, 7.5];
const dustDelay = [0, 1.4, 3.0, 4.6, 2.2];
const dust = computed<CSSProperties[]>(() =>
  [0, 1, 2, 3, 4].map((i) => ({
    position: "absolute",
    bottom: "0",
    left: dustPos[i],
    width: "2px",
    height: "2px",
    borderRadius: "50%",
    background: "#E2C97C",
    boxShadow: "0 0 4px rgba(226,201,124,0.7)",
    opacity: 0,
    animation: `gen-dust-rise ${dustDur[i]}s linear infinite`,
    animationDelay: `${dustDelay[i]}s`,
  })),
);
const engraveStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: "repeating-linear-gradient(135deg, rgba(212,175,90,0.05) 0 1px, transparent 1px 14px)",
  mixBlendMode: "screen",
  opacity: 0.6,
  pointerEvents: "none",
  animation: "gen-engrave 30s linear infinite",
};
const glowStyle: CSSProperties = {
  position: "absolute",
  top: "-60px",
  right: "-60px",
  width: "200px",
  height: "200px",
  background: "radial-gradient(circle, rgba(212,175,90,0.28), transparent 70%)",
  filter: "blur(4px)",
  pointerEvents: "none",
  animation: "gen-glow-drift 9s ease-in-out infinite",
};
const sheenStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(110deg, transparent 30%, rgba(212,175,90,0.18) 50%, transparent 70%)",
  transform: "translateX(-100%)",
  animation: "gen-sheen 5.5s ease-in-out infinite",
  pointerEvents: "none",
  zIndex: 1,
};
const crownChipStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: "999px",
  background: "rgba(212,175,90,0.10)",
  border: "1px solid rgba(212,175,90,0.45)",
  color: "#D4AF5A",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  fontWeight: 500,
  letterSpacing: "0.14em",
};
const titleStyle: CSSProperties = {
  marginTop: "18px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "28px",
  letterSpacing: "-0.024em",
  lineHeight: 1.18,
  color: "#F4E5C2",
};
const priceRowStyle: CSSProperties = {
  marginTop: "18px",
  paddingTop: "16px",
  borderTop: "1px solid rgba(212,175,90,0.18)",
  gap: "10px",
};
const priceStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "32px",
  letterSpacing: "-0.022em",
  color: "#F4E5C2",
};
const priceUnitStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11.5px",
  color: "rgba(244,229,194,0.55)",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
const heroSubStyle: CSSProperties = {
  marginTop: "12px",
  fontSize: "13px",
  color: "rgba(244,229,194,0.72)",
  lineHeight: 1.55,
};
const barTrackStyle: CSSProperties = {
  height: "4px",
  borderRadius: "2px",
  background: "rgba(212,175,90,0.14)",
  overflow: "hidden",
};
const barFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${salesBarInView.value ? soldPct.value : 0}%`,
  background: "linear-gradient(90deg, #B5894A 0%, #E2C97C 50%, #D4AF5A 100%)",
  borderRadius: "2px",
  boxShadow: "0 0 8px rgba(212,175,90,0.5)",
  transition: salesBarInView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));
const barShimmerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
  transform: "translateX(-100%)",
  animation: "gen-bar-shimmer 2.4s ease-in-out infinite",
};
const barMetaStyle: CSSProperties = {
  marginTop: "8px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "rgba(244,229,194,0.55)",
  letterSpacing: "0.04em",
};
const urgentStyle: CSSProperties = {
  color: "#D4AF5A",
  fontWeight: 500,
  animation: "gen-urgent 1.8s ease-in-out infinite",
};
const socialStyle: CSSProperties = {
  padding: "8px 12px",
  gap: "8px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
};
const socialDotStyle: CSSProperties = { width: "6px", height: "6px", borderRadius: "50%", background: "var(--v5-success)" };
const socialTimeStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-3)",
};
const secHeaderStyle: CSSProperties = { margin: "22px 2px 12px" };
const secTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const secLinkStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-brand)",
  fontWeight: 500,
};
const perksCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "14px",
  padding: "4px 16px",
};
const holdingsCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "18px",
};
const holdingsLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.02em",
};
const holdingsValueStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "26px",
  letterSpacing: "-0.022em",
  lineHeight: 1,
  color: "var(--v5-ink)",
};
const holdingsDailyStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-success)",
};
const faqCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "16px",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.55,
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};
const openseaStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: "12px",
  background: "var(--v5-warning-soft)",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink-2)",
};

// Sticky dock styles (folds GenesisDockHost) — anchored to chassis bottom.
const dockWrapStyle: CSSProperties = {
  padding: "12px 16px 24px",
  background: "var(--v5-sticky-bar-bg)",
  backdropFilter: "blur(18px) saturate(180%)",
  borderTop: "1px solid var(--v5-sticky-bar-border)",
};
const dockBtnStyle = computed<CSSProperties>(() => ({
  height: "54px",
  borderRadius: "999px",
  background:
    remaining.value > 0
      ? "linear-gradient(180deg, rgba(50,38,20,0.55) 0%, rgba(20,14,8,0.72) 100%)"
      : "var(--v5-surface-2)",
  border: remaining.value > 0 ? "1px solid rgba(212,175,90,0.55)" : "1px solid var(--v5-border)",
  color: remaining.value > 0 ? "#F4E5C2" : "var(--v5-ink-4)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "0.02em",
  boxShadow:
    remaining.value > 0
      ? [
          "inset 0 1px 0 rgba(255,255,255,0.40)",
          "inset 0 -1px 0 rgba(0,0,0,0.50)",
          "inset 0 0 0 1px rgba(212,175,90,0.18)",
          "0 0 24px rgba(212,175,90,0.20)",
          "0 14px 30px rgba(0,0,0,0.45)",
        ].join(", ")
      : "none",
}));
const dockSpecularStyle: CSSProperties = {
  position: "absolute",
  top: "1px",
  left: "1px",
  right: "1px",
  height: "55%",
  borderRadius: "999px 999px 200px 200px / 999px 999px 40px 40px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 55%, transparent 100%)",
  pointerEvents: "none",
};
const dockRimStyle: CSSProperties = {
  position: "absolute",
  left: "14%",
  right: "14%",
  bottom: "1px",
  height: "1px",
  background: "linear-gradient(90deg, transparent 0%, rgba(212,175,90,0.55) 50%, transparent 100%)",
  pointerEvents: "none",
};
const dockSheenStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
  transform: "translateX(-100%)",
  animation: "gen-sheen 4.5s ease-in-out infinite",
  pointerEvents: "none",
};
const dockLabelStyle = computed<CSSProperties>(() => ({
  color: remaining.value > 0 ? "#F4E5C2" : "var(--v5-ink-4)",
  fontWeight: 600,
}));
const dockDividerStyle: CSSProperties = {
  width: "1px",
  height: "14px",
  background: "rgba(212,175,90,0.40)",
  margin: "0 4px",
};
</script>

<style scoped>
.nx-genesis-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 35;
}
</style>
