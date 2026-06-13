<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { useApp } from "@/store/app";
import {
  useFreeTrial,
  liveShadowUSD,
  liveShadowNEX,
  remainingMs,
  isHighQualityEligible,
  computeTrialOffset,
} from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { useTrialExtensionSheet } from "@/store/trial-extension-sheet";
import { useBills } from "@/store/bills";
import { MAX_DEVICES } from "@/store/device-types";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

// Simulation tick driver (ports SimulationProvider). Runs the client-side
// earnings/device simulation while the app is visible; pauses in background.
let tickTimer: ReturnType<typeof setInterval> | undefined;
let lastTick = Date.now();

function startTick() {
  stopTick();
  lastTick = Date.now();
  tickTimer = setInterval(() => {
    const now = Date.now();
    useApp().tick(now - lastTick);
    lastTick = now;
  }, 1000);
}
function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}

// ── Trial state-machine poll (ports SimulationProvider's TRIAL_TICK loop) ──
// uni's trial.vue only ticks `now` for display; nothing advanced the free-trial
// machine (active→grace→redeemed/failed/cancelled), so this is the sole driver.
// Runs at the App (component) layer so the terminal auto-redeem side effects can
// compose multiple stores (debit + device spawn + bills) — stores never import
// each other (P-031/032). Mirrors the prototype's TRIAL_TICK_MS = 4000.
const TRIAL_TICK_MS = 4000;
const URGENCY_24H_MS = 24 * 3_600_000;
const URGENCY_1H_MS = 60 * 60_000;
// Session-scoped fire flags so urgency toasts don't spam every poll.
const urgencyFired = { active24h: false, grace1h: false };
let trialTimer: ReturnType<typeof setInterval> | undefined;

function pollTrial() {
  const freeTrial = useFreeTrial();
  const before = freeTrial.status;
  const nowMs = Date.now();
  // Snapshot accrued shadow BEFORE poll potentially advances status to
  // `redeemed` (which keeps the frozen value); on conversion these accrued
  // earnings merge into the spendable balance.
  const shadowUSDBeforeRedeem = liveShadowUSD(nowMs);
  const shadowNEXBeforeRedeem = liveShadowNEX(nowMs);
  freeTrial.poll(nowMs);
  const after = freeTrial.status;
  const t = useT().value;

  if (before !== after) {
    if (after === "redeemed") {
      handleAutoRedeem(shadowUSDBeforeRedeem, shadowNEXBeforeRedeem);
    } else if (after === "failed") {
      toast.error(t.trial.toastAutoDebitFailed);
    } else if (after === "cancelled") {
      toast.info(t.trial.toastCancelled);
    } else if (after === "grace") {
      toast.info(t.trial.toastGraceStarted);
      urgencyFired.grace1h = false;
    } else if (after === "active") {
      urgencyFired.active24h = false;
      urgencyFired.grace1h = false;
    }
  }

  // ── MVP-D: high-quality extension sheet trigger ──
  // free-trial.poll() returns early (does NOT charge) when the grace boundary is
  // reached while the user is high-quality (shadow ≥ threshold) and the offer
  // hasn't been resolved. Surface the extension sheet once in that window.
  const st = useFreeTrial();
  if (
    st.status === "grace" &&
    !st.extensionGranted &&
    isHighQualityEligible() &&
    st.graceEndsAt !== null &&
    nowMs >= st.graceEndsAt
  ) {
    const sheet = useTrialExtensionSheet();
    if (!sheet.open) sheet.show();
  }

  // ── Urgency pushes — 24h left in active / 1h left in grace ──
  if (st.status === "active" && st.activeEndsAt !== null) {
    const left = remainingMs(nowMs);
    if (!urgencyFired.active24h && left > 0 && left <= URGENCY_24H_MS) {
      urgencyFired.active24h = true;
      toast.warn(fmt(t.trial.urgency24h, { amount: useTrialConfig().config.discountCapUSD }));
    }
  } else if (st.status === "grace" && st.graceEndsAt !== null) {
    const left = remainingMs(nowMs);
    if (!urgencyFired.grace1h && left > 0 && left <= URGENCY_1H_MS) {
      urgencyFired.grace1h = true;
      toast.warn(t.trial.urgency1h);
    }
  } else {
    urgencyFired.active24h = false;
    urgencyFired.grace1h = false;
  }
}

// Terminal auto-redeem side effects (cross-store, composed at App layer).
// Mirrors SimulationProvider's `after === "redeemed"` branch: auto-charge full
// price minus the capped trial-earnings offset, write the purchase bill, credit
// the earnings remainder + NEX, then spawn + activate the device. Maps to the
// server cron POST /api/trial/charge (atomic) in production.
function handleAutoRedeem(shadowUSDBeforeRedeem: number, shadowNEXBeforeRedeem: number) {
  const app = useApp();
  const bills = useBills();
  const freeTrial = useFreeTrial();
  const cfg = useTrialConfig().config;
  const t = useT().value;

  const { offsetUSD, remainderUSD } = computeTrialOffset(cfg, shadowUSDBeforeRedeem);
  const chargeAmount = +Math.max(0, cfg.trialPriceUSD - offsetUSD).toFixed(2);
  const debitOk = app.debitBalance(chargeAmount);
  if (!debitOk) {
    // Insufficient bound-card balance — flip to failed (keeps finishedAt so the
    // cooldown clock starts; never reset() which would bypass cooldown).
    freeTrial.markChargeFailed("insufficient_funds");
    toast.error(t.trial.toastAutoDebitFailed);
    return;
  }
  const purchaseRef = `TRIAL-${Date.now().toString(36).toUpperCase()}`;
  bills.add({
    type: "purchase",
    symbol: "USDT",
    amount: -chargeAmount,
    status: "posted",
    memo: `Trial converted · NexionBox S1 (auto-charge, earnings -$${offsetUSD})`,
    ref: purchaseRef,
  });
  if (remainderUSD > 0) {
    app.creditBalance(remainderUSD);
    bills.add({
      type: "bonus",
      symbol: "USDT",
      amount: remainderUSD,
      status: "posted",
      memo: "Trial earnings remainder → balance · NexionBox S1",
      ref: `${purchaseRef}-EARN-USDT`,
    });
  }
  if (shadowNEXBeforeRedeem > 0) {
    app.creditNex(shadowNEXBeforeRedeem);
    bills.add({
      type: "bonus",
      symbol: "NEX",
      amount: shadowNEXBeforeRedeem,
      status: "posted",
      memo: "Trial earnings → balance · NEX",
      ref: `${purchaseRef}-EARN-NEX`,
    });
  }
  const beforeDevices = app.devices.length;
  const activeCount = app.devices.filter((d) => d.activatedAt !== null).length;
  app.addDevice(cfg.trialProductId);
  const deviceAdded = app.devices.length > beforeDevices;
  const newId = deviceAdded ? app.devices[app.devices.length - 1]?.id : null;
  if (newId && activeCount < MAX_DEVICES) {
    app.activateDevice(newId);
  }
  const note =
    shadowUSDBeforeRedeem <= 0
      ? ""
      : remainderUSD > 0
        ? fmt(t.trial.toastConvertedNoteRemainder, { remainder: remainderUSD.toFixed(2) })
        : t.trial.toastConvertedNoteOffset;
  if (deviceAdded) {
    toast.success(fmt(t.trial.toastConverted, { note }));
  } else {
    toast.warn(t.trial.toastConvertedNoDevice, t.trial.toastConvertedNoDeviceSub);
  }
}

function startTrialPoll() {
  stopTrialPoll();
  trialTimer = setInterval(pollTrial, TRIAL_TICK_MS);
}
function stopTrialPoll() {
  if (trialTimer) {
    clearInterval(trialTimer);
    trialTimer = undefined;
  }
}

onLaunch(() => {
  // Nexion is a dark-default design system (matches prototype theme-provider:
  // SSR renders <html data-theme="dark">). Apply on H5; App theming at packaging.
  // #ifdef H5
  document.documentElement.setAttribute("data-theme", "dark");
  // #endif
});
onShow(() => {
  startTick();
  startTrialPoll();
});
onHide(() => {
  stopTick();
  stopTrialPoll();
});
</script>

<style>
/* Global app surface — token-driven, dark by default. */
page {
  background-color: var(--v5-bg);
}
</style>
