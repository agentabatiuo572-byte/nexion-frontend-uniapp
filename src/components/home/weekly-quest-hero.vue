<!--
  Weekly Quest Tier 1 hero card — ported from
  Nexion-prototype/app/components/home/weekly-quest-hero.tsx.

  Renders the single highest-priority Tier 1 quest of the week
  (dispatchTier1). Hidden once tier1 claimed (the Tier 2 list takes over).
  Phase reward multiplier applies for display only; phase id never surfaced.

  Cross-store orchestration lives in the click handler (stores don't import each
  other): claim = wq.claimTier1() + app.creditNex/creditBalance + bills.add +
  achievements.unlock. navTo() maps the quest's logical href to a uni route.
-->
<template>
  <view v-if="visible" class="mt-3">
    <view class="relative overflow-hidden" :style="cardStyle">
      <!-- top edge accent line — warning amber sweep -->
      <view aria-hidden :style="accentLineStyle" />
      <!-- soft top-right radial wash -->
      <view aria-hidden :style="washStyle" />

      <view class="relative">
        <!-- mono 11/500 label — warning accent -->
        <view class="inline-flex items-center" :style="labelStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
          <text>{{ w.heroLabel }}</text>
        </view>

        <!-- Card title h-md 18 / 600 ink -->
        <text class="block" :style="titleStyle">{{ titleText }}</text>
        <!-- Body 12.5 ink-3 -->
        <text class="block" :style="bodyStyle">{{ bodyText }}</text>

        <view class="mt-3 flex items-center justify-between" style="gap: 10px">
          <view class="flex items-baseline" style="gap: 4px">
            <!-- Page H1 24 / 600 warning amber + tabular -->
            <text class="tabular-nums" :style="rewardStyle">+{{ rewardDisplay }}</text>
            <text :style="nexUnitStyle">NEX</text>
            <text v-if="quest && quest.rewardUsdt" class="tabular-nums" :style="usdtStyle">+${{ quest.rewardUsdt }}</text>
            <text v-if="mult > 1" class="inline-flex items-center" :style="promoChipStyle">{{ promoChipText }}</text>
          </view>

          <!-- primary h-md pill warning amber (quest accent) -->
          <view
            v-if="!completed"
            class="inline-flex items-center shrink-0 active:opacity-85"
            role="button"
            :style="ctaStyle"
            @click="onCta"
          >
            <text>{{ ctaText }}</text>
            <svg style="margin-left: 6px" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </view>
          <view
            v-else
            class="inline-flex items-center shrink-0 active:opacity-85"
            role="button"
            :style="claimStyle"
            @click="onClaim"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
            <text>{{ claimText }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useVRank } from "@/store/v-rank";
import { useWeeklyQuest } from "@/store/weekly-quest";
import { useProductPhase } from "@/composables/use-product-phase";
import { useAchievements } from "@/store/achievements";
import { dispatchTier1, getPhaseRewardMultiplier, type Tier1QuestDef } from "@/mock/weekly-quests";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";

const t = useT();
const w = computed(() => t.value.weeklyQuest);
const app = useApp();
const vRank = useVRank();
const phase = useProductPhase();
const wq = useWeeklyQuest();
const ach = useAchievements();
const bills = useBills();
const mounted = ref(false);

onMounted(() => {
  wq.rollWeekIfStale();
  mounted.value = true;
});

const quest = computed<Tier1QuestDef | null>(() => {
  if (!mounted.value) return null;
  const devices = app.devices;
  const hasHardware = devices.some((d) => d.kind !== "phone" && d.kind !== "cloud-share");
  const hasS1Only =
    devices.some((d) => d.kind === "stellarbox-s1") &&
    !devices.some((d) => d.kind === "stellarbox-pro" || d.kind === "stellarrack-p1");
  const hasProOrRackOldGen = devices.some(
    (d) => (d.kind === "stellarbox-pro" || d.kind === "stellarrack-p1") && d.generation === 1,
  );
  const hasRackAnyGen = devices.some((d) => d.kind === "stellarrack-p1");
  return dispatchTier1({
    phase: phase.value.id,
    balanceUSDT: app.user.usdtBalance,
    hasGenesis: false, // mock placeholder (source parity)
    myRank: vRank.myRank,
    hasHardware,
    hasS1Only,
    hasProOrRackOldGen,
    hasRackAnyGen,
    hasPremium: false, // mock placeholder (source parity)
    nexBalance: app.user.nexBalance,
  });
});

const mult = computed(() => getPhaseRewardMultiplier(phase.value.id));
const reward = computed(() => (quest.value ? Math.round(quest.value.rewardNex * mult.value) : 0));
const rewardDisplay = computed(() => reward.value.toLocaleString());
const completed = computed(() => !!quest.value && wq.tier1Completed === quest.value.id);
const visible = computed(() => mounted.value && !!quest.value && !wq.tier1Claimed);

const titleText = computed(() =>
  quest.value ? (w.value[`tier1_${quest.value.i18nKey}_title` as keyof typeof w.value] as string) : "",
);
const bodyText = computed(() =>
  quest.value ? (w.value[`tier1_${quest.value.i18nKey}_body` as keyof typeof w.value] as string) : "",
);
const ctaText = computed(() =>
  quest.value ? (w.value[`tier1_${quest.value.i18nKey}_cta` as keyof typeof w.value] as string) : "",
);
const promoChipText = computed(() => fmt(w.value.promoChip, { mult: mult.value.toFixed(1) }));
const claimText = computed(() => fmt(w.value.claim, { n: rewardDisplay.value }));

function onCta() {
  const q = quest.value;
  if (!q) return;
  // Completion trigger (PRD §11.13.5 + plan "CTA 跳转后手工领"): tapping the CTA
  // marks the quest complete so the claim button becomes reachable on return.
  // Backend-replaceable: the real server marks completion on behavioral
  // attribution (the user actually doing the action); here the CTA tap stands
  // in — consistent with how daily/event quests trigger on tap.
  wq.markTier1Complete(q.id);
  navTo(q.href);
}

function onClaim() {
  const q = quest.value;
  if (!completed.value || !q) return;
  if (wq.claimTier1()) {
    const r = reward.value;
    const refId = `WQUEST-${q.id}-${Date.now().toString(36).toUpperCase()}`;
    app.creditNex(r);
    bills.add({ type: "achievement", symbol: "NEX", amount: r, status: "posted", memo: `Weekly quest reward · ${q.id}`, ref: refId });
    if (q.rewardUsdt) {
      app.creditBalance(q.rewardUsdt);
      bills.add({ type: "achievement", symbol: "USDT", amount: q.rewardUsdt, status: "posted", memo: `Weekly quest reward · ${q.id}`, ref: refId });
    }
    if (q.badgeId) ach.unlock(q.badgeId);
  }
}

// ── styles ──
const cardStyle: CSSProperties = {
  position: "relative",
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface-bg)",
  border: "1px solid var(--v5-warning-soft)",
};
const accentLineStyle: CSSProperties = {
  position: "absolute",
  left: "0",
  right: "0",
  top: "0",
  height: "2px",
  background: "linear-gradient(90deg, transparent, var(--v5-warning), transparent)",
  opacity: 0.7,
  pointerEvents: "none",
};
const washStyle: CSSProperties = {
  position: "absolute",
  top: "-50px",
  right: "-50px",
  width: "120px",
  height: "120px",
  borderRadius: "50%",
  background: "radial-gradient(circle, var(--v5-warning-soft), transparent 70%)",
  opacity: 0.55,
  pointerEvents: "none",
};
const labelStyle: CSSProperties = {
  gap: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-warning)",
  letterSpacing: "0.06em",
};
const titleStyle: CSSProperties = {
  marginTop: "10px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
  lineHeight: 1.3,
};
const bodyStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.5,
};
const rewardStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "24px",
  letterSpacing: "-0.018em",
  color: "var(--v5-warning)",
  lineHeight: 1,
};
const nexUnitStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-warning)",
  marginLeft: "2px",
};
const usdtStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-success)",
  marginLeft: "6px",
};
const promoChipStyle: CSSProperties = {
  marginLeft: "8px",
  padding: "2px 6px",
  borderRadius: "4px",
  background: "var(--v5-brand-2-soft)",
  color: "var(--v5-brand-2)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  fontWeight: 500,
};
const ctaStyle: CSSProperties = {
  gap: "6px",
  height: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  background: "var(--v5-warning)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
};
const claimStyle: CSSProperties = {
  gap: "6px",
  height: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, var(--v5-warning), var(--v5-success))",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
};
</script>
