<!--
  Weekly Quest Tier 1 hero card — ported from
  Nexion-prototype/app/components/home/weekly-quest-hero.tsx.

  Renders the single highest-priority Tier 1 quest of the week
  (dispatchTier1). Hidden once tier1 claimed (the Tier 2 list takes over).
  Phase reward multiplier applies for display only; phase id never surfaced.

  Cross-store orchestration lives in the click handler (stores don't import each
  other): claim = wq.claimTier1() + postMoneyBills(奖励分录) + achievements.unlock。
  资金变更由收据的 amount/symbol 派生,不再单独调 creditNex/creditBalance。
  navTo() maps the quest's logical href to a uni route.
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
            role="button" tabindex="0"
            :style="ctaStyle"
            @click="onCta"
          >
            <text>{{ ctaText }}</text>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </view>
          <view
            v-else
            class="inline-flex items-center shrink-0 active:opacity-85"
            role="button" tabindex="0"
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
import { postMoneyBillsOnce, type ReceiptDraft } from "@/lib/money-receipt";
import { useVRank } from "@/store/v-rank";
import { useWeeklyQuest } from "@/store/weekly-quest";
import { useProductPhase } from "@/composables/use-product-phase";
import { useAchievements } from "@/store/achievements";
import { dispatchTier1, getPhaseRewardMultiplier, type Tier1QuestDef } from "@/mock/weekly-quests";
import { isPurchasedHardwareKind } from "@/store/device-types";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";

const t = useT();
const w = computed(() => t.value.weeklyQuest);
const app = useApp();
const vRank = useVRank();
// 🔴 任务派发也要问闸:关闭 / 熔断 / 售罄 / 未开售时不派「买创世」,否则用户领到一个
//   不可能完成的周任务(独立 critic Q1)。走唯一消费入口,本文件不自判。
const { block: genesisBlock } = useGenesisSaleGate();
const phase = useProductPhase();
const wq = useWeeklyQuest();
const ach = useAchievements();
const mounted = ref(false);

onMounted(() => {
  wq.rollWeekIfStale();
  mounted.value = true;
});

const quest = computed<Tier1QuestDef | null>(() => {
  if (!mounted.value) return null;
  const devices = app.visibleDevices;
  const hasHardware = devices.some((d) => isPurchasedHardwareKind(d.kind));
  const hasS1Only =
    devices.some((d) => d.kind === "stellarbox-s1") &&
    !devices.some((d) => d.kind === "stellarbox-pro" || d.kind === "stellarrack-p1");
  // FEAT-DEV02: generation retired — owning the original-tier kind IS the
  // trade-up signal (Pro v2 / Rack P2 are distinct kinds already).
  const hasProOrRackP1 = devices.some(
    (d) => d.kind === "stellarbox-pro" || d.kind === "stellarrack-p1",
  );
  const hasRackAnyGen = devices.some((d) => d.kind === "stellarrack-p1");
  return dispatchTier1({
    phase: phase.value.id,
    balanceUSDT: app.user.usdtBalance,
    hasGenesis: false, // mock placeholder (source parity)
    myRank: vRank.myRank,
    hasHardware,
    hasS1Only,
    hasProOrRackP1,
    hasRackAnyGen,
    hasPremium: false, // mock placeholder (source parity)
    nexBalance: app.user.nexBalance,
    // 判据走**唯一消费入口**,不在这自判(规格 ④「单一派生」)。
    genesisPurchasable: genesisBlock.value === null,
  });
});

const mult = computed(() => getPhaseRewardMultiplier(phase.value.id));
const reward = computed(() => (quest.value ? Math.round(quest.value.rewardNex * mult.value) : 0));
const rewardDisplay = computed(() => reward.value.toLocaleString());
// 🔴 **不要**改成「已完成未领取的任务钉住不再重派」(2026-08-05 独立审计提过,证伪后否决)。
//   看起来它修的是「闸一变、已完成的奖励静默作废」,实际会开三个更大的口子:
//   ① `markTier1Complete` 是**点 CTA 就触发**的(见下面 onCta 的注释),不是真买到才触发
//      —— 钉住 = 用户点一下、市场随即关闭,照样能领 2500 NEX 徽章,没买创世也领;
//   ② 钉住的那支绕开 `genesisPurchasable` 判据,闸对它彻底失效;
//   ③ `tier1Completed` 是从 storage 裸 cast 进来的字符串,脏值会让 `TIER1_QUESTS[脏值]`
//      变 undefined → 整周不出任务卡且周冠军奖永久不可领。
//   真要修得在服务端按**行为归因**判完成(本文件已是 backend-replaceable 的形状),
//   而不是在渲染层钉一个「点过了」的标记。现在这版「闸一关任务就换掉」反而是刹车。
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
  // MOCK-ONLY NON-ATOMIC: PROD POST /api/quests/weekly/{tier1}
  // claims, credits, and bills in one idempotent transaction.
  //
  // 🔴 顺序 = **先发钱(幂等)→ 后消费资格**,不可换(2026-08-04 对抗审计 B-P1-3)。
  // 原来是「先 claimTier1() 消费资格 → 发钱失败就 return」:资格没了、奖归零,用户白损失。
  // 反过来「先发钱后消费」本会有重复发钱的风险,但 postMoneyBillsOnce 按稳定 ref 判重 ——
  // 重放命中既有分录就不动钱直接返回 ok,于是这条顺序没有失效面。
  // ref 必须稳定(周 + 任务 id),带时间戳的话判重永不命中 = 假幂等。
  if (wq.tier1Claimed) return; // 已领过:原来由 claimTier1() 的内部守卫拦,现在提到发钱之前
  const r = reward.value;
  const refId = `WQUEST-${wq.weekKey}-${q.id}`;
  // 同一次领取的两腿一次落盘:发了 NEX 却没发 $(或反过来)是半边账,比整笔没发更难对。
  const drafts: ReceiptDraft[] = [
    { type: "achievement", symbol: "NEX", amount: r, status: "posted", memo: `Weekly quest reward · ${q.id}`, ref: refId },
  ];
  if (q.rewardUsdt) {
    drafts.push({ type: "achievement", symbol: "USDT", amount: q.rewardUsdt, status: "posted", memo: `Weekly quest reward · ${q.id}`, ref: refId });
  }
  if (postMoneyBillsOnce(drafts) !== "ok") return;
  if (!wq.claimTier1()) return; // 资格没消费成:钱已幂等落定,下次重试命中 ref 不会再发
  if (q.badgeId) ach.unlock(q.badgeId);
}

// ── styles ──
const cardStyle: CSSProperties = {
  position: "relative",
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
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
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-warning)",
  letterSpacing: "0.06em",
};
const titleStyle: CSSProperties = {
  marginTop: "10px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "20px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
  lineHeight: 1.3,
};
const bodyStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "13px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.5,
};
const rewardStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "26px",
  letterSpacing: "-0.018em",
  color: "var(--v5-nex)",
  lineHeight: 1,
};
const nexUnitStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-nex)",
  marginLeft: "2px",
};
const usdtStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
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
  fontSize: "12px",
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
