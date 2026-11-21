<template>
  <view class="quota-tier nx-viz-motion" :class="{ 'quota-tier--wide': wide }" :aria-busy="pending">
    <view v-if="!hideProduct" class="quota-product" role="link" tabindex="0" :aria-label="displayName" @click="openProduct" @keydown.enter.prevent="openProduct">
      <image v-if="productImage" :src="productImage" mode="aspectFit" class="quota-product__image" :alt="displayName" />
      <view class="quota-product__copy"><text class="quota-product__name">{{ displayName }}</text><view class="quota-product__price nx-num-amount"><text class="quota-price-symbol">$</text><text>{{ priceParts[0] }}</text><text v-if="priceParts[1]" class="quota-price-fraction">.{{ priceParts[1] }}</text></view></view>
      <svg class="quota-product__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </view>
    <view class="quota-tier__head">
      <text v-if="tier.conditions.length" class="quota-section-label">{{ tier.unlockKind === 'either' ? t.quota.unlockEither : t.quota.unlockAll }}</text>
      <NxTag :tone="!visibility.hidden && !pending && unlocked ? 'success' : 'neutral'" :label="visibility.mask(pending ? '—' : unlocked ? t.quota.unlocked : t.quota.locked)" />
    </view>
    <view v-if="tier.conditions.length" class="quota-conditions">
      <view v-for="(condition, index) in tier.conditions" :key="index" class="quota-condition">
        <view class="quota-stat-line"><text>{{ conditionLabel(condition) }}</text><text class="quota-condition__values nx-num-metric" :aria-label="conditionValue(condition)">{{ conditionValue(condition, true) }}</text></view>
        <QuotaConditionBar v-if="!visibility.hidden" :pct="pending ? 0 : condition.required > 0 ? Math.min(1, Math.max(0, condition.current / condition.required)) : 1" :met="!pending && condition.current >= condition.required" :tint="tier.tint" :label="conditionLabel(condition)" :value-text="conditionValue(condition)" />
      </view>
    </view>
    <view class="quota-meta">
      <view ref="stockBarRef" class="quota-stock"><view class="quota-stock__ring" :style="stockRingStyle" aria-hidden="true"><view class="quota-stock__hole" /></view><text>{{ fmt(t.quota.leftLabel, { n: pending ? '—' : stockLeft }) }} · {{ fmt(t.quota.soldPct, { pct: pending ? '—' : Math.round(stockPct * 100) }) }}</text></view>
      <text v-for="(perk, index) in tier.perks" :key="index">{{ perk }}</text>
    </view>
    <view class="quota-actions" :class="{ 'quota-pending-action': actionBlocked }">
      <view v-if="pending" class="nx-card-footer quota-text-action"><text class="nx-card-action" aria-disabled="true">{{ fmt(t.quota.buyCta, { name: displayName }) }}</text></view>
      <NxButton v-else-if="unlocked && stockLeft > 0 && tier.available !== false" class="quota-buy" :variant="wide ? 'primary' : 'brand'" :size="wide ? 'large' : 'medium'" :label="fmt(t.quota.buyCta, { name: displayName })" :disabled="actionBlocked" @click="openAction"><text>{{ t.quota.buy }}</text></NxButton>
      <text v-else-if="stockLeft <= 0" class="quota-unavailable" aria-disabled="true">{{ t.quota.stockUnavailable }}</text>
      <text v-else-if="unlocked && tier.available === false" class="quota-unavailable" aria-disabled="true">{{ auditCopy.quotaUnavailable }}</text>
      <view v-else class="nx-card-footer quota-text-action"><view class="nx-card-action nx-card-action--muted" role="button" :tabindex="actionBlocked ? -1 : 0" :aria-disabled="actionBlocked" @click="!actionBlocked && openAction()" @keydown.enter.prevent="!$event.repeat && !actionBlocked && openAction()" @keydown.space.prevent="!$event.repeat && !actionBlocked && openAction()"><text>{{ t.store.purchaseEligibilityIneligible }}</text><svg class="nx-card-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></view></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { useDataVisibility } from "@/store/data-visibility";
import { computed } from 'vue';
import { formatFinanceAmount } from '@/lib/finance-amount-display';
import { formatComputePoints } from '@/i18n/compute-points';
import { useLocaleStore } from '@/store/locale';
import { networkReauditCopy } from '@/i18n/network-reaudit';
import QuotaConditionBar from './quota-condition-bar.vue';
import NxButton from '@/components/ui/nx-button.vue';
import NxTag from '@/components/ui/nx-tag.vue';
import { useT } from '@/i18n/use-t';
import { fmt } from '@/i18n/format';
import { getProductMedia } from '@/lib/product-media';
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


// wide: the only tier on the page, shown full width with the page's primary action.
// hideProduct: the page hero already shows this product's name, price and image.
const props = defineProps<{ tier: QuotaTier; pending?: boolean; actionBlocked?: boolean; wide?: boolean; hideProduct?: boolean }>();
const emit = defineEmits<{ navigate: [url: string] }>();
const t = useT();
const visibility = useDataVisibility();
const locale = useLocaleStore();
const auditCopy = computed(() => networkReauditCopy(locale.code));
const displayName = computed(() => (props.tier.name));
const productImage = computed(() => getProductMedia(props.tier.productId)?.src ?? props.tier.imageUrl);
const { elRef: stockBarRef, inView: stockBarInView } = useScrollGrowProgress();
const unlocked = computed(() => {
  const met = props.tier.conditions.map(condition => condition.current >= condition.required);
  return met.length === 0 || (props.tier.unlockKind === 'either' ? met.some(Boolean) : met.every(Boolean));
});
const stockPct = computed(() => props.tier.monthlyStock > 0 ? Math.min(1, props.tier.soldThisMonth / props.tier.monthlyStock) : 1);
const stockLeft = computed(() => Math.max(0, props.tier.monthlyStock - props.tier.soldThisMonth));
const priceParts = computed(() => formatFinanceAmount(props.tier.price).split('.'));
const stockRingStyle = computed(() => ({ '--nx-viz-ring': props.pending || stockBarInView.value === false ? 0 : stockPct.value * 100, transition: props.pending || stockBarInView.value === false ? 'none' : VIZ_RING_TRANSITION }));
function conditionLabel(condition: QuotaCondition) {
  return condition.label;
}
// Compact values drop the points unit on screen; the accessible label keeps it.
function conditionValue(condition: QuotaCondition, compact = false) {
  if (props.pending) return `${visibility.mask("—")} / —`;
  return condition.kind === 'volume'
    ? compact
      ? `${visibility.mask(formatComputePoints(condition.current, locale.code).split(' ')[0])} / ${formatComputePoints(condition.required, locale.code).split(' ')[0]}`
      : `${visibility.mask(formatComputePoints(condition.current, locale.code))} / ${formatComputePoints(condition.required, locale.code)}`
    : `${visibility.mask(condition.current)} / ${condition.required}`;
}
function openProduct() { emit('navigate', `/pages/store/detail?id=${encodeURIComponent(props.tier.productId)}`); }
function openAction() { if (!props.pending && !props.actionBlocked) openProduct(); }
</script>
<style scoped>
.quota-pending-action :deep(.nx-button--disabled), .quota-pending-action { opacity: 1; }
/* Solid content card (01 §1.1.2): peers in the carousel and the single conditions card below the tinted hero. */
.quota-tier { box-sizing:border-box; padding:var(--ui-space-inset); border-radius:var(--ui-radius-surface); background:var(--v5-surface); color:var(--v5-ink); }
:global([data-theme="light"]) .quota-tier { box-shadow:var(--v5-glass-shadow); }
.quota-product { display:flex; align-items:center; gap:var(--ui-space-inline); margin-bottom:var(--ui-space-inset); cursor:pointer; }
.quota-product__image { flex:none; width:72px; height:72px; }
.quota-product__copy { flex:1; min-width:0; }
.quota-product__name { display:block; font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); overflow-wrap:break-word; }
.quota-product__price { display:flex; align-items:baseline; margin-top:var(--v5-space-1); font:500 18px/24px var(--font-amount); color:var(--v5-ink); }
.quota-price-symbol { margin-right:2px; font-size:12px; color:var(--v5-ink-3); }
.quota-price-fraction { color:var(--v5-ink-3); }
.quota-product__arrow { flex:none; color:var(--v5-ink-4); }
.quota-product:focus-visible { outline:2px solid var(--v5-brand); outline-offset:4px; border-radius:12px; }
.quota-tier__head { display:flex; align-items:center; flex-wrap:wrap; gap:var(--v5-space-2); }
.quota-tier__head :deep(.nx-tag) { margin-left:auto; }
.quota-section-label { min-width:0; font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); overflow-wrap:break-word; }
.quota-condition { margin-top:var(--v5-space-3); }
.quota-stat-line { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:var(--v5-space-1) var(--v5-space-3); font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
.quota-condition__values { margin-left:auto; font:500 13px/18px var(--font-metric); color:var(--v5-ink); font-variant-numeric:tabular-nums; text-align:right; }
/* Progress (design-rules Progress): thin ink-8% track, brand fill fading in toward a small solid head. */
.quota-condition :deep(.quota-progress) { height:4px; margin:var(--v5-space-2) 3px 0; background:color-mix(in srgb,var(--v5-ink) 8%,transparent); overflow:visible; }
.quota-condition :deep(.quota-progress > view) { position:relative; background:linear-gradient(90deg,color-mix(in srgb,var(--v5-brand) 12%,transparent),color-mix(in srgb,var(--v5-brand) 70%,transparent)); }
.quota-condition :deep(.quota-progress > view::after) { content:""; position:absolute; top:50%; right:-3px; width:6px; height:6px; margin-top:-3px; border-radius:50%; background:var(--v5-brand); }
.quota-meta { display:flex; flex-direction:column; gap:var(--v5-space-1); margin-top:var(--ui-space-inset); padding-top:var(--v5-space-3); border-top:1px solid color-mix(in srgb,var(--v5-ink) 8%,transparent); font:400 var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
.quota-stock { display:flex; align-items:center; gap:var(--v5-space-2); }
.quota-stock__ring { flex:none; display:grid; place-items:center; width:16px; height:16px; border-radius:50%; background:conic-gradient(var(--v5-brand) calc(var(--nx-viz-ring) * 1%),color-mix(in srgb,var(--v5-ink) 12%,transparent) 0); }
.quota-stock__hole { width:8px; height:8px; border-radius:50%; background:var(--v5-surface); }
.quota-actions { display:flex; justify-content:flex-end; margin-top:var(--ui-space-inset); }
.quota-tier--wide .quota-actions :deep(.quota-buy) { flex:1; box-sizing:border-box; }
.quota-text-action { flex:1; min-height:44px; border-top:0; }
.quota-unavailable { display:block; font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
</style>
