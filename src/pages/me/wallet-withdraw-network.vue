<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/wallet-withdraw-method" :title="t.bankWithdrawal.chooseNetwork" />
    <!-- One route card per USDT network the server currently opens; tapping one opens the withdraw page with that network fixed. -->
    <view class="withdraw-networks">
      <view v-for="item in cards" :key="item.id" class="method" role="button" tabindex="0" :data-testid="`withdraw-network-${item.label}`" :aria-label="item.accessibleName" :aria-disabled="loading" @click="open(item.id)" @keydown.enter.prevent="open(item.id)" @keydown.space.prevent="open(item.id)">
        <view class="method-top">
          <view class="method-icon" aria-hidden="true"><view class="method-coin"><UsdtCoin /></view></view>
          <view class="method-copy"><text class="method-title">{{ fmt(t.bankWithdrawal.usdtNetwork, { network: item.label }) }}</text><text class="method-note">{{ fmt(t.bankWithdrawal.networkFee, { fee: formatFinanceAmount(item.fee) }) }}</text></view>
          <svg class="method-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
        <view class="route" aria-hidden="true">
          <text class="route-from">{{ t.bankWithdrawal.routeFrom }}</text><view class="route-arrow" /><text class="route-tag">{{ item.label }}</text>
          <template v-if="item.to !== null"><view class="route-arrow" /><text :class="['route-to', { 'route-to--empty': !item.to }]">{{ item.to || t.bankWithdrawal.noAddress }}</text></template>
        </view>
      </view>
      <text v-if="!policy && loading" class="status" role="status">{{ t.bankWithdrawal.loading }}</text>
      <text v-else-if="readFailed" class="status" role="status">{{ t.bankWithdrawal.recoveryUnavailable }}</text>
      <!-- 全部网络关闭:页面中央一句结果 + 一个出口(03 §3.4),回到提现方式选择,银行卡提现可能仍可用 -->
      <view v-else-if="policy && cards.length === 0" class="closed" role="status">
        <view class="closed-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></svg></view>
        <text class="closed-title">{{ t.bankWithdrawal.usdtClosedTitle }}</text>
        <NxButton class="closed-cta" variant="secondary" size="medium" :label="t.bankWithdrawal.otherMethodCta" @click="toMethods" />
      </view>
      <text v-else-if="remoteApiEnabled && payout.readStatusFor(app.accountKey) === 'error'" class="status" role="status">{{ payoutReadCopy.addressUnavailable }}</text>
      <view v-if="readFailed && !loading" class="reload" role="button" tabindex="0" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ t.bankWithdrawal.reload }}</text></view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, ref, watch } from "vue";
import { onShow, onHide, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import UsdtCoin from "@/components/ui/usdt-coin.vue";
import NxButton from "@/components/ui/nx-button.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { formatFinanceAmount } from "@/lib/finance-amount-display";
import { canSelectNewUsdtNetwork } from "@/lib/usdt-network-options";
import { useFinanceReviewCopy } from "@/lib/finance-review-copy";
import { useApp } from "@/store/app";
import { usePayoutAddress } from "@/store/payout-address";
import { fromWithdrawNetwork } from "@/store/payout-address-core";
import { navBack, navTo } from "@/lib/route";
import { remoteApiEnabled, withdrawalApi } from "@/api/runtime";
import type { SupportedWithdrawalNetwork, WithdrawalPolicy } from "@/api/withdrawal-api";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";

// Same order as the withdraw page; the server policy decides which of them are open.
const NETWORK_ORDER: SupportedWithdrawalNetwork[] = ["USDT-TRC20", "USDT-BEP20", "USDT-ERC20"];

const t = useT(), app = useApp(), payout = usePayoutAddress();
const payoutReadCopy = useFinanceReviewCopy();
const policy = ref<WithdrawalPolicy | null>(null);
const loading = ref(false), readFailed = ref(false);
const cards = computed(() => {
  const current = policy.value;
  if (!current?.withdrawalEnabled) return [];
  // The address is decoration: until the address book is read, the card shows no destination rather than "not set".
  const addressesKnown = payout.readStatusFor(app.accountKey) === "ready";
  return NETWORK_ORDER.filter(id => canSelectNewUsdtNetwork(id) && current.enabledNetworks.includes(id)).map(id => {
    const label = id.slice(5), address = payout.currentFor(fromWithdrawNetwork(id))?.address ?? "";
    const fee = current.networkConfirmFeeUsd[label.toLowerCase() as keyof WithdrawalPolicy["networkConfirmFeeUsd"]];
    const to = !addressesKnown ? null : address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
    return { id, label, fee, to, accessibleName: [
      fmt(t.value.bankWithdrawal.usdtNetwork, { network: label }),
      fmt(t.value.bankWithdrawal.networkFee, { fee: formatFinanceAmount(fee) }),
      ...(to === null ? [] : [to || t.value.bankWithdrawal.noAddress]),
    ].join(", ") };
  });
});
let revision = 0, visible = false;
async function load() {
  const currentRevision = ++revision, account = app.accountKey, epoch = app.accountBindingEpoch, runtime = captureRuntimeRevision();
  const current = () => visible && currentRevision === revision && account === app.accountKey && epoch === app.accountBindingEpoch && isCurrentRuntimeRevision(runtime);
  readFailed.value = false; loading.value = true;
  try {
    const next = await withdrawalApi.policy(); if (!current()) return;
    policy.value = next;
  } catch { if (current()) { policy.value = null; readFailed.value = true; } }
  finally { if (current()) loading.value = false; }
}
useAutoRecovery({ failed: () => readFailed.value && !loading.value, retry: load });
useAutoRecovery({ failed: () => remoteApiEnabled && payout.readStatusFor(app.accountKey) === "error", retry: () => payout.refreshRemote() });
function reset() { revision++; policy.value = null; readFailed.value = false; if (visible) void load(); }
watch(() => [app.accountKey, app.accountBindingEpoch] as const, () => {
  if (visible && remoteApiEnabled) void payout.refreshRemote();
  reset();
});
const stopRuntime = subscribeRuntimeRevision(() => { revision++; if (visible) void load(); });
onShow(() => { visible = true; if (remoteApiEnabled) void payout.refreshRemote(); void load(); });
onHide(() => { visible = false; revision++; });
onUnload(() => { visible = false; revision++; stopRuntime(); });
function toMethods() { navBack("/pages/me/wallet-withdraw-method"); }
function open(id: SupportedWithdrawalNetwork) { if (!loading.value) navTo(`/pages/me/wallet-withdraw?network=${id}`); }
</script>

<style scoped>
.withdraw-networks { padding: 0 var(--v5-space-4) var(--v5-space-8); color: var(--v5-ink); }
.method { position: relative; display: block; margin-bottom: var(--v5-space-3); padding: var(--v5-space-4); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); cursor: pointer; }
.method-top { display: flex; align-items: center; gap: 14px; }
.method-icon { display: grid; place-items: center; flex: none; width: 48px; height: 48px; }
.method-coin { width: 40px; height: 40px; }
.method-copy { flex: 1; min-width: 0; }
.method-title { display: block; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.method-note { display: block; color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.method-chev { flex: none; color: var(--v5-ink-4); }
.route { display: flex; align-items: center; gap: var(--v5-space-2); margin-top: 14px; padding: var(--v5-space-3) 14px; border-radius: 14px; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .route { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
/* Long-language labels wrap inside the route instead of pushing the destination off the card. */
.route-from { flex: 0 1 auto; min-width: 0; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); overflow-wrap: break-word; }
.route-arrow { flex: 1; min-width: 12px; height: 1px; background: repeating-linear-gradient(90deg, var(--v5-ink-4) 0 4px, transparent 4px 8px); }
.route-tag { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); background: var(--v5-brand-soft); color: var(--v5-brand); font: 500 12px/16px var(--font-v5); white-space: nowrap; }
.route-to { color: var(--v5-ink); font: 500 13px/18px var(--font-metric); white-space: nowrap; }
.route-to--empty { flex: 0 1 auto; min-width: 0; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); text-align: right; white-space: normal; overflow-wrap: break-word; }
.closed { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 56vh; text-align: center; }
.closed-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: var(--v5-surface); color: var(--v5-ink-3); }
.closed-title { margin-top: 12px; color: var(--v5-ink); font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); }
.closed-cta { margin-top: 12px; }
.status { display: block; margin: var(--v5-space-1) var(--v5-space-1) 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.reload { display: inline-flex; align-items: center; min-height: 44px; margin-left: var(--v5-space-1); color: var(--v5-brand); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.method[aria-disabled="true"] { opacity: .5; cursor: default; }
.method[aria-disabled="true"]:active { transform: none; }
.method:focus-visible, .reload:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
</style>
