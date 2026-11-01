<!--
  TechMoneyCard — home hero "Today's earnings" (design system 04.1 首页收益, P-57).
  CROSS-STREAM aggregate: device mining, team commission, and staking accrual.
  (Genesis 已移出每日 USD 聚合——分红延期改造后它是上所后 NEX 排放，见 holder 页。)
  Open layout on the page: an amber floor glow that reaches under the glass
  check-in card, and a flat brand grid behind the amount only.
-->
<template>
  <view class="earn-hero">
    <view class="earn-hero__bg" aria-hidden="true"><view class="earn-hero__glow" /></view>
    <view class="earn-hero__grid" aria-hidden="true" />

    <view class="earn-hero__head">
      <view class="earn-hero__label"><text>{{ t.home.techTodaysEarnings }}</text><DataVisibilityToggle /></view>
      <text class="earn-hero__currency">{{ t.home.techEarningsCurrency }}</text>
    </view>

    <view class="earn-hero__amount" :class="{ 'earn-hero__amount--long': longAmount }">
      <text v-if="visibility.hidden" class="earn-hero__int">{{ visibility.mask(intPart) }}</text>
      <text v-else-if="remoteApiEnabled && remoteToday === null" class="earn-hero__int">—</text>
      <template v-else>
        <text class="earn-hero__cur">$</text>
        <text class="earn-hero__int">{{ intPart }}</text>
        <text class="earn-hero__dec">.{{ cents }}</text>
      </template>
    </view>

    <view class="earnings-feedback" :aria-busy="retrying ? 'true' : 'false'">
      <template v-if="recovering">
        <text class="earnings-feedback__key" role="status">{{ app.homeTruthStatus === 'error' ? t.coreReview.earningsReadFailed : t.home.techEarningsLoading }}</text>
        <view role="button" :tabindex="retrying ? -1 : 0" :aria-disabled="retrying ? 'true' : 'false'" class="earnings-retry" @click="retryEarnings" @keydown.enter.prevent="retryEarnings" @keydown.space.prevent="retryEarnings"><text>{{ t.ui.retry }}</text></view>
      </template>
      <template v-else>
        <text class="earnings-feedback__key">{{ t.home.techTodaysEarnings }}</text>
        <text class="earnings-feedback__value" :class="deltaTone">{{ deltaText }}</text>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatGroupedAmount } from "@/lib/amount-display";
import { computed, ref } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useCommission } from "@/store/commission";
import { useStaking } from "@/store/staking";
import { useTicker } from "@/composables/use-ticker";
import { useCountUp } from "@/composables/use-count-up";
import { remoteApiEnabled } from "@/api/runtime";
import { useDataVisibility } from "@/store/data-visibility";
import DataVisibilityToggle from "@/components/ui/data-visibility-toggle.vue";

const t = useT();
const visibility = useDataVisibility();
const app = useApp();
const retrying = ref(false);
async function retryEarnings() {
  if (retrying.value) return;
  retrying.value = true;
  try { await app.refreshHomeTruth(); } catch { /* The store keeps the read error visible. */ }
  finally { retrying.value = false; }
}
const commission = useCommission();
const staking = useStaking();

// 创世节点不再计入「今日 USD 收益」——分红延期改造后它是上所后 NEX 排放（在 holder 页按
// NEX 展示），非每日 USD 现金，故从首页每日聚合移除（去旧「平台交易量日分红」雷）。
const todayTotal = computed(() => app.earnings.today + commission.todayUSDT() + staking.todayAccruedUSDT());
const remoteToday = computed<number | null>(() => remoteApiEnabled
  ? app.homeTruthStatus === 'error' ? null : app.homeTruth?.earnings.today.usdt ?? null
  : null);
const recovering = computed(() => remoteApiEnabled && (app.homeTruthStatus === 'error' || (retrying.value && !app.homeTruth)));

// Today minus yesterday comes only from the server field; it is never derived from the percentage.
const vsYesterday = computed<number | null>(() => remoteApiEnabled && remoteToday.value !== null
  ? app.homeTruth?.earnings.todayVsYesterdayUsdt ?? null
  : null);
const deltaText = computed(() => {
  if (visibility.hidden) return visibility.mask("");
  const value = vsYesterday.value;
  if (value === null) return "—";
  const [whole, fraction] = Math.abs(value).toFixed(3).split(".");
  return `${value < 0 ? "−" : "+"}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
});
const deltaTone = computed(() => visibility.hidden || vsYesterday.value === null ? "is-none" : vsYesterday.value < 0 ? "is-down" : "is-up");

// Mock-only streaming number. Remote mode shows the exact server snapshot; the only motion is a
// one-time entrance count from 0 to that snapshot (07 首页收益入场), skipped for reduced motion.
const display = useTicker(() => remoteToday.value ?? Math.max(todayTotal.value, 0.06), 0.0009, 1100, !remoteApiEnabled);
const shownToday = useCountUp(remoteToday);

const amountParts = computed(() => formatGroupedAmount(shownToday.value ?? display.value).split("."));
const intPart = computed(() => amountParts.value[0]);
const cents = computed(() => amountParts.value[1]);
// The masked amount keeps the 64px size so it does not reveal the magnitude.
const longAmount = computed(() => !visibility.hidden && intPart.value.replace(/\D/g, "").length >= 4);
</script>

<style scoped>
.earn-hero { position:relative; isolation:isolate; }
/* Amber floor glow: from the amount's lower left down under the glass check-in card, fading out at the bottom. */
.earn-hero__bg { position:absolute; left:-16px; right:-16px; top:-24px; bottom:-84px; z-index:-1; pointer-events:none; overflow:hidden; -webkit-mask-image:linear-gradient(to bottom,#000 70%,transparent); mask-image:linear-gradient(to bottom,#000 70%,transparent); }
.earn-hero__glow { position:absolute; left:-22%; width:100%; bottom:-24px; height:240px; border-radius:50%; background:radial-gradient(closest-side,color-mix(in srgb,var(--v5-warning) 30%,transparent),transparent); filter:blur(12px); animation:earn-glow-in 1200ms cubic-bezier(.16,1,.3,1) both; }
:global([data-theme="light"] .earn-hero__glow) { background:radial-gradient(closest-side,color-mix(in srgb,var(--v5-warning) 22%,transparent),transparent); }
/* Flat 20px brand grid behind the amount only (8px above the 12px label margin, which does not collapse in this flex item). */
.earn-hero__grid { position:absolute; inset:4px -2px -12px; z-index:-1; pointer-events:none; background-image:linear-gradient(to right,color-mix(in oklab,var(--v5-brand) 9%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in oklab,var(--v5-brand) 9%,transparent) 1px,transparent 1px); background-size:20px 20px; -webkit-mask-image:radial-gradient(ellipse 62% 72% at 40% 52%,#000 25%,transparent 72%); mask-image:radial-gradient(ellipse 62% 72% at 40% 52%,#000 25%,transparent 72%); animation:earn-grid-in 900ms ease-out both; }
.earn-hero__head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:12px; height:20px; }
.earn-hero__label { display:flex; align-items:center; gap:2px; min-width:0; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }
.earn-hero__label :deep(.data-visibility-toggle) { margin:-12px -10px; }
.earn-hero__currency { padding:2px 7px; border-radius:4px; background:var(--v5-tech-cyan-soft); color:var(--v5-tech-cyan-ink); font:500 12px/16px var(--font-jet-mono); letter-spacing:.04em; white-space:nowrap; }
.earn-hero__amount { display:flex; align-items:baseline; gap:4px; margin-top:10px; font-family:var(--font-amount); font-weight:600; letter-spacing:-.024em; line-height:1; color:var(--v5-ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
.earn-hero__cur { font-size:24px; font-weight:500; color:var(--v5-ink-3); }
.earn-hero__int { font-size:64px; }
.earn-hero__dec { font-size:40px; color:var(--v5-ink-3); }
.earnings-feedback { display:flex; align-items:center; gap:8px; margin-top:16px; min-height:20px; animation:earn-rise 520ms 200ms cubic-bezier(.2,.8,.2,1) both; }
.earnings-feedback__key { min-width:0; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }
.earnings-feedback__value { font:500 16px/20px var(--font-jet-mono); font-variant-numeric:tabular-nums; white-space:nowrap; }
.earnings-feedback__value.is-up { color:var(--v5-success-ink); }
.earnings-feedback__value.is-down { color:var(--v5-danger); }
.earnings-feedback__value.is-none { color:var(--v5-ink-3); }
.earnings-retry { flex-shrink:0; display:inline-flex; align-items:center; min-height:44px; margin:-12px 0 -12px auto; padding:0 4px; font:500 13px/18px var(--font-v5); color:var(--v5-brand); cursor:pointer; }
@keyframes earn-glow-in { from { opacity:0; transform:translateY(60px) scale(.8); } }
@keyframes earn-grid-in { from { opacity:0; } }
@keyframes earn-rise { from { opacity:0; transform:translateY(8px); } }
@media (max-width:339px) {
  .earn-hero__cur { font-size:20px; }
  .earn-hero__int { font-size:52px; }
  .earn-hero__dec { font-size:32px; }
}
.earn-hero__amount--long .earn-hero__int { font-size:48px; }
.earn-hero__amount--long .earn-hero__dec { font-size:30px; }
@media (prefers-reduced-motion:reduce) {
  .earn-hero__glow, .earn-hero__grid, .earnings-feedback { animation:none; }
}
</style>
