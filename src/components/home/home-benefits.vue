<!-- Home benefits (P-56). Eligibility, claiming and lifecycle stay owned by the voucher and trial stores. -->
<template>
  <NxSection v-if="offerCount + pendingCount > 0" :title="copy.benefits" class="home-benefits" data-home-section="benefits">
    <view class="hb-stack" :class="{ 'hb-stack--enter': entering }">
      <view v-if="offerCount" class="hb-row" :class="{ 'hb-row--pair': offerCount === 2 }">
        <view v-if="voucherOffer" class="hb-card hb-glow-warn vb-card" :class="offerCount === 2 ? 'hb-half' : 'hb-wv'" :style="{ '--hb-i': 0 }" role="button" tabindex="0" :aria-label="fmt(copy.benefitVoucherAria, { v: offerFace.label })" @click="openVoucher" @keydown.enter.prevent="openVoucher" @keydown.space.prevent="openVoucher">
          <template v-if="offerCount === 2">
            <view class="hb-half__top"><image class="hb-half__art" :src="COUPON_ART" mode="aspectFit" aria-hidden="true" /></view>
            <view class="hb-half__main"><text class="hb-amount hb-half__amount nx-num-amount"><text v-if="offerFace.money" class="hb-amount__minor">$</text>{{ offerFace.text }}</text><text class="hb-half__sub">{{ copy.benefitVoucherSub }}</text></view>
            <view class="hb-perf" aria-hidden="true" />
            <view class="hb-half__foot"><text class="hb-label">{{ copy.benefitVoucherHint }}</text><text class="hb-pill nx-frosted-button">{{ t.trial.homeClaimShort }}</text></view>
          </template>
          <template v-else>
            <image class="hb-wv__art" :src="COUPON_ART" mode="aspectFit" aria-hidden="true" />
            <view class="hb-wv__txt"><text class="hb-label">{{ fmt(copy.benefitVoucherCount, { n: voucherClaimable.length }) }}</text><text class="hb-amount hb-wv__amount nx-num-amount"><text v-if="offerFace.money" class="hb-amount__minor">$</text>{{ offerFace.text }}</text><text class="hb-sub">{{ copy.benefitVoucherWideSub }}</text></view>
            <view class="hb-vperf" aria-hidden="true" />
            <view class="hb-wv__stub"><text class="hb-pill nx-frosted-button">{{ t.trial.homeClaimShort }}</text></view>
          </template>
        </view>
        <view v-if="trialOffer" class="hb-card hb-glow-cyan" :class="offerCount === 2 ? 'hb-half' : 'hb-wt'" :style="{ '--hb-i': voucherOffer ? 1 : 0 }" :data-trial-state="status" role="button" :tabindex="trialOfferEnabled ? 0 : -1" :aria-disabled="trialOfferEnabled ? undefined : 'true'" :aria-label="trialOfferAria" @click="openTrialOffer" @keydown.enter.prevent="openTrialOffer" @keydown.space.prevent="openTrialOffer">
          <template v-if="offerCount === 2">
            <view class="hb-half__top"><image class="hb-half__art" :src="trialArt" mode="aspectFit" aria-hidden="true" /></view>
            <view class="hb-half__main"><text class="hb-amount hb-half__amount nx-num-amount"><text class="hb-amount__minor">{{ estimateParts.currency }}</text>{{ estimateParts.whole }}<text class="hb-amount__dec">{{ estimateParts.cents }}</text></text><text class="hb-half__sub">{{ fmt(copy.benefitTrialSub, { name: trialName }) }}</text></view>
            <view class="hb-rule" aria-hidden="true" />
            <view class="hb-half__foot">
              <text class="hb-label">{{ capacityFull ? copy.benefitSlotsFull : fmt(copy.benefitTrialFree, { n: trialDays }) }}</text>
              <text v-if="capacityFull" class="hb-link">{{ lifecycleCopy.cardManage }} ›</text>
              <text v-else class="hb-pill nx-frosted-button" :class="{ 'hb-pill--muted': !trialOfferEnabled }">{{ trialPill[0] }}</text>
            </view>
          </template>
          <template v-else>
            <image class="hb-wt__art" :src="trialArt" mode="aspectFit" aria-hidden="true" />
            <view class="hb-wt__txt">
              <text class="hb-tag">{{ fmt(copy.benefitTrialFree, { n: trialDays }) }}</text>
              <text class="hb-amount hb-wt__amount nx-num-amount"><text class="hb-amount__minor">{{ estimateParts.currency }}</text>{{ estimateParts.whole }}<text class="hb-amount__dec">{{ estimateParts.cents }}</text></text>
              <text class="hb-sub">{{ fmt(copy.benefitTrialSub, { name: trialName }) }}</text>
              <view class="hb-wt__row">
                <text class="hb-label">{{ capacityFull ? copy.benefitSlotsFull : t.trial.homeNoPayment }}</text>
                <text v-if="capacityFull" class="hb-link">{{ lifecycleCopy.cardManage }} ›</text>
                <text v-else class="hb-pill nx-frosted-button" :class="{ 'hb-pill--muted': !trialOfferEnabled }">{{ trialPill[1] }}</text>
              </view>
            </view>
          </template>
        </view>
      </view>
      <view v-if="pendingCount" class="hb-row" :class="{ 'hb-row--pair': pendingCount === 2 }">
        <view v-if="voucherPending" class="hb-card hb-pend" :class="{ 'hb-pend--wide': pendingCount === 1, 'hb-pop': popVoucher }" :style="{ '--hb-i': offerCount }" role="button" tabindex="0" :aria-label="`${pendingName} · ${copy.benefitVoucherReady} · ${copy.benefitVoucherUse}`" @click="useVoucherNow" @keydown.enter.prevent="useVoucherNow" @keydown.space.prevent="useVoucherNow">
          <view class="hb-icon" aria-hidden="true"><image class="hb-icon__img" :src="COUPON_ART" mode="aspectFit" /></view>
          <view class="hb-pend__text"><text class="hb-pend__title">{{ pendingName }}</text><text class="hb-pend__sub"><text class="hb-warn">{{ copy.benefitVoucherReady }}</text><template v-if="pendingCount === 1">{{ copy.benefitVoucherAuto }}</template></text></view>
          <text v-if="pendingCount === 1" class="hb-act">{{ copy.benefitVoucherUse }} →</text>
          <svg v-else class="hb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
        <view v-if="trialPending" class="hb-card hb-pend" :class="{ 'hb-pend--wide': pendingCount === 1, 'hb-pop': popTrial }" :style="{ '--hb-i': offerCount + (voucherPending ? 1 : 0) }" :data-trial-state="status" role="button" tabindex="0" :aria-label="trialPendingAria" @click="openTrialDetails" @keydown.enter.prevent="openTrialDetails" @keydown.space.prevent="openTrialDetails">
          <view class="hb-icon" :class="{ 'hb-icon--dim': status === 'ended' }" aria-hidden="true"><image class="hb-icon__img" :src="trialArt" mode="aspectFit" /><view v-if="online" class="hb-online home-benefits__online" /></view>
          <view v-if="pendingCount === 2" class="hb-pend__text">
            <text class="hb-pend__title">{{ status === 'active' ? copy.benefitTrialActive : status === 'grace' ? `${lifecycleCopy.cardGraceTitle} ${visibility.mask(creditText.replace(/\.00$/, ''))}` : lifecycleCopy.endedTitle }}</text>
            <text v-if="status !== 'ended'" class="hb-pend__sub"><text class="hb-mono font-mono-tabular">{{ countdownText }}</text></text>
          </view>
          <view v-else class="hb-pend__text">
            <text class="hb-pend__title">{{ trialName }}</text>
            <text class="hb-pend__sub"><template v-if="status === 'ended'">{{ lifecycleCopy.endedTitle }}</template><template v-else>{{ status === 'active' ? copy.benefitTrialLeft : copy.benefitCreditLeft }}<text class="hb-mono font-mono-tabular">{{ countdownText }}</text></template></text>
          </view>
          <text v-if="pendingCount === 1 && status === 'ended'" class="hb-act">{{ lifecycleCopy.buyDevice }} →</text>
          <template v-else>
            <view v-if="pendingCount === 1" class="hb-val"><text>{{ copy.benefitCredit }}</text><text class="hb-val__amount">{{ visibility.mask(creditText) }}</text></view>
            <svg class="hb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </template>
        </view>
      </view>
      <view v-if="trial.authorityStatus === 'error' && (trialOffer || trialPending)" class="hb-retry" role="button" tabindex="0" :aria-label="t.trial.entryRetry" @click="retryEligibility" @keydown.enter.prevent="retryEligibility" @keydown.space.prevent="retryEligibility"><text>{{ t.trial.entryRetry }}</text></view>
    </view>
  </NxSection>
</template>
<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, onUnmounted, ref, watch, watchEffect, type Ref } from "vue";
import NxSection from '@/components/ui/nx-section.vue';
import { useVoucher } from "@/store/voucher";
import { useVoucherClaimSheet } from "@/store/voucher-claim-sheet";
import { useApp } from "@/store/app";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useDataVisibility } from "@/store/data-visibility";
import { useTrialPresentation } from '@/composables/use-trial-presentation';
import { useT } from "@/i18n/use-t";
import { useAuditUiCopy } from '@/i18n/audit-ui';
import { useTrialLifecycleCopy, formatTrialCountdown, formatTrialRemaining } from '@/i18n/trial-lifecycle';
import { fmt, fmtMoney } from '@/i18n/format';
import { formatAmount } from "@/lib/amount-display";
import { getProductMedia } from "@/lib/product-media";
import { voucherBenefitSummary } from '@/lib/voucher-benefit-summary';
import { voucherSupportsSurface } from '@/lib/voucher-sheet-authority';
import { navTo } from '@/lib/route';
import { remoteApiEnabled } from '@/api/runtime';
import type { VoucherDef } from "@/mock/vouchers";

const COUPON_ART = '/static/img/home-glass-20260928/coupon.webp';
const copy = useAuditUiCopy(), t = useT(), lifecycleCopy = useTrialLifecycleCopy();
const voucher = useVoucher(), voucherSheet = useVoucherClaimSheet();
const trial = useFreeTrial(), trialCfg = useTrialConfig(), trialView = useTrialPresentation(), trialSheet = useTrialClaimSheet();
useAutoRecovery({ failed: () => remoteApiEnabled && !trialSheet.open && trial.authorityStatus === "error", retry: () => trialView.refresh() });
const visibility = useDataVisibility();

// Voucher: same remote/local sources as the previous home banner, split into claimable and claimed.
const voucherClaimable = computed(() => (remoteApiEnabled ? voucher.presentationClaimable : voucher.claimableVouchers).filter(row => voucherSupportsSurface(row, 'home')));
const voucherClaimed = computed(() => remoteApiEnabled
  ? voucher.presentationOffers.filter(row => !voucher.presentationClaimable.some(item => item.id === row.id))
  : voucher.claimedUnused);
const voucherOffer = computed(() => voucherClaimable.value.length > 0);
const voucherPending = computed(() => voucherClaimed.value.length > 0);
function faceValue(rows: VoucherDef[]) {
  const summary = voucherBenefitSummary(rows);
  const text = summary.amount != null ? fmtMoney(summary.amount).replace(/^\$/, '').replace(/\.00$/, '') : summary.percent != null ? summary.percent + '%' : '–';
  return { money: summary.amount != null, text, label: (summary.amount != null ? '$' : '') + text };
}
const offerFace = computed(() => faceValue(voucherClaimable.value));
const pendingName = computed(() => fmt(copy.value.benefitVoucherName, { v: faceValue(voucherClaimed.value).label }));

// Trial: offer and lifecycle rules unchanged from the previous home trial card.
const status = computed(() => trialView.status.value);
const hasLifecycle = computed(() => status.value !== null && status.value !== 'none');
const eligibility = computed(() => trial.eligibility());
const capacityFull = computed(() => eligibility.value.reason === 'capacity-full');
// eligibility() fails closed while a background read is in flight, so keep the last
// CONFIRMED restart answer (reset on rebind). The claim sheet re-verifies before starting.
const app = useApp(), confirmedRestart = ref(false);
let restartBinding = '';
watchEffect(() => {
  const binding = `${app.accountKey}:${app.accountBindingEpoch}`;
  if (binding !== restartBinding) { restartBinding = binding; confirmedRestart.value = false; }
  if (!remoteApiEnabled || trial.authorityStatus === 'ready') confirmedRestart.value = status.value === 'ended' && eligibility.value.ok;
});
const canRestart = computed(() => status.value === 'ended' && confirmedRestart.value);
const canClaim = computed(() => trial.status === "none" && trial.authorityStatus !== 'error'
  && (eligibility.value.ok || trial.confirmedOfferState() === "claimable"));
const trialOffer = computed(() => canRestart.value || (!hasLifecycle.value && trial.status === "none"
  && trialCfg.config.seatsLeftToday > 0 && (trial.showHeroPromo() || capacityFull.value)));
const trialPending = computed(() => status.value === 'active' || status.value === 'grace' || (status.value === 'ended' && !canRestart.value));
const trialOfferEnabled = computed(() => canRestart.value || capacityFull.value || canClaim.value);
const trialName = computed(() => trialView.deviceName.value ?? t.value.trial.heroDeviceName);
const trialDays = computed(() => trialView.config.value?.trialDays ?? trialCfg.config.trialDays);
const trialArt = computed(() => getProductMedia(trialView.productId.value)?.src);
const online = computed(() => trialView.presentationReady.value && status.value === 'active');
// Same capped estimate the trial page and checkout quote (BUG 78).
const estimateText = computed(() => trialView.estimatedOffsetUSD.value === null ? '-' : `$${formatAmount(trialView.estimatedOffsetUSD.value)}`);
const estimateParts = computed(() => { const match = /^(\$?)(.*?)(\.\d+)?$/.exec(estimateText.value)!; return { currency: match[1], whole: match[2], cents: match[3] ?? '' }; });
const creditText = computed(() => trialView.offsetUSD.value === null ? '-' : `$${formatAmount(trialView.offsetUSD.value)}`);
const countdownText = computed(() => trialView.remainingMs.value === null ? '-' : formatTrialCountdown(trialView.remainingMs.value));
// Label follows the RETAINED offer state (BUG 14); the click stays gated by canClaim.
const trialPill = computed<[string, string]>(() => {
  if (canRestart.value) return [copy.value.benefitTrialAgain, copy.value.benefitTrialAgain];
  switch (trial.confirmedOfferState()) {
    case "claimable": return [t.value.trial.homeClaimShort, copy.value.benefitTrialClaim];
    case "error": return [t.value.trial.entryUnavailable, t.value.trial.entryUnavailable];
    case "unavailable": { const text = eligibility.value.reason === "product-unavailable" ? t.value.trial.heroProductUnavailable : t.value.store.temporarilyOutOfStock; return [text, text]; }
    default: return [t.value.trial.entryChecking, t.value.trial.entryChecking];
  }
});
const trialOfferAria = computed(() => capacityFull.value ? `${trialName.value} · ${copy.value.benefitSlotsFull} · ${lifecycleCopy.value.manageDevices}`
  : canClaim.value ? fmt(copy.value.benefitTrialAria, { name: trialName.value })
  : `${trialName.value} · ${fmt(copy.value.benefitTrialFree, { n: trialDays.value })} · ${trialPill.value[1]}`);
const trialPendingAria = computed(() => {
  if (status.value === 'ended') return `${trialName.value} · ${lifecycleCopy.value.endedTitle} · ${lifecycleCopy.value.buyDevice}`;
  const remaining = trialView.remainingMs.value === null ? '-' : formatTrialRemaining(trialView.remainingMs.value, lifecycleCopy.value.longRemaining);
  return `${trialName.value} · ${status.value === 'active' ? lifecycleCopy.value.activeTitle : lifecycleCopy.value.graceTitle} · ${status.value === 'active' ? lifecycleCopy.value.remainingLabel : lifecycleCopy.value.creditUntilLabel} ${remaining} · ${copy.value.benefitCredit} ${visibility.mask(creditText.value)} · ${lifecycleCopy.value.viewTrial}`;
});

const offerCount = computed(() => Number(voucherOffer.value) + Number(trialOffer.value));
const pendingCount = computed(() => Number(voucherPending.value) + Number(trialPending.value));

// One entrance per mount; a claimed offer turning into its pending card pops in once.
const entering = ref(false), popVoucher = ref(false), popTrial = ref(false);
let entered = false, enterTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => offerCount.value + pendingCount.value > 0, shown => {
  if (!shown || entered) return;
  entered = true; entering.value = true;
  enterTimer = setTimeout(() => { entering.value = false; }, 900);
}, { immediate: true });
// uni-app wraps view events, so the flag is cleared on a timer instead of animationend.
const popTimers: ReturnType<typeof setTimeout>[] = [];
function pop(flag: Ref<boolean>) { flag.value = true; popTimers.push(setTimeout(() => { flag.value = false; }, 400)); }
// A claim can pass through a brief state with neither card, so remember that the offer was shown.
let voucherOfferSeen = false, trialOfferSeen = false;
watch(voucherPending, (pending, had) => { if (pending && !had && voucherOfferSeen) pop(popVoucher); });
watch(trialPending, (pending, had) => { if (pending && !had && trialOfferSeen) pop(popTrial); });
watch(voucherOffer, offer => { if (offer) voucherOfferSeen = true; }, { immediate: true });
watch(trialOffer, offer => { if (offer) trialOfferSeen = true; }, { immediate: true });
onUnmounted(() => { clearTimeout(enterTimer); popTimers.forEach(timer => clearTimeout(timer)); });

function openVoucher() {
  if ((!remoteApiEnabled || voucher.remoteStatus === 'ready') && voucher.claimableVouchers.some(row => voucherSupportsSurface(row, 'home'))) voucherSheet.show('home');
  else navTo('/pages/me/rewards-list?cat=voucher');
}
function useVoucherNow() { navTo('/pages/store/store'); }
function openTrialOffer() {
  if (canRestart.value) { trialSheet.show(); return; }
  if (capacityFull.value) { navTo('/pages/me/devices'); return; }
  if (canClaim.value) trialSheet.show();
}
function openTrialDetails() { navTo('/pages/me/trial'); }
function retryEligibility() {
  if (trial.authorityStatus === "error") void trialView.refresh();
}
</script>
<style scoped>
.hb-stack { display:flex;flex-direction:column;gap:12px; }
.hb-row { display:grid;grid-template-columns:minmax(0,1fr);gap:12px; }
.hb-row--pair { grid-template-columns:repeat(2,minmax(0,1fr)); }
.hb-card { position:relative;isolation:isolate;box-sizing:border-box;min-width:0;overflow:hidden;border-radius:var(--ui-radius-surface);background:var(--v5-surface);border:1px solid var(--v5-border);box-shadow:var(--v5-glass-shadow);color:var(--v5-ink);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 200ms ease; }
.hb-card:active:not([aria-disabled="true"]) { transform:scale(.97);transition-duration:100ms; }
.hb-card[aria-disabled="true"] { cursor:default; }
.hb-card:focus-visible { outline:2px solid var(--v5-brand);outline-offset:2px; }
.hb-glow-warn { --hb-glow:color-mix(in srgb,var(--v5-warning) 17%,transparent); }
.hb-glow-cyan { --hb-glow:color-mix(in srgb,var(--v5-tech-cyan) 17%,transparent); }
/* Offer cards: liquid-glass soft-edge card, the check-in card's material (04.1 签到); pending cards stay solid.
   The corner glow is a background layer under the sheen, so the sheen, inner rim and highlight paint over it.
   The transparent border keeps the layout and the forced-colors outline; the fill stops inside it so the rim is the outer edge. */
.hb-half,.hb-wv,.hb-wt {
  --hb-fill:rgba(255,255,255,.045);--hb-rim:rgba(255,255,255,.10);--hb-highlight:rgba(255,255,255,.20);
  --hb-bottom:rgba(0,0,0,.40);--hb-sheen:rgba(255,255,255,.06);--hb-shadow:0 12px 32px rgba(0,0,0,.35);
  border-color:transparent;
  background:linear-gradient(145deg,var(--hb-sheen),transparent 40%,transparent 70%,var(--hb-sheen)),radial-gradient(circle 110px at 40px 30px,var(--hb-glow),transparent),var(--hb-fill);
  background-clip:padding-box;
  box-shadow:inset 0 0 0 1px var(--hb-rim),inset 0 7px 10px -7px var(--hb-highlight),inset 3px 0 12px -8px var(--hb-highlight),inset 0 -8px 14px -8px var(--hb-bottom),var(--hb-shadow);
}
[data-theme="light"] .hb-half,[data-theme="light"] .hb-wv,[data-theme="light"] .hb-wt {
  --hb-fill:rgba(255,255,255,.58);--hb-rim:rgba(73,94,125,.12);--hb-highlight:rgba(255,255,255,.95);
  --hb-bottom:rgba(87,115,155,.16);--hb-sheen:rgba(255,255,255,.30);--hb-shadow:0 2px 8px rgba(20,16,8,.05);
}

.hb-amount { display:block;font-weight:500;letter-spacing:-.02em;color:var(--v5-brand);white-space:nowrap; }
.hb-amount__minor { font-size:max(12px,.55em);color:var(--v5-ink-3); }
.hb-amount__dec { color:var(--v5-ink-3); }
.hb-label { min-width:0;font:400 12px/16px var(--font-v5);color:var(--v5-ink-3);overflow-wrap:anywhere; }
.hb-sub { font:400 12px/16px var(--font-v5);color:var(--v5-ink-3);overflow-wrap:anywhere; }
.hb-tag { display:inline-flex;align-items:center;box-sizing:border-box;height:24px;padding:0 8px;border-radius:var(--v5-radius-full);background:var(--v5-brand-soft);color:var(--v5-brand);font:var(--ui-type-chip-weight) 12px/16px var(--font-v5);white-space:nowrap; }
/* Brand liquid-glass S button (same fill override as the previous trial CTA); the whole card is the control. */
.hb-pill { --ui-button-fill:color-mix(in srgb,var(--v5-brand) 14%,transparent);--ui-button-ink:var(--v5-brand);--ui-button-solid:color-mix(in srgb,var(--v5-brand) 12%,var(--v5-surface));position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:32px;max-width:100%;padding:7px 14px;border-radius:var(--v5-radius-full);font:var(--ui-type-compact-button-weight) 13px/18px var(--font-v5);white-space:nowrap; }
.hb-pill--muted { opacity:.5;white-space:normal;text-align:center;overflow-wrap:anywhere; }
.hb-link { flex:none;display:inline-flex;align-items:center;min-height:44px;font:var(--ui-type-text-link-weight) 13px/18px var(--font-v5);color:var(--v5-ink-3);white-space:nowrap; }

/* Half offer card */
.hb-half { display:flex;flex-direction:column;min-height:208px; }
.hb-half__top { height:76px;padding:8px 0 0 6px;box-sizing:border-box; }
.hb-half__art { display:block;width:84px;height:84px;margin-top:-6px; }
.hb-half__main { flex:1;padding:4px 14px 12px; }
.hb-half__amount { font-size:32px;line-height:38px; }
.hb-half__sub { display:block;margin-top:2px;font:400 12px/16px var(--font-v5);color:var(--v5-ink-3);overflow-wrap:anywhere; }
.hb-half__foot { display:flex;align-items:center;justify-content:space-between;gap:8px;box-sizing:border-box;min-height:52px;padding:4px 10px 4px 14px; }
.hb-perf { position:relative;margin:0 14px;border-top:1px dashed var(--v5-border-strong); }
.hb-perf::before,.hb-perf::after { content:"";position:absolute;top:-9px;box-sizing:content-box;width:16px;height:16px;border-radius:50%;background:var(--v5-bg);border:1px solid var(--hb-rim); }
.hb-perf::before { left:-23px; }
.hb-perf::after { right:-23px; }
.hb-rule { height:1px;margin:0 14px;background:var(--v5-border); }

/* Full-width voucher ticket */
.hb-wv { display:flex;align-items:stretch;min-height:104px; }
.hb-wv__art { flex:none;align-self:center;width:80px;height:80px;margin:0 2px 0 6px; }
.hb-wv__txt { flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:12px 8px 12px 4px; }
.hb-wv__amount { font-size:32px;line-height:38px; }
.hb-vperf { position:relative;align-self:stretch;margin:14px 0;border-left:1px dashed var(--v5-border-strong); }
.hb-vperf::before,.hb-vperf::after { content:"";position:absolute;left:-9px;box-sizing:content-box;width:16px;height:16px;border-radius:50%;background:var(--v5-bg);border:1px solid var(--hb-rim); }
.hb-vperf::before { top:-23px; }
.hb-vperf::after { bottom:-23px; }
.hb-wv__stub { flex:none;display:flex;align-items:center;justify-content:center;width:92px; }

/* Full-width trial offer */
.hb-wt { display:flex;align-items:center;gap:6px;min-height:136px;padding:8px 12px 8px 4px; }
.hb-wt__art { flex:none;width:124px;height:124px; }
.hb-wt__txt { flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start; }
.hb-wt__amount { margin-top:8px;font-size:28px;line-height:34px; }
.hb-wt__row { display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;margin-top:6px; }

/* Claimed (pending) cards */
.hb-pend { display:flex;align-items:center;gap:8px;min-height:64px;padding:10px;border-radius:18px; }
.hb-pend--wide { gap:10px;padding:10px 14px 10px 10px; }
.hb-icon { position:relative;flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--v5-surface-2); }
.hb-icon__img { width:40px;height:40px; }
.hb-icon--dim .hb-icon__img { opacity:.5;filter:grayscale(1); }
.hb-online { position:absolute;right:1px;bottom:3px;width:8px;height:8px;border-radius:50%;background:var(--v5-success);box-shadow:0 0 0 2px var(--v5-surface-2); }
.hb-pend__text { flex:1;min-width:0; }
.hb-pend__title { display:block;font:500 14px/20px var(--font-v5);color:var(--v5-ink);overflow-wrap:anywhere; }
.hb-pend--wide .hb-pend__title { font-size:15px; }
.hb-pend__sub { display:block;margin-top:2px;font:400 12px/16px var(--font-v5);color:var(--v5-ink-3);overflow-wrap:anywhere; }
.hb-pend--wide .hb-pend__sub { font-size:13px;line-height:18px; }
.hb-warn { color:var(--v5-warning-ink); }
.hb-mono { font-size:12px;color:var(--v5-ink);white-space:nowrap; }
.hb-act { flex:none;font:500 13px/18px var(--font-v5);color:var(--v5-brand);white-space:nowrap; }
.hb-val { flex:none;text-align:right;font:400 12px/16px var(--font-v5);color:var(--v5-ink-3);white-space:nowrap; }
.hb-val__amount { display:block;margin-top:2px;font:500 15px/20px var(--font-v5);color:var(--v5-ink); }
.hb-chev { flex:none;width:16px;height:16px;color:var(--v5-ink-4); }
.hb-retry { display:inline-flex;align-items:center;align-self:flex-start;min-height:44px;padding:0 2px;font:600 13px/20px var(--font-v5);color:var(--v5-warning); }
.hb-retry:focus-visible { outline:2px solid var(--v5-brand);outline-offset:2px;border-radius:4px; }

/* Motion: one entrance with a short stagger, one pop when an offer becomes a pending card. */
.hb-stack--enter .hb-card { animation:hb-rise 420ms cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--hb-i, 0) * 70ms); }
.hb-card.hb-pop { animation:hb-pop 320ms cubic-bezier(.2,.9,.3,1.25) backwards; }
@keyframes hb-rise { from { opacity:0;transform:translateY(12px); } }
@keyframes hb-pop { from { opacity:0;transform:scale(.92); } }

@media (max-width:350px) {
  .hb-half__top { height:66px;padding:6px 0 0 4px; }
  .hb-half__art { width:72px;height:72px; }
  .hb-half__main,.hb-half__foot { padding-left:12px; }
  .hb-half__foot { gap:4px;padding-right:8px; }
  .hb-half__foot .hb-pill { padding-inline:11px; }
  .hb-half__amount,.hb-wv__amount { font-size:28px;line-height:34px; }
  .hb-wv__art { width:64px;height:64px;margin-left:4px; }
  .hb-wv__stub { width:80px; }
  .hb-pill { padding-inline:12px; }
  .hb-pend:not(.hb-pend--wide) { padding:10px 8px; }
  .hb-pend:not(.hb-pend--wide) .hb-icon { width:34px;height:34px;border-radius:10px; }
  .hb-pend:not(.hb-pend--wide) .hb-icon__img { width:36px;height:36px; }
  .hb-pend .hb-pend__title { font-size:13px;line-height:18px; }
  .hb-pend.hb-pend--wide .hb-pend__sub { font-size:12px;line-height:16px; }
  .hb-pend:not(.hb-pend--wide) .hb-mono { font-size:11px; }
  .hb-pend:not(.hb-pend--wide) .hb-chev { display:none; }
}
@media (prefers-reduced-motion:reduce) {
  .hb-card,.hb-stack--enter .hb-card,.hb-card.hb-pop { animation:none;transition:none; }
  .hb-card:active:not([aria-disabled="true"]) { transform:none; }
}
</style>
