<!--
  Genesis Node — creator-node presale (1000 slots / $9,999 / sales ticker /
  dividend). Ported from Nexion-prototype/app/(main)/genesis/page.tsx.

  Wrapped in <AppChassis active="me"> (sub-page reached from /me). The source's
  chassis-level GenesisDockHost (sticky gold CTA) + GenesisSheetHost (confirm
  sheet) are folded into the page: the dock is a fixed bottom bar inside the
  chassis, the sheet is <GenesisPurchaseSheet v-model:open>.

  🏛 金-曜石 hero 与吸底 CTA 的**金色描边**是「创世域」域级例外,**主人 2026-07-23 正式拍板**
  (此前文件头自称「设计例外」写于 2026-07-09「原有条件例外一律收回」终裁之前,已失效;
  C2 独立验收指出该措辞过期,故改为正式登记)。理由:金-曜石是 $11,999 旗舰 SKU 的视觉身份,
  靠「暗底 + 金边」成立,删边后与普通暗卡不可区分。登记位置 `docs/ZERO-BORDER-ALLOWLIST.json`
  (route+cls+size 精确匹配,只覆盖这两个元素);金色本体已于 C2 收敛为
  `--v5-genesis-gold-on-dark` token,不再是散落 hex。**本页其它容器不享此例外**;shared
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
                  <text style="color: var(--v5-genesis-gold-on-dark); font-weight: 500"> / {{ totalText }} {{ t.genesis.soldOf }}</text>
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
        <view class="relative inline-flex items-center" style="z-index: 1; gap: 6px; color: var(--v5-genesis-gold-on-dark)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
          <text :style="dockLabelStyle">{{ dockCtaText }}</text>
          <template v-if="preSale && showTime">
            <view :style="dockDividerStyle" />
            <text class="tabular-nums">{{ countdownDisplay }}</text>
          </template>
          <template v-else-if="remaining > 0 && eligible">
            <view :style="dockDividerStyle" />
            <text class="tabular-nums">${{ priceText }}</text>
          </template>
          <svg v-if="!preSale" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>

    <!-- Confirm sheet -->
    <GenesisPurchaseSheet v-model:open="sheetOpen" />
    <!-- Eligibility sheet(资格门 L2,FEAT-GEN08)-->
    <GenesisEligibilitySheet v-model:open="eligSheetOpen" @subscribe="onEligSubscribe" />
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import PerkRow from "@/components/genesis/perk-row.vue";
import NftCard from "@/components/genesis/nft-card.vue";
import GenesisPurchaseSheet from "@/components/genesis/purchase-sheet.vue";
import GenesisEligibilitySheet from "@/components/genesis/eligibility-sheet.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useGenesis, GENESIS_ELIGIBILITY } from "@/store/genesis";
import { useGenesisConfig } from "@/store/genesis-config";
import { useLocaleStore } from "@/store/locale";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";
import { toast } from "@/store/ui";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";

const t = useT();
const genesis = useGenesis();
const cfg = useGenesisConfig();
const locale = useLocaleStore();
const { eligible, gate } = useGenesisEligibility();
const { preSale, showTime, countdownDays, countdownClock } = useGenesisSaleGate();

const sheetOpen = ref(false);
const eligSheetOpen = ref(false);

// Value props — 运营可配（admin G4 权益配置）覆盖优先，未配置回退现 i18n 文案。
// config.perks[i] 空字段 → 用 i18n 缺省；四项图标固定。
const PERKS = computed(() => {
  const isZh = locale.code === "zh";
  const cp = cfg.config.perks;
  const fb = t.value.genesis.value;
  const pick = (i: number, name: string, desc: string) => {
    const p = cp[i];
    const cName = p ? (isZh ? p.nameZh : p.nameEn) : "";
    const cDesc = p ? (isZh ? p.descZh : p.descEn) : "";
    return { name: cName || name, desc: cDesc || desc };
  };
  return [
    { ico: "🪙", ...pick(0, fb.emissionName, fb.emissionDesc) },
    { ico: "🌐", ...pick(1, fb.poolName, fb.poolDesc) },
    { ico: "🗳", ...pick(2, fb.daoName, fb.daoDesc) },
    { ico: "🎁", ...pick(3, fb.airdropName, fb.airdropDesc) },
  ];
});

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

// Dock 四态文案:预售未开(最外层)/ 售罄 / 未达资格(→ 资格 sheet)/ 达标认购。
const dockCtaText = computed(() => {
  if (preSale.value) return t.value.genesisEligibility.comingSoon;
  if (remaining.value === 0) return t.value.genesis.ctaSoldOut;
  if (!eligible.value) return t.value.genesisEligibility.dockLocked;
  return t.value.genesis.ctaReserve;
});
// 倒计时副文本(showTime 时):「开售倒计时 {d天} HH:MM:SS」/「Opens in {d}d HH:MM:SS」。
const countdownDisplay = computed(() => {
  if (!showTime.value) return "";
  const dayPart = countdownDays.value > 0 ? fmt(t.value.genesisEligibility.countdownDay, { n: countdownDays.value }) + " " : "";
  return `${t.value.genesisEligibility.countdownLabel} ${dayPart}${countdownClock.value}`;
});

const totalText = computed(() => total.value.toLocaleString());
const soldText = computed(() => sold.value.toLocaleString());
const priceText = computed(() => price.value.toLocaleString());

// 阶梯档展示：累计售出决定各档 售罄/当前 态。档位读 live config(运营 G4 可配、可增删)。
// labelKey 按位置派生(不按 id 硬编码):首档=wl / 末档=Final tier / 中间=Public Tier —
// 运营增删档(t3/t4…)标签不错位、末档恒为 Final(修 id 硬编码致 label 错位)。
type TierLabelKey = "wl" | "t1" | "tail";
const tiers = computed(() =>
  cfg.config.tiers.map((tier, i, arr) => {
    const s = sold.value;
    const isCurrent = s >= tier.from && s < tier.to;
    const left = Math.max(0, tier.to - Math.max(tier.from, s));
    const labelKey: TierLabelKey = i === 0 ? "wl" : i === arr.length - 1 ? "tail" : "t1";
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
  // 预售未开(最外层门,FEAT-GEN09):不开任何 sheet,倒计时中。
  if (preSale.value) return;
  // 售罄 → 二级市场承接(GEN01 异常4;原 no-op 死按钮顺手修正)。
  if (remaining.value === 0) {
    goMarketplace();
    return;
  }
  // 资格门 L2:未达标 → 资格 sheet,不开购买 sheet(FEAT-GEN08)。
  if (!eligible.value) {
    eligSheetOpen.value = true;
    return;
  }
  // 单人限购:已达上限不进购买 sheet(sheet 内 L3 + store L4 仍兜底)。
  if (gate.value.capReached) {
    toast.error(
      t.value.genesisEligibility.toastCapReached,
      fmt(t.value.genesisEligibility.toastCapReachedSub, { n: GENESIS_ELIGIBILITY.perUserCap }),
    );
    return;
  }
  sheetOpen.value = true;
}

/** 资格 sheet 达标态「立即认购」→ 关资格 sheet、错开转场后开购买 sheet。 */
function onEligSubscribe() {
  eligSheetOpen.value = false;
  setTimeout(() => {
    sheetOpen.value = true;
  }, 260);
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
  background: "color-mix(in srgb, var(--v5-genesis-gold-on-dark) 14.000000000000002%, transparent)",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-genesis-gold-on-dark)",
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
};
const heroStyle: CSSProperties = {
  padding: "24px 22px 22px",
  borderRadius: "16px",
  background:
    "radial-gradient(circle at 90% 0%, color-mix(in srgb, var(--v5-genesis-gold-on-dark) 20%, transparent) 0%, transparent 55%)," +
    "radial-gradient(circle at 0% 100%, rgba(132,90,42,0.30) 0%, transparent 60%)," +
    "linear-gradient(160deg, #1B140A 0%, #0E0A05 60%, #1A1208 100%)",
  border: "1px solid color-mix(in srgb, var(--v5-genesis-gold-on-dark) 35%, transparent)",
  boxShadow:
    "inset 0 1px 0 color-mix(in srgb, var(--v5-genesis-gold-on-dark) 22%, transparent)," +
    "inset 0 -1px 0 rgba(0,0,0,0.45)," +
    "0 12px 32px rgba(0,0,0,0.20)",
  color: "var(--v5-genesis-gold-pale-on-dark)",
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
  backgroundImage: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--v5-genesis-gold-on-dark) 5%, transparent) 0 1px, transparent 1px 14px)",
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
  background: "radial-gradient(circle, color-mix(in srgb, var(--v5-genesis-gold-on-dark) 28.000000000000004%, transparent), transparent 70%)",
  filter: "blur(4px)",
  pointerEvents: "none",
  animation: "gen-glow-drift 9s ease-in-out infinite",
};
const sheenStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(110deg, transparent 30%, color-mix(in srgb, var(--v5-genesis-gold-on-dark) 18%, transparent) 50%, transparent 70%)",
  transform: "translateX(-100%)",
  animation: "gen-sheen 5.5s ease-in-out infinite",
  pointerEvents: "none",
  zIndex: 1,
};
const crownChipStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-genesis-gold-on-dark) 10%, transparent)",
  color: "var(--v5-genesis-gold-on-dark)",
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
  color: "var(--v5-genesis-gold-pale-on-dark)",
};
const heroSubStyle: CSSProperties = {
  marginTop: "12px",
  fontSize: "13.5px",
  color: "color-mix(in srgb, var(--v5-genesis-gold-pale-on-dark) 72%, transparent)",
  lineHeight: 1.55,
};
const heroDiscStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "11px",
  color: "color-mix(in srgb, var(--v5-genesis-gold-pale-on-dark) 50%, transparent)",
  lineHeight: 1.5,
};
const barTrackStyle: CSSProperties = {
  height: "4px",
  borderRadius: "2px",
  background: "color-mix(in srgb, var(--v5-genesis-gold-on-dark) 14.000000000000002%, transparent)",
  overflow: "hidden",
};
const barFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${salesBarInView.value ? soldPct.value : 0}%`,
  background: "linear-gradient(90deg, #B5894A 0%, #E2C97C 50%, var(--v5-genesis-gold-on-dark) 100%)",
  borderRadius: "2px",
  boxShadow: "0 0 8px color-mix(in srgb, var(--v5-genesis-gold-on-dark) 50%, transparent)",
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
  color: "color-mix(in srgb, var(--v5-genesis-gold-pale-on-dark) 55%, transparent)",
  letterSpacing: "0.04em",
};
const urgentStyle: CSSProperties = {
  color: "var(--v5-genesis-gold-on-dark)",
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
  // 这行落在**跟主题的页面底**上(不是曜石 hero):原金亮主题实测 1.85 → 走跟主题的深金档
  color: "var(--v5-genesis-gold)",
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
  fontSize: "13.5px",
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
      // 吸底条按设计是**暗色金属面**,但原 alpha 0.55/0.72 在亮主题下被奶油页底冲淡,
      // 合成底只到 rgb(83,78,71) → 金色价格实测 3.95 不达 AA(暗主题 8.95 正常)。
      // 提到 0.88/0.92 让它在两个主题下都真的是暗面:亮主题合成底 rgb(38,32,26) → 7.73;
      // 暗主题合成底 rgb(18,13,7)(原 22,18,13)→ 9.28,肉眼无差。(2026-07-23 C1)
      ? "linear-gradient(180deg, rgba(50,38,20,0.88) 0%, rgba(20,14,8,0.92) 100%)"
      : "var(--v5-surface-2)",
  border: remaining.value > 0 ? "1px solid color-mix(in srgb, var(--v5-genesis-gold-on-dark) 55%, transparent)" : "1px solid var(--v5-border)",
  color: remaining.value > 0 ? "var(--v5-genesis-gold-pale-on-dark)" : "var(--v5-ink-4)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "0.02em",
  boxShadow:
    remaining.value > 0
      ? [
          "inset 0 1px 0 rgba(255,255,255,0.40)",
          "inset 0 -1px 0 rgba(0,0,0,0.50)",
          "inset 0 0 0 1px color-mix(in srgb, var(--v5-genesis-gold-on-dark) 18%, transparent)",
          "0 0 24px color-mix(in srgb, var(--v5-genesis-gold-on-dark) 20%, transparent)",
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
  background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--v5-genesis-gold-on-dark) 55%, transparent) 50%, transparent 100%)",
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
  color: remaining.value > 0 ? "var(--v5-genesis-gold-pale-on-dark)" : "var(--v5-ink-4)",
  fontWeight: 600,
}));
const dockDividerStyle: CSSProperties = {
  width: "1px",
  height: "14px",
  background: "color-mix(in srgb, var(--v5-genesis-gold-on-dark) 40%, transparent)",
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
