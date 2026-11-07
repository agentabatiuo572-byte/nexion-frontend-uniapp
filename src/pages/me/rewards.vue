<!--
  My Rewards L1 (我的奖励 · 类别汇总) — me sub-page. OKX-rewards-hub-style
  stat cards (owner-directed 2026-07-09): hero benefit line, then one big
  surface card per category — category name, LARGE value (vouchers = available
  count; USDT/NEX = reward totals), one-line purpose description, and a
  round arrow affordance. Whole card taps into the L2 records page
  /me/rewards/list?cat=… (pages/me/rewards-list).

  Opening this page writes the rewards-seen watermark (clears the reward half
  of the Me-entry unread dot; the voucher half stays until used/expired).

  Voucher counts come from the voucher store. Remote reward totals come from
  GET /api/app/wallet/bills/summary; only mock mode sums local reward bills.
  All-zero keeps the three cards (big zeros) + hint line.
  Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink); padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" :title="t.rewards.title" />

      <text class="block" :style="heroStyle">{{ t.rewards.heroTitle }}</text>

      <view v-if="summaryFailed" class="flex items-center justify-between" :style="summaryErrorStyle">
        <text>{{ t.walletV3.submitReasonServiceUnavailable }}</text>
        <view class="shrink-0 active:opacity-70 nx-card-recovery-action nx-card-recovery-action--quiet nx-card-recovery-action--inline" role="button" tabindex="0" @click="refreshRewardSummary"><text>{{ t.store.catalogRetry }}</text></view>
      </view>

      <view class="reward-grid">
        <view v-for="c in displayCats" :key="c.key" class="reward-tile" :class="[`reward-tile--${c.key}`, {'nx-frosted-button': c.key === 'usdt'}]" role="button" tabindex="0" :aria-label="c.label" @click="openCat(c.key)">
          <view v-if="c.key === 'promotion'" class="reward-gift" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H7.5a2.5 2.5 0 1 1 2.4-3.2L12 8Zm0 0h4.5a2.5 2.5 0 1 0-2.4-3.2L12 8Z" /></svg></view>
          <view class="reward-tile__body">
            <text class="reward-tile__title">{{ c.label }}</text>
            <view v-if="c.big" class="reward-tile__amount"><text class="reward-value"><template v-if="c.key === 'usdt' && c.big.startsWith('$')"><text class="amount-cur">$</text>{{ c.big.slice(1).split('.')[0] }}<text class="amount-dec">{{ c.big.includes('.') ? '.' + c.big.split('.')[1] : '' }}</text></template><template v-else>{{ c.big }}</template></text><text class="reward-tile__unit" :class="{'reward-voucher-unit': c.key === 'voucher'}">{{ c.unit }}</text></view>
            <view v-if="c.key === 'voucher'" class="reward-perf" aria-hidden="true" />
            <text class="reward-tile__desc">{{ c.desc }}</text>
          </view>
          <view v-if="c.key === 'usdt' || c.key === 'promotion'" class="reward-arrow" :class="{'nx-frosted-button': c.key === 'usdt'}" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path v-if="c.key === 'usdt'" d="M5 12h14M13 6l6 6-6 6" /><path v-else d="m9 5 7 7-7 7" /></svg></view>
        </view>
      </view>

      <!-- All-zero guidance — cards stay rendered (stable IA), hint explains where rewards come from. -->
      <text v-if="allZero" class="block" :style="hintStyle">{{ t.rewards.emptyHint }}</text>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { formatAmount } from "@/lib/amount-display";
import { computed, onMounted, onUnmounted, ref, watch, type CSSProperties } from "vue";
import { onShow, onHide } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useVoucher } from "@/store/voucher";
import { useBills, isRewardBill } from "@/store/bills";
import { useRewardsSeen } from "@/store/rewards-seen";
import { useApp } from "@/store/app";
import { navTo } from "@/lib/route";
import { fundsServerEnabled, remoteApiEnabled } from "@/api/runtime";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import type { RewardsCat } from "./course-reward-link";

const t = useT();
const voucher = useVoucher();
const bills = useBills();
const rewardsSeen = useRewardsSeen();
const app = useApp();
let rewardViewActive = true;
let rewardViewRequest = 0;
function invalidateRewardView() { rewardViewActive = false; rewardViewRequest++; }
onHide(invalidateRewardView);
onUnmounted(invalidateRewardView);

async function refreshRewardSummary() {
  const accountKey = app.accountKey;
  const accountScope = remoteAccountScope.snapshot();
  const request = ++rewardViewRequest;
  if (remoteApiEnabled) void voucher.refreshRemote();
  if (!fundsServerEnabled) {
    rewardsSeen.markSeen();
    return;
  }
  try { await bills.refreshSummary(); } catch { return; /* failed or superseded reads never acknowledge a later summary */ }
  if (rewardViewActive && request === rewardViewRequest && remoteAccountScope.isCurrent(accountScope)
      && accountKey === app.accountKey && bills.summaryStatus === "ready") rewardsSeen.markSeen();
}
onShow(() => { rewardViewActive = true; void refreshRewardSummary(); });

const voucherReady = computed(() => !remoteApiEnabled || voucher.remoteStatus === "ready");
const remoteAvailableCount = computed<number | null>(() => voucherReady.value ? voucher.claimedUnused.length : null);
const remoteExpiredCount = computed<number | null>(() => voucherReady.value ? voucher.expiredVouchers.length : null);
// Voucher re-reads happen on every return from a detail page. Keep the last
// successful counts so the cards never flash "-" for values already known.
const lastAvailableCount = ref<number | null>(null);
const lastExpiredCount = ref<number | null>(null);
watch(remoteAvailableCount, (value) => { if (value !== null) lastAvailableCount.value = value; }, { immediate: true });
watch(remoteExpiredCount, (value) => { if (value !== null) lastExpiredCount.value = value; }, { immediate: true });
const availableCount = computed(() => remoteAvailableCount.value ?? lastAvailableCount.value);
const expiredCount = computed(() => remoteExpiredCount.value ?? lastExpiredCount.value);

// Reward totals per symbol — same reward-family predicate as the dot and
// the L2 records (bills.ts isRewardBill, single source).
function creditedTotal(symbol: "USDT" | "UVT"): number {
  return bills.bills.reduce((sum, b) => (isRewardBill(b) && b.symbol === symbol ? sum + b.amount : sum), 0);
}
const usdtTotal = computed(() => creditedTotal("USDT"));
const nexTotal = computed(() => creditedTotal("UVT"));
const summaryReady = computed(() => !fundsServerEnabled || bills.summaryStatus === "ready");
const summaryFailed = computed(() => (fundsServerEnabled && bills.summaryStatus === "error")
  || (remoteApiEnabled && voucher.remoteStatus === "error"));
const remoteUsdtTotal = computed<number | null>(() => summaryReady.value ? bills.summary?.rewardsUsdt ?? null : null);
const remoteNexTotal = computed<number | null>(() => summaryReady.value ? bills.summary?.rewardsNex ?? null : null);
// A background refresh (this page re-shows on every return from a detail page)
// must not blank out totals the user already saw. The store drops its snapshot
// to null only on a failed read, so keep the last successful figures while a
// re-read is in flight, and surface the failure through summaryFailed instead of
// replacing known values with "-".
const lastUsdtTotal = ref<number | null>(null);
const lastNexTotal = ref<number | null>(null);
watch(remoteUsdtTotal, (value) => { if (value !== null) lastUsdtTotal.value = value; }, { immediate: true });
watch(remoteNexTotal, (value) => { if (value !== null) lastNexTotal.value = value; }, { immediate: true });
const displayUsdtTotal = computed(() =>
  fundsServerEnabled ? (remoteUsdtTotal.value ?? lastUsdtTotal.value) : usdtTotal.value,
);
const displayNexTotal = computed(() =>
  fundsServerEnabled ? (remoteNexTotal.value ?? lastNexTotal.value) : nexTotal.value,
);

const allZero = computed(
  () => summaryReady.value && voucherReady.value && availableCount.value === 0 && expiredCount.value === 0 && displayUsdtTotal.value === 0 && displayNexTotal.value === 0,
);

interface CatCard {
  key: RewardsCat;
  label: string;
  big: string;
  unit: string;
  desc: string;
}

const cats = computed<CatCard[]>(() => [
  {
    key: "voucher",
    label: t.value.rewards.catVouchers,
    big: availableCount.value === null ? "—" : String(availableCount.value),
    unit: t.value.rewards.unitVouchers,
    // Expired stock replaces the purpose line — the more actionable fact.
    desc: expiredCount.value !== null && expiredCount.value > 0 ? fmt(t.value.rewards.expiredCount, { n: expiredCount.value }) : t.value.rewards.catVouchersDesc,
  },
  {
    key: "usdt",
    label: t.value.rewards.catUsdt,
    big: displayUsdtTotal.value === null ? "—" : `$${formatAmount(displayUsdtTotal.value)}`,
    unit: "USDT",
    desc: t.value.rewards.catUsdtDesc,
  },
  {
    key: "uvt",
    label: t.value.rewards.catNex,
    big: displayNexTotal.value === null ? "—" : formatAmount(displayNexTotal.value),
    unit: "UVT",
    desc: t.value.rewards.catNexDesc,
  },
  {
    key: "promotion",
    label: t.value.promotion.rewardCategory,
    big: "",
    unit: "",
    desc: t.value.promotion.rewardCategoryDesc,
  },
]);

function openCat(cat: RewardsCat) {
  navTo(`/me/rewards/list?cat=${cat}`);
}

const animatedUsdt = ref<number | null>(null);
const animatedUvt = ref<number | null>(null);
let rewardFrame = 0;
let animateRewardsMounted = false;
let animatedRewardScope = '';
function animateRewardAmounts() {
  if (!animateRewardsMounted || displayUsdtTotal.value === null || displayNexTotal.value === null) return;
  const scope = `${app.accountKey}:${app.accountBindingEpoch}`;
  if (animatedRewardScope === scope) return;
  animatedRewardScope = scope;
  if (typeof requestAnimationFrame === 'undefined' || typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const usdt = displayUsdtTotal.value, uvt = displayNexTotal.value;
  const started = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - started) / 900), eased = 1 - Math.pow(1 - p, 3);
    animatedUsdt.value = usdt * eased; animatedUvt.value = uvt * eased;
    if (p < 1) rewardFrame = requestAnimationFrame(step);
    else { animatedUsdt.value = null; animatedUvt.value = null; }
  };
  rewardFrame = requestAnimationFrame(step);
}
onMounted(() => { animateRewardsMounted = true; animateRewardAmounts(); });
watch([displayUsdtTotal, displayNexTotal], animateRewardAmounts);
function stopRewardAnimation() {
  if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rewardFrame);
  animatedUsdt.value = null; animatedUvt.value = null;
}
onHide(stopRewardAnimation);
onUnmounted(stopRewardAnimation);
watch(() => [app.accountKey, app.accountBindingEpoch], stopRewardAnimation, {flush: 'sync'});
const displayCats = computed(() => ['usdt', 'uvt', 'voucher', 'promotion'].map(key => {
  const card = cats.value.find(c => c.key === key)!;
  return {...card, big: key === 'usdt' && animatedUsdt.value !== null ? `$${formatAmount(animatedUsdt.value)}`
    : key === 'uvt' && animatedUvt.value !== null ? formatAmount(animatedUvt.value) : card.big};
}));


// Preserve known figures only within one account binding. A new binding must
// wait for its own voucher/summary reads instead of showing the former account.
watch(() => [app.accountKey, app.accountBindingEpoch], () => {
  rewardViewRequest++;
  lastAvailableCount.value = null;
  lastExpiredCount.value = null;
  lastUsdtTotal.value = null;
  lastNexTotal.value = null;
}, { flush: "sync" });

// ── styles ── (stat-card identity — filled surface, no border, big value as
// the visual hero; round ink circle = the rest-state affordance, OKX idiom)
const heroStyle: CSSProperties = {
  margin: "4px 20px 16px",
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  lineHeight: "28px",
  color: "var(--v5-ink)",
};
const cardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)",
  margin: "0 16px 12px",
  padding: "16px",
  gap: "12px",
  background: "var(--nx-glass-fill)",
  borderRadius: "var(--nx-glass-radius)",
};
const catTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 550,
  color: "var(--v5-ink)",
};
const bigNumStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "34px",
  fontWeight: 600,
  lineHeight: 1.1,
  letterSpacing: "-0.02em",
  color: "var(--v5-ink)",
};
const unitStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-list-subtitle)",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const descStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  textWrap: "pretty",
} as CSSProperties;
// Inverted ink circle — theme-safe high-contrast affordance (bg token flips
// with the theme, so dark = light circle / light = dark circle, OKX-style).
const circleStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  borderRadius: "var(--v5-radius-full)",
  background: "var(--v5-ink)",
};
const hintStyle: CSSProperties = {
  margin: "8px 24px 0",
  textAlign: "center",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.6,
};
const summaryErrorStyle: CSSProperties = { margin: "0 16px 12px", padding: "10px 12px", borderRadius: "var(--v5-radius-s)", background: "color-mix(in srgb, var(--v5-danger) 10%, transparent)", color: "var(--v5-danger)", fontSize: "12px", gap: "12px" };


</script>

<style scoped>
.reward-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: var(--v5-space-3); margin: 0 16px; }
.reward-tile { position: relative; padding: var(--v5-space-4); border-radius: var(--ui-radius-surface); color: var(--v5-ink); cursor: pointer; animation: reward-enter 480ms cubic-bezier(.16,1,.3,1) both; }
.reward-tile:not(.nx-frosted-button) { background: var(--v5-surface); }
.reward-tile:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
.reward-tile__title { display: block; font: 500 15px/22px var(--font-v5); }
.reward-tile__amount { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-top: var(--v5-space-2); font: 500 28px/34px var(--font-amount); letter-spacing: -.02em; }
.reward-tile__unit { font: 500 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.reward-tile__desc { display: block; margin-top: 6px; font: 400 12px/18px var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.reward-tile--usdt { grid-column: 1 / -1; padding: 18px; }
.reward-tile--usdt .reward-tile__amount { font-size: 40px; line-height: 48px; margin-top: 6px; padding-right: 28px; }
.reward-tile--usdt .reward-tile__desc { font-size: 13px; line-height: 20px; }
.reward-arrow { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 50%; }
.reward-tile--usdt .reward-arrow { position: absolute; top: 14px; right: 14px; background: color-mix(in srgb,var(--v5-ink) 7%,transparent); box-shadow: var(--ui-glass-edge-shadow); }
.reward-tile--uvt, .reward-tile--voucher { min-height: 168px; box-sizing: border-box; animation-delay: 70ms; }
.reward-tile--uvt { box-shadow: inset 0 1px 0 var(--v5-nex); }.reward-tile--uvt .reward-tile__amount, .reward-tile--uvt .reward-tile__unit { color: var(--v5-nex); }
.reward-tile--voucher::before, .reward-tile--voucher::after { content: ''; position: absolute; top: 50%; width: 20px; height: 20px; border-radius: 50%; background: var(--v5-bg); transform: translateY(-50%); left: -10px; }.reward-tile--voucher::after { left: auto; right: -10px; }
.reward-tile--voucher .reward-tile__amount { font: 500 32px/38px var(--font-metric); }
.reward-perf { margin: var(--v5-space-3) -4px 10px; border-top: 1.5px dashed var(--v5-border-strong); }
.reward-tile--promotion { grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; animation-delay: 140ms; }.reward-tile__body { flex: 1; min-width: 0; }
.reward-gift { display: grid; place-items: center; flex: none; width: 56px; height: 56px; border-radius: 18px; color: var(--v5-nex); background: color-mix(in srgb,var(--v5-nex) 18%,transparent); }
@keyframes reward-enter { from { transform: translateY(12px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .reward-tile { animation: none; } }

/* Approved growth board geometry and material. */
 .amount-cur { font-size:.55em; color:var(--v5-ink-3); margin-right:2px; letter-spacing:0; }.amount-dec { color:var(--v5-ink-3); }
.reward-tile { box-shadow:var(--v5-glass-shadow); }
.reward-tile--usdt { box-shadow:var(--ui-glass-edge-shadow); padding:18px; }
.reward-tile--usdt .reward-arrow { box-shadow:var(--ui-glass-edge-shadow); background:linear-gradient(145deg,var(--ui-button-sheen),transparent 38%,transparent 66%,var(--ui-button-sheen)),color-mix(in srgb,var(--v5-ink) 7%,transparent); }
.reward-tile--uvt { box-shadow:var(--v5-glass-shadow); }
.reward-tile--uvt::before { content:''; position:absolute; inset:0; border-radius:inherit; padding:1.5px; background:conic-gradient(from 210deg,transparent 0 45%,color-mix(in srgb,var(--v5-warning) 85%,transparent) 70%,transparent 92%); -webkit-mask:linear-gradient(var(--v5-ink) 0 0) content-box,linear-gradient(var(--v5-ink) 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; }
.reward-tile--voucher .reward-tile__amount { font-family:var(--font-amount); }
.reward-tile--promotion .reward-arrow { color:var(--v5-ink-4); }.reward-tile--promotion .reward-arrow svg { width:16px; height:16px; }
.reward-tile--usdt .reward-tile__amount { margin-top:6px; }.reward-tile--usdt .reward-tile__desc { margin-top:4px; }


:global([data-theme="light"] .reward-tile--usdt) {box-shadow:var(--ui-glass-edge-shadow),var(--v5-glass-shadow);}
.reward-tile--uvt .reward-tile__amount,.reward-tile--uvt .reward-tile__unit {color:var(--v5-nex-ink);}

.reward-tile__amount { font-variant-numeric:tabular-nums; }
.reward-tile__unit { letter-spacing:0; }

.reward-tile--usdt .reward-arrow { isolation:isolate; background:color-mix(in srgb,var(--v5-ink) 7%,transparent); }
.reward-tile--usdt .reward-arrow::before { content:""; position:absolute; inset:0; border-radius:inherit; z-index:-1; background:var(--v5-surface); opacity:.3; }

.reward-tile--promotion .reward-tile__desc { font-size:13px; line-height:20px; margin-top:1px; }
.reward-tile--promotion .reward-arrow { margin-right:-8px; }
.reward-voucher-unit { font-weight:400; }
:global([data-theme="light"] .reward-tile--usdt .reward-arrow) { background:color-mix(in srgb,var(--v5-ink) 8.5%,var(--v5-surface)); }
:global([data-theme="light"] .reward-tile--usdt .reward-arrow::before) { opacity:0; }

</style>
