<template>
  <view class="quota-tier nx-viz-motion" :class="wide ? 'quota-tier--wide' : 'quota-tier--compact'" :aria-busy="pending">
    <!-- Status tag left, stock ring top-right, laid over the enlarged machine image. -->
    <view class="quota-tier__top">
      <NxTag :tone="!visibility.hidden && !pending && unlocked ? 'success' : 'neutral'" :label="visibility.mask(pending ? '—' : unlocked ? t.quota.unlocked : t.quota.locked)" />
      <view ref="stockBarRef" class="quota-stock" role="img" :aria-label="stockText"><view class="quota-stock__ring" :class="{ 'quota-stock__ring--out': !pending && stockLeft <= 0 }" :style="stockRingStyle"><view class="quota-stock__hole nx-num-metric"><text>{{ pending ? '—' : stockLeft }}</text></view></view></view>
    </view>
    <view class="quota-product" role="link" tabindex="0" :aria-label="displayName" @click="openProduct" @keydown.enter.prevent="openProduct">
      <view class="quota-product__stage"><image v-if="imageSrc" :src="imageSrc" mode="aspectFit" class="quota-product__image" :alt="displayName" @error="imageError" /><!-- Missing or failed art: the same neutral placeholder as the product render (04.2). --><svg v-else class="quota-product__placeholder" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg></view>
      <view class="quota-product__name-row"><text class="quota-product__name">{{ displayName }}</text><svg class="quota-product__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></view>
      <view class="quota-product__price nx-num-amount"><text class="quota-price-symbol">$</text><text>{{ priceParts[0] }}</text><text v-if="priceParts[1]" class="quota-price-fraction">.{{ priceParts[1] }}</text></view>
    </view>
    <text v-if="tier.conditions.length" class="quota-section-label">{{ tier.unlockKind === 'either' ? t.quota.unlockEither : t.quota.unlockAll }}</text>
    <view v-if="tier.conditions.length" class="quota-conditions">
      <view v-for="(condition, index) in tier.conditions" :key="index" class="quota-condition">
        <view class="quota-stat-line"><text>{{ conditionLabel(condition) }}{{ condition.kind === 'volume' ? pointsUnitSuffix : '' }}</text><text class="quota-condition__values nx-num-metric" :aria-label="conditionValue(condition)">{{ conditionValue(condition, true) }}</text></view>
        <QuotaConditionBar v-if="!visibility.hidden" :pct="pending ? 0 : condition.required > 0 ? Math.min(1, Math.max(0, condition.current / condition.required)) : 1" :met="!pending && condition.current >= condition.required" :tint="tier.tint" :label="conditionLabel(condition)" :value-text="conditionValue(condition)" />
      </view>
    </view>
    <view class="quota-meta">
      <text>{{ stockText }}</text>
      <text v-for="(perk, index) in tier.perks" :key="index">{{ perk }}</text>
    </view>
    <view class="quota-actions">
      <view v-if="pending" class="nx-card-footer quota-text-action"><text class="nx-card-action" aria-disabled="true" :aria-label="fmt(t.quota.buyCta, { name: displayName })">{{ wide ? fmt(t.quota.buyCta, { name: displayName }) : t.quota.buy }}</text></view>
      <NxButton v-else-if="unlocked && stockLeft > 0 && tier.available !== false" class="quota-buy" :variant="wide ? 'primary' : 'brand'" :size="wide ? 'large' : 'medium'" :label="fmt(t.quota.buyCta, { name: displayName })" :disabled="actionBlocked" @click="openAction"><text>{{ t.quota.buy }}</text></NxButton>
      <text v-else-if="stockLeft <= 0" class="quota-unavailable" aria-disabled="true">{{ t.quota.stockUnavailable }}</text>
      <text v-else-if="unlocked && tier.available === false" class="quota-unavailable" aria-disabled="true">{{ auditCopy.quotaUnavailable }}</text>
      <!-- Compact cards are too narrow for the one-line entry; the status reads as text and the product row above opens the same detail page. -->
      <text v-else-if="!wide" class="quota-unavailable">{{ t.store.purchaseEligibilityIneligible }}</text>
      <view v-else class="nx-card-footer quota-text-action"><view class="nx-card-action nx-card-action--muted" role="button" :tabindex="actionBlocked ? -1 : 0" :aria-disabled="actionBlocked" @click="!actionBlocked && openAction()" @keydown.enter.prevent="!$event.repeat && !actionBlocked && openAction()" @keydown.space.prevent="!$event.repeat && !actionBlocked && openAction()"><text>{{ t.store.purchaseEligibilityIneligible }}</text><svg class="nx-card-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></view></view>
      <!-- Why the action is off while quota refreshes or could not be read, one line under it (03 §3.1, §3.4). The line keeps its space so the card does not jump on every refresh. -->
      <text v-if="!pending && stockLeft > 0 && (unlocked ? tier.available !== false : wide)" class="quota-blocked-note" :class="{ 'quota-blocked-note--idle': !actionBlocked, 'quota-blocked-note--center': wide && unlocked }" :aria-hidden="!actionBlocked">{{ actionBlocked ? blockedNote : '' }}</text>
    </view>
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
import NxButton from '@/components/ui/nx-button.vue';
import NxTag from '@/components/ui/nx-tag.vue';
import { useT } from '@/i18n/use-t';
import { fmt } from '@/i18n/format';
import { getProductMedia } from '@/lib/product-media';
import { useProductImage } from '@/composables/use-product-image';
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


// wide: the only tier on the page, full width with the page's primary action. Otherwise a carousel card.
const props = defineProps<{ tier: QuotaTier; pending?: boolean; actionBlocked?: boolean; blockedNote?: string; wide?: boolean }>();
const emit = defineEmits<{ navigate: [url: string] }>();
const t = useT();
const visibility = useDataVisibility();
const locale = useLocaleStore();
const auditCopy = computed(() => networkReauditCopy(locale.code));
const displayName = computed(() => (props.tier.name));
const productImage = computed(() => getProductMedia(props.tier.productId)?.src ?? props.tier.imageUrl);
const { imageSrc, imageError } = useProductImage(() => productImage.value ?? undefined);
const { elRef: stockBarRef, inView: stockBarInView } = useScrollGrowProgress();
const unlocked = computed(() => {
  const met = props.tier.conditions.map(condition => condition.current >= condition.required);
  return met.length === 0 || (props.tier.unlockKind === 'either' ? met.some(Boolean) : met.every(Boolean));
});
// A tier with no quota and nothing used draws an empty ring; one with no quota but units used is full.
const stockPct = computed(() => props.tier.monthlyStock > 0 ? Math.min(1, props.tier.soldThisMonth / props.tier.monthlyStock) : props.tier.soldThisMonth > 0 ? 1 : 0);
const stockLeft = computed(() => Math.max(0, props.tier.monthlyStock - props.tier.soldThisMonth));
// Shown on the card and read for the ring: what is left and the period total.
const stockText = computed(() => `${fmt(t.value.quota.leftLabel, { n: props.pending ? '—' : stockLeft.value })} · ${fmt(t.value.quota.totalLabel, { n: props.pending ? '—' : props.tier.monthlyStock })}`);
const priceParts = computed(() => formatFinanceAmount(props.tier.price).split('.'));
const stockRingStyle = computed(() => ({ '--nx-viz-ring': props.pending || stockBarInView.value === false ? 0 : stockPct.value * 100, transition: props.pending || stockBarInView.value === false ? 'none' : VIZ_RING_TRANSITION }));
const pointsUnitSuffix = computed(() => locale.code.startsWith('zh') ? `（${computePointsCopy(locale.code).unit}）` : ` (${computePointsCopy(locale.code).unit})`);
function conditionLabel(condition: QuotaCondition) {
  return condition.label;
}
// Values show the bare pair; the points unit is written once in the condition label (03 §3.6.1), and the accessible label keeps it on both numbers.
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
/* Solid content card (01 §1.1.2) below the tinted hero; a column so cards side by side end on the same action line. */
.quota-tier { position:relative; display:flex; flex-direction:column; box-sizing:border-box; min-width:0; padding:var(--ui-space-inset); border-radius:var(--ui-radius-surface); background:var(--v5-surface); color:var(--v5-ink); }
[data-theme="light"] .quota-tier { box-shadow:var(--v5-glass-shadow); }
.quota-tier__top { position:absolute; z-index:1; top:var(--ui-space-inset); left:var(--ui-space-inset); right:var(--ui-space-inset); display:flex; align-items:flex-start; justify-content:space-between; gap:var(--v5-space-2); pointer-events:none; }
.quota-stock { flex:none; }
.quota-stock__ring { display:grid; place-items:center; width:48px; height:48px; border-radius:50%; background:conic-gradient(var(--v5-brand) calc(var(--nx-viz-ring) * 1%),var(--v5-surface-3) 0); }
.quota-stock__hole { display:grid; place-items:center; width:38px; height:38px; border-radius:50%; background:var(--v5-surface); color:var(--v5-ink); font:500 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-metric); }
/* Nothing left: a neutral fill, so a full ring does not read as done (dark brand = success). */
.quota-stock__ring--out { background:conic-gradient(var(--v5-ink-3) calc(var(--nx-viz-ring) * 1%),var(--v5-surface-3) 0); }
.quota-tier--compact .quota-stock__ring { width:40px; height:40px; }
/* All-caps English tag gets +0.04em; other languages are sentence case (01 §1.2). */
.quota-tier__top :deep(.nx-tag):lang(en) { letter-spacing:.04em; }
.quota-tier--compact .quota-stock__hole { width:32px; height:32px; font-size:var(--ui-type-meta); line-height:var(--ui-type-meta-lh); }
.quota-product { display:block; margin-bottom:var(--ui-space-inset); cursor:pointer; }
/* The machine is the card's subject: the image fills the card width; the tag and ring may sit over it. */
.quota-product__stage { display:flex; align-items:center; justify-content:center; height:184px; margin:0 calc(-1 * var(--v5-space-2)); overflow:hidden; }
.quota-tier--compact .quota-product__stage { height:156px; }
/* Product art carries about 40% transparent margin (04.1 draws machine art at 1.5x its slot); scale it so the machine fills the stage. */
.quota-product__image { width:100%; height:100%; transform:scale(1.4); pointer-events:none; }
.quota-product__placeholder { color:var(--v5-ink-3); }
.quota-product__name-row { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--v5-space-1); margin-top:var(--v5-space-2); }
.quota-product__name { min-width:0; font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); overflow-wrap:break-word; }
.quota-product__arrow { flex:none; margin-top:3px; color:var(--v5-ink-4); }
.quota-product__price { display:flex; align-items:baseline; margin-top:var(--v5-space-1); font:var(--ui-type-metric-value-weight) var(--ui-type-metric-value)/var(--ui-type-metric-value-lh) var(--font-amount); color:var(--v5-ink); }
.quota-price-symbol { margin-right:2px; font-size:max(12px, .55em); color:var(--v5-ink-3); }
.quota-price-fraction { color:var(--v5-ink-3); }
.quota-product:focus-visible { outline:2px solid var(--v5-brand); outline-offset:4px; border-radius:12px; }
.quota-section-label { display:block; margin-top:var(--v5-space-1); font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); overflow-wrap:break-word; }
.quota-condition { margin-top:var(--v5-space-3); }
.quota-stat-line { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:var(--v5-space-1) var(--v5-space-3); font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
.quota-condition__values { margin-left:auto; font:500 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-metric); color:var(--v5-ink); font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; }
.quota-tier--compact .quota-condition__values { font-size:var(--ui-type-meta); line-height:var(--ui-type-meta-lh); }
/* Progress (design-rules Progress): thin ink-8% track, brand fill fading in toward a small solid head. */
.quota-condition :deep(.quota-progress) { height:4px; margin:var(--v5-space-2) 3px 0; background:color-mix(in srgb,var(--v5-ink) 8%,transparent); overflow:visible; }
.quota-condition :deep(.quota-progress > view) { position:relative; background:linear-gradient(90deg,color-mix(in srgb,var(--v5-brand) 12%,transparent),color-mix(in srgb,var(--v5-brand) 70%,transparent)); }
.quota-condition :deep(.quota-progress > view::after) { content:""; position:absolute; top:50%; right:-3px; width:6px; height:6px; margin-top:-3px; border-radius:50%; background:var(--v5-brand); }
.quota-meta { display:flex; flex-direction:column; gap:var(--v5-space-1); margin-top:var(--ui-space-inset); padding-top:var(--v5-space-3); border-top:1px solid color-mix(in srgb,var(--v5-ink) 8%,transparent); font:400 var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
/* One tier: the full-width primary L. Carousel: brand glass M at the bottom right (03 §3.1). */
.quota-actions { display:flex; flex-direction:column; align-items:flex-end; margin-top:auto; padding-top:var(--ui-space-inset); }
.quota-tier--wide .quota-actions { align-items:stretch; }
.quota-actions :deep(.quota-buy) { box-sizing:border-box; }
.quota-blocked-note { display:block; min-height:var(--ui-type-note-lh); margin-top:var(--v5-space-1); font:var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color:var(--v5-ink-3); text-align:right; overflow-wrap:break-word; }
.quota-blocked-note--center { text-align:center; }
.quota-blocked-note--idle { visibility:hidden; }
.quota-text-action { align-self:stretch; min-height:44px; border-top:0; }
.quota-unavailable { display:block; align-self:stretch; font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
</style>
