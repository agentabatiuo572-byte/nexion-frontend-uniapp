<!--
  OrderUsdtTopup — 为订单充值 with the network fixed by the payment sheet (plan C.2–C.4). The page's question is
  「转多少、转到哪、什么时候能付」: the hero shows the suggested transfer, then one bar for balance → amount due with
  the gap (还差) at its open end; the address card shows the fixed network's QR and full address. Once the balance
  covers the order the address steps aside and the page bar offers 去支付. Blocked, cancelled and paid orders show a
  result head and no transfer or pay entry. The page renders this pane's bar action in its fixed bottom bar (04.0).

  PLACEHOLDER(B84): the reads below are one-shot placeholders so the preview can show every state. Codex replaces them
  with the BE-05 order read, the existing deposit address and deposit list reads, their refresh cadence, automatic
  recovery (03 §3.5.2), stale-response guards and account switches (plan C.3). Field names follow contract-b84.md.
-->
<template>
  <view class="out">
    <view class="out-order">
      <text v-if="name" class="out-order__name">{{ name }}</text>
      <view class="out-order__no"><text class="out-order__k">{{ copy.orderNo }}</text><NxCodeValue class="out-order__code" :value="orderNo" :label="copy.orderNo" :copyable="false" /></view>
    </view>

    <view v-if="view === 'loading'" class="out-sk-wrap" role="status" :aria-label="copy.creating">
      <view class="out-sk" style="height: 232px" />
      <view class="out-sk out-sk--next" style="height: 360px" />
    </view>

    <!-- The order read failed: it blocks this page's action, so the reason stays in place; recovery is automatic, no button (03 §3.5.2). -->
    <view v-else-if="view === 'order-error'" class="out-card out-state" role="status">
      <view class="out-state__ic is-warn" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg></view>
      <text class="out-state__t">{{ copy.orderErrorTitle }}</text>
      <text class="out-state__d">{{ copy.orderError }}</text>
    </view>

    <!-- The deadline has passed and the order is re-read: no transfer or pay entry, the result follows (plan C.3 截止). -->
    <view v-else-if="view === 'deadline'" class="out-card out-state" role="status">
      <view class="out-state__ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></view>
      <text class="out-state__t">{{ copy.deadlineTitle }}</text>
      <text class="out-state__d">{{ copy.deadlineBody }}</text>
    </view>

    <!-- Blocked, cancelled or paid: one result head (03 §3.6.1), no QR, address or pay entry. -->
    <view v-else-if="head" class="out-result">
      <NxResultHead :tone="head.tone" :icon="head.icon" :title="head.title" :description="head.body" />
      <view v-if="view === 'paid' && read" class="out-card out-facts">
        <view class="out-fact"><text class="out-fact__k">{{ copy.paidAmount }}</text><text class="out-fact__v out-fact__v--amt">{{ amt(read.paidAmountUsdt) }}<text class="out-unit">{{ USDT }}</text></text></view>
        <view v-if="read.paidAt" class="out-fact"><text class="out-fact__k">{{ copy.paidAt }}</text><text class="out-fact__v tabular-nums">{{ paidAtLabel }}</text></view>
      </view>
    </view>

    <template v-else-if="read">
      <!-- Hero: the amount to send (or, once covered, the amount due) and the balance → due bar. Amber while short, brand once covered (1.1.2). -->
      <view class="out-card out-hero nx-tint" :class="{ 'is-covered': covered }">
        <view v-if="closesIn" class="out-cd"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg><text>{{ fill(copy.topupCloses, { t: closesIn }) }}</text></view>
        <text class="out-hero__lab">{{ covered ? copy.dueLabel : copy.suggest }}</text>
        <view class="out-hero__row">
          <text class="out-hero__amt" :class="amountSize">{{ heroParts.whole }}<text v-if="heroParts.fraction" class="out-hero__frac">.{{ heroParts.fraction }}</text><text class="out-hero__unit">{{ USDT }}</text></text>
          <view v-if="!covered" class="out-copy" role="button" tabindex="0" :aria-label="copy.copySuggest" @click="copyText(read.suggestedTransferUsdt, copy.suggestCopied)" @keydown.enter.prevent="copyText(read.suggestedTransferUsdt, copy.suggestCopied)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
          </view>
        </view>
        <text v-if="!covered" class="out-hero__note">{{ minimumFloor ? fill(copy.suggestMinNote, { min: amt(read.minDepositUsdt) }) : fill(copy.suggestNote, { fee: amt(read.depositFeeUsdt) }) }}</text>

        <view class="out-gauge">
          <view v-if="!covered" class="out-gauge__scale"><text class="out-gauge__k">{{ copy.dueLabel }}</text><text class="out-num">{{ amt(read.amountDueUsdt) }}<text class="out-unit">{{ USDT }}</text></text></view>
          <view class="nx-progress out-gauge__bar" role="progressbar" :aria-label="copy.balanceLabel" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="fillPct">
            <view v-viz-inview class="nx-progress__fill nx-viz-grow" :style="{ width: fillPct + '%' }" />
          </view>
          <view class="out-gauge__legend">
            <view class="out-leg"><view class="out-leg__dot is-fill" aria-hidden="true" /><text class="out-gauge__k">{{ debt ? copy.debtLabel : copy.balanceLabel }}</text><text class="out-num">{{ amt(balanceAbs) }}</text></view>
            <view v-if="covered" class="out-leg out-leg--end"><NxTag tone="success" :label="copy.enoughLabel" /></view>
            <view v-else class="out-leg out-leg--end"><text class="out-gauge__k">{{ copy.leftLabel }}</text><text class="out-num">{{ amt(read.shortfallUsdt) }}</text><view class="out-leg__dot" aria-hidden="true" /></view>
          </view>
          <text v-if="debt && !covered" class="out-gauge__note">{{ copy.debtIncluded }}</text>
        </view>
        <view v-if="latest" class="out-latest"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg><text>{{ fill(copy.latestIn, { amt: amt(latest), network }) }}</text></view>
      </view>

      <!-- A transfer below the minimum: one line and the next step (plan C.3 低于最低额的转账). -->
      <view v-if="dust && !covered" class="out-dust" role="status">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        <view class="out-dust__tx">
          <text>{{ fill(copy.dustNote, { amt: amt(dust) }) }}</text>
          <view class="nx-card-link out-dust__link" role="link" tabindex="0" @click="emit('support')" @keydown.enter.prevent="emit('support')"><text>{{ copy.support }}</text><NxIcon name="chevron-right" class="nx-card-link__chevron" /></view>
        </view>
      </view>

      <!-- Where to send: the fixed network's QR and the full address on its own line (03 §3.6.1); no QR or copy unless the address can take deposits (plan C.3). -->
      <view v-if="!covered" class="out-card out-addr">
        <view class="out-addr__top"><text class="out-addr__t">{{ copy.addrTitle }}</text><NxTag tone="brand" :label="networkName" /></view>
        <!-- On a phone the address is copied far more often than scanned: address and copy first, the QR under them. -->
        <template v-if="address.state === 'ready'">
          <text class="out-addr__cap">{{ copy.addrScan }}</text>
          <NxCodeValue class="out-addr__code" :value="address.address" :label="copy.addrTitle" full :copyable="false" />
          <view class="out-addr__act"><NxButton variant="brand" size="medium" :label="copy.addrCopy" @click="copyText(address.address, copy.copied)" /></view>
          <view class="out-qr"><image class="out-qr__img" :src="qrImage" mode="aspectFit" :aria-label="copy.addressQr" /></view>
        </template>
        <view v-else class="out-state out-state--inline" role="status">
          <view class="out-state__ic" :class="{ 'is-warn': address.state !== 'preparing' }" aria-hidden="true">
            <svg v-if="address.state === 'preparing'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          </view>
          <text class="out-state__t">{{ addressCopy.title }}</text>
          <text class="out-state__d">{{ addressCopy.body }}</text>
        </view>
      </view>

      <!-- What the user can lose, exact and short (copy-rules): the network, the minimum and the external wallet's own fee. -->
      <view v-if="!covered" class="out-warn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        <view class="out-warn__tx"><text>{{ fill(copy.warnNet, { network }) }}</text><text>{{ fill(copy.warnMin, { min: amt(read.minDepositUsdt) }) }}</text></view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import qrcode from "qrcode-generator";
import NxButton from "@/components/ui/nx-button.vue";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import { apiClient, cregisDepositApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { isApiRefusal } from "@/api/errors";
import { formatAmount, formatGroupedAmount } from "@/lib/amount-display";
import { walletBillTimeLabel } from "@/lib/wallet-bill-date";
import { purchasePaymentCopy, fillCopy as fill } from "@/lib/purchase-payment-copy";
import { useLocaleStore } from "@/store/locale";
import { toast } from "@/store/ui";

const props = defineProps<{ orderNo: string; network: "BEP20" | "ERC20"; name: string }>();
const emit = defineEmits<{ (event: "pay" | "open-intent" | "support" | "view-order"): void }>();
const locale = useLocaleStore();
const copy = computed(() => purchasePaymentCopy(locale.code));
const USDT = "\u00A0USDT";

/** PLACEHOLDER(B84): BE-05 GET /api/app/orders/{orderNo}/usdt-topup?network= — field names as contract-b84.md. */
type OrderUsdtTopupRead = {
  orderNo: string; network: string; state: "PENDING" | "PAID" | "CLOSED"; canonicalStatus: string; payable: boolean; deadlineAt: string | null;
  amountDueUsdt: string; walletAvailableUsdt: string; shortfallUsdt: string; minDepositUsdt: string; depositFeeUsdt: string;
  suggestedTransferUsdt: string; blocker: "NONE" | "OPEN_INTENT" | "NEEDS_REVIEW";
  openIntent: { intentNo: string; paymentMethod: string; paymentAllowed: boolean } | null;
  reviewReason: "BANK_SESSION" | "FINANCE_REVIEW" | null; paidAt: string | null; paidAmountUsdt: string | null;
};
const read = ref<OrderUsdtTopupRead | null>(null);
const orderFailed = ref(false);
const orderMissing = ref(false);
type AddressView = { state: "ready"; address: string } | { state: "loading" | "preparing" | "paused" | "error"; address: "" };
const address = ref<AddressView>({ state: "loading", address: "" });
const latest = ref<string | null>(null);
const dust = ref<string | null>(null);

// PLACEHOLDER(B84): one read per show. Codex: cadence, recovery, stale responses, deadline re-read (plan C.3).
async function load() {
  try {
    read.value = await apiClient.request<OrderUsdtTopupRead>({ path: `/api/app/orders/${encodeURIComponent(props.orderNo)}/usdt-topup?network=${props.network}` });
    orderFailed.value = false;
    orderMissing.value = false;
  } catch (error) {
    // 404 ORDER_NOT_FOUND is a definite answer (another account's or no such order); other failures recover.
    orderMissing.value = isApiRefusal(error, 404, "ORDER_NOT_FOUND");
    orderFailed.value = !orderMissing.value;
  }
  try {
    const snapshot = await cregisDepositApi.address(props.network);
    address.value = snapshot.enabled && snapshot.creditEnabled && snapshot.address ? { state: "ready", address: snapshot.address }
      : { state: snapshot.reason === "CREGIS_ADDRESS_PREPARING" ? "preparing" : "paused", address: "" };
  } catch {
    address.value = { state: "error", address: "" };
  }
  // PLACEHOLDER(B84): which deposit counts as 「最近到账」 and which hold shows the below-minimum line is Codex's (window, network).
  const rows = await cregisDepositApi.list().catch(() => []);
  const mine = rows.filter((row) => row.network === props.network && Date.now() - row.createdAt < 30 * 60_000);
  const credited = mine.find((row) => row.status === "CREDITED");
  const held = mine.find((row) => row.status === "DUST_HOLD");
  latest.value = credited ? credited.creditedUsdtExact ?? String(credited.creditedUsdt) : null;
  dust.value = held ? held.grossAmountUsdtExact ?? String(held.grossAmountUsdt) : null;
}
// Same session gate as DepositUsdtPane: read once this account's session is restored.
const app = useApp();
const auth = useAuth();
const sessionReady = computed(() => {
  void app.accountBindingEpoch;
  return binarySessionReady({ remote: remoteApiEnabled, authenticated: auth.isAuthenticated, accountId: auth.accountId,
    appAccountKey: app.accountKey, sessionUserId: sessionVault.read()?.user.userId ?? null });
});
watch(sessionReady, (ready) => { if (ready) void load(); }, { immediate: true });
onShow(() => { if (sessionReady.value && (read.value || orderFailed.value)) void load(); });

const now = ref(Date.now());
useVisibleInterval(() => { now.value = Date.now(); }, 1000);
const deadline = computed(() => read.value?.deadlineAt ? Date.parse(read.value.deadlineAt) : null);
const closesIn = computed(() => {
  if (deadline.value === null) return "";
  const left = Math.max(0, Math.ceil((deadline.value - now.value) / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
});

const nonZero = (value: string) => /[1-9]/.test(value);
// Order facts first (plan C.3, contract state): paid, closed, blocked, past the deadline, then the balance.
const view = computed(() => {
  const r = read.value;
  if (!r) return orderMissing.value ? "missing" : orderFailed.value ? "order-error" : "loading";
  if (r.state === "PAID") return "paid";
  if (r.state === "CLOSED") return "closed";
  if (r.blocker === "OPEN_INTENT") return "open-intent";
  if (r.blocker === "NEEDS_REVIEW") return "review";
  // Pending but no longer payable with no blocker, or the local clock has reached the deadline: collapse the transfer
  // and pay entries until the re-read gives the result (plan C.3 截止).
  if (!r.payable || deadline.value !== null && now.value >= deadline.value) return "deadline";
  return nonZero(r.shortfallUsdt) ? "waiting" : "covered";
});
const covered = computed(() => view.value === "covered");
// The suggestion was raised to the minimum deposit (shortfall + fee is below it): say so instead of the fee line.
const minimumFloor = computed(() => !!read.value && formatAmount(read.value.suggestedTransferUsdt, "full") === formatAmount(read.value.minDepositUsdt, "full")
  && nonZero(read.value.shortfallUsdt));
const head = computed(() => {
  const c = copy.value;
  switch (view.value) {
    case "paid": return { tone: "success" as const, icon: undefined, title: c.paidTitle, body: "" };
    // Only the order's own canonical status may say it timed out (contract canonicalStatus).
    case "closed": return { tone: "neutral" as const, icon: read.value?.canonicalStatus === "expired" ? "clock" as const : undefined, title: read.value?.canonicalStatus === "expired" ? c.expiredTitle : c.closedTitle, body: c.expiredBody };
    case "missing": return { tone: "neutral" as const, icon: "alert" as const, title: c.orderMissingTitle, body: c.orderMissing };
    case "open-intent": return { tone: "warning" as const, icon: "clock" as const, title: c.openIntentTitle, body: c.openIntentBody };
    case "review": return { tone: "warning" as const, icon: "shield" as const, title: c.reviewHoldTitle, body: c.reviewHold };
    default: return null;
  }
});

/** Exact amounts: thousands separators, no trailing zeros, no decimal point for whole numbers. */
const amt = (value: string | null | undefined) => value == null ? "—" : formatGroupedAmount(value, "full");
const heroParts = computed(() => {
  const [whole, fraction = ""] = amt(covered.value ? read.value?.amountDueUsdt : read.value?.suggestedTransferUsdt).split(".");
  return { whole, fraction };
});
// Long amounts step down to fit the card beside the copy icon instead of being cut (10.2 主金额长数值).
const amountSize = computed(() => {
  const length = heroParts.value.whole.length + (heroParts.value.fraction ? heroParts.value.fraction.length + 1 : 0);
  return length > 14 ? "is-xlong" : length > 9 ? "is-long" : "";
});
const debt = computed(() => !!read.value && read.value.walletAvailableUsdt.trim().startsWith("-"));
const balanceAbs = computed(() => read.value?.walletAvailableUsdt.replace(/^\s*-/, "") ?? null);
// The bar's geometry only: balance as a share of the amount due; a debt draws no fill.
const fillPct = computed(() => {
  const r = read.value;
  if (!r || debt.value) return 0;
  const due = Number(r.amountDueUsdt), balance = Number(r.walletAvailableUsdt);
  return due > 0 ? Math.round(Math.min(100, Math.max(0, balance / due * 100)) * 10) / 10 : 100;
});
const paidAtLabel = computed(() => read.value?.paidAt ? walletBillTimeLabel(Date.parse(read.value.paidAt), locale.code) : "—");
const networkName = computed(() => props.network === "ERC20" ? copy.value.erc20 : copy.value.bep20);
const addressCopy = computed(() => {
  const c = copy.value;
  if (address.value.state === "preparing") return { title: c.addrPreparingTitle, body: c.addrPreparing };
  if (address.value.state === "paused") return { title: fill(c.addrPausedTitle, { network: props.network }), body: c.addrPaused };
  return { title: c.addrErrorTitle, body: c.addrError };
});
const qrImage = computed(() => {
  if (address.value.state !== "ready") return "";
  const code = qrcode(0, "M");
  code.addData(address.value.address);
  code.make();
  // Dark modules on white with a four-module quiet zone, in both themes (04.3).
  return code.createDataURL(4, 16);
});
function copyText(value: string, done: string) {
  uni.setClipboardData({ data: value, showToast: false, success: () => { uni.hideToast(); toast.success(done); }, fail: () => {} });
}

/** The page's bottom bar for this state (04.0): one primary; a disabled one says why above it (03 §3.1). */
const barAction = computed(() => {
  const c = copy.value;
  switch (view.value) {
    case "waiting": return { label: c.goPay, enabled: false, note: c.payWhenEnough, run: () => {} };
    case "covered": return { label: c.goPay, enabled: true, note: c.payReady, run: () => emit("pay") };
    case "open-intent": return { label: c.openIntent, enabled: true, note: "", run: () => emit("open-intent") };
    case "review": return { label: c.support, enabled: true, note: "", run: () => emit("support") };
    case "paid": case "closed": return { label: c.viewOrder, enabled: true, note: "", run: () => emit("view-order") };
    default: return null;
  }
});
defineExpose({ barAction });
</script>

<style scoped>
.out { padding: 0 var(--v5-space-4); }
.out-order { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--v5-space-1) var(--v5-space-3); margin: var(--v5-space-1) var(--v5-space-1) var(--v5-space-3); }
.out-order__name { min-width: 0; color: var(--v5-ink); font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.out-order__no { display: flex; align-items: baseline; gap: var(--v5-space-1); min-width: 0; margin-left: auto; }
.out-order__k { flex: none; color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.out-order__code { color: var(--v5-ink-3); font-size: var(--ui-type-meta); line-height: var(--ui-type-meta-lh); }
.out-card { border-radius: var(--ui-radius-surface); }
.out-card:not(.nx-tint) { background: var(--v5-surface); }
[data-theme="light"] .out-card:not(.nx-tint) { box-shadow: var(--v5-glass-shadow); }
.out-card + .out-card, .out-card + .out-dust, .out-dust + .out-card { margin-top: var(--ui-space-card-gap); }

/* Hero (page first card: 20 inset). Amber while short, brand once covered: one tinted card on this screen region. */
.out-hero { --nx-tint: var(--v5-warning); --nx-progress-hue: var(--v5-tech-cyan); padding: var(--ui-space-inset-hero); }
.out-hero.is-covered { --nx-tint: var(--v5-brand); --nx-progress-hue: var(--v5-brand); }
.out-cd { display: flex; align-items: center; justify-content: center; gap: var(--v5-space-1); margin-bottom: var(--v5-space-3); color: var(--v5-warning-ink); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.out-cd > svg, .out-cd > .nx-native-svg { flex: none; }
.out-hero__lab { display: block; color: var(--v5-ink-3); text-align: center; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
/* The key number sits in the middle of the card (balanced layout); the copy icon rides beside it. */
.out-hero__row { display: flex; align-items: center; justify-content: center; gap: var(--v5-space-1); margin-top: var(--v5-space-1); }
/* Main amount on the wallet-amount role (主金额上限), stepping down to the display-title and metric sizes for long values (10.2). */
.out-hero__amt { min-width: 0; color: var(--v5-ink); font: 500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.out-hero__amt.is-long { font-size: var(--ui-type-display-title); line-height: var(--ui-type-display-title-lh); }
.out-hero__amt.is-xlong { font-size: var(--ui-type-metric-value); line-height: var(--ui-type-metric-value-lh); letter-spacing: -.01em; }
.out-hero__frac { color: var(--v5-ink-3); }
.out-hero__unit { color: var(--v5-ink-3); font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); letter-spacing: 0; }
.out-copy { flex: none; display: grid; place-items: center; width: 44px; height: 44px; color: var(--v5-ink-2); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.out-copy:active { opacity: .6; }
.out-copy:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -4px; border-radius: var(--v5-radius-s); }
.out-hero__note { display: block; margin-top: var(--v5-space-1); color: var(--v5-ink-3); text-align: center; text-wrap: pretty; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; }

/* Balance → amount due: the filled part is the balance, the open end is what is still needed (04.0 主视觉). */
.out-gauge { margin-top: var(--v5-space-4); padding-top: var(--v5-space-4); border-top: 1px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.out-gauge__scale { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--v5-space-1) var(--v5-space-3); }
.out-gauge__k { color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space: nowrap; }
.out-num { color: var(--v5-ink); font: 500 var(--ui-type-metric-value)/var(--ui-type-metric-value-lh) var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
.out-unit { color: var(--v5-ink-3); font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.out-gauge__bar { margin: var(--v5-space-3) 0; }
.out-gauge__bar .nx-progress__fill { transition: width 1400ms cubic-bezier(0.16, 1, 0.3, 1); }
.out-gauge__legend { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--v5-space-1) var(--v5-space-3); }
.out-leg { display: flex; align-items: baseline; gap: var(--v5-space-1); min-width: 0; }
.out-leg--end { margin-left: auto; }
.out-leg__dot { flex: none; align-self: center; width: 8px; height: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--v5-ink-3); }
.out-leg__dot.is-fill { background: var(--nx-progress-hue); box-shadow: none; }
.out-gauge__note { display: block; margin-top: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align: right; }
.out-latest { display: flex; align-items: center; gap: var(--v5-space-1); margin-top: var(--v5-space-3); color: var(--v5-success-ink); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.out-latest > svg, .out-latest > .nx-native-svg { flex: none; }

/* Address card: solid content card (1.1.2), its own copy action as brand glass M (03 §3.1 卡片内次操作). */
.out-addr { padding: var(--ui-space-inset); }
.out-addr__top { display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-2); }
.out-addr__t { color: var(--v5-ink); font: var(--ui-type-card-title-weight, 600) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.out-addr__cap { display: block; margin-top: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.out-addr__code { margin-top: var(--v5-space-3); padding: var(--v5-space-3) var(--v5-space-4); border-radius: var(--v5-radius-s); background: var(--v5-surface-2); color: var(--v5-ink); font-size: var(--ui-type-list-subtitle); line-height: var(--ui-type-list-subtitle-lh); user-select: text; }
.out-addr__act { display: flex; justify-content: flex-end; margin-top: var(--v5-space-3); }
.out-qr { width: 200px; height: 200px; margin: var(--v5-space-4) auto 0; padding: var(--v5-space-3); box-sizing: border-box; border-radius: var(--v5-radius-m); background: #fff; box-shadow: inset 0 0 0 1px var(--v5-border); animation: nx-viz-pop 420ms cubic-bezier(.2, 1.4, .4, 1) 200ms both; }
.out-qr__img { display: block; width: 176px; height: 176px; image-rendering: pixelated; }

/* In-place state (address preparing / paused / unreadable, order unreadable, deadline): icon, title, one line; no button (03 §3.5.2). */
.out-state { display: flex; flex-direction: column; align-items: center; padding: var(--v5-space-6) var(--v5-space-5); text-align: center; }
.out-state--inline { padding: var(--v5-space-6) var(--v5-space-1) var(--v5-space-2); }
.out-state__ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--v5-ink-2); background: color-mix(in srgb, var(--v5-ink-3) 16%, transparent); }
.out-state__ic.is-warn { color: var(--v5-warning-ink); background: color-mix(in srgb, var(--v5-warning) 16%, transparent); }
.out-state__t { display: block; margin-top: var(--v5-space-3); color: var(--v5-ink); font: var(--ui-type-card-title-weight, 600) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); text-wrap: balance; }
.out-state__d { display: block; max-width: 320px; margin-top: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); text-wrap: pretty; }

/* Warnings stand out: warning ink with an icon (design-rules). The light tint sits on the content surface so the
   warning ink keeps at least 4.5:1 (01 §1.1.1); on the page floor it measured about 4.2:1. */
.out-warn, .out-dust { display: flex; align-items: flex-start; gap: var(--v5-space-3); padding: var(--v5-space-3) var(--v5-space-4); border-radius: var(--v5-radius-s); background: color-mix(in srgb, var(--v5-warning) 14%, transparent); color: var(--v5-warning-ink); font: var(--ui-type-note-weight, 400) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
[data-theme="light"] :is(.out-warn, .out-dust) { background: color-mix(in srgb, var(--v5-warning) 6%, var(--v5-surface)); }
.out-warn { margin-top: var(--v5-space-3); }
.out-warn > svg, .out-dust > svg, .out-warn > .nx-native-svg, .out-dust > .nx-native-svg { flex: none; margin-top: .1em; }
.out-warn__tx, .out-dust__tx { display: flex; flex-direction: column; gap: var(--v5-space-1); min-width: 0; overflow-wrap: break-word; }
.out-dust { margin-top: var(--v5-space-3); }
.out-dust__link { align-self: flex-end; }

.out-result { padding: var(--v5-space-3) 0 0; }
.out-facts { margin-top: var(--v5-space-6); padding: var(--v5-space-1) var(--v5-space-4); }
.out-fact { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--v5-space-1) var(--v5-space-3); padding: var(--v5-space-3) 0; }
.out-fact + .out-fact { border-top: 1px solid var(--v5-border); }
.out-fact__k { color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight, 400) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.out-fact__v { margin-left: auto; color: var(--v5-ink); font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); white-space: nowrap; }
.out-fact__v--amt { font: 500 var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); }

.out-sk--next { margin-top: var(--ui-space-card-gap); }
.out-sk { border-radius: var(--ui-radius-surface); background: color-mix(in srgb, var(--v5-ink) 6%, transparent); }
@media (prefers-reduced-motion: reduce) { .out-gauge__bar .nx-progress__fill { transition: none; } .out-qr { animation: none; } }
</style>
