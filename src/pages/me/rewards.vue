<!--
  My Rewards (我的奖励) — me sub-page. Three categories:
  (1) Available vouchers — claimed, unused, still valid → "去使用" routes to the
      SKU detail (single-SKU voucher) or the mall (multi/all).
  (2) Expired vouchers — claimed, unused, past validity → grayed + Expired badge.
  (3) System rewards — bills of reward types (bonus/refer/achievement), the
      activity & compensation USDT/NEX credits, categorized by type.
  Backend-replaceable: vouchers from the voucher store (GET /api/me/vouchers),
  rewards derived from the bills ledger (GET /api/me/bills) — the real backend
  posts activity / CS-compensation rewards as bills (the admin 360 客服补偿 action
  → POST /api/users/:id/compensation lands as a bill), so they surface here
  automatically with no extra endpoint. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink); padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" :title="t.rewards.title" />

      <!-- Empty -->
      <view v-if="isEmpty" :style="emptyStyle">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
        <text class="block" :style="emptyTitleStyle">{{ t.rewards.empty }}</text>
        <text class="block" :style="emptyHintStyle">{{ t.rewards.emptyHint }}</text>
      </view>

      <template v-else>
        <!-- Available vouchers -->
        <view v-if="available.length > 0">
          <text class="block" :style="secHeadStyle">{{ t.rewards.secAvailable }}</text>
          <view :style="cardStyle">
            <view v-for="(v, i) in available" :key="v.id" class="flex items-center" :style="rowStyle(i)">
              <view class="grid place-items-center shrink-0" :style="vIconStyle(false)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M13 5v14" /></svg>
              </view>
              <view class="flex-1 min-w-0">
                <text class="block truncate" :style="rowTitleStyle"><text :style="valueStyle">{{ valueText(v) }}</text> · {{ v.name }}</text>
                <text class="block truncate" :style="rowSubStyle">{{ scopeText(v) }} · {{ expiryText(v) }}</text>
              </view>
              <view class="shrink-0 inline-flex items-center active:opacity-80" :style="useBtnStyle" role="button" tabindex="0" :aria-label="t.rewards.useCta" @click="onUse(v)">
                <text class="vcs-cta-t" :style="useBtnTextStyle">{{ t.rewards.useCta }}</text>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 3px"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </view>
            </view>
          </view>
        </view>

        <!-- Expired vouchers -->
        <view v-if="expired.length > 0">
          <text class="block" :style="secHeadStyle">{{ t.rewards.secExpired }}</text>
          <view :style="cardStyle">
            <view v-for="(v, i) in expired" :key="v.id" class="flex items-center" :style="rowStyle(i)">
              <view class="grid place-items-center shrink-0" :style="vIconStyle(true)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M13 5v14" /></svg>
              </view>
              <view class="flex-1 min-w-0">
                <text class="block truncate" :style="rowTitleExpiredStyle">{{ valueText(v) }} · {{ v.name }}</text>
                <text class="block truncate" :style="rowSubStyle">{{ scopeText(v) }}</text>
              </view>
              <view class="shrink-0" :style="expiredBadgeStyle"><text>{{ t.rewards.expiredBadge }}</text></view>
            </view>
          </view>
        </view>

        <!-- System rewards (bills-derived) -->
        <view v-if="systemRewards.length > 0">
          <text class="block" :style="secHeadStyle">{{ t.rewards.secSystem }}</text>
          <view :style="cardStyle">
            <view v-for="(b, i) in systemRewards" :key="b.id" class="flex items-center" :style="rowStyle(i)">
              <view class="grid place-items-center shrink-0" :style="vIconStyle(false)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
              </view>
              <view class="flex-1 min-w-0">
                <text class="block truncate" :style="rowTitleStyle">{{ rewardTypeLabel(b.type) }}</text>
                <text class="block truncate" :style="rowSubStyle">{{ b.memo }}</text>
              </view>
              <view class="text-right shrink-0" style="margin-left: 8px">
                <text class="block tabular-nums" :style="rewardAmountStyle">+{{ b.amount.toLocaleString() }} {{ b.symbol }}</text>
                <text class="block" :style="rowDateStyle">{{ shortDate(b.ts) }}</text>
              </view>
            </view>
          </view>
        </view>
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useVoucher } from "@/store/voucher";
import { useBills, type BillType } from "@/store/bills";
import { getProduct } from "@/mock/products";
import { isSingleSkuVoucher, type VoucherDef } from "@/mock/vouchers";
import { navTo } from "@/lib/route";

const t = useT();
const voucher = useVoucher();
const bills = useBills();

const available = computed<VoucherDef[]>(() => voucher.claimedUnused);
const expired = computed<VoucherDef[]>(() => voucher.expiredVouchers);

// System rewards = reward-type bill credits (activity bonuses, referral
// commissions, achievements). Real backend posts CS-compensation here too.
const REWARD_TYPES: BillType[] = ["bonus", "refer", "achievement"];
const systemRewards = computed(() => bills.bills.filter((b) => REWARD_TYPES.includes(b.type) && b.amount > 0));

const isEmpty = computed(() => available.value.length === 0 && expired.value.length === 0 && systemRewards.value.length === 0);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function valueText(v: VoucherDef): string {
  return v.type === "fixed"
    ? fmt(t.value.voucher.offFixed, { amount: v.amountUSD ?? 0 })
    : fmt(t.value.voucher.offPercent, { percent: v.percent ?? 0 });
}
function scopeText(v: VoucherDef): string {
  if (isSingleSkuVoucher(v)) {
    const name = getProduct(v.applicableSkus[0])?.name ?? v.applicableSkus[0];
    return fmt(t.value.voucher.scopeSingle, { name });
  }
  return t.value.voucher.scopeAll;
}
function expiryText(v: VoucherDef): string {
  return v.endAt === 0 ? t.value.rewards.noExpiry : fmt(t.value.rewards.validUntil, { date: formatDate(v.endAt) });
}
function rewardTypeLabel(type: BillType): string {
  if (type === "refer") return t.value.rewards.typeRefer;
  if (type === "achievement") return t.value.rewards.typeAchievement;
  return t.value.rewards.typeBonus;
}
function onUse(v: VoucherDef) {
  if (isSingleSkuVoucher(v)) {
    navTo(`/store/detail?id=${v.applicableSkus[0]}`);
  } else {
    navTo("/store");
  }
}

// ── styles ──
const secHeadStyle: CSSProperties = {
  margin: "20px 24px 8px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--v5-ink-4)",
};
const cardStyle: CSSProperties = {
  margin: "0 16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  overflow: "hidden",
};
function rowStyle(i: number): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 16px",
    borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)",
  };
}
function vIconStyle(dim: boolean): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: dim
      ? "var(--v5-surface-2)"
      : "color-mix(in srgb, var(--v5-brand) 12%, transparent)",
  };
}
const rowTitleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 500, color: "var(--v5-ink)" };
const rowTitleExpiredStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 500, color: "var(--v5-ink-3)" };
const valueStyle: CSSProperties = { fontWeight: 600, color: "var(--v5-brand)" };
const rowSubStyle: CSSProperties = { marginTop: "2px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
const rowDateStyle: CSSProperties = { marginTop: "2px", fontSize: "11px", color: "var(--v5-ink-4)" };
const rewardAmountStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-brand)",
};
const useBtnStyle: CSSProperties = {
  minHeight: "30px",
  padding: "0 13px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
};
const useBtnTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-on-brand)",
};
const expiredBadgeStyle: CSSProperties = {
  padding: "3px 9px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-4)",
  fontSize: "11px",
};
const emptyStyle: CSSProperties = {
  margin: "20px 16px 0",
  background: "var(--v5-surface)",
  border: "1px dashed var(--v5-border)",
  borderRadius: "16px",
  padding: "32px",
  textAlign: "center",
};
const emptyTitleStyle: CSSProperties = { marginTop: "12px", fontSize: "13.5px", color: "var(--v5-ink-2)" };
const emptyHintStyle: CSSProperties = { marginTop: "6px", fontSize: "11.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
</script>
