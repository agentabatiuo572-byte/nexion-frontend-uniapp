<!--
  Weekly Quest Tier 2 list — ported from
  Nexion-prototype/app/components/home/weekly-quest-list.tsx.

  4 quests sampled deterministically by weekKey (dispatchTier2). Each row: link
  (pending) → claim button (completed) → struck-through done (claimed). Once all
  4 done+claimed AND tier 1 claimed → champion bonus row appears (+500 NEX ×
  phase mult). Cross-store orchestration in click handlers (stores don't import
  each other).
-->
<template>
  <view v-if="mounted" class="mx-4 mt-3 overflow-hidden" :style="cardStyle">
    <!-- Header -->
    <view class="px-4 py-3 flex items-center justify-between" :style="headerStyle">
      <text :style="tier2LabelStyle">{{ w.tier2Label }}</text>
      <text class="tabular-nums" :style="countStyle">{{ completedCount }} / {{ tier2Quests.length }}</text>
    </view>

    <!-- Quest rows -->
    <view>
      <view v-for="(q, i) in tier2Quests" :key="q.id" :style="{ borderBottom: i === tier2Quests.length - 1 ? 'none' : '1px solid var(--v5-border)' }">
        <!-- claimed: struck-through done -->
        <view v-if="isClaimed(q)" class="flex items-center px-4 py-3" :style="claimedRowStyle">
          <view class="grid place-items-center shrink-0" :style="checkBoxStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </view>
          <text class="flex-1" :style="claimedLabelStyle">{{ titleOf(q) }}</text>
          <text :style="claimedRewardStyle">+{{ rewardOf(q) }} NEX</text>
        </view>

        <!-- completed: claimable button -->
        <view v-else-if="isCompleted(q)" class="flex items-center px-4 py-3 active:opacity-80" role="button" :style="completedRowStyle" @click="onClaimRow(q)">
          <view class="grid place-items-center shrink-0" :style="sparkBoxStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          </view>
          <text class="flex-1" :style="claimLabelStyle">{{ claimTextFor(q) }}</text>
          <text :style="claimRewardStyle">+{{ rewardOf(q) }} NEX</text>
        </view>

        <!-- pending: navigate to target route -->
        <view v-else class="flex items-center px-4 py-3 active:opacity-80" role="button" :style="pendingRowStyle" @click="onRowCta(q)">
          <view class="grid place-items-center shrink-0" :style="numberBoxStyle">
            <text>{{ i + 1 }}</text>
          </view>
          <text class="flex-1" :style="pendingLabelStyle">{{ titleOf(q) }}</text>
          <view class="flex items-baseline" style="gap: 4px">
            <text :style="pendingRewardStyle">+{{ rewardOf(q) }} NEX</text>
            <text v-if="q.rewardUsdt" :style="pendingUsdtStyle">+${{ q.rewardUsdt }}</text>
          </view>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px; flex-shrink: 0"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>
    </view>

    <!-- Bonus row — all 5 done, claim championship bonus -->
    <view v-if="allFiveDone && !bonusClaimed" class="px-3 py-3" :style="bonusRowStyle">
      <view class="flex items-center justify-center active:opacity-85" role="button" :style="bonusBtnStyle" @click="onClaimBonus">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0z" /></svg>
        <text>{{ bonusCtaText }}</text>
      </view>
    </view>
    <view v-else-if="bonusClaimed" class="px-4 py-2 flex items-center" :style="bonusDoneStyle">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; flex-shrink: 0"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0z" /></svg>
      <text :style="bonusDoneTextStyle">🎉 {{ bonusClaimedText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useWeeklyQuest } from "@/store/weekly-quest";
import { useProductPhase } from "@/composables/use-product-phase";
import { useAchievements } from "@/store/achievements";
import {
  dispatchTier2,
  getPhaseRewardMultiplier,
  currentWeekKey,
  WEEKLY_BONUS_NEX,
  WEEKLY_CHAMPION_BADGE_ID,
  type Tier2QuestDef,
} from "@/mock/weekly-quests";
import { isPurchasedHardwareKind } from "@/store/device-types";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";

const t = useT();
const w = computed(() => t.value.weeklyQuest);
const app = useApp();
const bills = useBills();
const wq = useWeeklyQuest();
const phase = useProductPhase();
const ach = useAchievements();
const mounted = ref(false);

onMounted(() => {
  wq.rollWeekIfStale();
  mounted.value = true;
});

const tier2Quests = computed<Tier2QuestDef[]>(() => {
  if (!mounted.value) return [];
  const hasHardware = app.visibleDevices.some((d) => isPurchasedHardwareKind(d.kind));
  return dispatchTier2({
    balanceUSDT: app.user.usdtBalance,
    nexBalance: app.user.nexBalance,
    hasHardware,
    weekKey: currentWeekKey(),
  });
});

const mult = computed(() => getPhaseRewardMultiplier(phase.value.id));
const completedCount = computed(() => tier2Quests.value.filter((q) => wq.tier2Completed.includes(q.id)).length);
const allTier2Done = computed(() => completedCount.value === tier2Quests.value.length && tier2Quests.value.length > 0);
const allClaimed = computed(() => tier2Quests.value.every((q) => wq.tier2Claimed.includes(q.id)));
const allFiveDone = computed(() => wq.tier1Claimed && allTier2Done.value && allClaimed.value);
const bonusClaimed = computed(() => wq.bonusClaimed);

function isClaimed(q: Tier2QuestDef): boolean {
  return wq.tier2Claimed.includes(q.id);
}
function isCompleted(q: Tier2QuestDef): boolean {
  return wq.tier2Completed.includes(q.id) && !wq.tier2Claimed.includes(q.id);
}
function rewardOf(q: Tier2QuestDef): number {
  return Math.round(q.rewardNex * mult.value);
}
function titleOf(q: Tier2QuestDef): string {
  return w.value[`tier2_${q.i18nKey}_title` as keyof typeof w.value] as string;
}
function claimTextFor(q: Tier2QuestDef): string {
  return fmt(w.value.claim, { n: rewardOf(q).toLocaleString() });
}

const bonusCtaText = computed(() => fmt(w.value.bonusCta, { n: Math.round(WEEKLY_BONUS_NEX * mult.value).toLocaleString() }));
const bonusClaimedText = computed(() => fmt(w.value.bonusClaimed, { n: Math.round(WEEKLY_BONUS_NEX * mult.value).toLocaleString() }));

function onRowCta(q: Tier2QuestDef) {
  // Completion trigger (see hero onCta): tap marks complete so the row flips to
  // its claimable state on return. Backend-replaceable (server attribution).
  wq.markTier2Complete(q.id);
  navTo(q.href);
}

function onClaimRow(q: Tier2QuestDef) {
  if (wq.claimTier2(q.id)) {
    const amount = rewardOf(q);
    app.creditNex(amount);
    bills.add({
      type: "achievement",
      symbol: "NEX",
      amount,
      status: "posted",
      memo: `Weekly quest tier-2 · ${q.id}`,
      ref: `WQT2-${q.id}-${Date.now().toString(36).toUpperCase()}`,
    });
  }
}

function onClaimBonus() {
  if (wq.claimBonus()) {
    const amount = Math.round(WEEKLY_BONUS_NEX * mult.value);
    app.creditNex(amount);
    bills.add({
      type: "achievement",
      symbol: "NEX",
      amount,
      status: "posted",
      memo: "Weekly champion bonus",
      ref: `WCHAMPION-${Date.now().toString(36).toUpperCase()}`,
    });
    ach.unlock(WEEKLY_CHAMPION_BADGE_ID);
  }
}

// ── styles ──
const cardStyle: CSSProperties = {
  background: "var(--v5-surface-bg)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const headerStyle: CSSProperties = { borderBottom: "1px solid var(--v5-border)" };
const tier2LabelStyle: CSSProperties = {
  fontFamily: "var(--font-numbers)",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const countStyle: CSSProperties = {
  fontFamily: "var(--font-numbers)",
  fontSize: "11px",
  color: "var(--v5-ink-2)",
};
const claimedRowStyle: CSSProperties = { gap: "12px", opacity: 0.65 };
const checkBoxStyle: CSSProperties = { width: "22px", height: "22px", borderRadius: "999px", background: "var(--v5-success)" };
const claimedLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink-4)",
  textDecoration: "line-through",
};
const claimedRewardStyle: CSSProperties = {
  fontFamily: "var(--font-numbers)",
  fontSize: "11px",
  color: "var(--v5-success)",
};
const completedRowStyle: CSSProperties = { gap: "12px", minHeight: "48px", background: "var(--v5-warning-soft)" };
const sparkBoxStyle: CSSProperties = { width: "22px", height: "22px", borderRadius: "999px", background: "var(--v5-warning)" };
const claimLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "12.5px",
  color: "var(--v5-warning)",
  letterSpacing: "-0.005em",
};
const claimRewardStyle: CSSProperties = {
  fontFamily: "var(--font-numbers)",
  fontWeight: 500,
  fontSize: "11px",
  color: "var(--v5-warning)",
};
const pendingRowStyle: CSSProperties = { gap: "12px", minHeight: "48px" };
const numberBoxStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "999px",
  background: "var(--v5-brand-soft)",
  color: "var(--v5-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "11px",
};
const pendingLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink)",
};
const pendingRewardStyle: CSSProperties = {
  fontFamily: "var(--font-amount)",
  fontWeight: 500,
  fontSize: "11px",
  color: "var(--v5-brand)",
};
const pendingUsdtStyle: CSSProperties = {
  fontFamily: "var(--font-amount)",
  fontSize: "11px",
  color: "var(--v5-success)",
};
const bonusRowStyle: CSSProperties = {
  borderTop: "1px solid var(--v5-success-soft)",
  background: "var(--v5-success-soft)",
};
const bonusBtnStyle: CSSProperties = {
  gap: "6px",
  height: "44px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, var(--v5-success), var(--v5-warning))",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  letterSpacing: "-0.005em",
};
const bonusDoneStyle: CSSProperties = {
  gap: "8px",
  borderTop: "1px solid var(--v5-success-soft)",
  background: "var(--v5-success-soft)",
};
const bonusDoneTextStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-success)",
  fontWeight: 500,
};
</script>
