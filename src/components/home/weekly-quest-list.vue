<!-- Weekly Tier 2 is server-authoritative; pending rows use PC-configured routes. -->
<template>
  <view v-if="mounted && wq.error" class="mx-4 mt-3 px-4 py-3 active:opacity-70" :style="cardStyle" role="button" tabindex="0" @click="retry">
    <text :style="pendingLabelStyle">{{ w.loadError }}</text>
  </view>
  <view v-else-if="mounted && !wq.snapshot" class="mx-4 mt-3 px-4 py-3" :style="cardStyle">
    <text :style="pendingLabelStyle">{{ w.loading }}</text>
  </view>
  <view v-else-if="mounted" class="mx-4 mt-3 overflow-hidden" :style="cardStyle">
    <!-- Header -->
    <view class="px-4 py-3 flex items-center justify-between" :style="headerStyle">
      <text :style="tier2LabelStyle">{{ w.tier2Label }}</text>
      <view style="text-align: right">
        <text class="block tabular-nums" :style="countStyle">{{ completedCount }} / {{ tier2Quests.length }}</text>
        <text v-if="tier2Quests[0]" class="block tabular-nums" :style="periodStyle">{{ periodText }}</text>
      </view>
    </view>

    <!-- Quest rows -->
    <view>
      <view v-for="(q, i) in tier2Quests" :key="`${q.questCode}:${q.instanceKey}`" :style="{ borderBottom: i === tier2Quests.length - 1 ? 'none' : '1px solid var(--v5-border)' }">
        <!-- claimed: struck-through done -->
        <view v-if="isClaimed(q)" class="flex items-center px-4 py-3" :style="claimedRowStyle">
          <view class="grid place-items-center shrink-0" :style="checkBoxStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </view>
          <view class="flex-1">
            <text class="block" :style="claimedLabelStyle">{{ titleOf(q) }}</text>
            <text class="block" :style="categoryLabelStyle">{{ categoryOf(q) }}</text>
          </view>
          <text :style="claimedRewardStyle">+{{ rewardOf(q) }} NEX</text>
        </view>

        <!-- completed: claimable button -->
        <view v-else-if="isCompleted(q)" class="flex items-center px-4 py-3 active:opacity-80" role="button" tabindex="0" :style="completedRowStyle" @click="onClaimRow(q)">
          <view class="grid place-items-center shrink-0" :style="sparkBoxStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          </view>
          <view class="flex-1">
            <text class="block" :style="claimLabelStyle">{{ claimTextFor(q) }}</text>
            <text class="block" :style="categoryLabelStyle">{{ categoryOf(q) }}</text>
          </view>
          <text :style="claimRewardStyle">+{{ rewardOf(q) }} NEX</text>
        </view>

        <!-- pending: navigate to target route -->
        <view v-else class="flex items-center px-4 py-3" :class="isExpired(q) ? 'opacity-50' : 'active:opacity-80'" :role="isExpired(q) ? undefined : 'button'" :tabindex="isExpired(q) ? -1 : 0" :aria-disabled="isExpired(q)" :style="pendingRowStyle" @click="onRowCta(q)">
          <view class="grid place-items-center shrink-0" :style="numberBoxStyle">
            <text>{{ i + 1 }}</text>
          </view>
          <view class="flex-1">
            <text class="block" :style="pendingLabelStyle">{{ titleOf(q) }}</text>
            <text class="block" :style="categoryLabelStyle">{{ categoryOf(q) }}</text>
          </view>
          <view class="flex items-baseline" style="gap: 4px">
            <text :style="pendingRewardStyle">+{{ rewardOf(q) }} NEX</text>
          </view>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px; flex-shrink: 0"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>
      <view v-if="tier2Quests.length === 0" class="px-4 py-3" :style="pendingLabelStyle" @click="retry">
        {{ w.empty }}
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type CSSProperties } from "vue";
import type { CanonicalQuest } from "@/api/quest-api";
import { useWeeklyQuest } from "@/store/weekly-quest";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
import { useNow } from "@/composables/use-now";

const t = useT();
const w = computed(() => t.value.weeklyQuest);
const wq = useWeeklyQuest();
const mounted = ref(false);
const nowTick = useNow();

onMounted(async () => {
  await wq.refresh();
  mounted.value = true;
});

const tier2Quests = computed<CanonicalQuest[]>(() => mounted.value ? wq.tier2Quests : []);

const mult = computed(() => wq.multiplier);
const completedCount = computed(() => tier2Quests.value.filter((q) => q.status === "CLAIMED").length);
const periodText = computed(() => {
  const remainingMs = Date.parse(tier2Quests.value[0]?.eligibleUntil ?? "") - nowTick.value * 1000;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return fmt(w.value.periodEndsIn, { time: "00:00:00" });
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return fmt(w.value.periodEndsIn, { time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` });
});

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
  return q.name;
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
  return fmt(w.value.claim, { n: rewardOf(q).toLocaleString() });
}

function onRowCta(q: CanonicalQuest) {
  if (isExpired(q)) return;
  navTo(q.actionRoute);
}

function retry() {
  void wq.refresh();
}

function onClaimRow(q: CanonicalQuest) {
  void wq.claim(q);
}

// ── styles ──
// Form-b: filled container, no border — quest rows keep their hairline dividers,
// tinted claim states, and champion bonus row inside.
const cardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderRadius: "16px",
};
const headerStyle: CSSProperties = { borderBottom: "1px solid var(--v5-border)" };
const tier2LabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const countStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-2)",
};
const claimedRowStyle: CSSProperties = { gap: "12px", opacity: 0.65 };
const checkBoxStyle: CSSProperties = { width: "22px", height: "22px", borderRadius: "999px", background: "var(--v5-success)" };
const claimedLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  color: "var(--v5-ink-4)",
  textDecoration: "line-through",
};
const claimedRewardStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-nex)",
};
const completedRowStyle: CSSProperties = { gap: "12px", minHeight: "48px", background: "var(--v5-warning-soft)" };
const sparkBoxStyle: CSSProperties = { width: "22px", height: "22px", borderRadius: "999px", background: "var(--v5-warning)" };
const claimLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-warning)",
  letterSpacing: "-0.005em",
};
const claimRewardStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontWeight: 500,
  fontSize: "12px",
  color: "var(--v5-nex)",
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
  fontSize: "12px",
};
const pendingLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  color: "var(--v5-ink)",
};
const periodStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
const categoryLabelStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-v5)",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
const pendingRewardStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontWeight: 500,
  fontSize: "12px",
  color: "var(--v5-nex)",
};
const pendingUsdtStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
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
