<!--
  NetworkCard — ported from me/page.tsx NetworkCard.
  V-rank ladder progress toward the next rank: prize emoji anchor + "Toward V{n}
  {title} · {gap}" line + perk-unlock line + scroll-grow progress bar (≥80% =
  warning "hot" state). Max-rank reached → collapses to a single dignity row.
  Reads useVRank + nextRankGap; locale fallback shows cnTitle only for `zh`.
  Taps through to /team (not yet ported → nav fail:()=>{}).
-->
<template>
  <view>
    <SectionHeader :title="t.me.myNetwork" link="/pages/team/team" :link-label="t.me.team" />

    <!-- Max-rank end state -->
    <view v-if="!gap.next" class="block active:opacity-90" :style="maxCardStyle" @click="goTeam">
      <view :style="maxIconStyle" :aria-label="maxPrizeName">
        <text style="font-size: 22px">{{ maxPrizeIcon }}</text>
      </view>
      <view style="flex: 1; min-width: 0">
        <text class="block" style="font-family: var(--font-v5); font-size: 14px; font-weight: 600; color: var(--v5-ink)">{{ maxRankLine }}</text>
      </view>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="m9 18 6-6-6-6" /></svg>
    </view>

    <!-- In-progress state -->
    <view v-else class="block active:opacity-90" :style="cardStyle" @click="goTeam">
      <!-- Prize hero -->
      <view :style="prizeHeroStyle" :aria-label="prizeHeroName">
        <text style="font-size: 28px">{{ prizeHeroIcon }}</text>
      </view>

      <view style="flex: 1; min-width: 0">
        <!-- Line 1: toward V{n} · gap -->
        <view style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); line-height: 1.25">
          <text>{{ towardLine }}</text>
          <template v-if="gapLine">
            <text style="color: var(--v5-ink-4); font-weight: 400"> · </text>
            <text :style="{ color: gap.primaryGap ? 'var(--v5-brand-2)' : 'var(--v5-success)' }">{{ gapLine }}</text>
            <text v-if="moreCount > 0" style="color: var(--v5-ink-4); font-weight: 400; font-size: 12.5px"> {{ moreCountLabel }}</text>
          </template>
        </view>

        <!-- Line 2: perk unlocks -->
        <text v-if="perkLine" class="block truncate" :style="perkLineStyle">{{ perkLine }}</text>

        <!-- Line 3: progress bar + % -->
        <view class="flex items-center" style="gap: 8px; margin-top: 8px">
          <view ref="elRef" class="overflow-hidden" style="flex: 1; height: 6px; border-radius: 3px; background: var(--v5-surface-3)">
            <view :style="barFillStyle" />
          </view>
          <text class="font-mono-tabular tabular-nums" :style="pctStyle">{{ pctInt }}%</text>
        </view>
      </view>

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="m9 18 6-6-6-6" /></svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useLocaleStore } from "@/store/locale";
import {
  useVRank,
  nextRankGap,
  V_RANKS,
  type PrimaryGap,
  type PerkUnlock,
} from "@/store/v-rank";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";

const t = useT();
const vrank = useVRank();
const locale = useLocaleStore();
const { elRef, inView } = useScrollGrowProgress();

const isZh = computed(() => locale.code === "zh");
const myRank = computed(() => vrank.myRank);
const gap = computed(() => nextRankGap(vrank));

const titleOf = (v: number): string => (isZh.value ? V_RANKS[v].cnTitle : V_RANKS[v].title);

// ── Max-rank end state ──
const maxPrizeIcon = computed(() => V_RANKS[myRank.value].prizeIcon || "✓");
const maxPrizeName = computed(() => V_RANKS[myRank.value].prizeName);
const maxRankLine = computed(() => fmt(t.value.me.networkCardMaxRank, { title: titleOf(myRank.value) }));

// ── In-progress derived values ──
const nextV = computed(() => gap.value.next?.v ?? 0);
const progressPct = computed(() => gap.value.progressPct);
const pctInt = computed(() => Math.round(progressPct.value * 100));
const isHot = computed(() => progressPct.value >= 0.8);

const prizeHeroIcon = computed(() => gap.value.newPrize?.icon || "★");
const prizeHeroName = computed(() => gap.value.newPrize?.name ?? gap.value.next?.prizeName ?? "");

const towardLine = computed(() =>
  fmt(t.value.me.networkCardToward, { v: nextV.value, title: titleOf(nextV.value) }),
);

function formatPrimaryGap(g: PrimaryGap): string {
  switch (g.kind) {
    case "teamVolume":
      return fmt(t.value.me.networkCardGapTeamVolume, { amount: g.remaining.toLocaleString() });
    case "selfBuy":
      return fmt(t.value.me.networkCardGapSelfBuy, { amount: g.remaining.toLocaleString() });
    case "directRefs":
      return fmt(t.value.me.networkCardGapDirectRefs, {
        n: g.remaining,
        label: g.remaining === 1 ? t.value.me.networkCardInviteWord : t.value.me.networkCardInvitesWord,
      });
    case "vDownlines":
      return fmt(t.value.me.networkCardGapVDownlines, {
        n: g.remaining,
        v: g.vLevel,
        s: g.remaining === 1 ? "" : "s",
      });
  }
}

function formatPerk(u: PerkUnlock): string {
  switch (u.kind) {
    case "peerBonusUnlock":
      return fmt(t.value.me.networkCardUnlockPeerBonus, { rate: Math.round(u.rate * 100) });
    case "leadershipUnlock":
      return t.value.me.networkCardUnlockLeadership;
    case "cultivationJump":
      return fmt(t.value.me.networkCardUnlockCultivation, { to: u.to.toLocaleString() });
    case "directBonusUp":
      return fmt(t.value.me.networkCardUnlockDirectBonus, { to: Math.round(u.to * 100) });
    case "unilevelDepthUp":
      return fmt(t.value.me.networkCardUnlockDepth, { n: u.to - u.from });
  }
}

const gapLine = computed(() =>
  gap.value.primaryGap ? formatPrimaryGap(gap.value.primaryGap) : t.value.me.networkCardServerEligible,
);
const moreCount = computed(() => Math.max(0, gap.value.unmetCount - 1));
const moreCountLabel = computed(() => fmt(t.value.me.networkCardMoreCount, { n: moreCount.value }));
const perkLine = computed(() =>
  gap.value.topUnlocks.map(formatPerk).join(t.value.me.networkCardUnlocksJoin),
);

function goTeam() {
  uni.navigateTo({ url: "/pages/team/team", fail: () => {} });
}

// ── styles ──
const maxCardStyle: CSSProperties = {
  padding: "14px 18px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
};
const maxIconStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "color-mix(in oklab, var(--v5-success) 22%, transparent)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
const cardStyle: CSSProperties = {
  padding: "16px 18px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
};
const prizeHeroStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "999px",
  background: "color-mix(in oklab, var(--v5-success) 14%, transparent)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
const perkLineStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.3,
  whiteSpace: "nowrap",
};
const barFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${inView.value ? pctInt.value : 0}%`,
  background: isHot.value
    ? "linear-gradient(90deg, var(--v5-warning) 0%, var(--v5-warning) 100%)"
    : "linear-gradient(90deg, var(--v5-brand) 0%, var(--v5-tech-cyan) 100%)",
  transition: inView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));
const pctStyle = computed<CSSProperties>(() => ({
  fontSize: "11px",
  color: isHot.value ? "var(--v5-warning)" : "var(--v5-brand)",
  minWidth: "30px",
  textAlign: "right",
}));
</script>
