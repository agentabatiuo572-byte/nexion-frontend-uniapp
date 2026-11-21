<template>
  <view class="quota-tier nx-tint nx-viz-motion" :aria-busy="pending">
    <view class="quota-tier__top">
      <NxTag class="quota-qualification" :tone="!visibility.hidden && !pending && unlocked ? 'brand' : 'neutral'"><svg v-if="!visibility.hidden && !pending && unlocked" class="quota-qualification__check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>{{ visibility.mask(pending ? '—' : unlocked ? t.quota.unlocked : t.quota.locked) }}</NxTag>
      <view ref="stockBarRef" class="quota-stock" :aria-label="`${fmt(t.quota.leftLabel, { n: pending ? '—' : stockLeft })} · ${fmt(t.quota.totalLabel, { n: pending ? '—' : tier.monthlyStock })}`">
        <view class="quota-stock__ring" :style="stockRingStyle"><view class="quota-stock__hole nx-num-metric"><text>{{ pending ? '—' : stockLeft }}</text></view></view>
      </view>
    </view>
    <view class="quota-product" role="link" tabindex="0" :aria-label="displayName" @click="openProduct" @keydown.enter.prevent="openProduct">
      <image v-if="tier.imageUrl" :src="tier.imageUrl" mode="aspectFit" class="quota-product__image" :alt="displayName" />
      <view class="quota-product__copy"><text class="quota-product__name">{{ displayName }}</text><view class="quota-product__price nx-num-amount"><text class="quota-price-symbol">$</text><text>{{ priceParts[0] }}</text><text v-if="priceParts[1]" class="quota-price-fraction">.{{ priceParts[1] }}</text></view></view>
      <svg class="quota-product__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </view>
    <view class="quota-actions">
      <view v-if="pending" class="nx-card-footer quota-text-action"><text class="nx-card-action" aria-disabled="true">{{ fmt(t.quota.buyCta, { name: displayName }) }}</text></view>
      <view v-else-if="unlocked && stockLeft > 0 && tier.available !== false" class="nx-card-footer quota-text-action"><text v-if="actionBlocked" class="nx-card-footer__note">{{ t.quota.updatingNote }}</text><view class="nx-card-action quota-buy" role="button" :tabindex="actionBlocked ? -1 : 0" :aria-disabled="actionBlocked" :aria-label="fmt(t.quota.buyCta, { name: displayName })" @click="openAction" @keydown.enter.prevent="!$event.repeat && openAction()" @keydown.space.prevent="!$event.repeat && openAction()"><text>{{ t.quota.buy }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></view></view>
      <text v-else-if="stockLeft <= 0" class="quota-unavailable" aria-disabled="true">{{ t.quota.stockUnavailable }}</text>
      <text v-else-if="unlocked && tier.available === false" class="quota-unavailable" aria-disabled="true">{{ auditCopy.quotaUnavailable }}</text>
      <view v-else class="nx-card-footer quota-text-action"><text v-if="actionBlocked" class="nx-card-footer__note">{{ t.quota.updatingNote }}</text><view class="nx-card-action nx-card-action--muted" role="button" :tabindex="actionBlocked ? -1 : 0" :aria-disabled="actionBlocked" @click="!actionBlocked && openAction()" @keydown.enter.prevent="!$event.repeat && !actionBlocked && openAction()" @keydown.space.prevent="!$event.repeat && !actionBlocked && openAction()"><text>{{ t.store.purchaseEligibilityIneligible }}</text><svg class="nx-card-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></view></view>
    </view>
    <view v-if="tier.conditions.length" class="quota-conditions">
      <text class="quota-section-label">{{ tier.unlockKind === 'either' ? t.quota.unlockEither : t.quota.unlockAll }}</text>
      <view v-for="(condition, index) in tier.conditions" :key="index" class="quota-condition">
        <view class="quota-stat-line"><text>{{ conditionLabel(condition) }}</text><text class="quota-condition__values nx-num-metric" :aria-label="conditionValue(condition)">{{ conditionValue(condition, true) }}</text></view>
        <QuotaConditionBar v-if="!visibility.hidden" :pct="pending ? 0 : condition.required > 0 ? Math.min(1, Math.max(0, condition.current / condition.required)) : 1" :met="!pending && condition.current >= condition.required" :tint="tier.tint" :label="conditionLabel(condition)" :value-text="conditionValue(condition)" />
      </view>
    </view>
    <view v-if="tier.perks.length" class="quota-perks"><text v-for="(perk, index) in tier.perks" :key="index">{{ perk }}</text></view>
  </view>
</template>
<script setup lang="ts">
import { useDataVisibility } from "@/store/data-visibility";
import { computed } from 'vue';
import { formatFinanceAmount } from '@/lib/finance-amount-display';
import { computePointsCopy, formatComputePoints } from '@/i18n/compute-points';
import { useLocaleStore } from '@/store/locale';
import { networkReauditCopy } from '@/i18n/network-reaudit';
import QuotaConditionBar from './quota-condition-bar.vue';
import NxTag from '@/components/ui/nx-tag.vue';
import { useT } from '@/i18n/use-t';
import { fmt } from '@/i18n/format';
import { useScrollGrowProgress, VIZ_RING_TRANSITION } from '@/composables/use-scroll-grow-progress';
export interface QuotaCondition {
  label: string;
  current: number;
  required: number;
  kind: "invites" | "volume";
}
export interface QuotaTier {
  available?: boolean;
  productId: string;
  imageUrl?: string;
  name: string;
  price: number;
  monthlyStock: number;
  soldThisMonth: number;
  /** BUG-549: used this month including unpaid payment orders; an old server omits it and soldThisMonth stands in. */
  usedThisMonth?: number;
  /** BUG-549: the server's buyable remainder (unpaid orders already counted); an old server omits it and monthlyStock − used stands in. */
  remaining?: number;
  unlockKind: "either" | "all";
  conditions: QuotaCondition[];
  perks: string[];
  tint: string;
  /**
   * 年化 ROI 的**推导输入**。zentao #221:此前只写「约 N% 年化(按美元日收益/售价)」,
   * 而参与计算的两个数(美元日收益、售价)页面上一分都没露 —— 用户复核不了比例来源。
   * 目录读到时由页面填上;缺失(旧服务端/目录未落地)则整行不渲染,而不是显示占位 0。
   */
  roiBasis?: { dailyEarn: number; price: number; roi: number; revision?: string | null };
}


const props = defineProps<{ tier: QuotaTier; pending?: boolean; actionBlocked?: boolean }>();
const emit = defineEmits<{ navigate: [url: string] }>();
const t = useT();
const visibility = useDataVisibility();
const locale = useLocaleStore();
const auditCopy = computed(() => networkReauditCopy(locale.code));
const displayName = computed(() => (props.tier.name));
const { elRef: stockBarRef, inView: stockBarInView } = useScrollGrowProgress();
const unlocked = computed(() => {
  const met = props.tier.conditions.map(condition => condition.current >= condition.required);
  return met.length === 0 || (props.tier.unlockKind === 'either' ? met.some(Boolean) : met.every(Boolean));
});
// The ring fills with what is used (unpaid orders included); the centre shows what can still be bought.
const stockUsed = computed(() => props.tier.usedThisMonth ?? props.tier.soldThisMonth);
// A tier with no quota and nothing used draws an empty ring; one with no quota but units used is full.
const stockPct = computed(() => props.tier.monthlyStock > 0 ? Math.min(1, stockUsed.value / props.tier.monthlyStock) : stockUsed.value > 0 ? 1 : 0);
const stockLeft = computed(() => props.tier.remaining ?? Math.max(0, props.tier.monthlyStock - stockUsed.value));
const priceParts = computed(() => formatFinanceAmount(props.tier.price).split('.'));
const stockRingStyle = computed(() => ({ '--nx-viz-ring': props.pending || stockBarInView.value === false ? 0 : stockPct.value * 100, transition: props.pending || stockBarInView.value === false ? 'none' : VIZ_RING_TRANSITION }));
function conditionLabel(condition: QuotaCondition) {
  return condition.label;
}
// Compact values write the points unit once after the pair; the accessible label keeps it on both numbers.
function conditionValue(condition: QuotaCondition, compact = false) {
  if (props.pending) return `${visibility.mask("—")} / —`;
  return condition.kind === 'volume'
    ? compact
      ? `${visibility.mask(formatComputePoints(condition.current, locale.code).split(' ')[0])} / ${formatComputePoints(condition.required, locale.code).split(' ')[0]}\u00a0${computePointsCopy(locale.code).unit}`
      : `${visibility.mask(formatComputePoints(condition.current, locale.code))} / ${formatComputePoints(condition.required, locale.code)}`
    : `${visibility.mask(condition.current)} / ${condition.required}`;
}
function openProduct() { emit('navigate', `/pages/store/detail?id=${encodeURIComponent(props.tier.productId)}`); }
function openAction() { if (!props.pending && !props.actionBlocked) openProduct(); }
</script>
<style scoped>
/* The conditions block below already draws the divider; the text action row adds none (P-67). */
.quota-text-action { min-height: 44px; border-top: 0; }
/* P-41 tinted tier card: the shared tinted solid in brand (it used to be a top glow). */
.quota-tier { --nx-tint:var(--v5-brand);padding:var(--ui-space-section) 18px 22px;margin-bottom:18px;border:1px solid var(--v5-border);border-radius:24px;color:var(--v5-ink); }
.quota-product { display:flex;align-items:center;gap:14px;min-height:80px;cursor:pointer; }
.quota-product__image { width:76px;height:80px;flex:none; }.quota-product__copy { min-width:0;flex:1; }
.quota-product__name { display:block;font:600 17px/1.4 var(--font-v5);overflow-wrap:break-word; }.quota-product__price { display:block;margin-top:var(--v5-space-1);font:500 14px/1.5 var(--font-v5);color:var(--v5-ink-2); }
.quota-qualification__check { flex:none;margin-right:var(--v5-space-1); }.quota-product__arrow { flex:none;color:var(--v5-ink-3); }
.quota-stock { margin-top:18px; }.quota-stat-line { display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px 14px;font:400 12px/1.6 var(--font-v5);color:var(--v5-ink-2);overflow-wrap:break-word; }
.quota-stock__track { height:3px;background:var(--v5-surface-3);border-radius:9px;overflow:hidden;margin-top:var(--v5-space-2); }.quota-stock__track > view { height:100%;background:var(--v5-ink-3);border-radius:inherit; }
.quota-conditions { margin-top:22px; }.quota-section-label { display:block;font:600 13px/1.5 var(--font-v5); }.quota-condition { margin-top:var(--ui-space-inset); }.quota-condition__values { margin-left:auto;font:500 13px/18px var(--font-metric);color:var(--v5-brand);font-variant-numeric:tabular-nums;text-align:right; }
.quota-perks { display:flex;flex-direction:column;gap:6px;margin-top:18px;color:var(--v5-ink-3);font:400 12px/1.6 var(--font-v5);overflow-wrap:break-word; }.quota-actions { margin-top:var(--ui-space-section); }
.quota-unavailable { display:block;font:var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.quota-product:focus-visible { outline:2px solid var(--v5-brand);outline-offset:4px; }
.quota-tier__top { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--v5-space-3); margin-bottom:var(--v5-space-3); }
.quota-tier__top .quota-stock { flex:none; margin:0; }
.quota-stock__ring { display:grid; place-items:center; width:48px; height:48px; border-radius:50%; background:conic-gradient(var(--v5-brand) calc(var(--nx-viz-ring) * 1%),var(--v5-surface-3) 0); }
.quota-stock__hole { display:grid; place-items:center; width:38px; height:38px; border-radius:50%; background:var(--v5-surface); color:var(--v5-ink); font:500 13px/18px var(--font-metric); }
.quota-product .quota-product__price { display:flex; align-items:baseline; gap:0; font:var(--ui-type-metric-value-weight) var(--ui-type-metric-value)/var(--ui-type-metric-value-lh) var(--font-amount); color:var(--v5-ink-2); letter-spacing:-.03em; }
.quota-price-symbol { font-size:12px; margin-right:2px; color:var(--v5-ink-3); }
.quota-price-fraction { color:var(--v5-ink-3); }
@media(max-width:350px) { .quota-product { gap:var(--ui-space-row-y); }.quota-product__image { width:64px;height:72px; } }
</style>
