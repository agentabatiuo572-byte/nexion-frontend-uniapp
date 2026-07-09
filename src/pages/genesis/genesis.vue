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
            <!-- Crown chip + rules-intro pill share the top row (gold-toned pill
                 so it reads on the obsidian-gold hero; owner 2026-07-09 kill gap). -->
            <view class="flex items-center justify-between" style="gap: 8px">
              <view class="inline-flex items-center" :style="crownChipStyle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
                <text>{{ t.genesis.heroCrown }}</text>
              </view>
              <view class="inline-flex items-center shrink-0 active:opacity-80" :style="howPillStyle" @click="goHowItWorks">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                <text style="margin: 0 6px">{{ t.genesis.howItWorksEntry }}</text>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </view>
            </view>

            <!-- Title — punchy, restrained (high-end OG seat, not a bark) -->
            <text class="block" :style="titleStyle">{{ t.genesis.heroTitle }}</text>

            <!-- Sub + disclaimer -->
            <text class="block" :style="heroSubStyle">{{ t.genesis.heroSub }}</text>
            <text class="block" :style="heroDiscStyle">{{ t.genesis.heroDisc }}</text>

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

        <!-- ════ Tier ladder — 售罄跳价 ════ -->
        <view class="flex items-center justify-between" :style="secHeaderStyle">
          <text :style="secTitleStyle">{{ t.genesis.tier.title }}</text>
        </view>
        <view :style="ladderCardStyle">
          <view v-for="tr in tiers" :key="tr.id" class="flex items-center" :style="tierRowStyle(tr.isCurrent)">
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 8px">
                <text :style="tierNameStyle">{{ t.genesis.tier[tr.labelKey] }}</text>
                <text :style="tr.isCurrent ? tierChipLiveStyle : tierChipSoldStyle">{{ tr.isCurrent ? t.genesis.tier.live : t.genesis.tier.soldOut }}</text>
              </view>
              <text class="block" :style="tierMetaStyle">{{ tr.isCurrent ? fmt(t.genesis.tier.left, { n: tr.left }) : fmt(t.genesis.tier.seats, { n: tr.seatsTotal }) }}</text>
            </view>
            <view class="text-right shrink-0">
              <text class="block tabular-nums" :style="tierPriceStyle">${{ tr.priceText }}</text>
              <text v-if="tr.isCurrent" class="block" :style="tierCurrentStyle">{{ t.genesis.tier.current }}</text>
            </view>
          </view>
          <text class="block" :style="tierPremiumStyle">{{ t.genesis.tier.premium }}</text>
        </view>

        <!-- ════ Value / perks ════ -->
        <view class="flex items-center justify-between" :style="secHeaderStyle">
          <text :style="secTitleStyle">{{ t.genesis.value.title }}</text>
        </view>
        <view :style="perksCardStyle">
          <PerkRow v-for="(p, i) in PERKS" :key="p.name" :ico="p.ico" :name="p.name" :desc="p.desc" :is-last="i === PERKS.length - 1" />
        </view>

        <!-- ════ Live market ════ -->
        <view class="flex items-center justify-between active:opacity-80" :style="secHeaderStyle" role="button" tabindex="0" :aria-label="t.genesis.viewMarketplace" @click="goMarketplace">
          <text :style="secTitleStyle">{{ t.genesis.secLiveMarket }}</text>
          <text :style="secLinkStyle" style="pointer-events: none">{{ t.genesis.viewMarketplace }}</text>
        </view>
        <view class="grid grid-cols-2" style="gap: 10px">
          <NftCard v-for="n in LIVE_MARKET" :key="n.id" :id="n.id" :price="n.price" :ago="n.ago" />
        </view>

        <!-- ════ FAQ snippet — de-carded: floor hairline group ════ -->
        <view :style="faqWrapStyle">
          <view v-for="(k, i) in faqKeys" :key="k" :style="faqRowStyle(i)">
            <text class="block" :style="faqQStyle">
              <text style="color: var(--v5-ink); font-weight: 600">Q.</text>
              <text> {{ t.genesis.faq[k] }}</text>
            </text>
            <text class="block" :style="faqAStyle">{{ t.genesis.faq[answerKey(k)] }}</text>
          </view>
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
import { fmt } from "@/i18n/format";
import { useGenesis, GENESIS_TIERS } from "@/store/genesis";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";

const t = useT();
const genesis = useGenesis();

const sheetOpen = ref(false);

// Value props — i18n-driven（迁离硬编码英文，去日分红/$25K 地板雷）。
const PERKS = computed(() => [
  { ico: "🪙", name: t.value.genesis.value.emissionName, desc: t.value.genesis.value.emissionDesc },
  { ico: "🌐", name: t.value.genesis.value.poolName, desc: t.value.genesis.value.poolDesc },
  { ico: "🗳", name: t.value.genesis.value.daoName, desc: t.value.genesis.value.daoDesc },
  { ico: "🎁", name: t.value.genesis.value.airdropName, desc: t.value.genesis.value.airdropDesc },
]);

// Secondary-market recent fills（价格随尾盘档溢价，非旧 $25K 地板叙事）。
const LIVE_MARKET = [
  { id: 247, price: 13.4, ago: "12m" },
  { id: 481, price: 14.2, ago: "34m" },
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
const price = computed(() => genesis.unitPriceUSDT);
const remaining = computed(() => total.value - sold.value);
const soldPct = computed(() => (sold.value / total.value) * 100);

const totalText = computed(() => total.value.toLocaleString());
const soldText = computed(() => sold.value.toLocaleString());
const priceText = computed(() => price.value.toLocaleString());

// 阶梯档展示：累计售出决定各档 售罄/当前 态（wl/t1 售罄、t2 尾盘当前）。
type TierLabelKey = "wl" | "t1" | "tail";
const tiers = computed(() =>
  GENESIS_TIERS.map((tier) => {
    const s = sold.value;
    const isCurrent = s >= tier.from && s < tier.to;
    const left = Math.max(0, tier.to - Math.max(tier.from, s));
    const labelKey: TierLabelKey = tier.id === "t2" ? "tail" : (tier.id as "wl" | "t1");
    return {
      id: tier.id,
      labelKey,
      priceText: tier.priceUSDT.toLocaleString(),
      isCurrent,
      left,
      seatsTotal: tier.to - tier.from,
    };
  }),
);

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
// Gold-toned pill (matches the obsidian-gold hero's crown chip — a green
// brand-soft would clash on the gold). Hardcoded gold is the .genesis-hero
// design exception (see file header), not a v5 token slip.
const howPillStyle: CSSProperties = {
  height: "34px",
  padding: "0 12px",
  borderRadius: "999px",
  background: "rgba(212,175,90,0.14)",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "#D4AF5A",
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
const heroSubStyle: CSSProperties = {
  marginTop: "12px",
  fontSize: "13px",
  color: "rgba(244,229,194,0.72)",
  lineHeight: 1.55,
};
const heroDiscStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "11px",
  color: "rgba(244,229,194,0.5)",
  lineHeight: 1.5,
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
// Live social-proof bubble — filled surface, no border (chat-bubble idiom).
const socialStyle: CSSProperties = {
  padding: "8px 12px",
  gap: "8px",
  background: "var(--v5-surface)",
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
// De-carded: floor hairline group — PerkRow already carries its own dividers.
const perksCardStyle: CSSProperties = {
  padding: "0 2px",
  borderTop: "1px solid var(--v5-border)",
};
// ── Tier ladder — de-carded: floor hairline group (rows sit on the page). ──
const ladderCardStyle: CSSProperties = {
  padding: "0 2px",
  borderTop: "1px solid var(--v5-border)",
};
function tierRowStyle(isCurrent: boolean): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 0",
    borderBottom: "1px solid var(--v5-border)",
    opacity: isCurrent ? 1 : 0.6,
  };
}
const tierNameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const tierChipLiveStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  fontWeight: 500,
  padding: "1px 7px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-warning) 16%, transparent)",
  color: "var(--v5-warning)",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
};
const tierChipSoldStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  fontWeight: 500,
  padding: "1px 7px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
};
const tierMetaStyle: CSSProperties = {
  marginTop: "3px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};
const tierPriceStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};
const tierCurrentStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  color: "#D4AF5A",
  letterSpacing: "0.02em",
};
const tierPremiumStyle: CSSProperties = {
  marginTop: "10px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
// De-carded: floor hairline group + typed Q/A layering (title ink, body ink-2).
const faqWrapStyle: CSSProperties = {
  padding: "0 2px",
  borderTop: "1px solid var(--v5-border)",
};
function faqRowStyle(i: number): CSSProperties {
  return {
    padding: "12px 0",
    borderBottom: i < faqKeys.length - 1 ? "1px solid var(--v5-border)" : "none",
  };
}
const faqQStyle: CSSProperties = {
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  lineHeight: 1.4,
};
const faqAStyle: CSSProperties = {
  marginTop: "5px",
  fontSize: "13px",
  color: "var(--v5-ink-2)",
  lineHeight: 1.62,
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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
