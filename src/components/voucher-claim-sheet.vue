<!--
  VoucherClaimSheet — chassis-level bottom sheet for claiming 代金券. Surfaced by
  Home auto-push (voucher-claim-sheet store) + manual entry from VoucherBanner.
  Lists claimable + already-claimed-unused vouchers; each card's CTA flips from
  「领取」(claim) to「马上去使用」(use → routes to the SKU detail for a single-SKU
  voucher, else the mall). Mirrors trial-claim-sheet.vue's backdrop + slide-up.
  Zero card chrome on the protected tab pages — this is a chassis overlay.
-->
<template>
  <view v-if="sheet.open" class="vcs-root" role="dialog" aria-modal="true" :aria-label="t.voucher.popupTitle">
    <view class="vcs-backdrop" @click="hide" />

    <view class="nx-glass-sheet vcs-panel" @click.stop>
      <!-- header -->
      <view class="vcs-head">
        <view class="vcs-head-l">
          <view class="vcs-tk-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg>
          </view>
          <view class="vcs-head-meta">
            <text class="vcs-cap">{{ t.voucher.popupCap }}</text>
            <text class="vcs-title">{{ t.voucher.popupTitle }}</text>
          </view>
        </view>
        <!-- The shared sheet close (as NxSheet): neutral glass M, round (03 §3.1 圆形关闭, 全站玻璃控件边缘). -->
        <NxButton class="vcs-close" :label="t.voucher.closeAria" size="medium" round @click="hide"><NxIcon name="close" :size="18" /></NxButton>
      </view>

      <text class="vcs-sub">{{ t.voucher.popupSubtitle }}</text>

      <!-- voucher cards -->
      <view class="vcs-list">
        <view v-for="v in vouchers" :key="v.id" class="vcs-card">
          <view class="vcs-card-l">
            <text class="vcs-val">{{ valueText(v) }}</text>
            <text v-if="condText(v)" class="vcs-cond">{{ condText(v) }}</text>
          </view>
          <view class="vcs-card-r">
            <text class="vcs-name">{{ v.name }}</text>
            <text class="vcs-scope">{{ scopeText(v) }}</text>
            <text class="vcs-expiry">{{ expiryText(v) }}</text>
            <!-- The voucher card is a tinted card, so its action is a brand text action, never glass (03 §3.1 P-67): 「立即领取」
                 acts in place; once claimed, 「去使用」 carries a trailing arrow into the next page. The same node stays,
                 so focus stays on it when the claim lands. The slot keeps the 44px row in both states. -->
            <view class="vcs-cta">
              <NxButton variant="text" size="medium" :label="voucher.isClaimed(v.id) ? t.voucher.useCta : t.voucher.claimCta" :icon="voucher.isClaimed(v.id) ? 'arrow-right' : undefined" @click="voucher.isClaimed(v.id) ? onUse(v) : onClaim(v)" />
            </view>
          </view>
        </view>
      </view>

      <!-- Text button (03 §3.1). Once every listed voucher is claimed there is nothing left to decline, so it closes (06.1). -->
      <view class="vcs-dismiss" role="button" tabindex="0" :aria-label="dismissLabel" @click="hide" @keydown.enter.stop.prevent="hide" @keydown.space.stop.prevent="hide">
        <text class="vcs-dismiss-t">{{ dismissLabel }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatDisplayDate } from "@/lib/display-date";
import { formatAmount } from "@/lib/amount-display";
import { computed } from "vue";
import { useVoucherClaimSheet } from "@/store/voucher-claim-sheet";
import { useVoucher } from "@/store/voucher";
import { getProduct } from "@/mock/products";
import { isSingleSkuVoucher, listVouchers, type VoucherDef } from "@/mock/vouchers";
import { visibleVoucherCatalog } from "@/lib/voucher-sheet-authority";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { remoteApiEnabled } from "@/api/runtime";
import { dateLocale, fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import NxButton from "@/components/ui/nx-button.vue";
import NxIcon from "@/components/ui/nx-icon.vue";

const sheet = useVoucherClaimSheet();
const voucher = useVoucher();
const t = useT();

// Showable = claimable (unclaimed) ∪ claimed-unused (ready to use), in stable
// catalog order so a card never jumps position when its CTA flips claim→use.
const vouchers = computed<VoucherDef[]>(() => {
  return visibleVoucherCatalog(
    remoteApiEnabled ? voucher.catalog : listVouchers(),
    voucher.claimableVouchers,
    voucher.claimedUnused,
    sheet.surface,
  );
});

const dismissLabel = computed(() => vouchers.value.length > 0 && vouchers.value.every(v => voucher.isClaimed(v.id))
  ? t.value.voucher.closeAria : t.value.voucher.dismissCta);

function formatDate(ms: number): string {
  return formatDisplayDate(ms, dateLocale());
}

function valueText(v: VoucherDef): string {
  return v.type === "fixed"
    ? fmt(t.value.voucher.offFixed, { amount: formatAmount(v.amountUSD ?? 0) })
    : fmt(t.value.voucher.offPercent, { percent: v.percent ?? 0 });
}
function condText(v: VoucherDef): string {
  if (v.type === "fixed" && (v.minPurchaseUSD ?? 0) > 0) {
    return fmt(t.value.voucher.condMin, { min: formatAmount(v.minPurchaseUSD ?? 0) });
  }
  if (v.type === "percent" && (v.maxDiscountUSD ?? 0) > 0) {
    return fmt(t.value.voucher.condCap, { cap: formatAmount(v.maxDiscountUSD ?? 0) });
  }
  return "";
}
function scopeText(v: VoucherDef): string {
  if (isSingleSkuVoucher(v)) {
    const name = getProduct(v.applicableSkus[0])?.name ?? v.applicableSkus[0];
    return fmt(t.value.voucher.scopeSingle, { name });
  }
  return t.value.voucher.scopeAll;
}
function expiryText(v: VoucherDef): string {
  return v.endAt === 0 ? t.value.voucher.noExpiry : fmt(t.value.voucher.expiryLabel, { date: formatDate(v.endAt) });
}

function hide() {
  sheet.hide();
}
async function onClaim(v: VoucherDef) {
  if (remoteApiEnabled) {
    if (await voucher.claimRemote(v.id, sheet.surface)) toast.success(t.value.voucher.claimedToast);
    else toast.error(voucher.remoteStatus === 'ready' ? t.value.promotion.eventVoucherUnavailable : t.value.authOtp.errorServiceUnavailable);
    return;
  }
  const r = voucher.claim(v.id);
  if (r.ok) {
    toast.success(t.value.voucher.claimedToast);
  } else if (r.conflict) {
    // 这张券在别处(另一标签页 / 另一端)已经领过,store 已把最新券包刷回来 —— 说清楚,
    // 不能让用户点了没反应。
    toast.warn(t.value.errors.staleTitle, t.value.errors.staleMsg);
  }
}
function onUse(v: VoucherDef) {
  sheet.hide();
  if (isSingleSkuVoucher(v)) {
    // navTo() per project convention (maps /store/detail → /pages/store/detail).
    navTo(`/store/detail?id=${v.applicableSkus[0]}`);
  } else {
    navTo("/store");
  }
}

// 遮罩只拦指针不拦键盘:不接这一层,弹层打开后 Tab 会直接走到背景(那里有花钱的按钮)。
useDialogA11y(computed(() => sheet.open), ".vcs-root", hide);


</script>

<style scoped>
.vcs-root {
  position: fixed;
  inset: 0;
  z-index: 790;
}
.vcs-backdrop {
  position: absolute;
  inset: 0;
  background: var(--v5-bg-color-mask);
  backdrop-filter: blur(8px) saturate(150%);
  -webkit-backdrop-filter: blur(8px) saturate(150%);
  animation: vcs-fade 0.24s ease-out;
}
.vcs-panel { border-radius: var(--nx-glass-radius) var(--nx-glass-radius) 0 0; box-shadow: var(--nx-glass-edge);
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  box-sizing: border-box;
  max-height: calc(100% - var(--nx-overlay-top));
  overflow-y: auto;


  background: var(--nx-glass-fill);
  border: none;
  padding: 20px 16px;
  padding-bottom: var(--nx-overlay-bottom);
  animation: vcs-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes vcs-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes vcs-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.vcs-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.vcs-head-l {
  display: flex;
  align-items: center;
  gap: 10px;
}
.vcs-tk-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--v5-brand) 14%, transparent);
}
.vcs-head-meta {
  display: flex;
  flex-direction: column;
}
/* Eyebrow: interface font, label role 12/16 500, no tracking or capitals (01 §1.2 字距, 06 §6.3 no monospace for style). */
.vcs-cap {
  font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5);
  color: var(--v5-brand);
}
/* Sheet title: overview-title role (03 §3.9). */
.vcs-title {
  font: var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);
  letter-spacing: -0.01em;
  color: var(--v5-ink);
  margin-top: 2px;
}
.vcs-title:lang(zh) {
  letter-spacing: 0;
}
.vcs-close {
  flex: none;
}
.vcs-sub {
  display: block;
  margin-top: 8px;
  font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);
  color: var(--v5-ink-3);
}
.vcs-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.vcs-card {
  display: flex;
  align-items: stretch;
  gap: 14px;
  border-radius: 16px;
  padding: 14px;
  background: color-mix(in srgb, var(--v5-brand) 6%, var(--v5-surface-2));
}
.vcs-card-l {
  flex-shrink: 0;
  width: 104px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  border-right: 1px dashed color-mix(in srgb, var(--v5-brand) 32%, transparent);
  padding-right: 12px;
}
/* Face value: the card's own main figure under 30px, Montserrat 500 (10 §10.1 卡内主数值, 01 §1.2 金额不另设 600). */
.vcs-val {
  font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount);
  color: var(--v5-brand);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
/* Conditions and expiry carry information: auxiliary ink, never the disabled ink (01 §1.1.1). */
.vcs-cond {
  font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);
  color: var(--v5-ink-3);
  text-align: center;
}
.vcs-card-r {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* Voucher name and its lines: list title 500 and list subtitle (10 §10.1; same as the voucher list, rewards-list). */
.vcs-name {
  font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5);
  color: var(--v5-ink);
  overflow-wrap: break-word;
}
.vcs-scope {
  margin-top: 4px;
  font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5);
  color: var(--v5-ink-3);
}
.vcs-expiry {
  margin-top: 2px;
  font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);
  font-variant-numeric: tabular-nums;
  color: var(--v5-ink-3);
}
.vcs-cta {
  /* 主人 2026-08-16:CTA 落卡片右下角,与上方文字块拉开,不挤在一起 */
  margin-top: 12px;
  align-self: flex-end;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.vcs-dismiss {
  margin-top: 16px;
  width: 100%;
  /* tap≥44;弱化靠 ghost 文字(无填充 + 400 + ink-3),不靠缩小热区 */
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.12s ease;
}
.vcs-dismiss:active {
  opacity: 0.7;
}
/* Text button (03 §3.1): no container, brand ink, button role. */
.vcs-dismiss-t {
  font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5);
  color: var(--v5-brand);
  text-align: center;
}
.vcs-dismiss:focus-visible {
  outline: 2px solid var(--v5-brand);
  outline-offset: 3px;
}
</style>
