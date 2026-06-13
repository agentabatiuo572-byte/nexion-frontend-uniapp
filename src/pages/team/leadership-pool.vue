<!--
  Global Leadership Pool — ported from
  Nexion-prototype/app/(main)/team/leadership-pool/page.tsx.
  Week-pool hero ($X K + settles-in) + my-status card (unlocked: projected
  dividend + votes/share stats / locked: V3-gate + path CTA) + V-rank vote-weight
  table (VBadgeIcon rows, mine highlighted) + past-pools history. Sub-page →
  <AppChassis active="team"> w/ back → /team. Reuses leadership-pool + v-rank
  stores + VBadge/VBadgeIcon. useMemo → computed. banned hex #15131F/#0E0E0E →
  tokens. <Link>→<view @click>.
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.pool.pageTitle" />

      <!-- How-it-works entry -->
      <view class="px-4 flex items-center justify-end" style="padding-top: 8px; padding-bottom: 8px">
        <view class="inline-flex items-center active:opacity-80" :style="howEntryStyle" @click="go('/pages/team/leadership-pool-how')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <text>{{ t.pool.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </view>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- Week pool hero -->
        <view class="rounded-2xl text-center" :style="heroStyle">
          <view class="flex items-center justify-center font-mono-tabular" :style="heroCapStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
            <text>{{ t.pool.weekPool }}</text>
          </view>
          <text class="block font-display tabular-nums" :style="heroBigStyle">${{ (pool.currentWeekPoolUSDT / 1000).toFixed(1) }}K</text>
          <text class="block" :style="heroDescStyle">{{ weeklyDescText }}</text>
        </view>

        <!-- My status -->
        <view class="rounded-2xl" :style="unlocked ? statusUnlockedStyle : statusLockedStyle">
          <template v-if="unlocked">
            <view class="flex items-center justify-between">
              <text class="font-mono-tabular" :style="statusCapStyle('var(--v5-brand)')">{{ t.pool.projectedDividend }}</text>
              <VBadge :v="myRank" size="sm" />
            </view>
            <text class="block font-display tabular-nums" :style="projectedStyle">${{ projectedPayout.toFixed(2) }}</text>
            <view class="grid grid-cols-3 text-center" style="margin-top: 12px; gap: 8px">
              <view>
                <text class="block" :style="statLabelStyle">{{ t.pool.yourVotes }}</text>
                <text class="block font-display tabular-nums" :style="statValueStyle">{{ myVotes }}</text>
              </view>
              <view>
                <text class="block" :style="statLabelStyle">{{ t.pool.totalVotes }}</text>
                <text class="block font-display tabular-nums" :style="statValueStyle">{{ totalVotes.toLocaleString() }}</text>
              </view>
              <view>
                <text class="block" :style="statLabelStyle">{{ t.pool.yourShare }}</text>
                <text class="block font-display tabular-nums" :style="statValueStyle">{{ (myShare * 100).toFixed(3) }}%</text>
              </view>
            </view>
          </template>
          <template v-else>
            <text class="block font-mono-tabular" :style="statusCapStyle('var(--v5-ink-3)')">{{ t.pool.locked }}</text>
            <text class="block" :style="lockedHeadStyle">
              <text>{{ requiresV3Parts[0] }}</text>
              <text :style="{ color: 'var(--v5-brand)', fontWeight: 600 }">V3 Captain</text>
              <text>{{ requiresV3Parts[1] }}</text>
            </text>
            <text class="block" :style="lockedSubStyle">{{ currentlyVText }}</text>
            <view class="inline-flex items-center active:opacity-90" :style="pathCtaStyle" @click="go('/pages/team/rank')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
              <text>{{ t.pool.seePathV3 }}</text>
            </view>
          </template>
        </view>

        <!-- V-rank vote-weight table -->
        <view class="rounded-2xl border overflow-hidden" :style="tableCardStyle">
          <view class="flex items-center justify-between" :style="tableHeadStyle">
            <text class="font-mono-tabular" :style="tableHeadCapStyle">{{ t.pool.rankWeights }}</text>
            <text class="font-mono-tabular" :style="tableHeadCapStyle">{{ totalPeopleText }}</text>
          </view>
          <view
            v-for="(row, i) in voteRows"
            :key="row.v"
            class="flex items-center"
            :style="voteRowStyle(row.isMine, i === voteRows.length - 1)"
          >
            <VBadgeIcon :v="row.v" :size="32" />
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 6px">
                <text :style="{ fontSize: '12.5px', fontWeight: 600, color: 'var(--v5-ink)' }">V{{ row.v }} {{ row.title }}</text>
                <text v-if="row.isMine" class="font-mono-tabular" :style="{ fontSize: '10px', color: 'var(--v5-brand)' }">{{ t.pool.youTag }}</text>
              </view>
              <text class="block font-mono-tabular" :style="{ fontSize: '10px', color: 'var(--v5-ink-3)' }">{{ row.peopleVotes }}</text>
            </view>
            <view class="text-right">
              <text class="block font-mono-tabular tabular-nums" :style="{ fontSize: '11.5px', color: 'var(--v5-ink)' }">{{ (row.shareOfPool * 100).toFixed(2) }}%</text>
              <text class="block font-mono-tabular tabular-nums" :style="{ fontSize: '10px', color: 'var(--v5-ink-3)' }">${{ row.perPerson }} {{ t.pool.eaShort }}</text>
            </view>
          </view>
        </view>

        <!-- Past pools -->
        <view v-if="pool.history.length > 0" class="rounded-2xl border overflow-hidden" :style="tableCardStyle">
          <text class="block font-mono-tabular" :style="pastHeadStyle">{{ t.pool.pastPools }}</text>
          <view
            v-for="(h, i) in pool.history"
            :key="h.weekId"
            class="flex items-center justify-between"
            :style="historyRowStyle(i === pool.history.length - 1)"
          >
            <view>
              <text class="block" :style="{ fontSize: '12px', color: 'var(--v5-ink)' }">{{ h.weekId }}</text>
              <text class="block font-mono-tabular" :style="{ fontSize: '10px', color: 'var(--v5-ink-3)' }">{{ poolTotalText(h) }}</text>
            </view>
            <text class="font-mono-tabular tabular-nums" :style="{ fontSize: '11.5px', color: h.payoutUSDT > 0 ? 'var(--v5-brand)' : 'var(--v5-ink-3)' }">{{ h.payoutUSDT > 0 ? `+$${h.payoutUSDT.toFixed(2)}` : "—" }}</text>
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
import VBadge from "@/components/team/v-badge.vue";
import VBadgeIcon from "@/components/team/v-badge-icon.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useLeadershipPool, V_VOTES, type LeadershipPayout } from "@/store/leadership-pool";
import { useVRank, V_RANKS, type VRank } from "@/store/v-rank";

const t = useT();
const vState = useVRank();
const pool = useLeadershipPool();

const myRank = computed(() => vState.myRank);
const unlocked = computed(() => vState.myRank >= 3);
const dist = computed(() => pool.globalVDistribution);
const totalVotes = computed(() => pool.totalVotes());
const myVotes = computed(() => pool.myVotes(vState.myRank));
const myShare = computed(() => pool.mySharePct(vState.myRank));
const projectedPayout = computed(() => pool.myProjectedPayout(vState.myRank));
const nextPayoutTs = computed(() => pool.nextPayoutTs());
const daysToPayout = computed(() => Math.max(0, Math.ceil((nextPayoutTs.value - Date.now()) / 86400000)));
const hoursToPayout = computed(() => Math.max(0, Math.ceil((nextPayoutTs.value - Date.now()) / 3600000)));

const weeklyDescText = computed(() => {
  const n = daysToPayout.value > 0 ? `${daysToPayout.value}${t.value.pool.daysShort}` : `${hoursToPayout.value}${t.value.pool.hoursShort}`;
  return fmt(t.value.pool.weeklyDesc, { n });
});
const requiresV3Parts = computed(() => {
  const parts = t.value.pool.requiresV3.split("V3 Captain");
  return [parts[0] ?? "", parts[1] ?? ""];
});
const currentlyVText = computed(() => fmt(t.value.pool.currentlyV, { n: vState.myRank, title: V_RANKS[vState.myRank].title }));
const totalPeopleText = computed(() =>
  fmt(t.value.pool.totalPeople, { n: Object.values(dist.value).reduce((a, b) => a + b, 0).toLocaleString() }),
);

const voteRows = computed(() => {
  const ranks: VRank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return ranks.map((v) => {
    const def = V_RANKS[v];
    const count = dist.value[v] ?? 0;
    const votes = V_VOTES[v];
    const vTotalVotes = count * votes;
    const shareOfPool = totalVotes.value > 0 ? vTotalVotes / totalVotes.value : 0;
    return {
      v,
      title: def.title,
      isMine: v === vState.myRank,
      peopleVotes: fmt(t.value.pool.peopleVotesEa, { count: count.toLocaleString(), votes }),
      shareOfPool,
      perPerson: ((pool.currentWeekPoolUSDT * shareOfPool) / Math.max(count, 1)).toFixed(0),
    };
  });
});

function poolTotalText(h: LeadershipPayout): string {
  return fmt(t.value.pool.poolTotalShort, { k: (h.poolUSDT / 1000).toFixed(1), n: h.totalVotes.toLocaleString() });
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

const heroStyle: CSSProperties = {
  padding: "16px",
  background:
    "radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--v5-tech-cyan) 22%, transparent) 0%, transparent 65%)," +
    "linear-gradient(180deg, var(--v5-surface) 0%, var(--v5-bg) 100%)",
  border: "1px solid color-mix(in srgb, var(--v5-tech-cyan) 30%, transparent)",
};
const heroCapStyle: CSSProperties = { gap: "6px", fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-brand-2)" };
const heroBigStyle: CSSProperties = { marginTop: "8px", fontSize: "48px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const heroDescStyle: CSSProperties = { marginTop: "8px", fontSize: "11px", color: "var(--v5-ink-3)" };

const statusUnlockedStyle: CSSProperties = { padding: "16px", background: "var(--v5-surface)", border: "1px solid color-mix(in srgb, var(--v5-brand) 30%, transparent)" };
const statusLockedStyle: CSSProperties = { padding: "16px", background: "color-mix(in srgb, var(--v5-surface-2) 50%, transparent)", border: "1px solid var(--v5-border)" };
function statusCapStyle(color: string): CSSProperties {
  return { fontSize: "10px", letterSpacing: "0.16em", color };
}
const projectedStyle: CSSProperties = { marginTop: "8px", fontSize: "30px", fontWeight: 600, lineHeight: 1, color: "var(--v5-brand)" };
const statLabelStyle: CSSProperties = { fontSize: "10px", color: "var(--v5-ink-3)" };
const statValueStyle: CSSProperties = { fontSize: "15px", fontWeight: 600, color: "var(--v5-ink)", marginTop: "2px" };
const lockedHeadStyle: CSSProperties = { marginTop: "8px", fontSize: "14px", color: "var(--v5-ink)" };
const lockedSubStyle: CSSProperties = { marginTop: "6px", fontSize: "11px", color: "var(--v5-ink-3)", lineHeight: 1.45 };
const pathCtaStyle: CSSProperties = {
  marginTop: "12px",
  gap: "6px",
  padding: "0 16px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontSize: "12.5px",
  fontWeight: 600,
};

const tableCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "16px" };
const tableHeadStyle: CSSProperties = { padding: "14px 16px 8px" };
const tableHeadCapStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-ink-3)" };
function voteRowStyle(isMine: boolean, isLast: boolean): CSSProperties {
  return {
    padding: "10px 16px",
    gap: "12px",
    background: isMine ? "color-mix(in srgb, var(--v5-brand) 5%, transparent)" : "transparent",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
const pastHeadStyle: CSSProperties = { padding: "14px 16px 8px", fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-ink-3)" };
function historyRowStyle(isLast: boolean): CSSProperties {
  return { padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid var(--v5-border)" };
}
</script>
