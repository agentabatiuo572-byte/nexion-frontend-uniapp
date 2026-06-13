<!--
  Influence Network Royalty — ported from
  Nexion-prototype/app/(main)/team/unilevel/page.tsx.
  Partner-program model: hero (monthly royalty total + partner status) + Direct
  Royalty card + Network Yield Bonus card (influence score / activity) + Partner
  Status tier progression (4 cards + progress to next) + filter pills + member
  list. Sub-page → <AppChassis active="team"> w/ back → /team. Reuses network
  (byLayer) + commission (UNILEVEL_USDT) stores + VBadge. useMemo → computed.
  React local state → ref. TickerNumber → direct value render (entrance tween dropped,
  values are store-derived not interval-driven). `${color}NN` alpha-hex →
  color-mix. banned hex #0F140A/#0E0E0E → tokens. De-MLM'd wording kept.
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.unilevel.pageTitle" />

      <!-- How-it-works entry -->
      <view class="px-4 flex items-center justify-end" style="padding-top: 8px; padding-bottom: 8px">
        <view class="nx-unilevel-how-link inline-flex items-center active:opacity-80" :style="howEntryStyle" @click="go('/pages/team/unilevel-how')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <text>{{ t.unilevel.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </view>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- Hero -->
        <view class="rounded-2xl" :style="heroStyle">
          <text class="block font-mono-tabular" :style="{ fontSize: '10px', letterSpacing: '0.16em', color: 'var(--v5-brand)' }">{{ t.unilevel.heroLabel }}</text>
          <text class="block font-display tabular-nums" :style="heroBigStyle">${{ totalRoyalty.toFixed(2) }}</text>
          <view class="inline-flex items-center font-mono-tabular" :style="heroTierChipStyle">
            <text>{{ heroRateLineText }}</text>
          </view>
        </view>

        <!-- Component A: Direct Royalty -->
        <view class="rounded-2xl" :style="{ padding: '16px', background: 'var(--v5-success-soft)' }">
          <view class="flex items-start" style="gap: 12px">
            <text class="rounded-xl grid place-items-center shrink-0" :style="compBadgeStyle('var(--v5-brand)')">D</text>
            <view class="flex-1 min-w-0">
              <text class="block" :style="compTitleStyle">{{ t.unilevel.directLabel }}</text>
              <text class="block" :style="compSubStyle">{{ t.unilevel.directSub }}</text>
              <text class="block font-mono-tabular" :style="{ fontSize: '10.5px', color: 'var(--v5-brand)', marginTop: '6px' }">{{ directRateText }}</text>
            </view>
            <view class="text-right shrink-0">
              <text class="block font-display tabular-nums" :style="{ fontSize: '18px', fontWeight: 600, color: 'var(--v5-brand)' }">${{ directRoyalty.toFixed(2) }}</text>
              <text class="block" :style="{ fontSize: '10px', color: 'var(--v5-ink-3)', marginTop: '2px' }">{{ directMembersText }}</text>
            </view>
          </view>
        </view>

        <!-- Component B: Network Yield Bonus -->
        <view class="rounded-2xl" :style="{ padding: '16px', background: 'var(--v5-tech-cyan-soft)' }">
          <view class="flex items-start" style="gap: 12px">
            <text class="rounded-xl grid place-items-center shrink-0" :style="compBadgeStyle('var(--v5-brand-2)')">N</text>
            <view class="flex-1 min-w-0">
              <text class="block" :style="compTitleStyle">{{ t.unilevel.networkLabel }}</text>
              <text class="block" :style="compSubStyle">{{ t.unilevel.networkSub }}</text>
              <view class="grid grid-cols-2" style="margin-top: 8px; gap: 8px; font-size: 10.5px">
                <view>
                  <text class="block" :style="{ color: 'var(--v5-ink-3)' }">{{ t.unilevel.networkScoreLabel }}</text>
                  <text class="block font-mono-tabular tabular-nums" :style="{ color: 'var(--v5-brand-2)', fontWeight: 600, marginTop: '2px' }">{{ influenceScore.toFixed(2) }}</text>
                </view>
                <view>
                  <text class="block" :style="{ color: 'var(--v5-ink-3)' }">{{ t.unilevel.networkActivityLabel }}</text>
                  <text class="block font-mono-tabular tabular-nums" :style="{ color: 'var(--v5-brand-2)', fontWeight: 600, marginTop: '2px' }">${{ monthlyNetworkVolume.toLocaleString() }}</text>
                </view>
              </view>
            </view>
            <view class="text-right shrink-0">
              <text class="block font-display tabular-nums" :style="{ fontSize: '18px', fontWeight: 600, color: 'var(--v5-brand-2)' }">${{ networkBonus.toFixed(2) }}</text>
            </view>
          </view>
          <view class="flex items-start" :style="algoNoteStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            <text :style="{ fontSize: '10px', color: 'var(--v5-ink-3)', lineHeight: 1.6 }">{{ t.unilevel.networkAlgoNote }}</text>
          </view>
        </view>

        <!-- Partner Status tier progression -->
        <view class="rounded-2xl border" :style="{ padding: '16px', background: 'var(--v5-surface)', borderColor: 'var(--v5-border)' }">
          <text class="block font-mono-tabular" :style="{ fontSize: '10px', letterSpacing: '0.16em', color: 'var(--v5-ink-3)' }">{{ t.unilevel.rateTierLabel }}</text>
          <text class="block" :style="{ marginTop: '6px', fontSize: '11px', color: 'var(--v5-ink-3)', lineHeight: 1.6 }">{{ t.unilevel.rateTierNote }}</text>

          <view class="grid grid-cols-4" style="margin-top: 12px; gap: 6px">
            <view v-for="tier in RATE_TIERS" :key="tier.id" class="rounded-lg text-center" :style="tierCardStyle(tier)">
              <text class="block font-display" :style="{ fontSize: '11px', fontWeight: 600, color: tier.id === currentTier.id ? tier.color : 'var(--v5-ink-3)' }">{{ t.unilevel.rateTiers[tier.id].name }}</text>
              <text class="block" :style="{ fontSize: '8.5px', marginTop: '2px', lineHeight: 1.1, color: tier.id === currentTier.id ? tier.color : 'var(--v5-ink-4)' }">{{ t.unilevel.rateTiers[tier.id].perk }}</text>
              <text class="block font-mono-tabular" :style="{ fontSize: '8.5px', color: 'var(--v5-ink-4)', marginTop: '2px' }">{{ tierVolLabel(tier.minVolume) }}</text>
            </view>
          </view>

          <view v-if="next" style="margin-top: 12px">
            <view class="flex items-center justify-between" style="font-size: 10.5px; margin-bottom: 6px">
              <text :style="{ color: 'var(--v5-ink-3)' }">{{ rateTierCurrentText }}</text>
              <text class="font-mono-tabular" :style="{ color: 'var(--v5-brand)' }">${{ monthlyNetworkVolume.toLocaleString() }} / ${{ next.minVolume.toLocaleString() }}</text>
            </view>
            <view class="rounded-full overflow-hidden" :style="{ height: '8px', background: 'color-mix(in srgb, var(--v5-surface-2) 60%, transparent)' }">
              <view class="rounded-full" :style="tierProgressFillStyle" />
            </view>
            <text class="block" :style="{ marginTop: '8px', fontSize: '10.5px', color: 'var(--v5-ink-3)', lineHeight: 1.45 }">{{ rateTierProgressText }}</text>
          </view>
          <view v-else class="inline-flex items-center" :style="maxedChipStyle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
            <text>{{ rateTierMaxedText }}</text>
          </view>
        </view>

        <!-- Filter pills -->
        <scroll-view scroll-x class="nx-no-scrollbar" style="white-space: nowrap; width: 100%">
          <view class="inline-flex" style="gap: 6px">
            <view class="nx-unilevel-filter-all shrink-0 inline-flex items-center active:opacity-70" :style="pillStyle(filter === 'all')" @click="filter = 'all'">
              <text :style="pillTextStyle(filter === 'all')">{{ t.unilevel.filterAll }}</text>
              <text class="font-mono-tabular" :style="pillCountStyle(filter === 'all')">· {{ directMembers.length + extendedMembers.length }}</text>
            </view>
            <view class="nx-unilevel-filter-direct shrink-0 inline-flex items-center active:opacity-70" :style="pillStyle(filter === 'direct')" @click="filter = 'direct'">
              <view v-if="filter !== 'direct'" class="rounded-full" :style="{ width: '6px', height: '6px', background: 'var(--v5-brand)' }" />
              <text :style="pillTextStyle(filter === 'direct')">{{ t.unilevel.filterDirect }}</text>
              <text class="font-mono-tabular" :style="pillCountStyle(filter === 'direct')">· {{ directMembers.length }}</text>
            </view>
            <view class="nx-unilevel-filter-extended shrink-0 inline-flex items-center active:opacity-70" :style="pillStyle(filter === 'extended')" @click="filter = 'extended'">
              <view v-if="filter !== 'extended'" class="rounded-full" :style="{ width: '6px', height: '6px', background: 'var(--v5-tech-cyan)' }" />
              <text :style="pillTextStyle(filter === 'extended')">{{ t.unilevel.filterExtended }}</text>
              <text class="font-mono-tabular" :style="pillCountStyle(filter === 'extended')">· {{ extendedMembers.length }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- Member list -->
        <view class="rounded-2xl border overflow-hidden" :style="{ background: 'var(--v5-surface)', borderColor: 'var(--v5-border)', borderRadius: '16px' }">
          <view v-if="filteredMembers.length === 0" class="text-center" :style="{ padding: '32px', fontSize: '12px', color: 'var(--v5-ink-3)' }">
            <text>{{ t.unilevel.noMembers }}</text>
          </view>
          <template v-else>
            <view
              v-for="(m, i) in filteredMembers"
              :key="m.id"
              class="nx-unilevel-member-row flex items-center"
              :style="memberRowStyle(i === filteredMembers.length - 1)"
            >
              <view class="rounded-full grid place-items-center shrink-0" :style="memberAvatarStyle">
                <text style="font-size: 18px; line-height: 1">{{ m.avatar }}</text>
              </view>
              <view class="flex-1 min-w-0">
                <view class="flex items-center" style="gap: 6px">
                  <text class="truncate" :style="{ fontSize: '13.5px', fontWeight: 500, color: 'var(--v5-ink)' }">{{ m.name }}</text>
                  <text v-if="m.isSpillover" class="font-mono-tabular" :style="spillTagStyle">{{ t.unilevel.spillTag }}</text>
                  <VBadge :v="m.vRank" size="sm" :show-title="false" />
                </view>
                <view class="flex items-center" style="margin-top: 2px; gap: 6px">
                  <view class="rounded-full" :style="{ width: '6px', height: '6px', background: statusColor(m.status) }" />
                  <text :style="{ fontSize: '10.5px', color: 'var(--v5-ink-3)' }">{{ m.status }} · {{ m.city }}</text>
                  <text class="font-mono-tabular" :style="memberBadgeStyle(m.kind)">{{ m.kind === "direct" ? t.unilevel.memberBadgeDirect : t.unilevel.memberBadgeExtended }}</text>
                </view>
              </view>
              <view class="text-right">
                <text class="font-mono-tabular tabular-nums" :style="{ fontSize: '12px', color: 'var(--v5-brand)' }">+${{ memberCommission(m).toFixed(2) }}</text>
              </view>
            </view>
          </template>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import VBadge from "@/components/team/v-badge.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNetwork, type NetworkMember, type MemberStatus } from "@/store/network";
import { UNILEVEL_USDT } from "@/store/commission";

type RateTierId = "standard" | "verified" | "premium" | "diamond";
interface RateTier {
  id: RateTierId;
  minVolume: number;
  color: string;
  bg: string;
}
const RATE_TIERS: ReadonlyArray<RateTier> = [
  { id: "standard", minVolume: 0, color: "var(--v5-ink-3)", bg: "var(--v5-surface-2)" },
  { id: "verified", minVolume: 5_000, color: "var(--v5-success)", bg: "var(--v5-success-soft)" },
  { id: "premium", minVolume: 50_000, color: "var(--v5-tech-cyan)", bg: "var(--v5-tech-cyan-soft)" },
  { id: "diamond", minVolume: 500_000, color: "var(--v5-brand-2)", bg: "var(--v5-brand-2-soft)" },
];
function pickRateTier(monthlyVolume: number): RateTier {
  for (let i = RATE_TIERS.length - 1; i >= 0; i--) {
    if (monthlyVolume >= RATE_TIERS[i].minVolume) return RATE_TIERS[i];
  }
  return RATE_TIERS[0];
}
function nextRateTier(current: RateTier): RateTier | null {
  const idx = RATE_TIERS.findIndex((tier) => tier.id === current.id);
  return idx < RATE_TIERS.length - 1 ? RATE_TIERS[idx + 1] : null;
}

type FilterId = "all" | "direct" | "extended";
type PlottedMember = NetworkMember & { kind: "direct" | "extended" };

const t = useT();
const network = useNetwork();
const filter = ref<FilterId>("all");

const byLayer = computed(() => network.byLayer());
const directMembers = computed(() => byLayer.value[1] ?? []);
const extendedMembers = computed(() =>
  ([2, 3, 4, 5, 6, 7] as const).flatMap((L) => byLayer.value[L] ?? []),
);

const monthlyNetworkVolume = computed(() =>
  ([1, 2, 3, 4, 5, 6, 7] as const).reduce(
    (sum, L) => sum + (byLayer.value[L] ?? []).reduce((s, m) => s + m.monthVolumeUSD, 0),
    0,
  ),
);
const currentTier = computed(() => pickRateTier(monthlyNetworkVolume.value));
const next = computed(() => nextRateTier(currentTier.value));

const directVolume = computed(() => directMembers.value.reduce((s, m) => s + m.monthVolumeUSD, 0));
const directRoyalty = computed(() => directVolume.value * UNILEVEL_USDT[1]);
const networkBonus = computed(() =>
  extendedMembers.value.reduce((sum, m) => sum + m.monthVolumeUSD * (UNILEVEL_USDT[m.layer] ?? 0), 0),
);
const influenceScore = computed(() => {
  if (monthlyNetworkVolume.value < 100) return 1.0;
  return Math.min(5.0, 1 + Math.log10(monthlyNetworkVolume.value / 100));
});
const totalRoyalty = computed(() => directRoyalty.value + networkBonus.value);

const filteredMembers = computed<PlottedMember[]>(() => {
  if (filter.value === "all") {
    return [
      ...directMembers.value.map((m) => ({ ...m, kind: "direct" as const })),
      ...extendedMembers.value.map((m) => ({ ...m, kind: "extended" as const })),
    ];
  }
  if (filter.value === "direct") return directMembers.value.map((m) => ({ ...m, kind: "direct" as const }));
  return extendedMembers.value.map((m) => ({ ...m, kind: "extended" as const }));
});

// i18n text
const heroRateLineText = computed(() =>
  fmt(t.value.unilevel.heroRateLine, { rate: (UNILEVEL_USDT[1] * 100).toFixed(0), tier: t.value.unilevel.rateTiers[currentTier.value.id].name }),
);
const directRateText = computed(() => fmt(t.value.unilevel.directRateText, { rate: (UNILEVEL_USDT[1] * 100).toFixed(0) }));
const directMembersText = computed(() => fmt(t.value.unilevel.directMembersText, { n: directMembers.value.length }));
const rateTierCurrentText = computed(() => fmt(t.value.unilevel.rateTierCurrent, { tier: t.value.unilevel.rateTiers[currentTier.value.id].name }));
const rateTierProgressText = computed(() => {
  if (!next.value) return "";
  return fmt(t.value.unilevel.rateTierProgress, {
    remaining: Math.max(0, next.value.minVolume - monthlyNetworkVolume.value).toLocaleString(),
    next: t.value.unilevel.rateTiers[next.value.id].name,
  });
});
const rateTierMaxedText = computed(() => fmt(t.value.unilevel.rateTierMaxed, { tier: t.value.unilevel.rateTiers[currentTier.value.id].name }));

function tierVolLabel(minVolume: number): string {
  return minVolume >= 1000 ? `$${minVolume / 1000}K+` : `$${minVolume}`;
}
function statusColor(status: MemberStatus): string {
  return status === "active" ? "var(--v5-brand)" : status === "idle" ? "var(--v5-warning)" : "var(--v5-ink-4)";
}
function memberCommission(m: PlottedMember): number {
  return m.monthVolumeUSD * (UNILEVEL_USDT[m.layer] ?? 0);
}

function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// ─── styles ───
const howEntryStyle: CSSProperties = {
  gap: "8px",
  padding: "0 14px",
  minHeight: "44px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};

const heroStyle = computed<CSSProperties>(() => ({
  padding: "16px",
  background:
    `radial-gradient(80% 60% at 80% 0%, color-mix(in srgb, ${currentTier.value.color} 12%, transparent) 0%, transparent 65%),` +
    "linear-gradient(180deg, var(--v5-surface) 0%, var(--v5-bg) 100%)",
  border: `1px solid color-mix(in srgb, ${currentTier.value.color} 20%, transparent)`,
}));
const heroBigStyle: CSSProperties = { marginTop: "6px", fontSize: "30px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const heroTierChipStyle = computed<CSSProperties>(() => ({
  marginTop: "12px",
  padding: "4px 10px",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: 600,
  background: `color-mix(in srgb, ${currentTier.value.color} 15%, transparent)`,
  color: currentTier.value.color,
}));

function compBadgeStyle(color: string): CSSProperties {
  return {
    width: "40px",
    height: "40px",
    background: `color-mix(in srgb, ${color} 22%, transparent)`,
    color,
    fontSize: "18px",
    fontWeight: 600,
  };
}
const compTitleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };
const compSubStyle: CSSProperties = { marginTop: "2px", fontSize: "10.5px", color: "var(--v5-ink-3)", lineHeight: 1.45 };
const algoNoteStyle: CSSProperties = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid var(--v5-border)",
  gap: "6px",
};

function tierCardStyle(tier: RateTier): CSSProperties {
  const isCurrent = tier.id === currentTier.value.id;
  return {
    padding: "8px",
    background: isCurrent ? tier.bg : "rgba(255,255,255,0.02)",
    border: `1px solid ${isCurrent ? `color-mix(in srgb, ${tier.color} 55%, transparent)` : "rgba(255,255,255,0.04)"}`,
  };
}
const tierProgressFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${next.value ? Math.min(100, (monthlyNetworkVolume.value / next.value.minVolume) * 100) : 100}%`,
  background: next.value ? `linear-gradient(to right, ${currentTier.value.color}, ${next.value.color})` : currentTier.value.color,
  transition: "width 300ms ease",
}));
const maxedChipStyle: CSSProperties = {
  marginTop: "12px",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)",
  color: "var(--v5-brand-2)",
  fontSize: "11px",
  fontWeight: 600,
};

function pillStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    padding: "0 16px",
    gap: "6px",
    borderRadius: "999px",
    background: active ? "var(--v5-brand)" : "var(--v5-surface-2)",
  };
}
function pillTextStyle(active: boolean): CSSProperties {
  return { fontSize: "12px", fontWeight: 600, color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)" };
}
function pillCountStyle(active: boolean): CSSProperties {
  return { fontSize: "12px", opacity: 0.65, color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)" };
}

function memberRowStyle(isLast: boolean): CSSProperties {
  return { padding: "12px 16px", gap: "12px", borderBottom: isLast ? "none" : "1px solid var(--v5-border)" };
}
const memberAvatarStyle: CSSProperties = { width: "36px", height: "36px", background: "var(--v5-surface-2)" };
const spillTagStyle: CSSProperties = {
  fontSize: "10px",
  color: "var(--v5-brand-2)",
  background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)",
  padding: "0 4px",
  borderRadius: "4px",
};
function memberBadgeStyle(kind: "direct" | "extended"): CSSProperties {
  const color = kind === "direct" ? "var(--v5-brand)" : "var(--v5-tech-cyan)";
  return {
    marginLeft: "auto",
    padding: "0 4px",
    borderRadius: "4px",
    fontSize: "8.5px",
    letterSpacing: "0.04em",
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
  };
}
</script>
