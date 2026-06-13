<!--
  Genesis Holder Dashboard — ported from
  Nexion-prototype/app/(main)/genesis/holder/page.tsx.

  Hero (holdings · lifetime · today · next-payout countdown) → 30d bar chart →
  live dividend feed → holdings list → holder perks → quick actions. When
  myOwned === 0 → empty-state CTA + preview banner (no fake holder numbers).
  Wrapped in <AppChassis active="me">. Per-node dividend uses the store-owned
  Q14 single source (genesis.currentDailyDividendPerNodeUSDT).
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 32px">
      <SubPageHeader back="/pages/genesis/genesis" />

      <view class="px-4" style="padding-top: 8px; display: flex; flex-direction: column; gap: 12px">
        <!-- Hero -->
        <view class="relative overflow-hidden" :style="heroCardStyle">
          <view class="flex items-start" style="gap: 12px">
            <view class="grid place-items-center shrink-0" :style="avatarStyle">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="heroLabelStyle">{{ t.genesisHolder.heroLabel }}</text>
              <view class="flex items-baseline" style="gap: 6px; margin-top: 4px">
                <text class="tabular-nums" :style="heroNumStyle">{{ owned }}</text>
                <text :style="heroNodesStyle">{{ t.genesisHolder.nodes }}</text>
              </view>
            </view>
          </view>

          <view class="tabular-nums" :style="lifetimeStyle">
            <text>{{ t.genesisHolder.lifetimeEarned }} </text>
            <text style="font-weight: 500">{{ hasNodes ? lifetimeText : "$0.00" }}</text>
          </view>

          <view class="grid grid-cols-3" :style="heroStatGridStyle">
            <view>
              <text class="block truncate" :style="cellLabelStyle">{{ t.genesisHolder.todayShare }}</text>
              <text class="block tabular-nums" :style="cellValStyle('var(--v5-success)')">{{ hasNodes ? todayShareText : "$0.00" }}</text>
            </view>
            <view>
              <text class="block truncate" :style="cellLabelStyle">{{ t.genesisHolder.pendingPayout }}</text>
              <text class="block tabular-nums" :style="cellValStyle(hasNodes ? 'var(--v5-brand-2)' : 'var(--v5-ink)')">{{ hasNodes ? pendingText : "$0.00" }}</text>
            </view>
            <view>
              <text class="block truncate" :style="cellLabelStyle">{{ nextPayoutLabel }}</text>
              <text class="block tabular-nums" :style="cellValMonoStyle">{{ countdownText }}</text>
            </view>
          </view>
        </view>

        <!-- No-holder CTA -->
        <view v-if="!hasNodes" class="active:scale-[0.99]" :style="ctaCardStyle" @click="goGenesis">
          <view class="flex items-center" style="gap: 12px">
            <view class="grid place-items-center shrink-0" :style="ctaIconStyle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="ctaTitleStyle">{{ t.genesisHolder.notHolderTitle }}</text>
              <text class="block" :style="ctaBodyStyle">{{ notHolderBodyText }}</text>
            </view>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </view>
        </view>

        <!-- Preview hint -->
        <view v-if="!hasNodes" :style="previewStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
          <text :style="previewTextStyle">{{ t.genesisHolder.previewModeBanner }}</text>
        </view>

        <!-- 30-day chart -->
        <view v-if="hasNodes" :style="chartCardStyle">
          <view class="flex items-center justify-between" style="margin-bottom: 8px">
            <text :style="chartLabelStyle">{{ t.genesisHolder.chartLabel }}</text>
            <text class="tabular-nums" :style="chartTotalStyle">{{ t.genesisHolder.chartTotal }} {{ monthTotalText }}</text>
          </view>
          <view :style="chartBoxStyle">
            <svg width="100%" height="96" viewBox="0 0 320 96" preserveAspectRatio="none">
              <rect v-for="(v, i) in chartData" :key="i" :x="i * (barW + 2)" :y="96 - v * 88 - 2" :width="barW" :height="v * 88" fill="var(--v5-success)" :opacity="0.6 + v * 0.4" rx="1" />
            </svg>
          </view>
        </view>

        <!-- Live dividend feed -->
        <view class="overflow-hidden" :style="feedCardStyle">
          <view class="px-4 flex items-center justify-between" style="padding-top: 12px; padding-bottom: 8px">
            <view class="flex items-center" style="gap: 6px">
              <view class="mc-pulse" :style="feedDotStyle" />
              <text :style="feedLabelStyle">{{ t.genesisHolder.distFeedLabel }}</text>
            </view>
          </view>
          <view v-for="(f, i) in feed" :key="i" class="px-4 flex items-center" :style="feedRowStyle(i === feed.length - 1)">
            <view class="flex-1 min-w-0">
              <text class="block truncate" style="color: var(--v5-ink); font-size: 11.5px">{{ f.who }}</text>
              <text class="block truncate" style="font-size: 10.5px; color: var(--v5-ink-3)">{{ f.label }}</text>
            </view>
            <text class="tabular-nums" :style="feedAmtStyle">+{{ usd(f.amount) }}</text>
            <text class="text-right" :style="feedAgoStyle">{{ feedAgo(f.ts) }}s</text>
          </view>
          <text class="block px-4" :style="feedNoteStyle">{{ t.genesisHolder.distFeedNote }}</text>
        </view>

        <!-- Holdings list -->
        <view v-if="hasNodes">
          <text class="block" :style="sectionLabelStyle">{{ t.genesisHolder.holdingsLabel }}</text>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <view v-for="h in holdings" :key="h.id" class="flex items-center" :style="holdingCardStyle">
              <view class="shrink-0 grid place-items-center" :style="holdingArtStyle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
              </view>
              <view class="flex-1 min-w-0">
                <text class="block" :style="holdingIdStyle">{{ h.id }}</text>
                <text class="block font-mono-tabular" style="font-size: 10.5px; color: var(--v5-ink-3); margin-top: 2px">{{ mintedText(h.mintedAt) }}</text>
                <view class="flex items-center font-mono-tabular" style="margin-top: 6px; gap: 12px; font-size: 10.5px">
                  <text style="color: var(--v5-brand)">{{ t.genesisHolder.holdingCard.lifetime }} {{ usd1(h.lifetime) }}</text>
                  <text style="color: var(--v5-brand-2)">{{ t.genesisHolder.holdingCard.thisMonth }} {{ usd1(h.thisMonth) }}</text>
                </view>
              </view>
              <view class="grid place-items-center active:opacity-70" :style="holdingLinkStyle" @click="goMarketplace">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
              </view>
            </view>
          </view>
        </view>

        <!-- Holder perks -->
        <view :style="perksCardStyle">
          <text class="block" :style="perksLabelStyle">{{ t.genesisHolder.perksLabel }}</text>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <view v-for="k in perkKeys" :key="k" class="grid items-start" :style="perkRowStyle">
              <view class="flex items-center justify-center" :style="perkIconStyle">
                <text style="font-size: 18px; line-height: 1">{{ t.genesisHolder.perks[k].icon }}</text>
              </view>
              <view class="min-w-0">
                <text class="block" :style="perkLabelStyle">{{ t.genesisHolder.perks[k].label }}</text>
                <text class="block" :style="perkBodyStyle">{{ t.genesisHolder.perks[k].body }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Quick actions -->
        <view>
          <text class="block" :style="sectionLabelStyle">{{ t.genesisHolder.actionsLabel }}</text>
          <view class="grid grid-cols-3" style="gap: 8px">
            <view :style="actionTileStyle" class="active:scale-[0.97]" @click="goGenesis">
              <view class="grid place-items-center" :style="actionIconStyle('var(--v5-brand-2)')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
              </view>
              <text :style="actionLabelStyle">{{ t.genesisHolder.actions.buy }}</text>
              <text :style="actionSubStyle">{{ buySub }}</text>
            </view>
            <view :style="actionTileStyle" class="active:scale-[0.97]" @click="goMarketplace">
              <view class="grid place-items-center" :style="actionIconStyle('var(--v5-brand)')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
              </view>
              <text :style="actionLabelStyle">{{ t.genesisHolder.actions.sell }}</text>
              <text :style="actionSubStyle">floor $25K</text>
            </view>
            <view :style="actionTileClaimStyle" class="active:scale-[0.97]" @click="handleClaim">
              <view class="grid place-items-center" :style="actionIconStyle('var(--v5-success)')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3" /><path d="m6 11 6 6 6-6" /><path d="M19 21H5" /></svg>
              </view>
              <text :style="actionLabelStyle">{{ t.genesisHolder.actions.claim }}</text>
              <text class="tabular-nums" style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 10.5px; color: var(--v5-brand)">{{ pendingText }}</text>
            </view>
          </view>
        </view>

        <text class="block text-center" :style="noteStyle">{{ t.genesisHolder.note }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useGenesis } from "@/store/genesis";
import { toast } from "@/store/ui";

const DAY = 86400_000;

const t = useT();
const genesis = useGenesis();

const perkKeys = ["a", "b", "c", "d", "e", "f"] as const;
const barW = (320 - 30 * 2) / 30;

const owned = computed(() => genesis.myOwned);
const hasNodes = computed(() => owned.value > 0);
const remaining = computed(() => genesis.totalSlots - genesis.soldSlots);
const unitPrice = computed(() => genesis.unitPriceUSDT);

// Q14 single source.
const dailyDividendPerNode = computed(() => genesis.currentDailyDividendPerNodeUSDT());
const todayShare = computed(() => dailyDividendPerNode.value * owned.value);
const lifetimeEarned = computed(() => todayShare.value * 142);
const pendingPayout = computed(() => todayShare.value * 0.8);
const monthTotal = computed(() => todayShare.value * 30);

// Next payout countdown — daily 00:00 UTC, refreshed each second.
const tick = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => (tick.value += 1), 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const nextPayoutMs = computed(() => {
  void tick.value; // re-evaluate each second
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - Date.now();
});

function fmtUSD(n: number, dp = 2): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp })}`;
}
function usd(n: number): string {
  return fmtUSD(n, 2);
}
function usd1(n: number): string {
  return fmtUSD(n, 1);
}
function fmtCompactUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const lifetimeText = computed(() => fmtUSD(lifetimeEarned.value));
const todayShareText = computed(() => fmtUSD(todayShare.value));
const pendingText = computed(() => fmtUSD(pendingPayout.value));
const monthTotalText = computed(() => fmtUSD(monthTotal.value));
const countdownText = computed(() => fmtCountdown(nextPayoutMs.value));
const buySub = computed(() => fmtCompactUSD(unitPrice.value));
const nextPayoutLabel = computed(() => t.value.genesisHolder.nextPayout.replace("{time}", "").trim());
const notHolderBodyText = computed(() => fmt(t.value.genesisHolder.notHolderBody, { n: remaining.value }));

// Holdings list — only when owning nodes (max 6).
const holdings = computed(() => {
  const list: Array<{ id: string; mintedAt: number; lifetime: number; thisMonth: number }> = [];
  const count = Math.min(owned.value, 6);
  for (let i = 0; i < count; i++) {
    const serial = 4192 - i * 137;
    list.push({
      id: `NEX-GEN-${serial.toString().padStart(4, "0")}`,
      mintedAt: Date.now() - (142 - i * 18) * DAY,
      lifetime: dailyDividendPerNode.value * (142 - i * 18) * (0.95 + i * 0.02),
      thisMonth: dailyDividendPerNode.value * 30 * (0.95 + i * 0.02),
    });
  }
  return list;
});

function mintedText(ms: number): string {
  return fmt(t.value.genesisHolder.holdingCard.mintedOn, { date: new Date(ms).toLocaleDateString() });
}

// 30d earnings sparkline (deterministic seed).
const chartData = computed(() => {
  const arr: number[] = [];
  let v = 0.5;
  let seed = 8273;
  for (let i = 0; i < 30; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    v = Math.max(0.2, Math.min(0.9, v + (seed / 233280 - 0.4) * 0.15));
    arr.push(v);
  }
  return arr;
});

// Live dividend feed (mock, fixed at mount).
const feedBase = Date.now();
const feed = [
  { ts: feedBase - 12000, who: "Anon #2017", amount: 0.42, label: "store purchase · NexionBox Pro" },
  { ts: feedBase - 47000, who: "Anon #8819", amount: 0.18, label: "exchange · NEX → USDT" },
  { ts: feedBase - 91000, who: "Anon #4471", amount: 0.96, label: "Genesis primary sale" },
  { ts: feedBase - 142000, who: "Anon #1102", amount: 0.07, label: "staking unlock fee" },
  { ts: feedBase - 200000, who: "Anon #6638", amount: 0.32, label: "store purchase · Cloud Share" },
];
function feedAgo(ts: number): number {
  void tick.value;
  return Math.floor((Date.now() - ts) / 1000);
}

function handleClaim() {
  if (pendingPayout.value < 0.01) {
    toast.info("Nothing to claim yet", "Next payout 00:00 UTC daily");
    return;
  }
  toast.success(t.value.genesisHolder.actions.claimedToast, fmtUSD(pendingPayout.value));
}
function goGenesis() {
  uni.navigateTo({ url: "/pages/genesis/genesis", fail: () => {} });
}
function goMarketplace() {
  uni.navigateTo({ url: "/pages/genesis/marketplace", fail: () => {} });
}

// ── styles ──
const heroCardStyle: CSSProperties = {
  padding: "18px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const avatarStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #D4AF5A 0%, #E2C97C 100%)",
  boxShadow: "0 4px 12px rgba(212,175,90,0.25)",
};
const heroLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.04em",
};
const heroNumStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "48px",
  letterSpacing: "-0.034em",
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const heroNodesStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const lifetimeStyle: CSSProperties = {
  marginTop: "8px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-success)",
};
const heroStatGridStyle: CSSProperties = {
  marginTop: "10px",
  paddingTop: "14px",
  borderTop: "1px dashed var(--v5-border-strong)",
  gap: "14px",
};
const cellLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.02em",
};
function cellValStyle(tint: string): CSSProperties {
  return {
    marginTop: "3px",
    fontFamily: "var(--font-v5)",
    fontWeight: 500,
    fontSize: "18px",
    letterSpacing: "-0.014em",
    color: tint,
    lineHeight: 1.1,
  };
}
const cellValMonoStyle: CSSProperties = {
  marginTop: "3px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
  color: "var(--v5-ink)",
  lineHeight: 1.1,
};
const ctaCardStyle: CSSProperties = { padding: "16px", borderRadius: "16px", background: "var(--v5-brand-2-soft)" };
const ctaIconStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  background: "var(--v5-brand-2)",
  boxShadow: "var(--v5-spotlight-brand-2)",
  color: "var(--v5-on-brand-2)",
};
const ctaTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "14px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const ctaBodyStyle: CSSProperties = { marginTop: "3px", fontSize: "12.5px", color: "var(--v5-ink-3)", lineHeight: 1.4 };
const previewStyle: CSSProperties = {
  borderRadius: "16px",
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 30%, transparent)",
  padding: "12px",
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
};
const previewTextStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-warning)", lineHeight: 1.5 };
const chartCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "16px",
};
const chartLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const chartTotalStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-brand)",
};
const chartBoxStyle: CSSProperties = {
  height: "96px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)",
  overflow: "hidden",
};
const feedCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const feedDotStyle: CSSProperties = { width: "6px", height: "6px", borderRadius: "999px", background: "var(--v5-brand)" };
const feedLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
function feedRowStyle(isLast: boolean): CSSProperties {
  return {
    paddingTop: "8px",
    paddingBottom: "8px",
    gap: "10px",
    fontSize: "11.5px",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
const feedAmtStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-brand)",
};
const feedAgoStyle: CSSProperties = {
  width: "40px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-ink-4)",
};
const feedNoteStyle: CSSProperties = {
  paddingTop: "8px",
  paddingBottom: "8px",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
  borderTop: "1px solid var(--v5-border)",
};
const sectionLabelStyle: CSSProperties = {
  marginBottom: "10px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const holdingCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "14px",
  gap: "12px",
};
const holdingArtStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  background: "radial-gradient(60% 60% at 30% 30%, rgba(255,107,53,0.40), rgba(255,107,53,0.10) 80%)",
  border: "1px solid rgba(255,107,53,0.40)",
};
const holdingIdStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const holdingLinkStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-surface-2) 50%, transparent)",
  color: "var(--v5-ink-3)",
};
const perksCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "16px",
};
const perksLabelStyle: CSSProperties = {
  marginBottom: "12px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
  letterSpacing: "0.06em",
};
const perkRowStyle: CSSProperties = { gridTemplateColumns: "36px 1fr", gap: "12px", padding: "10px 0" };
const perkIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  background: "var(--v5-brand-soft)",
};
const perkLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const perkBodyStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "2px", lineHeight: 1.4 };
const actionTileStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
};
const actionTileClaimStyle: CSSProperties = { ...actionTileStyle };
function actionIconStyle(tint: string): CSSProperties {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: `color-mix(in srgb, ${tint} 15%, transparent)`,
    color: tint,
  };
}
const actionLabelStyle: CSSProperties = { fontSize: "11px", fontWeight: 600, color: "var(--v5-ink-2)" };
const actionSubStyle: CSSProperties = {
  fontSize: "10px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  color: "var(--v5-ink-3)",
};
const noteStyle: CSSProperties = {
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.5,
  paddingTop: "8px",
};
</script>
