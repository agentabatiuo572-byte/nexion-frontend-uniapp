<!--
  Team — ported from Nexion-prototype/app/(main)/team/page.tsx.
  v3 反向 Ponzi hub: royalty hero (V3+) → V-rank + upgrade progress → InviteEarnCard
  → leaderboard entry → 3-up quick-nav (influence / binary / leadership pool) →
  TeamLedgerCard → network composition → Genesis FOMO → quota+ambassador →
  visualizations. Tab page → <AppChassis active="team">.
  Reuses v-rank / network / commission / leadership-pool stores (all ported).
  zustand selectors → computed off Pinia store; mount-effect unlockMatured @60s →
  onMounted/onUnmounted interval. framer scroll-grow bar → CSS width transition.
  Nav targets to not-yet-ported sub-pages degrade via fail:()=>{} (see report §7).
-->
<template>
  <AppChassis active="team">
    <view class="pb-4" style="padding-top: 12px; color: var(--v5-ink)">
      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- V3+ royalty hero -->
        <view v-if="myRank >= 3" class="rounded-2xl relative overflow-hidden active:opacity-95" :style="royaltyHeroStyle" @click="go('/pages/team/unilevel')">
          <view class="flex items-center font-mono-tabular" :style="royaltyCapStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14" /></svg>
            <text>{{ t.teamV3.royaltyHeroLabel }}</text>
          </view>
          <text class="block font-display tabular-nums" :style="royaltyAmtStyle">${{ monthUSDT.toFixed(2) }}</text>
          <text class="block" :style="royaltySubStyle">{{ t.teamV3.royaltyHeroSubtitle }}</text>
          <view class="flex items-center justify-between" style="margin-top: 8px">
            <text class="font-mono-tabular" :style="{ fontSize: '10.5px', color: 'var(--v5-tech-cyan)' }">+{{ monthNEX.toFixed(0) }} NEX</text>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </view>
        </view>

        <!-- My V-rank + upgrade progress -->
        <view class="nx-team-rank-link relative overflow-hidden rounded-2xl active:opacity-95" :style="rankCardStyle" @click="go('/pages/team/rank')">
          <NetworkOrbBackdrop :opacity="0.32" />
          <view class="relative flex items-start justify-between">
            <view>
              <text class="block font-mono-tabular" :style="{ fontSize: '11px', color: 'var(--v5-tech-cyan)' }">{{ t.teamV3.yourRank }}</text>
              <view style="margin-top: 6px">
                <VBadge :v="myRank" size="lg" />
              </view>
              <text class="block" :style="rankBonusStyle">
                {{ t.teamV3.directBonus }} {{ Math.round(myRankDef.directBonus * 100) }}%{{ myRankDef.unilevelDepth > 1 ? ` · ${t.teamV3.extendedRoyalty}` : "" }}
              </text>
            </view>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 6px"><path d="m9 18 6-6-6-6" /></svg>
          </view>

          <view v-if="rankInfo.next" class="relative" style="margin-top: 16px">
            <view class="flex items-center justify-between" style="font-size: 11px; margin-bottom: 6px">
              <text :style="{ color: 'var(--v5-ink-3)' }">{{ t.teamV3.next }} <text :style="{ color: 'var(--v5-brand)', fontWeight: 600 }">V{{ rankInfo.next.v }} {{ rankInfo.next.title }}</text></text>
              <text class="font-mono-tabular" :style="{ color: 'var(--v5-brand)' }">{{ Math.round(rankInfo.progressPct * 100) }}%</text>
            </view>
            <view class="rounded-full overflow-hidden" :style="rankBarTrackStyle">
              <view :style="rankBarFillStyle" />
            </view>
            <text v-if="rankInfo.missing.length > 0" class="block" :style="missingStyle">
              {{ t.teamV3.need }} {{ rankInfo.missing.join(" · ") }}
            </text>
            <view class="inline-flex items-center" :style="prizeChipStyle">
              <text>{{ t.teamV3.prize }} {{ rankInfo.next.prizeIcon }} {{ rankInfo.next.prizeName }}</text>
            </view>
          </view>
        </view>

        <!-- Invite hero -->
        <InviteEarnCard />

        <!-- Leaderboard entry -->
        <view class="relative overflow-hidden rounded-2xl active:opacity-95" :style="leaderboardCardStyle" @click="go('/pages/team/leaderboard')">
          <view class="flex items-center" style="gap: 12px">
            <view class="rounded-xl grid place-items-center shrink-0" :style="trophyIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0z" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block font-mono-tabular" :style="{ fontSize: '11px', color: 'var(--v5-warning)' }">{{ t.teamV3.leaderboardCard.title }}</text>
              <text class="block" :style="{ fontSize: '13.5px', fontWeight: 600, color: 'var(--v5-ink)', marginTop: '2px' }">{{ t.teamV3.leaderboardCard.subtitle }}</text>
            </view>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </view>
        </view>

        <!-- 3-up quick nav -->
        <view class="grid grid-cols-3" style="gap: 8px">
          <!-- Influence -->
          <view class="rounded-2xl border active:opacity-95" :style="quickNavStyle" @click="go('/pages/team/unilevel')">
            <view class="flex items-start justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10M7 17 17 7" /></svg>
            </view>
            <text class="block font-display tabular-nums" :style="quickBigStyle">{{ totalMembersCount }}</text>
            <text class="block" :style="quickLabelStyle">{{ t.teamV3.sevenLayerNetwork }}</text>
            <view class="font-mono-tabular tabular-nums" :style="quickSubStyle">
              <text class="block">{{ t.teamV3.directLabel }} · {{ directCount }}</text>
              <text class="block">{{ t.teamV3.extendedLabel }} · {{ totalMembersCount - directCount }}</text>
            </view>
          </view>

          <!-- Binary -->
          <view class="nx-team-binary-link rounded-2xl border active:opacity-95" :style="quickNavStyle" @click="go('/pages/team/binary')">
            <view class="flex items-start justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10M7 17 17 7" /></svg>
            </view>
            <text class="block font-display tabular-nums" :style="quickBigWarnStyle">+${{ binaryMatch.toFixed(2) }}</text>
            <text class="block" :style="quickLabelStyle">{{ t.teamV3.todayMatch }}</text>
            <view class="font-mono-tabular tabular-nums" :style="quickSubStyle">
              <text class="block">A · ${{ leftVol.toFixed(0) }}</text>
              <text class="block">B · ${{ rightVol.toFixed(0) }}</text>
            </view>
          </view>

          <!-- Leadership pool -->
          <view class="nx-team-leadership-pool-link rounded-2xl border active:opacity-95" :style="quickNavStyle" @click="go('/pages/team/leadership-pool')">
            <view class="flex items-start justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14" /></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10M7 17 17 7" /></svg>
            </view>
            <text class="block font-display tabular-nums" :style="quickBigStyle">${{ projectedPayout.toFixed(2) }}</text>
            <text class="block" :style="quickLabelStyle">{{ t.teamV3.weeklyPool }}</text>
            <view class="font-mono-tabular tabular-nums" :style="quickSubStyle">
              <text class="block">{{ myVotes }} {{ t.teamV3.votes }}</text>
              <text class="block">{{ (myShare * 100).toFixed(2) }}%</text>
            </view>
          </view>
        </view>

        <!-- This month ledger -->
        <TeamLedgerCard
          :total-u-s-d-t-lifetime="totalUSDTLifetime"
          :contributors="totalMembersCount"
          :direct-u-s-d-t="directUSDT"
          :extended-u-s-d-t="extendedUSDT"
          :month-u-s-d-t="monthUSDT"
          :month-n-e-x="monthNEX"
          :unlocked-u-s-d-t="unlockedUSDT"
          :cooling-u-s-d-t="coolingUSDT"
        />

        <!-- Network composition -->
        <view class="rounded-2xl border active:opacity-95" :style="compositionCardStyle" @click="go('/pages/team/unilevel')">
          <view class="flex items-center justify-between">
            <text class="font-mono-tabular" :style="{ fontSize: '11px', color: 'var(--v5-ink-3)' }">{{ t.teamV3.networkComposition }}</text>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </view>
          <view style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px">
            <view class="flex items-center" style="gap: 8px; font-size: 11.5px">
              <text :style="{ width: '80px', color: 'var(--v5-brand)', fontWeight: 600 }">{{ t.teamV3.directLabel }}</text>
              <view class="flex-1 rounded-full overflow-hidden" :style="compBarTrackStyle">
                <view class="h-full rounded-full" :style="{ width: directBarPct + '%', background: 'linear-gradient(to right, color-mix(in srgb, var(--v5-brand) 70%, transparent), var(--v5-brand))' }" />
              </view>
              <text class="text-right font-mono-tabular tabular-nums" :style="{ width: '32px' }">{{ directCount }}</text>
            </view>
            <view class="flex items-center" style="gap: 8px; font-size: 11.5px">
              <text :style="{ width: '80px', color: 'var(--v5-tech-cyan)', fontWeight: 600 }">{{ t.teamV3.extendedLabel }}</text>
              <view class="flex-1 rounded-full overflow-hidden" :style="compBarTrackStyle">
                <view class="h-full rounded-full" :style="{ width: extendedBarPct + '%', background: 'linear-gradient(to right, color-mix(in srgb, var(--v5-tech-cyan) 70%, transparent), var(--v5-tech-cyan))' }" />
              </view>
              <text class="text-right font-mono-tabular tabular-nums" :style="{ width: '32px' }">{{ extendedCount }}</text>
            </view>
          </view>
        </view>

        <!-- Genesis FOMO -->
        <view class="relative overflow-hidden rounded-2xl active:opacity-95" :style="genesisCardStyle" @click="go('/pages/genesis/genesis')">
          <view class="flex items-start justify-between">
            <view class="flex items-center" style="gap: 8px">
              <view class="rounded-xl grid place-items-center" :style="genesisIconStyle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14" /></svg>
              </view>
              <view>
                <text class="block font-mono-tabular" :style="{ fontSize: '11px', color: 'var(--v5-brand-2)' }">{{ t.teamV3.genesis.label }}</text>
                <text class="block font-display" :style="{ fontSize: '15px', fontWeight: 600, lineHeight: 1.2, marginTop: '2px' }">{{ t.teamV3.genesis.headline }}</text>
              </view>
            </view>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 6px"><path d="m9 18 6-6-6-6" /></svg>
          </view>
          <view class="flex items-center justify-between font-mono-tabular" style="margin-top: 12px; font-size: 11px">
            <text :style="{ color: 'var(--v5-ink-2)' }">{{ t.teamV3.genesis.priceLine }}</text>
            <text :style="{ color: 'var(--v5-warning)' }">{{ t.teamV3.genesis.remaining }}</text>
          </view>
          <view class="rounded-full overflow-hidden" :style="genesisBarTrackStyle">
            <view class="h-full rounded-full" :style="{ width: '85%', background: 'linear-gradient(to right, var(--v5-brand-2), var(--v5-warning))' }" />
          </view>
        </view>

        <!-- Quota + ambassador -->
        <view class="grid grid-cols-2" style="gap: 10px">
          <view class="rounded-2xl border active:opacity-95" :style="quickNavStyle" @click="go('/pages/team/quota')">
            <view class="flex items-start justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10M7 17 17 7" /></svg>
            </view>
            <text class="block" :style="dualTitleStyle">{{ t.teamV3.hardwareQuota }}</text>
            <text class="block" :style="dualSubStyle">{{ t.teamV3.quotaSubtitle }}</text>
          </view>
          <view class="rounded-2xl border active:opacity-95" :style="quickNavStyle" @click="go('/pages/team/agent')">
            <view class="flex items-start justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14" /></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10M7 17 17 7" /></svg>
            </view>
            <text class="block" :style="dualTitleStyle">{{ t.teamV3.ambassador }}</text>
            <text class="block" :style="dualSubStyle">{{ t.teamV3.ambassadorSubtitle }}</text>
          </view>
        </view>

        <!-- Visualizations -->
        <view class="grid grid-cols-2" style="gap: 10px">
          <view class="rounded-2xl border active:opacity-95" :style="quickNavStyle" @click="go('/pages/team/network')">
            <view class="flex items-start justify-between">
              <view class="rounded-full" :style="orbDotStyle" />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10M7 17 17 7" /></svg>
            </view>
            <text class="block" :style="dualTitleStyle">{{ t.teamV3.visualizations.influenceNetwork }}</text>
            <text class="block" :style="dualSubStyle">{{ t.teamV3.visualizations.orbitLiveMap }}</text>
          </view>
          <view class="rounded-2xl border active:opacity-95" :style="quickNavStyle" @click="go('/pages/team/tree')">
            <view class="flex items-start justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10M7 17 17 7" /></svg>
            </view>
            <text class="block" :style="dualTitleStyle">{{ t.teamV3.visualizations.genealogy }}</text>
            <text class="block" :style="dualSubStyle">{{ t.teamV3.visualizations.genealogySubtitle }}</text>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import VBadge from "@/components/team/v-badge.vue";
import InviteEarnCard from "@/components/team/invite-earn-card.vue";
import TeamLedgerCard from "@/components/team/team-ledger-card.vue";
import NetworkOrbBackdrop from "@/components/team/network-orb-backdrop.vue";
import { useT } from "@/i18n/use-t";
import { useVRank, nextRankProgress, V_RANKS } from "@/store/v-rank";
import { useNetwork } from "@/store/network";
import { useCommission } from "@/store/commission";
import { useLeadershipPool } from "@/store/leadership-pool";

const t = useT();
const vrank = useVRank();
const network = useNetwork();
const commission = useCommission();
const pool = useLeadershipPool();

const myRank = computed(() => vrank.myRank);
const myRankDef = computed(() => V_RANKS[vrank.myRank]);
const members = computed(() => network.members);
const totalMembersCount = computed(() => network.totalMembers);
const events = computed(() => commission.events);

const rankInfo = computed(() =>
  nextRankProgress({
    myRank: vrank.myRank,
    selfBuyUSD: vrank.selfBuyUSD,
    directRefs: vrank.directRefs,
    teamVolumeUSD: vrank.teamVolumeUSD,
    vDownlineCounts: vrank.vDownlineCounts,
  }),
);

// Scroll-grow bar → simple in-view fill (animate on mount via transition).
const rankBarFilled = ref(false);
onMounted(() => {
  // next tick paint then expand
  setTimeout(() => (rankBarFilled.value = true), 60);
});

const byLayerBuckets = computed(() => network.byLayer());
const directCount = computed(() => byLayerBuckets.value[1].length);
const extendedCount = computed(() =>
  ([2, 3, 4, 5, 6, 7] as const).reduce((s, L) => s + byLayerBuckets.value[L].length, 0),
);
const compTotal = computed(() => Math.max(1, directCount.value + extendedCount.value));
const directBarPct = computed(() => (directCount.value / compTotal.value) * 100);
const extendedBarPct = computed(() => (extendedCount.value / compTotal.value) * 100);

// Commission month aggregates (30d) + direct/extended split.
const ledger = computed(() => {
  const cutoff = Date.now() - 30 * 86400000;
  let mU = 0, mS = 0, uU = 0, cU = 0, tU = 0, dU = 0, eU = 0;
  for (const e of events.value) {
    if (e.ts >= cutoff) {
      mU += e.amountUSDT;
      mS += e.amountNEX;
    }
    if (e.status === "unlocked") uU += e.amountUSDT;
    if (e.status === "cooling") cU += e.amountUSDT;
    tU += e.amountUSDT;
    if (e.kind === "unilevel" && e.layer === 1) dU += e.amountUSDT;
    else eU += e.amountUSDT;
  }
  return { monthUSDT: mU, monthNEX: mS, unlockedUSDT: uU, coolingUSDT: cU, totalUSDTLifetime: tU, directUSDT: dU, extendedUSDT: eU };
});
const monthUSDT = computed(() => ledger.value.monthUSDT);
const monthNEX = computed(() => ledger.value.monthNEX);
const unlockedUSDT = computed(() => ledger.value.unlockedUSDT);
const coolingUSDT = computed(() => ledger.value.coolingUSDT);
const totalUSDTLifetime = computed(() => ledger.value.totalUSDTLifetime);
const directUSDT = computed(() => ledger.value.directUSDT);
const extendedUSDT = computed(() => ledger.value.extendedUSDT);

// Binary match snapshot.
const binary = computed(() => {
  let L = 0, R = 0;
  for (const m of members.value) {
    if (m.binary === "left") L += m.monthVolumeUSD;
    else R += m.monthVolumeUSD;
  }
  const match = Math.min(Math.min(L / 30, R / 30) * 0.1, 5000);
  return { binaryMatch: match, leftVol: L, rightVol: R };
});
const binaryMatch = computed(() => binary.value.binaryMatch);
const leftVol = computed(() => binary.value.leftVol);
const rightVol = computed(() => binary.value.rightVol);

const myVotes = computed(() => pool.myVotes(vrank.myRank));
const myShare = computed(() => pool.mySharePct(vrank.myRank));
const projectedPayout = computed(() => pool.myProjectedPayout(vrank.myRank));

function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// unlockMatured at mount + every 60s.
let unlockTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  commission.unlockMatured();
  unlockTimer = setInterval(() => commission.unlockMatured(), 60_000);
});
onUnmounted(() => {
  if (unlockTimer) clearInterval(unlockTimer);
});

// ─── styles ───
const royaltyHeroStyle: CSSProperties = {
  padding: "16px",
  background: "radial-gradient(80% 60% at 100% 0%, var(--v5-brand-soft) 0%, transparent 60%), var(--v5-surface)",
  border: "1px solid var(--v5-brand-border)",
};
const royaltyCapStyle: CSSProperties = { gap: "6px", fontSize: "11px", color: "var(--v5-brand)", marginBottom: "8px" };
const royaltyAmtStyle: CSSProperties = { fontSize: "28px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1 };
const royaltySubStyle: CSSProperties = { marginTop: "4px", fontSize: "11px", color: "var(--v5-ink-3)" };

const rankCardStyle: CSSProperties = {
  padding: "16px",
  background: "radial-gradient(80% 60% at 80% 0%, var(--v5-tech-cyan-soft) 0%, transparent 65%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const rankBonusStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "6px" };
const rankBarTrackStyle: CSSProperties = { height: "6px", background: "var(--v5-surface-3)" };
const rankBarFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(to right, var(--v5-tech-cyan), var(--v5-brand))",
  width: rankBarFilled.value ? `${rankInfo.value.progressPct * 100}%` : "0%",
  transition: rankBarFilled.value ? "width 1.1s cubic-bezier(0.16,1,0.3,1)" : "none",
}));
const missingStyle: CSSProperties = { marginTop: "8px", fontSize: "11px", color: "var(--v5-ink-3)", lineHeight: 1.4 };
const prizeChipStyle: CSSProperties = {
  marginTop: "10px",
  gap: "4px",
  padding: "4px 8px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
  color: "var(--v5-brand)",
  fontSize: "10.5px",
  fontWeight: 600,
};

const leaderboardCardStyle: CSSProperties = {
  padding: "16px",
  background: "radial-gradient(80% 60% at 80% 0%, var(--v5-warning-soft) 0%, transparent 65%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const trophyIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)",
};

const quickNavStyle: CSSProperties = {
  padding: "14px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
};
const quickBigStyle: CSSProperties = { marginTop: "10px", fontSize: "18px", fontWeight: 600, lineHeight: 1 };
const quickBigWarnStyle: CSSProperties = { marginTop: "10px", fontSize: "18px", fontWeight: 600, lineHeight: 1, color: "var(--v5-warning)" };
const quickLabelStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-3)", marginTop: "4px" };
const quickSubStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "6px", lineHeight: 1.4 };

const compositionCardStyle: CSSProperties = {
  padding: "16px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const compBarTrackStyle: CSSProperties = { height: "8px", background: "var(--v5-surface-3)" };

const genesisCardStyle: CSSProperties = {
  padding: "16px",
  background: "radial-gradient(80% 60% at 80% 0%, var(--v5-brand-2-soft) 0%, transparent 65%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const genesisIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  background: "color-mix(in srgb, var(--v5-brand-2) 20%, transparent)",
};
const genesisBarTrackStyle: CSSProperties = { marginTop: "8px", height: "6px", background: "var(--v5-surface-3)" };

const dualTitleStyle: CSSProperties = { marginTop: "10px", fontSize: "13.5px", fontWeight: 600, lineHeight: 1.2 };
const dualSubStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "4px" };
const orbDotStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  background: "radial-gradient(circle at 30% 30%, var(--v5-brand) 0%, var(--v5-tech-cyan) 70%, transparent 100%)",
};
</script>
