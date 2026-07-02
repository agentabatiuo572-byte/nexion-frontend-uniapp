<!--
  Hardware Quota — ported from Nexion-prototype/app/(main)/team/quota/page.tsx.
  Higher tiers (NexionBox Pro / Rack P1) gated behind activated-direct-invite /
  team-volume milestones. Hero (active-invites count) + 2 QuotaTierCards + invite
  CTA → /team. Sub-page → <AppChassis active="team"> w/ back → /team. Reuses
  network + v-rank stores. useMemo → computed. condition `kind` flag replaces
  locale string-match. banned hex #11131A → var(--v5-surface). <Link>→<view @click>.
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.quota.pageTitle" />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px; padding-top: 4px">
        <!-- Hero -->
        <view class="rounded-2xl" :style="heroStyle">
          <view class="flex items-center" style="gap: 8px">
            <view class="rounded-xl grid place-items-center" :style="heroIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </view>
            <view>
              <text class="block font-mono-tabular" :style="heroCapStyle">{{ t.quota.yourInvites }}</text>
              <view class="flex items-baseline" style="gap: 4px; margin-top: 2px">
                <text class="font-display tabular-nums" :style="heroBigStyle">{{ activeDirect }}</text>
                <text class="font-mono-tabular" :style="heroSuffixStyle">{{ fmt(t.quota.totalSuffix, { n: directInvites }) }}</text>
              </view>
            </view>
          </view>
          <text class="block" :style="heroBodyStyle">{{ t.quota.heroBody }}</text>
        </view>

        <!-- Tier cards -->
        <QuotaTierCard v-for="tier in tiers" :key="tier.productId" :tier="tier" @navigate="go" />

        <!-- Invite CTA -->
        <view class="rounded-2xl active:scale-[0.99] transition-transform" :style="inviteCtaStyle" @click="go('/pages/team/team')">
          <view class="flex items-center" style="gap: 12px">
            <view class="rounded-xl grid place-items-center" :style="inviteIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="inviteTitleStyle">{{ t.quota.inviteFriendsTitle }}</text>
              <text class="block" :style="inviteHintStyle">{{ inviteHint }}</text>
            </view>
            <text class="font-mono-tabular" :style="{ fontSize: '10px', color: 'var(--v5-brand)' }">{{ t.quota.shareTag }}</text>
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
const inviteHint = computed(() => fmt(t.value.quota.inviteFriendsHint, { nex: cfg.config.rewards.welcomeGift.nexAmount }));

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
const heroStyle: CSSProperties = {
  padding: "16px",
  // SKILL 原版 radial glow = rgba(124,92,255,...) 紫色 → dark 主题 --v5-tech-cyan(=#8E72FF 紫);
  // 与 leadership-pool.vue 同源映射一致(was --v5-brand-2 橙, 与图标 chip 撞色 = port bug)
  background:
    "radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--v5-tech-cyan) 15%, transparent) 0%, transparent 65%)," +
    "linear-gradient(180deg, var(--v5-surface) 0%, var(--v5-on-brand) 100%)",
  border: "1px solid color-mix(in srgb, var(--v5-tech-cyan) 25%, transparent)",
};
const heroIconStyle: CSSProperties = { width: "40px", height: "40px", background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)" };
const heroCapStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-brand-2)" };
const heroBigStyle: CSSProperties = { fontSize: "28px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const heroSuffixStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const heroBodyStyle: CSSProperties = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid var(--v5-border)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  // SKILL leading-relaxed = 1.625 (原版 .text-[12px] leading-relaxed; was 1.6)
  lineHeight: 1.625,
};

const inviteCtaStyle: CSSProperties = {
  padding: "16px",
  background: "color-mix(in srgb, var(--v5-brand) 10%, transparent)",
  border: "1px solid var(--v5-border)",
};
const inviteIconStyle: CSSProperties = { width: "40px", height: "40px", background: "color-mix(in srgb, var(--v5-brand) 20%, transparent)" };
const inviteTitleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };
const inviteHintStyle: CSSProperties = { marginTop: "2px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
</script>
