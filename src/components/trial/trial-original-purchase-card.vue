<template>
  <view ref="loopRef" class="tpc" :class="{ 'nx-loops-paused': !loops.running.value }">
    <text class="tpc__title">{{ copy.payCardTitle }}</text>
    <view class="tpc__row">
      <view class="tpc__thumb" aria-hidden="true"><image v-if="purchase.device.imageUrl" class="tpc__img" :src="purchase.device.imageUrl" mode="aspectFit" /></view>
      <view class="tpc__main">
        <text class="tpc__name">{{ purchase.device.productName }}</text>
        <view v-if="isTrialDevice" class="tpc__tagline"><NxTag tone="neutral">{{ copy.thisTrialTag }}</NxTag></view>
        <text class="tpc__method">{{ methodText }}</text>
      </view>
      <view class="tpc__side">
        <text class="tpc__amount"><text v-if="amount" class="tpc__cur">$</text>{{ amount?.whole ?? '—' }}<text v-if="amount" class="tpc__dec">{{ amount.decimals }}</text></text>
        <view class="tpc__status" :class="{ 'tpc__status--warn': status.tone === 'warning' }">
          <view v-if="status.kind === 'confirming'" class="tpc__spinner" aria-hidden="true" />
          <text>{{ status.text }}</text>
          <text v-if="status.kind === 'pending'" class="tpc__count">{{ countdown }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 试用详情「进行中的付款」卡 (04 §4.6 进行中的付款; board S7a/S7b/S7d/S7e). Everything comes from the payment's own snapshot,
// never from the current list or quote, so the card stays when the device has left the list. Display only.
import { computed } from "vue";
import type { TrialOriginalPurchase } from "@/api/trial-api";
import NxTag from "@/components/ui/nx-tag.vue";
import { useLoopsInView } from "@/composables/use-loops-in-view";
import { useTrialDetailCopy } from "@/i18n/trial-detail";
import { useT } from "@/i18n/use-t";
import { formatGroupedAmount } from "@/lib/amount-display";
import { purchasePaymentCopy } from "@/lib/purchase-payment-copy";
import { useLocaleStore } from "@/store/locale";

const props = defineProps<{
  purchase: TrialOriginalPurchase;
  /** The payment buys the user's own trial device: the name gets the 「本次试用」 tag. */
  isTrialDevice: boolean;
  /** Server-aligned clock (ms) the parent ticks; drives the external payment's mm:ss. */
  now: number;
}>();
const copy = useTrialDetailCopy();
const t = useT();
const locale = useLocaleStore();
const payCopy = computed(() => purchasePaymentCopy(locale.code));
// The confirming spinner pauses off-screen and on hidden pages.
const loops = useLoopsInView(".tpc");
const loopRef = loops.elRef;

const methodText = computed(() => {
  switch (props.purchase.paymentMethod) {
    case "WALLET": return copy.value.balancePay;
    case "HDPAY_BANK": return payCopy.value.bank;
    case "CREGIS_USDT_ERC20": return payCopy.value.erc20;
    case "CREGIS_USDT_TRC20": return payCopy.value.trc20;
    default: return payCopy.value.bep20;
  }
});
const amount = computed(() => {
  if (props.purchase.confirmedAmountUSD === null) return null;
  const text = formatGroupedAmount(props.purchase.confirmedAmountUSD, 2);
  const at = text.indexOf(".");
  return at < 0 ? { whole: text, decimals: "" } : { whole: text.slice(0, at), decimals: text.slice(at) };
});
/** 12/16 status text under the amount, no pill: awaiting payment + countdown, result being confirmed + spinner, or not sent. */
const status = computed((): { kind: "pending" | "confirming" | "notSent"; text: string; tone: "warning" | "muted" } => {
  const purchase = props.purchase;
  if (purchase.kind === "BALANCE") return purchase.status === "RESUMABLE"
    ? { kind: "notSent", text: copy.value.origNotSent, tone: "warning" }
    : { kind: "confirming", text: copy.value.origConfirming, tone: "muted" };
  if (purchase.status === "AWAITING_PAYMENT") return { kind: "pending", text: `${t.value.store.pendingBarLabel} · `, tone: "warning" };
  return { kind: "confirming", text: copy.value.origConfirming, tone: "muted" };
});
const countdown = computed(() => {
  if (props.purchase.kind !== "EXTERNAL") return "";
  const seconds = Math.max(0, Math.floor((props.purchase.expiresAt - props.now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  return hours > 0 ? `${hours}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}` : `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
});
</script>

<style scoped>
/* Solid content card (01 §1.1.2 纯色): card title + one list row, not a radio. */
.tpc { min-width: 0; padding: 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .tpc { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.tpc__title { display: block; color: var(--v5-ink); font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.tpc__row { display: flex; align-items: center; gap: 12px; min-height: 70px; margin-top: 12px; }
/* Same art drawing as the picker rows: no backing block, one draw size, shifted up onto the row's centre line. */
.tpc__thumb { position: relative; flex: none; width: 76px; height: 48px; }
.tpc__img { position: absolute; left: 50%; top: 50%; width: 96px; height: 96px; transform: translate(-50%, calc(-50% - 7px)); pointer-events: none; }
.tpc__main { flex: 1; min-width: 0; }
.tpc__name { display: block; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.tpc__tagline { display: flex; margin-top: 4px; }
.tpc__method { display: block; margin-top: 4px; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
/* The status may take two lines; the name column keeps room for a whole word (03 §3.6.1). */
.tpc__side { flex: 0 1 auto; min-width: 0; max-width: 42%; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
.tpc__amount { color: var(--v5-ink); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); white-space: nowrap; }
.tpc__cur { margin-right: 1px; color: var(--v5-ink-3); font-size: var(--ui-type-meta); }
.tpc__dec { color: var(--v5-ink-3); }
.tpc__status { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0 4px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.tpc__status > .tpc__count { white-space: nowrap; }
.tpc__status--warn { color: var(--v5-warning-ink); }
.tpc__count { font-family: var(--font-metric); font-variant-numeric: tabular-nums; }
.tpc__spinner { flex: none; box-sizing: border-box; width: 12px; height: 12px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
.nx-loops-paused .tpc__spinner { animation-play-state: paused; }
@media (max-width: 374px) {
  .tpc__thumb { width: 60px; }
  .tpc__img { width: 80px; height: 80px; transform: translate(-50%, calc(-50% - 6px)); }
}
@media (prefers-reduced-motion: reduce) { .tpc__spinner { animation: none; } }
</style>
