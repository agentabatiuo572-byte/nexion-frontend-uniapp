<!--
  Hardware Quota — ported from Nexion-prototype/app/(main)/team/quota/page.tsx.
  Higher tiers (NexGridBox Pro / Rack P1) gated behind activated-direct-invite /
  team-volume milestones. De-carded hero (active-invites count directly on the
  page floor, hairline footer) + 2 QuotaTierCards (whitelist tier cards, fill
  no border) + invite CTA (tint fill, border dropped) → /team. Sub-page →
  <AppChassis active="team"> w/ back → /team. Reuses network + v-rank stores.
  useMemo → computed. condition `kind` flag replaces locale string-match.
  banned hex #11131A → var(--v5-surface). <Link>→<view @click>.
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.quota.pageTitle" />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px; padding-top: 18px">
        <!-- Hero — de-carded: invites count sits directly on the page floor.
             The bordered card + page-floor radial glow were deleted outright
             (owner call 2026-07-08: floor auras are removed, not re-tuned). -->
        <view :style="heroStyle">
          <view class="flex items-start justify-between">
            <view>
              <text class="block font-mono-tabular" :style="heroCapStyle">{{ t.quota.yourInvites }}</text>
              <view class="flex items-baseline" style="margin-top: 8px; gap: 6px">
                <text class="font-display tabular-nums" :style="heroBigStyle">{{ activeDirect }}</text>
                <text class="font-mono-tabular" :style="heroSuffixStyle">{{ fmt(t.quota.totalSuffix, { n: directInvites }) }}</text>
              </view>
            </view>
            <view class="rounded-2xl grid place-items-center" :style="heroIconStyle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </view>
          </view>
          <view :style="heroFooterStyle">
            <text class="block" :style="heroBodyStyle">{{ t.quota.heroBody }}</text>
          </view>
        </view>

        <!-- Tier cards -->
        <QuotaTierCard v-for="tier in tiers" :key="tier.productId" :tier="tier" @navigate="go" />

        <!-- Invite CTA -->
        <view class="rounded-2xl active:scale-[0.98] transition-transform" :style="inviteCtaStyle" @click="go('/pages/team/team')">
          <view class="flex items-center" style="gap: 12px">
            <view class="rounded-xl grid place-items-center" :style="inviteIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="inviteTitleStyle">{{ t.quota.inviteFriendsTitle }}</text>
              <text class="block" :style="inviteHintStyle">{{ inviteHint }}</text>
            </view>
            <text class="font-mono-tabular" :style="{ fontSize: '12px', color: 'var(--v5-brand)' }">{{ t.quota.shareTag }}</text>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import QuotaTierCard, { type QuotaTier, type QuotaCondition } from "@/components/team/quota-tier-card.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { getProduct, annualRoiPct } from "@/mock/products";
import { useNetwork } from "@/store/network";
import { useVRank } from "@/store/v-rank";
import { useConfig } from "@/store/config";

const t = useT();
const network = useNetwork();
const vRank = useVRank();
const cfg = useConfig();
// 礼包 NEX 数量单源派生自 platform config。
const inviteHint = computed(() => fmt(t.value.quota.inviteFriendsHint, { inviterNex: cfg.config.rewards.inviterReward.nexAmount, nex: cfg.config.rewards.welcomeGift.nexAmount }));

const members = computed(() => network.members);
const directInvites = computed(() => members.value.filter((m) => m.layer === 1).length);
const activeDirect = computed(() => members.value.filter((m) => m.layer === 1 && m.status === "active").length);

// Single source: tiers derive from the catalog products that carry a
// purchaseGate (name/price/锁额/解锁条件/perks all from getProduct + gate config,
// with live progress from network/v-rank). No hardcoded device economics here —
// the page mirrors §4 PurchaseGate + the store catalog (fixes stale $899/$3,499/
// "800-1,100 NEX/day" that drifted out of sync with the recalibrated catalog).
function buildTier(productId: string, tint: string): QuotaTier | null {
  const p = getProduct(productId);
  const g = p?.purchaseGate;
  if (!p || !g) return null;
  const conditions: QuotaCondition[] = [];
  if (g.rankMin != null)
    conditions.push({ label: fmt(t.value.quota.condRank, { v: g.rankMin }), current: vRank.myRank, required: g.rankMin, kind: "invites" });
  if (g.activeDirectMin != null)
    conditions.push({ label: t.value.quota.condActivatedDirect, current: activeDirect.value, required: g.activeDirectMin, kind: "invites" });
  if (g.teamVolumeMin != null)
    conditions.push({ label: t.value.quota.condTeamVol, current: vRank.teamVolumeUSD, required: g.teamVolumeMin, kind: "volume" });
  return {
    productId,
    name: p.name,
    price: p.price,
    monthlyStock: g.quotaCap ?? 0,
    soldThisMonth: g.quotaSold ?? 0,
    unlockKind: g.mode,
    conditions,
    perks: [
      fmt(t.value.quota.perkGen, { n: p.dailyEarnNEX }),
      `${p.gpu} · ${p.vram}`,
      fmt(t.value.quota.perkRoi, { roi: annualRoiPct(p) }),
    ],
    tint,
  };
}

const tiers = computed<QuotaTier[]>(() =>
  [buildTier("stellarbox-pro", "var(--v5-brand)"), buildTier("stellarrack-p1", "var(--v5-warning)")].filter(
    (x): x is QuotaTier => x !== null,
  ),
);

function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// ─── styles ───
// De-carded hero: no surface/border/glow — content sits directly on the page
// floor (leaderboard prize-hero idiom, 2px optical inset).
const heroStyle: CSSProperties = { padding: "6px 2px 0" };
const heroIconStyle: CSSProperties = { width: "48px", height: "48px", background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)" };
const heroCapStyle: CSSProperties = { fontSize: "12px", fontWeight: 500, color: "var(--v5-brand-2)", letterSpacing: "0.06em" };
const heroBigStyle: CSSProperties = { fontSize: "34px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.022em", color: "var(--v5-ink)" };
const heroSuffixStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
// -2px side margins pull the hairline back to full width (hero has a 2px optical inset).
const heroFooterStyle: CSSProperties = { margin: "12px -2px 0", padding: "12px 2px 0", borderTop: "1px solid var(--v5-border)" };
const heroBodyStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  // SKILL leading-relaxed = 1.625 (原版 .text-[12px] leading-relaxed; was 1.6)
  lineHeight: 1.625,
};

// Conversion entry — tint fill only, border dropped (filled no border: single
// visual difference).
const inviteCtaStyle: CSSProperties = {
  padding: "16px",
  background: "color-mix(in srgb, var(--v5-brand) 10%, transparent)",
};
const inviteIconStyle: CSSProperties = { width: "40px", height: "40px", background: "color-mix(in srgb, var(--v5-brand) 20%, transparent)" };
const inviteTitleStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const inviteHintStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-3)" };
</script>
