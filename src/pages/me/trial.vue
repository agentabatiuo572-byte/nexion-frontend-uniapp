<!--
  Free-trial dashboard (ported from Nexion-prototype/app/(main)/me/trial/page.tsx).
  Idle/terminal: claim CTA + status. Active/grace/extended: countdown hero, shadow
  accrued, bound card, early-purchase (with charge-disclosing confirm), discount
  preview. Auto-starts the trial when returning from card binding with `?trial=1`.
  Cross-store redeem orchestration (debit + credit remainder + NEX + device spawn +
  bills) lives in the handler. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" :title="t.trial.pageTitle" :subtitle="t.trial.pageHeaderSubtitle" />

      <view class="mx-4" style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px">
        <!-- Active cycle -->
        <template v-if="isActiveCycle">
          <CountdownHero
            :status="status"
            :now="now"
            :remaining-ms="remainingMsValue"
            :shadow-u-s-d="shadowUSD"
            :shadow-n-e-x="shadowNEX"
            :started-at="freeTrial.startedAt"
            :active-ends-at="freeTrial.activeEndsAt"
            :grace-ends-at="freeTrial.graceEndsAt"
            :extended-ends-at="freeTrial.extendedEndsAt"
          />

          <view v-if="boundCard" :style="cardSecStyle">
            <view class="flex items-center" style="gap: 12px">
              <view class="grid place-items-center shrink-0" :style="cardIconBoxStyle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
              </view>
              <view class="min-w-0" style="flex: 1">
                <text class="block" :style="cardNumStyle">{{ boundCardLabel }} •••• {{ boundCard.last4 }}</text>
                <text class="block" :style="cardFooterStyle">{{ boundCardFooter }}</text>
              </view>
              <view class="flex items-center active:opacity-70" :style="manageStyle" @click="goCards">
                <text>{{ t.trial.boundCardManage }}</text>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </view>
            </view>
          </view>

          <!-- Discount preview -->
          <view :style="cardSecStyle">
            <text class="block" :style="discountLabelStyle">{{ discountBannerLabel }}</text>
            <view style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px">
              <Row :label="t.trial.rowSubtotal" :value="`$${discountInfo.subtotal.toLocaleString()}`" />
              <Row :label="discountRowLabel" :value="`−$${discountInfo.discount.toFixed(2)}`" accent />
              <Row v-if="trialOffset.offsetUSD > 0" :label="t.trial.rowEarningsOffset" :value="`−$${trialOffset.offsetUSD.toFixed(2)}`" accent />
              <view :style="dividerStyle" />
              <Row :label="t.trial.rowTotal" :value="`$${payNow.toLocaleString()}`" big />
              <text v-if="trialOffset.remainderUSD > 0" class="block" :style="remainderNoteStyle">{{ offsetRemainderNote }}</text>
            </view>
            <view class="w-full flex items-center justify-center active:scale-[0.98]" :style="buyBtnStyle" @click="handleRedeem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
              <text style="margin-left: 6px">{{ t.trial.buyCta }}</text>
            </view>
          </view>

          <view class="w-full flex items-center justify-center active:opacity-90" :style="goEarnStyle" @click="goEarn">
            <text>{{ t.trial.goEarnCta }} →</text>
          </view>

          <text class="block" :style="fineprintStyle">{{ t.trial.fineprint }}</text>
        </template>

        <!-- Idle / terminal -->
        <template v-else>
          <view v-if="showIdle" :style="idleCardStyle">
            <view class="grid place-items-center" :style="idleIconBoxStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
            </view>
            <text class="block" :style="idleTitleStyle">{{ status === "idle" ? t.trial.idleTitleNew : t.trial.idleTitleAgain }}</text>
            <text class="block" :style="idleBodyStyle">{{ idleBody }}</text>
            <view class="inline-flex items-center justify-center active:scale-[0.98]" :style="idleCtaStyle" role="button" tabindex="0" :aria-label="t.trial.idleCta" @click="claim">
              <text>{{ t.trial.idleCta }}</text>
            </view>
          </view>

          <view v-else :style="terminalCardStyle">
            <view class="grid place-items-center" :style="terminalIconBoxStyle">
              <view v-html="terminalView.icon" />
            </view>
            <text class="block" :style="idleTitleStyle">{{ terminalView.title }}</text>
            <text class="block" :style="idleBodyStyle">{{ terminalView.desc }}</text>
            <view class="inline-flex items-center justify-center active:opacity-70" :style="cooldownLinkStyle" @click="goDevices">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></svg>
              <text>{{ terminalCooldownLink }}</text>
            </view>
          </view>
        </template>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CountdownHero from "@/components/me/trial-countdown-hero.vue";
import Row from "@/components/me/trial-discount-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast, confirm } from "@/store/ui";
import {
  useFreeTrial,
  liveShadowUSD,
  liveShadowNEX,
  remainingMs,
  type TrialStatus,
} from "@/store/free-trial";
import { useTrialConfig, computeDiscountedPrice, computeTrialOffset } from "@/store/trial-config";
import { useCards, brandLabel } from "@/store/cards";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { MAX_DEVICES } from "@/store/device-types";

const t = useT();
const freeTrial = useFreeTrial();
const trialConfig = useTrialConfig();
const cards = useCards();
const app = useApp();
const bills = useBills();

const cfg = computed(() => trialConfig.config);
const status = computed(() => freeTrial.status);

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
  ticker = null;
});

// Auto-start trial when returning from card binding with ?trial=1.
onLoad((options) => {
  if (options?.trial !== "1") return;
  if (!freeTrial.canStart()) {
    toast.info(t.value.trial.toastCannotStart);
    return;
  }
  const tokenToUse = cards.defaultTokenId ?? cards.cards[cards.cards.length - 1]?.tokenId;
  if (!tokenToUse) return;
  freeTrial.startWithCard(tokenToUse);
  toast.success(t.value.trial.toastActivated);
});

const isActiveCycle = computed(() => status.value === "active" || status.value === "grace" || status.value === "extended");
const shadowUSD = computed(() => liveShadowUSD(now.value));
const shadowNEX = computed(() => liveShadowNEX(now.value));
const remainingMsValue = computed(() => remainingMs(now.value));
const boundCard = computed(() => (freeTrial.cardTokenId ? cards.cards.find((c) => c.tokenId === freeTrial.cardTokenId) ?? null : null));
const boundCardLabel = computed(() => (boundCard.value ? brandLabel(boundCard.value.brand) : ""));
const discountInfo = computed(() => computeDiscountedPrice(cfg.value));
const trialOffset = computed(() => computeTrialOffset(cfg.value, shadowUSD.value));
const payNow = computed(() => +Math.max(0, discountInfo.value.total - trialOffset.value.offsetUSD).toFixed(2));

const w = computed(() => t.value.trial);
const boundCardFooter = computed(() => fmt(w.value.boundCardFooter, { price: cfg.value.trialPriceUSD.toLocaleString() }));
const discountBannerLabel = computed(() => fmt(w.value.discountBannerLabel, { amount: cfg.value.discountCapUSD.toString() }));
const discountRowLabel = computed(() => fmt(w.value.rowDiscount, { pct: (cfg.value.discountRate * 100).toFixed(0) }));
const offsetRemainderNote = computed(() => fmt(w.value.offsetRemainderNote, { remainder: trialOffset.value.remainderUSD.toFixed(2) }));

// Idle vs terminal split (mirrors source IdleOrTerminal).
const canStartNow = computed(() => freeTrial.canStart());
const showIdle = computed(
  () =>
    status.value === "idle" ||
    (canStartNow.value && (status.value === "cancelled" || status.value === "failed" || status.value === "redeemed")),
);
const idleBody = computed(() => fmt(w.value.idleBody, { n: String(cfg.value.trialDays) }));
const terminalCooldownLink = computed(() => fmt(w.value.terminalCooldownLink, { n: String(cfg.value.cooldownDays) }));

const CHECK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>`;
const X_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>`;
const ALERT_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>`;
const terminalView = computed(() => {
  if (status.value === "redeemed") return { icon: CHECK_SVG, title: w.value.terminalRedeemedTitle, desc: w.value.terminalRedeemedDesc };
  if (status.value === "failed") return { icon: X_SVG, title: w.value.terminalFailedTitle, desc: w.value.terminalFailedDesc };
  if (status.value === "cancelled") return { icon: ALERT_SVG, title: w.value.terminalCancelledTitle, desc: w.value.terminalCancelledDesc };
  return { icon: "", title: "", desc: "" };
});

function claim() {
  useTrialClaimSheet().show();
}

async function handleRedeem() {
  const nowMs = Date.now();
  const shadowUSDBeforeRedeem = liveShadowUSD(nowMs);
  const shadowNEXBeforeRedeem = liveShadowNEX(nowMs);
  const { offsetUSD, remainderUSD } = computeTrialOffset(cfg.value, shadowUSDBeforeRedeem);
  const chargeAmount = +Math.max(0, discountInfo.value.total - offsetUSD).toFixed(2);

  if (app.user.usdtBalance < chargeAmount) {
    toast.error(w.value.toastDebitFailedNoBalance);
    return;
  }

  // Explicit charge-disclosing confirmation before any debit.
  const confirmed = await confirm({
    title: w.value.confirmPurchaseTitle,
    message: fmt(w.value.confirmPurchaseMessage, { amount: chargeAmount.toLocaleString() }),
    confirmLabel: w.value.confirmPurchaseConfirm,
    cancelLabel: w.value.confirmPurchaseCancel,
    icon: "info",
  });
  if (!confirmed) return;

  const result = freeTrial.redeemEarly();
  if (!result.ok) {
    toast.error(w.value.toastDebitFailedTrialEnded);
    return;
  }

  // Cross-store orchestration in the handler (stores don't import each other).
  app.debitBalance(chargeAmount);
  const purchaseRef = `TRIAL-EARLY-${Date.now().toString(36).toUpperCase()}`;
  bills.add({
    type: "purchase",
    symbol: "USDT",
    amount: -chargeAmount,
    status: "posted",
    memo: `Trial early-redeem · NexionBox S1 (promo -$${discountInfo.value.discount}, earnings -$${offsetUSD})`,
    ref: purchaseRef,
  });
  if (remainderUSD > 0) {
    app.creditBalance(remainderUSD);
    bills.add({ type: "bonus", symbol: "USDT", amount: remainderUSD, status: "posted", memo: "Trial earnings remainder → balance · NexionBox S1", ref: `${purchaseRef}-EARN-USDT` });
  }
  if (shadowNEXBeforeRedeem > 0) {
    app.creditNex(shadowNEXBeforeRedeem);
    bills.add({ type: "bonus", symbol: "NEX", amount: shadowNEXBeforeRedeem, status: "posted", memo: "Trial earnings → balance · NEX", ref: `${purchaseRef}-EARN-NEX` });
  }
  // Provision device (mirrors simulation-provider auto-redeem path).
  const activeCount = app.devices.filter((d) => d.activatedAt !== null).length;
  app.addDevice(cfg.value.trialProductId);
  const newId = app.devices[app.devices.length - 1]?.id;
  if (newId && activeCount < MAX_DEVICES) {
    app.activateDevice(newId);
  }
  const amountStr = chargeAmount.toLocaleString();
  if (shadowUSDBeforeRedeem <= 0) {
    toast.success(fmt(w.value.toastPurchaseComplete, { amount: amountStr }));
  } else if (remainderUSD > 0) {
    toast.success(fmt(w.value.toastPurchaseCompleteWithEarn, { amount: amountStr, remainder: remainderUSD.toFixed(2) }));
  } else {
    toast.success(fmt(w.value.toastPurchaseCompleteOffsetOnly, { amount: amountStr }));
  }
}

function goCards() {
  uni.navigateTo({ url: "/pages/me/wallet-cards", fail: () => {} });
}
function goEarn() {
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
}
function goDevices() {
  uni.navigateTo({ url: "/pages/me/devices", fail: () => {} });
}

const cardSecStyle: CSSProperties = { borderRadius: "16px", border: "1px solid var(--v5-border)", background: "var(--v5-surface)", padding: "16px" };
const cardIconBoxStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "8px", background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)" };
const cardNumStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)", fontFamily: "var(--font-jet-mono), ui-monospace, monospace" };
const cardFooterStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-3)", marginTop: "2px" };
const manageStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const discountLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--v5-tech-cyan)" };
const dividerStyle: CSSProperties = { height: "1px", background: "var(--v5-border)", margin: "6px 0" };
const remainderNoteStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-4)", marginTop: "6px", lineHeight: 1.6 };
const buyBtnStyle: CSSProperties = { marginTop: "12px", width: "100%", height: "48px", borderRadius: "999px", background: "var(--v5-brand)", color: "var(--v5-on-brand)", fontSize: "13.5px", fontWeight: 600 };
const goEarnStyle: CSSProperties = { width: "100%", height: "44px", borderRadius: "999px", background: "var(--v5-surface-2)", fontSize: "12.5px", color: "var(--v5-ink-2)" };
const fineprintStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-4)", lineHeight: 1.6, paddingLeft: "4px" };
const idleCardStyle: CSSProperties = {
  borderRadius: "16px",
  border: "1px dashed var(--v5-border-strong)",
  background: "color-mix(in srgb, var(--v5-surface) 40%, transparent)",
  padding: "32px 20px",
  textAlign: "center",
};
const idleIconBoxStyle: CSSProperties = { width: "48px", height: "48px", borderRadius: "999px", background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)", margin: "0 auto" };
const idleTitleStyle: CSSProperties = { marginTop: "12px", fontSize: "14px", fontWeight: 600, color: "var(--v5-ink)" };
const idleBodyStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.4, padding: "0 8px" };
const idleCtaStyle: CSSProperties = { marginTop: "16px", height: "48px", padding: "0 24px", borderRadius: "999px", background: "var(--v5-brand)", color: "var(--v5-on-brand)", fontSize: "13.5px", fontWeight: 600 };
const terminalCardStyle: CSSProperties = { borderRadius: "16px", border: "1px solid var(--v5-border)", background: "var(--v5-surface)", padding: "24px 20px", textAlign: "center" };
const terminalIconBoxStyle: CSSProperties = { width: "48px", height: "48px", borderRadius: "999px", background: "var(--v5-surface-2)", margin: "0 auto" };
const cooldownLinkStyle: CSSProperties = { marginTop: "16px", fontSize: "12.5px", color: "var(--v5-ink-2)" };
</script>
