<!-- ConversionBanner — homepage weekly task card. -->
<template>
  <view
    class="weekly-quest block active:scale-[0.98] active:opacity-90 transition-transform"
    :style="rootStyle"
    role="button"
    :tabindex="props.active ? 0 : -1"
    :aria-hidden="!props.active"
    :data-copy-source="managedCopy.status[MANAGED_POSITION] ?? 'fallback'"
    :data-copy-key="managedCopy.deliveries[MANAGED_POSITION]?.copyKey ?? 'builtin'"
    :data-copy-version="managedCopy.deliveries[MANAGED_POSITION]?.version ?? 'builtin'"
    :data-experiment-id="managedCopy.deliveries[MANAGED_POSITION]?.experimentId ?? ''"
    :data-target-device="weeklyCard.targetDevice ?? ''"
    :data-quest-category="weeklyCard.category ?? ''"
    @click="onCardAction"
    @keydown.enter.prevent="onCardAction"
    @keydown.space.prevent="onCardAction"
  >
    <image
      class="weekly-quest__product"
      src="/static/img/marketing/trial-hero.png"
      mode="aspectFit"
      :style="productStyle"
      aria-hidden="true"
    />

    <view class="weekly-quest__content">
      <view class="weekly-quest__header">
        <view class="weekly-quest__identity">
          <view class="weekly-quest__mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
              <path d="m12 13 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" />
            </svg>
          </view>
          <text class="weekly-quest__title">{{ t.home.weeklyQuestEyebrow }}</text>
          <text v-if="categoryText" class="weekly-quest__category">{{ categoryText }}</text>
          <text class="weekly-quest__multiplier">{{ weeklyState === "ready" && promoMult !== null ? `${promoMult}×` : "—" }}</text>
        </view>
        <view class="weekly-quest__countdown">
          <text class="weekly-quest__countdown-label">{{ t.home.weeklyQuestEndsIn }}</text>
          <text class="weekly-quest__countdown-value">{{ remainingLabel }}</text>
        </view>
      </view>

      <view v-if="weeklyState === 'loading'" class="weekly-quest__state" aria-live="polite">
        <text class="weekly-quest__state-copy">{{ t.weeklyQuest.loading }}</text>
      </view>
      <view v-else-if="weeklyState === 'error'" class="weekly-quest__state" role="alert">
        <text class="weekly-quest__state-copy">{{ t.weeklyQuest.loadError }}</text>
      </view>
      <view v-else-if="weeklyState === 'empty'" class="weekly-quest__state" aria-live="polite">
        <text class="weekly-quest__state-copy">{{ t.weeklyQuest.empty }}</text>
      </view>
      <view v-else class="weekly-quest__body">
        <view class="weekly-quest__reward">
          <text class="weekly-quest__reward-value">+{{ finalRewardText }}</text>
          <text class="weekly-quest__reward-unit">NEX</text>
        </view>
        <text class="weekly-quest__subtitle" :aria-label="subtitleText" :title="subtitleText">{{ subtitleText }}</text>
        <view class="weekly-quest__rate">
          <text class="weekly-quest__rate-value">${{ targetDailyText }}</text>
          <text class="weekly-quest__rate-unit">/d</text>
        </view>
      </view>

      <view class="weekly-quest__cta">
        <text>{{ ctaText }}</text>
        <text class="weekly-quest__cta-arrow" aria-hidden="true">→</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useContentCopy } from "@/store/content-copy";
import { refreshCanonicalOrders } from "@/store/order-canonical";
import { useWeeklyQuest } from "@/store/weekly-quest";
import { presentHomeWeeklyCard, selectHomeWeeklySource } from "@/lib/home-task-carousel";
import { navTo } from "@/lib/route";

const MANAGED_POSITION = "home.conversion-banner";

const props = withDefaults(defineProps<{ active?: boolean }>(), {
  active: true,
});
const t = useT();
const managedCopy = useContentCopy();
const wq = useWeeklyQuest();

onMounted(() => {
  void managedCopy.refresh(MANAGED_POSITION).then(() => {
    if (managedCopy.deliveries[MANAGED_POSITION]?.experimentId) void refreshCanonicalOrders(true);
  });
});

const weeklySource = computed(() => selectHomeWeeklySource(
  [...wq.tier1Quests, ...wq.tier2Quests],
  wq.snapshot?.promoBanner ?? null,
));
const weeklyCard = computed(() => presentHomeWeeklyCard(
  weeklySource.value,
  wq.snapshot?.promoBanner ?? null,
  wq.multiplier,
));
const weeklyState = computed<"loading" | "error" | "empty" | "ready">(() => {
  if (wq.error) return "error";
  if (wq.loading || !wq.snapshot) return "loading";
  return weeklySource.value ? "ready" : "empty";
});
const promoMult = computed<number | null>(() => weeklyCard.value.multiplier);
const finalRewardText = computed(() => {
  const reward = weeklyCard.value.rewardNex;
  return reward === null ? "—" : reward.toLocaleString();
});

const remainingLabel = computed(() => {
  const days = weeklyCard.value.countdownDays;
  const hours = weeklyCard.value.countdownHours;
  if (days === null || hours === null) return "—";
  return `${days}d ${String(hours).padStart(2, "0")}h`;
});

const targetDailyText = computed(() => {
  const value = weeklyCard.value.targetDaily;
  return value == null ? "—" : value.toFixed(2);
});
const subtitleText = computed(() => weeklyCard.value.subtitle || "—");
const categoryText = computed(() => {
  const category = weeklyCard.value.category;
  if (!category) return "";
  return ({
    wallet: t.value.home.dayOneCatWallet,
    explore: t.value.home.dayOneCatExplore,
    recommend: t.value.home.dayOneCatRecommend,
    identity: t.value.home.dayOneCatIdentity,
    social: t.value.home.dayOneCatSocial,
  })[category];
});
const ctaText = computed(() => {
  if (weeklyState.value === "loading") return t.value.weeklyQuest.loading;
  if (weeklyState.value === "error" || weeklyState.value === "empty") return t.value.ui.retry;
  return weeklySource.value?.kind === "quest"
    ? t.value.weeklyQuest.goComplete
    : t.value.home.weeklyQuestGetNexGridBox;
});

const rootStyle: CSSProperties = {
  position: "relative",
  boxSizing: "border-box",
  width: "100%",
  height: "var(--home-task-card-height, 184px)",
  minHeight: "var(--home-task-card-height, 184px)",
  borderRadius: "16px",
  background:
    "radial-gradient(50% 60% at 100% 0%, var(--v5-brand-soft), transparent 70%), var(--v5-surface)",
  overflow: "hidden",
  color: "var(--v5-ink)",
};

const PRODUCT_MASK =
  "radial-gradient(ellipse 200px 250px at 95% 50%, #000 25%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.1) 82%, transparent 100%)";
const productStyle: CSSProperties = {
  position: "absolute",
  top: "-36px",
  right: "-50px",
  width: "220px",
  height: "220px",
  pointerEvents: "none",
  zIndex: 0,
  maskImage: PRODUCT_MASK,
  WebkitMaskImage: PRODUCT_MASK,
};

function onCardAction() {
  if (weeklyState.value !== "ready") {
    if (!wq.loading) void wq.refresh();
    return;
  }

  if (weeklyCard.value.actionRoute) navTo(weeklyCard.value.actionRoute);
}
</script>

<style scoped>
.weekly-quest__content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  height: 100%;
  padding: 14px 16px;
}

.weekly-quest__header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.weekly-quest__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.weekly-quest__mark {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border-radius: 999px;
  background: var(--v5-brand-soft);
}

.weekly-quest__title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
  white-space: nowrap;
}

.weekly-quest__multiplier {
  display: inline-flex;
  height: 22px;
  padding: 0 8px;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--v5-brand);
  background: transparent;
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--v5-brand);
  white-space: nowrap;
}

.weekly-quest__countdown {
  display: flex;
  min-width: 72px;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1;
  white-space: nowrap;
}

.weekly-quest__countdown-label {
  font-family: var(--font-v5);
  font-size: 12px;
  font-weight: 400;
  color: var(--v5-ink-4);
}

.weekly-quest__countdown-value {
  margin-top: 5px;
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-quest-violet-ink);
  font-variant-numeric: tabular-nums;
}

.weekly-quest__body {
  position: relative;
  z-index: 2;
  width: 62%;
  margin-top: 6px;
}

.weekly-quest__category {
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--v5-brand-soft);
  font-family: var(--font-v5);
  font-size: 12px;
  font-weight: 500;
  color: var(--v5-brand);
  white-space: nowrap;
}

.weekly-quest__state {
  position: relative;
  z-index: 2;
  display: flex;
  width: 62%;
  min-height: 74px;
  padding: 12px 0;
  align-items: center;
}

.weekly-quest__state-copy {
  font-family: var(--font-v5);
  font-size: 13px;
  line-height: 1.5;
  color: var(--v5-ink-3);
}

.weekly-quest__reward {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.weekly-quest__reward-value {
  font-family: var(--font-v5);
  font-size: 34px;
  font-weight: 500;
  line-height: 1;
  color: var(--v5-nex);
  letter-spacing: -0.024em;
}

.weekly-quest__reward-unit {
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-nex);
}

.weekly-quest__subtitle {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  font-family: var(--font-v5);
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-ink-3);
  letter-spacing: -0.008em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weekly-quest__rate {
  display: flex;
  align-items: baseline;
  margin-top: 3px;
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.weekly-quest__rate-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--v5-brand);
}

.weekly-quest__rate-unit {
  font-size: 12px;
  color: var(--v5-ink-4);
}

.weekly-quest__cta {
  position: absolute;
  right: 16px;
  bottom: 14px;
  left: 16px;
  display: inline-flex;
  min-height: 44px;
  padding: 0 20px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 999px;
  background: var(--v5-brand-soft);
  font-family: var(--font-v5);
  font-size: 13px;
  font-weight: 500;
  color: color-mix(in srgb, var(--v5-brand) 82%, var(--v5-ink-3));
  letter-spacing: -0.005em;
}

.weekly-quest__cta-arrow {
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-size: 12px;
  color: currentColor;
  opacity: 0.58;
}
</style>
