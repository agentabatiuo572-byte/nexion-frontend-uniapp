<!-- The latest income bills (same ledger as the bills page, direction IN) for the home earnings tab. -->
<template>
  <view v-if="rows.length" class="nx-feed-list" role="link" tabindex="0" @click="goIncome" @keydown.enter.stop.prevent="goIncome">
    <view v-for="bill in rows" :key="bill.id" class="nx-feed-row" data-home-income-row="true">
      <view class="nx-feed-icon" :style="{ background: `color-mix(in srgb, ${WALLET_BILL_TYPE_COLOR[bill.type]} 14%, transparent)` }" aria-hidden="true">
        <BillTypeIcon :type="bill.type" :color="WALLET_BILL_TYPE_COLOR[bill.type]" />
      </view>
      <view class="nx-feed-copy">
        <view class="nx-feed-title-row">
          <text class="nx-feed-title">{{ typeLabel(bill.type) }}</text>
          <NxTag v-if="bill.status === 'pending'" tone="warning" :label="t.bills.statusPending" />
        </view>
        <text class="nx-feed-sub">{{ resolveWalletBillMemo(bill, t.bills.memo as Record<string, string>) }} · {{ formatHomeFeedTime(new Date(bill.ts).toISOString(), locale.code) }}</text>
      </view>
      <view class="nx-feed-amount font-mono-tabular">
        <text>{{ visibility.mask(`+${formatWalletBillDecimal(bill.amountExact, bill.amount, bill.symbol, dateLocale())}`) }}</text>
        <text class="nx-feed-unit">{{ platformDisplayText(bill.symbol) }}</text>
      </view>
    </view>
  </view>
  <view v-else class="nx-feed-state">
    <text>{{ stateText }}</text>
    <text v-if="pager.status === 'error'" class="nx-feed-retry" role="button" tabindex="0" @click="refresh" @keydown.enter.stop.prevent="refresh">{{ t.ui.retry }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { dateLocale } from "@/i18n/format";
import { useLocaleStore } from "@/store/locale";
import { useBills, type BillType } from "@/store/bills";
import { useDataVisibility } from "@/store/data-visibility";
import { fundsServerEnabled } from "@/api/runtime";
import { navTo } from "@/lib/route";
import { platformDisplayText } from "@/lib/brand-copy";
import { runPassiveTabRead } from "@/lib/passive-tab-read";
import { WALLET_BILL_TYPE_COLOR, formatWalletBillDecimal, resolveWalletBillMemo } from "@/lib/wallet-bill-display";
import { onShow } from "@/composables/use-tab-page-lifecycle";
import { formatHomeFeedTime } from "./home-live-feed";
import BillTypeIcon from "@/components/me/bill-type-icon.vue";
import NxTag from "@/components/ui/nx-tag.vue";

const ROWS = 5;
const t = useT();
const locale = useLocaleStore();
const visibility = useDataVisibility();
const billsStore = useBills();
const pager = billsStore.getLedger({ direction: "IN" });
const rows = computed(() => (fundsServerEnabled ? pager.rows : billsStore.bills.filter(bill => bill.amount > 0)).slice(0, ROWS));
const stateText = computed(() => fundsServerEnabled && (pager.status === "idle" || pager.status === "loading") ? t.value.home.networkStatUpdating
  : fundsServerEnabled && pager.status === "error" ? t.value.uiChrome.unavailable : t.value.home.incomeEmpty);
function typeLabel(type: BillType): string {
  return t.value.bills[`type${type.charAt(0).toUpperCase()}${type.slice(1)}` as keyof typeof t.value.bills] as string;
}
function refresh() {
  if (fundsServerEnabled) void runPassiveTabRead("bills-income", () => pager.refresh(), undefined, () => pager.status === "ready").catch(() => undefined);
}
function goIncome() {
  navTo("/pages/me/wallet-bills?filter=in");
}
onShow(refresh);
</script>
