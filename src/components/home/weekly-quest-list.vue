<!-- Weekly Tier 2 is server-authoritative; pending rows use PC-configured routes. -->
<template>
  <view v-if="!mounted && !wq.snapshot" class="nx-glass-card mx-4 mt-3 px-4 py-3" :style="cardStyle" role="status" aria-busy="true">
    <text :style="pendingLabelStyle">{{ w.loading }}</text>
    <view v-for="row in 3" :key="row" style="height: 46px; padding-top: 14px">
      <view :style="{ width: row === 2 ? '56%' : '72%', height: '12px', borderRadius: '4px', background: 'var(--v5-surface-2)' }" />
    </view>
  </view>

  <view v-else-if="mounted && !wq.snapshot" class="nx-glass-card mx-4 mt-3 px-4 py-3" :style="cardStyle">
    <text :style="pendingLabelStyle">{{ w.tier2Label }}</text><text class="block">—</text>
  </view>
  <view v-else-if="mounted" class="nx-glass-card mx-4 mt-3 overflow-hidden" :style="cardStyle">
    <!-- Header -->
    <view class="weekly-list-heading px-4 py-3 flex items-center justify-between" :style="headerStyle">
      <text :style="tier2LabelStyle">{{ w.tier2Label }}</text>
      <view style="text-align: right">
        <text class="block" :style="countStyle">{{ progressParts[0] }}<text class="weekly-completed-count">{{ visibility.mask(completedCount) }}</text>{{ progressParts[1] }}</text>
        <text v-if="periodText && !wq.tier1Quests.some(q=>q.eligibleUntil===tier2Quests[0]?.eligibleUntil)" class="block tabular-nums" :style="periodStyle">{{ periodText }}</text>
      </view>
    </view>



    <!-- Quest rows -->
    <view>
      <view v-for="(q, i) in tier2Quests" :key="`${q.questCode}:${q.instanceKey}`" :style="{ '--ui-weekly-row-border': i === tier2Quests.length - 1 ? 'none' : '1px solid var(--v5-border)' }">
        <!-- claimed: struck-through done -->
        <view v-if="isClaimed(q)" class="weekly-quest-row flex items-center px-4 py-3" :style="claimedRowStyle">
          <view class="grid place-items-center shrink-0" :style="checkBoxStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </view>
          <view class="flex-1">
            <text class="block" :style="claimedLabelStyle">{{ titleOf(q) }}</text>

          </view>
          <view style="text-align:right"><text :style="claimedRewardStyle">+{{ formatAmount(rewardOf(q)) }} UVT</text><text class="block" :style="categoryLabelStyle">{{ t.questClaim.alreadyClaimed }}</text></view>
        </view>

        <!-- completed: claimable button -->
        <view v-else-if="isCompleted(q)" class="weekly-quest-row weekly-claimable flex items-center px-4 py-3" :style="completedRowStyle">
          <view class="grid place-items-center shrink-0" :style="sparkBoxStyle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--v5-on-brand)" aria-hidden="true"><path d="m12 2 3.1 6.9L22 12l-6.9 3.1L12 22l-3.1-6.9L2 12l6.9-3.1z"/></svg>
          </view>
          <view class="flex-1">
            <text class="block" :style="pendingLabelStyle">{{ titleOf(q) }}</text>
            <text class="block" :style="categoryLabelStyle">{{ t.growthUi.weekReady }}</text>
            <text v-if="wq.error && wq.claimErrorQuestCode === q.questCode" class="block" role="status" :style="claimErrorStyle">{{ claimErrorText }}</text>
          </view>
          <NxButton variant="brand" size="small" :label="claimTextFor(q)" @click="onClaimRow(q)" />
        </view>

        <!-- pending: navigate to target route -->
        <view v-else class="weekly-quest-row weekly-pending flex items-center px-4 py-3" :class="rowInactive(q) ? 'opacity-50' : 'active:opacity-80'" :role="rowInactive(q) ? undefined : 'button'" :tabindex="rowInactive(q) ? -1 : 0" :aria-disabled="rowInactive(q)" :style="pendingRowStyle" @click="onRowCta(q)">
          <view class="grid place-items-center shrink-0" :style="numberBoxStyle">
            <text>{{ i + 1 }}</text>
          </view>
          <view class="flex-1">
            <text class="block" :style="pendingLabelStyle">{{ titleOf(q) }}</text>
            <text class="block" :style="categoryLabelStyle">{{ categoryOf(q) }}</text>
          </view>
          <view class="flex items-baseline" style="gap: var(--v5-space-1)">
            <!-- 目标业务停摆时不给可赚取数字:它与「不可完成」同屏是自相矛盾的。 -->
            <text v-if="targetClosed(q)" :style="pendingPausedStyle">{{ t.questClaim.definitionInactive }}</text>
            <text v-else :style="pendingRewardStyle">+{{ formatAmount(rewardOf(q)) }} UVT</text>
          </view>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: -2px; flex-shrink: 0"><path d="m9 6 6 6-6 6" /></svg>
        </view>
      </view>
      <view v-if="tier2Quests.length === 0" class="px-4 py-3" :style="pendingLabelStyle">
        {{ w.empty }}
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { isLiteQuest } from "@/lib/lite-scope";
import { remoteApiEnabled } from "@/api/runtime";
import { useApp } from "@/store/app";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import NxButton from "@/components/ui/nx-button.vue";
import { useDataVisibility } from "@/store/data-visibility";
import { formatAmount } from "@/lib/amount-display";
import { computed, onMounted, ref, type CSSProperties } from "vue";
import { onHide, onShow } from "@/composables/use-tab-page-lifecycle";
import type { CanonicalQuest } from "@/api/quest-api";
import { useWeeklyQuest } from "@/store/weekly-quest";
import { useConfig } from "@/store/config";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { fmt } from "@/i18n/format";
import { isStakingVisibilityRoute, navTo } from "@/lib/route";
import { useNow } from "@/composables/use-now";
import { toast } from "@/store/ui";
import { bindPageVisibilityRefresh, createPageVisibilityRefresh } from "@/lib/page-visibility-refresh";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";
import { genesisBlockIsKnownUnavailable } from "@/store/genesis-config";
import { questTargetBusiness, unclaimableBusinessQuests, type QuestTargetAvailability } from "@/lib/quest-business-availability";
import { useQuestTargetAvailability } from "@/composables/use-quest-target-availability";
import { weeklyQuestDisplayName } from "@/lib/quest-presentation";

const visibility = useDataVisibility();
const t = useT();
const stakingDisplay = useConfig();
const locale = useLocaleStore();
const w = computed(() => t.value.weeklyQuest);
const wq = useWeeklyQuest();
const weeklyReadFailed = ref(false);
async function refreshWeekly() {
  const epoch = useApp().accountBindingEpoch;
  weeklyReadFailed.value = false;
  const ready = await wq.refresh();
  if (epoch !== useApp().accountBindingEpoch) return;
  weeklyReadFailed.value = !ready && !!wq.error && !wq.claimErrorQuestCode;
  mounted.value = true;
}
useAutoRecovery({ failed: () => remoteApiEnabled && weeklyReadFailed.value && !wq.loading && !wq.claimErrorQuestCode, retry: refreshWeekly });
const mounted = ref(false);
const nowTick = useNow();

const weeklyQuestVisibility = createPageVisibilityRefresh(() => {
  void refreshWeekly();
});
bindPageVisibilityRefresh(weeklyQuestVisibility, {
  mounted: (callback) => onMounted(callback),
  shown: (callback) => onShow(callback),
  hidden: (callback) => onHide(callback),
});

const tier2Quests = computed<CanonicalQuest[]>(() => mounted.value
  ? wq.tier2Quests.filter((q) => isLiteQuest(q) && (stakingDisplay.isEnabled("stakingVisible") || !isStakingVisibilityRoute(q.actionRoute))) : []);

const mult = computed(() => wq.multiplier);
const completedCount = computed(() => tier2Quests.value.filter((q) =>
  ["COMPLETED", "CLAIMABLE", "CLAIMED"].includes(q.status)).length);
const progressText = computed(() => fmt(t.value.quest.progress, {
  done: visibility.mask(completedCount.value),
  total: visibility.mask(tier2Quests.value.length),
}));
const progressParts = computed(() => fmt(t.value.quest.progress, {done:'|', total:visibility.mask(tier2Quests.value.length)}).split('|'));
const periodText = computed(() => {
  const remainingMs = Date.parse(tier2Quests.value[0]?.eligibleUntil ?? "") - nowTick.value * 1000;
  if (!Number.isFinite(remainingMs)) return '';
  if (remainingMs <= 0) return w.value.periodEnded;
  if (remainingMs > 86_400_000) return fmt(w.value.periodDays, { n: Math.ceil(remainingMs / 86_400_000) });
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return fmt(w.value.periodEndsIn, { time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` });
});
const claimErrorText = computed(() => wq.error === "WEEKLY_QUEST_CLAIM_OUTCOME_UNKNOWN"
  ? w.value.claimOutcomeUnknown : w.value.claimFailed);

function isClaimed(q: CanonicalQuest): boolean {
  return q.status === "CLAIMED";
}
function isCompleted(q: CanonicalQuest): boolean {
  return !isExpired(q) && ["COMPLETED", "CLAIMABLE"].includes(q.status);
}
function isExpired(q: CanonicalQuest): boolean {
  return Date.parse(q.eligibleUntil) <= nowTick.value * 1000;
}
function rewardOf(q: CanonicalQuest): number {
  return Math.round(q.rewardNex * mult.value);
}
function titleOf(q: CanonicalQuest): string {
  return weeklyQuestDisplayName(q, locale.code, t.value);
}
function categoryOf(q: CanonicalQuest): string {
  return ({
    wallet: t.value.home.dayOneCatWallet,
    explore: t.value.home.dayOneCatExplore,
    recommend: t.value.home.dayOneCatRecommend,
    identity: t.value.home.dayOneCatIdentity,
    social: t.value.home.dayOneCatSocial,
  })[q.category];
}
function claimTextFor(q: CanonicalQuest): string {
  return fmt(w.value.claim, { n: formatAmount(rewardOf(q)) });
}

/**
 * 这条任务的**目标业务现在整体不可用**吗(BUG 127 / 155)。
 *
 * 🔴 与 hero 用**同一份读数**:`useQuestTargetAvailability` + 创世闸(唯一派生)。
 *   列表在这里独立判一次会与 hero 漂移 —— 同页两处对同一条任务给出两种结论,
 *   正是本缺陷的形态。
 * 🔴 `configUnavailable`(不知道)不算停:Cold start 配置还没到就撤掉 CTA,
 *   用户看到的是任务莫名消失。
 */
const { block: genesisBlock, secondaryBlock: genesisSecondaryBlock } = useGenesisSaleGate();
const targetAvailability = useQuestTargetAvailability();

function targetClosed(q: CanonicalQuest): boolean {
  const domain = questTargetBusiness(q);
  if (domain === null) return false;
  const closed: QuestTargetAvailability = {
    genesisBlocked: domain === "genesis"
      // 二级挂单承接的是他人存量,售罄档仍然可逛 —— 与闸完全同源。
      ? (q.actionRoute.startsWith("/pages/genesis/marketplace")
        ? genesisSecondaryBlock.value !== null
        : genesisBlockIsKnownUnavailable(genesisBlock.value))
      : false,
    stakingClosed: targetAvailability.value.stakingClosed,
    exchangeClosed: targetAvailability.value.exchangeClosed,
  };
  return unclaimableBusinessQuests([{ ...q, status: "PENDING" }], closed).length > 0;
}

/** 过期与「目标业务停摆」都是不可点:一处判据,渲染点只用它。 */
function rowInactive(q: CanonicalQuest): boolean {
  return isExpired(q) || targetClosed(q);
}

function onRowCta(q: CanonicalQuest) {
  if (rowInactive(q)) return;
  navTo(q.actionRoute);
}


async function onClaimRow(q: CanonicalQuest) {
  const claimed = await wq.claim(q);
  if (!claimed && wq.claimNotice) toast.info(t.value.questClaim[wq.claimNotice]);
}

// ── styles ──
// Form-b: filled container, no border — quest rows keep their hairline dividers,
// tinted claim states, and champion bonus row inside.
const cardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)",
  background: "var(--nx-glass-fill)",
  borderRadius: "var(--nx-glass-radius)",
};
const headerStyle: CSSProperties = {};
const tier2LabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "normal",
};
const countStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  letterSpacing: "normal",
};
const claimedRowStyle: CSSProperties = { gap: "12px", opacity: 0.65 };
const checkBoxStyle: CSSProperties = { width: "22px", height: "22px", borderRadius: "var(--v5-radius-full)", background: "var(--v5-success)" };
const claimedLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  color: "var(--v5-ink-4)",
  textDecoration: "line-through",
};
const claimedRewardStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontSize: "12px",
  color: "var(--v5-nex)",
};
const completedRowStyle: CSSProperties = { gap: "12px", minHeight: "60px", background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)" };
const sparkBoxStyle: CSSProperties = { width: "24px", height: "24px", borderRadius: "var(--v5-radius-full)", background: "var(--v5-warning)" };
const claimLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-warning)",
  letterSpacing: "-0.005em",
};
const claimRewardStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontWeight: 500,
  fontSize: "12px",
  color: "var(--v5-nex)",
};
const pendingRowStyle: CSSProperties = { gap: "12px", minHeight: "60px" };
const numberBoxStyle: CSSProperties = {
  width: "24px",
  height: "24px",
  borderRadius: "var(--v5-radius-full)",
  background: "transparent",
  border: "1.5px solid var(--v5-ink-4)",
  color: "var(--v5-ink-3)",
  fontFamily: "var(--font-metric)",
  fontWeight: 500,
  fontSize: "11px",
};
const pendingLabelStyle: CSSProperties = {
  fontWeight: 500,
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  color: "var(--v5-ink)",
};
const periodStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-metric)",
  fontSize: "12px",
  color: "var(--v5-ink-4)",
};
const categoryLabelStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const claimErrorStyle: CSSProperties = { ...categoryLabelStyle, color: "var(--v5-ink)" };
const refreshErrorStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-warning)", borderBottom: "1px solid var(--v5-border)" };
/** 「未开放」标记与奖励数字同槽位:同样是 12px 等宽,但不得像可赚取的金额一样抢眼。 */
const pendingPausedStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontSize: "12px",
  color: "var(--v5-ink-4)",
};
const pendingRewardStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontWeight: 500,
  transform: "translateX(-2px)",
  fontSize: "13px",
  color: "var(--v5-nex)",
};
const pendingUsdtStyle: CSSProperties = {
  fontFamily: "var(--font-metric)",
  fontSize: "12px",
  color: "var(--v5-success)",
};
const bonusRowStyle: CSSProperties = {
  borderTop: "1px solid var(--v5-success-soft)",
  background: "var(--v5-success-soft)",
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

<style scoped>
.weekly-claimable { position: relative; overflow: hidden; }.weekly-claimable::before { content:''; position: absolute; inset:0; background: linear-gradient(105deg,transparent 30%,color-mix(in srgb,var(--v5-brand) 16%,transparent),transparent 70%); transform: translateX(-100%); animation: weekly-sheen 800ms ease-out 200ms both; pointer-events:none; }
@keyframes weekly-sheen { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .weekly-claimable::before { animation:none; display:none; } }

/* Approved growth board geometry and material. */
 .weekly-completed-count { font:600 12px/16px var(--font-metric); color:var(--v5-ink); }
.weekly-claimable::before { background:linear-gradient(105deg,transparent 30%,color-mix(in srgb,var(--v5-warning) 16%,transparent),transparent 70%); }
.weekly-claimable :deep(.nx-button--brand > .nx-button__surface) { --ui-button-ink:var(--v5-ink); }
.weekly-claimable, .weekly-claimable ~ view { min-height:60px; }

 .weekly-claimable, .weekly-pending { min-height:60px; padding-top:8px !important; padding-bottom:8px !important; box-sizing:border-box; }.weekly-claimable :deep(.nx-button__surface) { --ui-button-ink:var(--v5-ink) !important; }
.weekly-quest-row { box-sizing:border-box; min-height:60px; padding-top:7.5px!important; padding-bottom:7.5px!important; border-bottom:var(--ui-weekly-row-border); }
.weekly-list-heading {padding:14px 16px 6px !important;}
</style>
