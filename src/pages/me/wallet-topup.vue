<!--
  WalletTopup — 充值页(PAY-规格 [FEAT-PAY01] ⑤ 信息架构,参照 pay-vn-rails.html)。
  正式模式提供 USDT-BEP20 与银行转账两个入口；本地非正式模式仍可展示旧卡片原型。

  Wrapped in <AppChassis active="me">. Header is the shared sticky <SubPageHeader>
  (back=/pages/me/wallet).
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.wallet.addFunds" :subtitle="t.wallet.topUp" />

      <!-- Topping up for an unpaid order: what is missing, when the order closes, and the way back once funds arrive. -->
      <view v-if="orderTopup" class="topup-order" :class="{ 'is-done': orderTopupLeft <= 0 }" role="status">
        <view class="topup-order__t"><view class="topup-order__dot" aria-hidden="true" /><text>{{ orderTopupLeft > 0 ? payCopy.topupFor : payCopy.topupDone }}</text></view>
        <text v-if="orderTopupLeft > 0 && balanceKnown" class="topup-order__d">{{ fillCopy(payCopy.topupNeed, { name: orderTopup.name }) }}<text class="topup-order__b">{{ formatGroupedAmount(orderTopupLeft) }} USDT</text>{{ payCopy.topupNeedTail }}</text>
        <text v-else-if="orderTopupLeft <= 0" class="topup-order__d">{{ fillCopy(payCopy.topupEnough, { amt: formatGroupedAmount(app.user.usdtBalance) }) }}</text>
        <view v-if="orderTopupLeft > 0 && orderCloseLeft !== null" class="topup-order__cd">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          <text>{{ fillCopy(payCopy.topupCloses, { t: orderCloseLeft }) }}</text>
        </view>
      </view>

      <!-- While a bank order is open (paying, credited, expired…) the channel switch steps aside, as on the board. -->
      <GlassSegments v-if="!bankOrderOpen" :label="t.wallet.chooseMethod" v-model="seg" :options="segmentOptions" style="margin: 15px 16px 0">
        <template #option="{ option }">
          <view class="topup-seg">
            <svg v-if="option.value === 'bank'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 3 8h18z" /></svg>
            <svg v-else-if="option.value === 'crypto'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 8h8M12 8v9M8.5 11.5c2 .8 5 .8 7 0" /></svg>
            <text class="topup-seg__label">{{ option.label }}</text>
          </view>
        </template>
      </GlassSegments>
      <view v-if="!bankOrderOpen" style="height: 4px" />

      <DepositUsdtPane v-if="seg === 'crypto'" />
      <DepositBankPane v-else-if="seg === 'bank'" ref="bankPane" />
      <TopupCardForm v-else @change-channel="seg = 'crypto'" />
      <view v-if="orderFunded || bankAction" style="height: 120px" />
    </view>
    <!-- The page's main action sits in the thumb zone (DS-30): back to the order once it is covered, otherwise the bank pane's create action. -->
    <template #pageFixed>
      <view v-if="orderFunded" class="topup-sticky"><NxButton class="topup-sticky__btn" variant="primary" :label="payCopy.backToPay" @click="backToOrder" /></view>
      <view v-else-if="bankAction" class="topup-sticky">
        <NxButton v-if="bankSecondary" :class="['topup-sticky__btn', bankSecondary.className]" variant="secondary" :label="bankSecondary.label" @click="bankSecondary.run()" />
        <NxButton :class="['topup-sticky__btn', bankAction.className]" variant="primary" :label="bankAction.label" :disabled="!bankAction.enabled" @click="bankAction.run()">
          <view class="topup-sticky__label">
            <view v-if="bankAction.busy" class="topup-sticky__spin" />
            <text>{{ bankAction.label }}</text>
            <svg v-if="bankAction.external" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
          </view>
        </NxButton>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, nextTick, type CSSProperties, computed, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { takeNavigationQuery, navTo } from "@/lib/route";
import NxButton from "@/components/ui/nx-button.vue";
import { useApp } from "@/store/app";
import { useLocaleStore } from "@/store/locale";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { purchasePaymentCopy, fillCopy } from "@/lib/purchase-payment-copy";
import { formatGroupedAmount } from "@/lib/amount-display";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import TopupCardForm from "@/components/me/topup-card-form.vue";
import DepositUsdtPane from "@/components/me/deposit-usdt-pane.vue";
import DepositBankPane from "@/components/me/deposit-bank-pane.vue";
import { useT } from "@/i18n/use-t";
import { remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useDeposits } from "@/store/deposits";
import { useFx } from "@/store/fx";
import { useAuth } from "@/store/auth";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { findResumablePaymentIntent } from "@/lib/hosted-payment";

// ── 通道 segmented(USDT 链上 / 银行转账 / 银行卡)──
type Seg = "crypto" | "bank" | "card";
const SEGMENTS: { id: Seg }[] = [{ id: "bank" }, { id: "crypto" }, { id: "card" }];
const segments = remoteApiEnabled ? SEGMENTS.filter((item) => item.id !== "card") : SEGMENTS;
const seg = ref<Seg>(remoteApiEnabled ? "bank" : "crypto");
onLoad((query) => {
  const pending = new URLSearchParams(takeNavigationQuery('/pages/me/wallet-topup'));
  const channel = query?.channel ?? pending.get('channel');
  const allowed = segments.find(item => item.id === channel);
  if (allowed) seg.value = allowed.id;
  const orderNo = query?.orderNo ?? pending.get('orderNo'), amount = Number(query?.amount ?? pending.get('amount')), deadline = Number(query?.deadline ?? pending.get('deadline'));
  if (orderNo && Number.isFinite(amount) && amount > 0) orderTopup.value = { orderNo, amount, name: query?.name ?? pending.get('name') ?? '', deadlineAt: Number.isFinite(deadline) && deadline > 0 ? deadline : null };
});
const app = useApp();
const payCopy = computed(() => purchasePaymentCopy(locale.code));
const orderTopup = ref<{ orderNo: string; amount: number; name: string; deadlineAt: number | null } | null>(null);
const topupNow = ref(Date.now());
useVisibleInterval(() => { if (orderTopup.value) topupNow.value = Date.now(); }, 1000);
// Until the wallet snapshot arrives the shortfall is unknown, so the banner shows only the order and its deadline.
const balanceKnown = computed(() => Number.isFinite(app.user.usdtBalance) && app.user.usdtBalance >= 0 && app.remoteFleetHasSnapshot);
const orderTopupLeft = computed(() => !orderTopup.value ? 0 : balanceKnown.value ? Math.max(0, orderTopup.value.amount - app.user.usdtBalance) : orderTopup.value.amount);
const orderCloseLeft = computed(() => {
  const left = orderTopup.value?.deadlineAt ? Math.max(0, Math.ceil((orderTopup.value.deadlineAt - topupNow.value) / 1000)) : null;
  return left === null ? null : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
});
const orderFunded = computed(() => !!orderTopup.value && balanceKnown.value && orderTopupLeft.value <= 0);
function backToOrder() { if (orderTopup.value) void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderTopup.value.orderNo)}&pay=1`); }
function segLabel(id: Seg): string {
  const tc = t.value.topupChrome;
  if (id === "crypto") return tc.segUsdt;
  if (id === "bank") return t.value.bankPane.segBank;
  return tc.segCard;
}
/**
 * 通道 tablist 的左右方向键:移一格并选上,焦点跟到新选中项(roving tabindex 的标准行为)。
 *
 * 这里比别处多一道必要判断:通道切换会**卸载/挂载不同的 pane 组件**(USDT/银行/银行卡
 * 三段是 v-if/v-else-if/v-else),所以方向键移过去之后原焦点节点可能已被移除。
 * 若不在下一帧重新聚焦新选中的 tab,焦点会掉到 body,键盘用户被踢回页面开头 ——
 * 这恰恰是「方向键动了但焦点没动」那类复验失败的成因,必须在 nextTick 之后聚焦。
 */
function moveSeg(index: number, delta: number): void {
  const next = segments[(index + delta + segments.length) % segments.length];
  if (!next || next.id === seg.value) return;
  seg.value = next.id;
  void nextTick(() => {
    if (typeof document === "undefined") return;
    document.querySelector<HTMLElement>('.nx-topup-seg[tabindex="0"]')?.focus();
  });
}

const t = useT();
const locale = useLocaleStore();
const dep = useDeposits();
const fx = useFx();
const auth = useAuth();
const sessionReady = computed(() => {
  void app.accountBindingEpoch;
  return binarySessionReady({
    remote: remoteApiEnabled,
    authenticated: auth.isAuthenticated,
    accountId: auth.accountId,
    appAccountKey: app.accountKey,
    sessionUserId: sessionVault.read()?.user.userId ?? null,
  });
});
// The page reads the bank channel config itself, so a channel turned back on (or another account) shows again.
watch([sessionReady, () => app.accountKey, () => app.accountBindingEpoch], ([ready]) => { if (ready) void fx.load(); }, { immediate: true });
onShow(() => { if (sessionReady.value) void fx.load(); });
// Only hide the bank channel once this account's bank orders are read and none can be resumed;
// until then (config or orders still loading) the segment stays.
// Latched per account binding: later background refreshes briefly report "loading" and must not bring the segment back.
// Sync flush: a queued refresh can turn "ready" back into "loading" in the same tick.
const bankOrdersReadFor = ref("");
const accountBinding = computed(() => `${app.accountKey}:${app.accountBindingEpoch}`);
watch([() => dep.remoteReceiptInitialStatus, accountBinding], ([status]) => {
  if (status === "ready" && dep.currentAccountKey() === app.accountKey) bankOrdersReadFor.value = accountBinding.value;
}, { immediate: true, flush: "sync" });
const bankOrdersRead = computed(() => bankOrdersReadFor.value === accountBinding.value);
const bankHidden = computed(() => remoteApiEnabled
  ? fx.configReady && !fx.vietQrEnabled && bankOrdersRead.value && !findResumablePaymentIntent(dep.intents)
  : !dep.bankRailAvailable);
const visibleSegments = computed(() => bankHidden.value ? segments.filter((item) => item.id !== "bank") : segments);
// The bank pane owns the create flow; the page only renders its action in the fixed bottom bar.
const bankPane = ref<InstanceType<typeof DepositBankPane> | null>(null);
const bankAction = computed(() => seg.value === "bank" ? bankPane.value?.primaryAction ?? null : null);
const bankSecondary = computed(() => seg.value === "bank" ? bankPane.value?.secondaryAction ?? null : null);
const bankOrderOpen = computed(() => seg.value === "bank" && !!bankPane.value && bankPane.value.paneView !== "form");
// An open bank order stays on screen; otherwise a hidden bank channel hands over to USDT.
watch([bankHidden, bankOrderOpen, seg], ([hidden, open]) => { if (hidden && !open && seg.value === "bank") seg.value = "crypto"; }, { immediate: true });

// ── styles ──
// Segmented pill tabs — wallet-bills / SegmentedControl idiom.
const segWrapStyle: CSSProperties = {
  margin: "0 16px 16px",
  // 轨道贴页面底:surface-2 与页面底同色不可辨(亮色 ΔE 2.2),改 L1 surface;选中 pill 是 brand 实底,不撞色
  background: "var(--v5-surface)",
  borderRadius: "16px",
  padding: "4px",
  gap: "2px",
};
function segPillStyle(id: Seg): CSSProperties {
  return {
    height: "44px",
    borderRadius: "10px",
    background: seg.value === id ? "var(--v5-brand)" : "transparent",
  };
}
function segLabelStyle(id: Seg): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "var(--ui-type-list-subtitle)",
    fontWeight: seg.value === id ? 600 : 500,
    color: seg.value === id ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}

import GlassSegments from "@/components/glass-segments.vue";
const segmentOptions = computed(() => visibleSegments.value.map(({ id }) => ({
  value: id, label: segLabel(id), className: `nx-topup-seg-${id}`,
})));
</script>
<style scoped>
.topup-order { margin: 0 16px 16px; padding: var(--v5-space-4); border-radius: var(--ui-radius-surface); background: radial-gradient(240px 160px at 100% 0%, color-mix(in srgb, var(--v5-warning) 9%, transparent), transparent 72%), var(--v5-surface); }
.topup-order.is-done { background: radial-gradient(240px 160px at 100% 0%, color-mix(in srgb, var(--v5-brand) 9%, transparent), transparent 72%), var(--v5-surface); }
.topup-order__t { display: flex; align-items: center; gap: var(--v5-space-2); font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.topup-order__dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--v5-warning); }
.topup-order.is-done .topup-order__dot { background: var(--v5-brand); }
.topup-order__d { display: block; margin-top: 6px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.topup-order__b { font-weight: 500; color: var(--v5-ink); }
.topup-order__cd { display: flex; align-items: center; gap: 6px; margin-top: var(--v5-space-2); color: var(--v5-warning); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.topup-sticky { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; display: flex; padding: var(--v5-space-3) var(--v5-space-4) calc(30px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, color-mix(in srgb, var(--ui-ticket-top) 70%, transparent), color-mix(in srgb, var(--ui-ticket-bottom) 94%, transparent)); border-top: 1px solid color-mix(in srgb, var(--v5-ink) 5%, transparent); backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%); }
.topup-sticky { gap: 12px; }
.topup-sticky__btn { display: flex; flex: 1 1 0; }
.topup-sticky__label { display: inline-flex; align-items: center; gap: 8px; }
.topup-sticky__spin { width: 16px; height: 16px; flex: none; box-sizing: border-box; border-radius: 50%; border: 2px solid color-mix(in srgb, currentColor 30%, transparent); border-top-color: currentColor; animation: spin 1s linear infinite; }
.topup-seg { display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; }
.topup-seg > svg { flex: none; }
.topup-seg__label { font: var(--ui-type-segment-weight) var(--ui-type-segment)/var(--ui-type-segment-lh) var(--font-v5); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .topup-sticky__spin { animation-duration: 2s; } }
</style>
