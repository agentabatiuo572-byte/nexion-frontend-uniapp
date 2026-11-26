<template>
  <view class="promotion promotion-bundle" data-testid="promotion-bundle">
    <!-- Activity not ready, failed or not available: the existing status heading. -->
    <view v-if="!activity" class="promotion-bundle__status">
      <text class="promotion-title promotion-title--section" role="heading" aria-level="2">{{ !scopeId?t.promotion.bundle:contextStatus==='ready'?t.promotion.disabled:contextStatus==='error'?t.promotion.error:t.promotion.loading }}</text>
      <text v-if="scopeId&&(contextStatus==='loading'||contextStatus==='idle')" class="promotion-copy" role="status">{{ t.promotion.loading }}</text>
      <text v-if="scopeId && contextStatus === 'error'" class="promotion-copy">—</text>
    </view>
    <!-- Activity strip (board B): a time-limited activity, so the one coral tinted card in this screen region (01 §1.1.2);
         title, days-left tag (03 §3.8), 「活动说明 ›」 text link (03 §3.9) and this order's reward from the quote. -->
    <view v-else class="promotion-bundle__activity nx-tint" role="region" :aria-label="localized(activity.title,locale.code)">
      <view class="promotion-bundle__activity-head">
        <text class="promotion-bundle__activity-title" role="heading" aria-level="2">{{ localized(activity.title,locale.code) }}</text>
        <NxTag class="promotion-bundle__days" tone="warning" :label="promotionRemaining(activity,t.promotion)" />
        <view class="nx-card-link promotion-bundle__rules" role="button" tabindex="0" @click="termsOpen=true" @keydown.enter.prevent="termsOpen=true" @keydown.space.prevent="termsOpen=true"><text>{{ t.promotion.rulesLink }}</text><svg class="nx-card-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></view>
      </view>
      <view v-if="orderRewards.length" class="promotion-bundle__reward">
        <text class="promotion-bundle__reward-key">{{ t.promotion.orderReward }}</text>
        <text v-for="(reward,index) in orderRewards" :key="index" class="promotion-bundle__reward-value"><text v-if="index" class="promotion-bundle__reward-sep"> · </text><text class="promotion-bundle__reward-amount">{{ reward.amount }}</text><text class="promotion-bundle__reward-unit" :class="{ 'is-uvt': reward.uvt }">{{ reward.unit }}</text></text>
      </view>
    </view>
    <!-- Only one model of this activity is on sale: the page says so here and its one action, 「查看商品并购买」, sits in
         the shared bottom bar as a lone floating button (04 §4.0); the page renders it from `single`. -->
    <view v-if="singleActivityProduct" class="promotion-flat promotion-bundle__single" data-testid="single-activity-guidance"><text class="promotion-copy">{{ commerceCopy(locale.code).singleActivity }}</text></view>
    <template v-else-if="!scopeId||activity">
    <BundleHero :count="selection.length" :tiers="quotedTiers" :items="tiles" :rules="limitReached ? t.promotion.quantityLimit : t.bundle.sameModel" :addable="suggestions.length > 0" :add-disabled="limitReached" @remove="remove" @add="jumpToSuggestions">
      <template #tile="{ item }">
        <text v-if="levelsFor(item.id)" class="promotion-bundle__tile-note">{{ levelsFor(item.id) }}</text>
        <NxTag v-if="tileTag(item.id)" class="promotion-bundle__tile-tag" tone="unavailable" :label="tileTag(item.id)" />
        <text v-for="(reward,index) in rewardsFor(item.id)" :key="index" class="promotion-bundle__tile-reward"><text class="promotion-bundle__reward-amount">+{{ reward.amount }}</text><text class="promotion-bundle__reward-unit" :class="{ 'is-uvt': reward.uvt }">{{ reward.unit }}</text></text>
        <!-- A model that cannot be bought here keeps only 移除: no quantity to change (03 §3.4). -->
        <view v-if="tileTag(item.id) !== t.bundle.tileUnavailable" class="promotion-bundle__stepper" role="group" :aria-label="item.name+' · '+t.promotion.quantity">
          <view class="promotion-bundle__step" role="button" :tabindex="quantityOf(item.id)<=1?-1:0" :aria-disabled="quantityOf(item.id)<=1" :aria-label="t.uiChrome.decreaseQty" @click="changeQuantity(item.id,-1)" @keydown.enter.prevent="changeQuantity(item.id,-1)" @keydown.space.prevent="changeQuantity(item.id,-1)"><NxIcon name="minus" :size="16" /></view>
          <text class="promotion-bundle__qty" aria-live="polite">{{ quantityOf(item.id) }}</text>
          <view class="promotion-bundle__step" role="button" :aria-label="t.uiChrome.increaseQty" :tabindex="totalUnits>=100?-1:0" :aria-disabled="totalUnits>=100" @click="changeQuantity(item.id,1)" @keydown.enter.prevent="changeQuantity(item.id,1)" @keydown.space.prevent="changeQuantity(item.id,1)"><NxIcon name="plus" :size="16" /></view>
        </view>
      </template>
    </BundleHero>
    <!-- Tiles show estimates, so the estimate note follows the focal card here too (copy-rules; same place and style as
         the plain bundle). -->
    <text v-if="selection.length > 0" class="promotion-bundle__estimate-note">{{ t.store.cardEstimateNote }}</text>
    <view v-if="catalogStatus!=='ready'" class="promotion-bundle__catalog" role="status"><text class="promotion-copy">{{ catalogStatus==='loading'?t.store.catalogLoadingBody:'—' }}</text></view>
    <BundleSuggestions v-if="suggestions.length" class="promotion-bundle__section" anchor="bundle-more" :title="t.bundle.addMore" :items="suggestionRows" @add="add" @open="openDetail" />
    </template>
    <!-- Page end (board B): the reward rule, then the next-level text links (03 §3.9). -->
    <view v-if="scopeId||builder" class="promotion-bundle__links">
      <template v-if="builder">
        <text class="promotion-bundle__note">{{ t.promotion.rewardNote }}</text>
        <view class="nx-card-link" role="button" tabindex="0" @click="navTo(promotionStoreHref(scopeId))" @keydown.enter.prevent="navTo(promotionStoreHref(scopeId))" @keydown.space.prevent="navTo(promotionStoreHref(scopeId))"><text>{{ t.promotion.buyMore }}</text><svg class="nx-card-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></view>
      </template>
      <view v-if="scopeId" class="nx-card-link" role="button" tabindex="0" @click="clearScope" @keydown.enter.prevent="clearScope" @keydown.space.prevent="clearScope"><text>{{ activity?t.promotion.ordinary:t.promotion.allProducts }}</text><svg class="nx-card-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></view>
    </view>
    <PromotionTerms v-if="activity" :open="termsOpen" :title="localized(activity.title,locale.code)" :terms="ruleTerms" :rules="firstPurchaseTermsRules(activity.firstPurchaseCondition,locale.code)" :disclosures="promotionDisclosures(activity)" @close="termsOpen=false" />
    <!-- Keeps the last link clear of the page's bottom tray (04 §4.0): an invisible copy of the tray's rows. -->
    <view v-if="singleActivityProduct" class="bundle-bar-space" aria-hidden="true"><text class="bundle-bar-space__cta bundle-bar-space__cta--wide">{{ commerceCopy(locale.code).singlePurchase }}</text></view>
    <view v-if="footer" class="bundle-bar-space" aria-hidden="true">
      <text v-if="footer.note" class="bundle-bar-space__note">{{ footer.note }}</text>
      <template v-if="footer.signedIn">
        <view v-if="footer.showTotal" class="bundle-bar-space__copy"><text class="bundle-bar-space__total">{{ footer.total ?? '—' }}</text><text class="bundle-bar-space__meta">{{ footer.saved !== null ? t.bundle.saved : t.bundle.total }}</text></view>
        <text class="bundle-bar-space__cta">{{ footer.continueLabel }}</text>
      </template>
      <text v-else class="bundle-bar-space__cta bundle-bar-space__cta--wide">{{ t.promotion.signIn }}</text>
    </view>
  </view>
</template>
<script setup lang="ts">
import { firstPurchaseTermsRules,promotionRemaining,quoteIncludesPhoneGift } from '@/lib/promotion-landing';
import NxIcon from "@/components/ui/nx-icon.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import BundleHero,{ type BundleTile } from '@/components/store/bundle-hero.vue';
import BundleSuggestions,{ type BundleSuggestion } from '@/components/store/bundle-suggestions.vue';
import { formatGroupedAmount } from '@/lib/amount-display';
import { platformDisplayText } from '@/lib/brand-copy';
import { productDailyEstimateRange } from '@/lib/product-estimates';
import { formatEstimateRange } from '@/lib/estimate-display';
import { bundleDiscountForCount } from '@/store/cart';
import type { BundleDiscountSnapshot } from '@/api/bundle-discount-api';
import { quoteBundleAmountUsdt } from '@/api/bundle-quote';
import { asApiError } from '@/api/errors';
import { hasVisiblePullRefresh } from '@/lib/active-page-refresh';
import { foregroundReadAllowed } from '@/lib/foreground-read';
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed,onBeforeUnmount,ref,watch } from 'vue';
import { onHide,onShow } from '@dcloudio/uni-app';
import { commerceCopy } from '@/lib/commerce-review';
import { promotionApi,sessionVault } from '@/api/runtime';
import { checkoutQuoteBlock,type CheckoutQuoteBlock,type Quote } from '@/api/promotion-api';
import type { ExpectedReward } from '@/api/promotion-contracts';
import { useT } from '@/i18n/use-t';
import { useApp } from '@/store/app';
import { useLocaleStore } from '@/store/locale';
import { productCatalogPresentation,productCatalogState,refreshProductCatalog } from '@/store/product-catalog';
import { useProductPhase } from '@/composables/use-product-phase';
import { isProductAvailable, productHasStock, productOutOfStock } from '@/store/product-availability';
import { isBundleHardwareAvailable } from '@/store/bundle-catalog-guard';
import { usePromotionContext } from '@/composables/use-promotion-context';
import { readAccountRow,writeAccountRow } from '@/store/account-scoped-storage';
import { catalogProductImageUrl } from '@/lib/product-image';
import { productTaskLevelsText } from '@/lib/product-copy';
import { checkoutQuoteBlockCopy,localized,displayDeadline,rewardSummary } from '@/lib/promotion-display';
import { navTo } from '@/lib/route';
import { fmt } from '@/i18n/format';
import { confirmInventoryPlacement,type InventoryPlacement } from '@/lib/inventory-placement-confirm';
import { createPromotionReadFence,isEntryQuoteFresh,restoreEntrySelection,promotionBundleHref,promotionCheckoutHref,promotionDetailHref,promotionDisclosures,promotionStoreHref,validEntryItems,type EntryItem,type EntrySelectionDraft } from '@/lib/promotion-entry';

import PromotionTerms from './promotion-terms.vue';
const props=defineProps<{activityId:string;initialItems:EntryItem[];policy:BundleDiscountSnapshot|null}>();
const app=useApp(),locale=useLocaleStore(),t=useT(),phase=useProductPhase();
const scopeId=ref(props.activityId),selection=ref<EntryItem[]>([]),termsOpen=ref(false);
const {activity,status:contextStatus,available,refresh:refreshContext}=usePromotionContext(scopeId,true);
const quote=ref<Quote|null>(null),quoteStatus=ref<'idle'|'loading'|'ready'|'error'>('idle');
const quoteBlock=ref<CheckoutQuoteBlock|null>(null);
const quoteExpired=ref(false),quoteIneligible=ref(false);
const capacityRecheckPending=ref(false);
const fence=createPromotionReadFence();const visible=ref(true);
const clockNow=()=>typeof performance!=='undefined'?performance.now():Date.now();
let quoteReceivedAt=0;
let expiryTimer:ReturnType<typeof setTimeout>|undefined;
const storageKey='growth-promotion-selection:'+props.activityId;
function restore(initial:EntryItem[]=props.initialItems){
  const saved=readAccountRow<EntrySelectionDraft>(storageKey,app.accountKey);
  selection.value=restoreEntrySelection(initial,saved);
}
restore(props.initialItems);
const catalogStatus=computed(()=>productCatalogState.status);
const repeatWithoutPull = { repeatMs: 30_000, repeatWhile: () => !hasVisiblePullRefresh() };
useAutoRecovery({ ...repeatWithoutPull, failed: () => catalogStatus.value === "error", retry: () => refreshProductCatalog(true) });
useAutoRecovery({ ...repeatWithoutPull, failed: () => contextStatus.value === "error", retry: () => refreshContext() });
const catalog=computed(()=>productCatalogPresentation.value?.products??[]);
const productFor=(id:string)=>catalog.value.find(product=>product.id===id);
const levelsFor=(id:string)=>productTaskLevelsText(t.value,productFor(id)?.taskLevels??[]);
// A draft model the catalogue does not list (still loading, or no longer sold) has no name to show: the unknown mark (03 §3.4).
const nameFor=(id:string)=>productFor(id)?.name??'—';
const imageFor=(id:string)=>catalogProductImageUrl(productFor(id)?.imageUrl,'')??'';
const ruleTerms=computed(()=>activity.value?[
  localized(activity.value.terms,locale.code),
  ...activity.value.rewardRules.map(rule=>[
    `${nameFor(rule.productNo)} · ${t.value.promotion.rulePer} ${rule.minBuyQty} · ${rule.repeatMode==='PER_GROUP'?t.value.promotion.perGroup:t.value.promotion.oncePerOrder}`,
    `${t.value.promotion.orderGroupLimit} · ${rule.maxGroups.mode==='LIMITED'?rule.maxGroups.value:t.value.promotion.unlimitedGroups}`,
    `${t.value.promotion.personGroupLimit} · ${rule.maxGroupsPerPerson.mode==='LIMITED'?rule.maxGroupsPerPerson.value:t.value.promotion.unlimitedGroups}`,
    ...[rule.buyerReward,rule.inviterReward].filter(reward=>!!reward).map(reward=>reward?`${reward.beneficiaryRole==='BUYER'?t.value.promotion.buyer:t.value.promotion.inviter} · ${rewardSummary(reward,t.value.promotion,reward.disclosure.deviceName)}`:''),
  ].join('\n')),
  `${t.value.promotion.deadline} · ${displayDeadline(activity.value.endsAt,locale.code)}`,
].join('\n\n'):'');
const totalUnits=computed(()=>selection.value.reduce((total,item)=>total+item.quantity,0));
const signedIn=computed(()=>{void app.accountBindingEpoch;void app.accountKey;return !!sessionVault.read();});
const scopedHardware = computed(() => catalog.value.filter(product => !scopeId.value || activity.value?.productNos.includes(product.id)));
const purchasableHardware = computed(() => scopedHardware.value.filter(product => isBundleHardwareAvailable(product, phase.value)));
const activityProductsBlock = computed(() => {
  if (!scopeId.value || !activity.value || catalogStatus.value !== 'ready' || purchasableHardware.value.length) return '';
  return scopedHardware.value.some(product =>
    product.productType !== 'SHARE' && isProductAvailable(product, phase.value) && productOutOfStock(product))
    ? t.value.store.temporarilyOutOfStock : t.value.promotion.noMatchingProducts;
});
const singleActivityProduct = computed(() => scopeId.value && available.value && catalogStatus.value === 'ready'
  && !selectionBlock.value && purchasableHardware.value.length === 1 ? purchasableHardware.value[0] : null);
function openSingleProduct(){if(singleActivityProduct.value)void navTo(promotionDetailHref(singleActivityProduct.value.id,scopeId.value));}
const suggestions = computed(() => purchasableHardware.value.filter(product =>
  !selection.value.some(item => item.productNo === product.id)));
// Display rows for the shared bundle layout (board B). Tiles and the list read the same catalogue and quote as before.
const builder=computed(()=>!singleActivityProduct.value&&(!scopeId.value||!!activity.value));
const limitReached=computed(()=>selection.value.length>=8||totalUnits.value>=100);
function estimateText(id:string){const estimate=productFor(id)?productDailyEstimateRange(productFor(id)!):null;return estimate?`$${formatEstimateRange(estimate.low,estimate.high)}${t.value.store.cardPerDaySuffix}`:'—';}
const tiles=computed<BundleTile[]>(()=>selection.value.map(item=>({id:item.productNo,name:nameFor(item.productNo),label:catalogStatus.value==='ready'&&!productFor(item.productNo)?t.value.bundle.tileGoneName:undefined,imageUrl:imageFor(item.productNo),price:productFor(item.productNo)?.price??null,estimate:estimateText(item.productNo)})));
const quantityOf=(id:string)=>selection.value.find(item=>item.productNo===id)?.quantity??0;
const suggestionRows=computed<BundleSuggestion[]>(()=>suggestions.value.map(product=>({
  id:product.id,name:product.name,imageUrl:imageFor(product.id),price:product.price,estimate:estimateText(product.id),
  notes:product.taskLevels.length?[productTaskLevelsText(t.value,product.taskLevels)]:[],
  action:'add',actionLabel:fmt(t.value.uiChrome.addItem,{name:product.name}),disabled:limitReached.value,openable:true,
})));
function openDetail(id:string){void navTo(promotionDetailHref(id,scopeId.value));}
/** Quote rewards summed per asset (order discounts are already in 已省): UVT and USDT amounts, devices by name. */
function rewardTotals(list:ExpectedReward[]){
  const sums=new Map<string,{units:bigint;type:'UVT'|'USDT'}>(),devices:{amount:string;unit:string;uvt:boolean}[]=[];
  for(const entry of list){
    const reward=entry.reward;
    if(reward.type==='DISCOUNT_USDT')continue;
    if(reward.type==='DEVICE'){devices.push({amount:String(reward.quantity*entry.groups),unit:'\u00a0'+(entry.disclosure?.deviceName||t.value.promotion.unknown),uvt:false});continue;}
    const [whole,fraction='']=reward.amount.split('.');
    const row=sums.get(reward.type)??{units:BigInt(0),type:reward.type};
    row.units+=BigInt(whole+fraction.slice(0,6).padEnd(6,'0'))*BigInt(entry.groups);
    sums.set(reward.type,row);
  }
  return [...[...sums.values()].map(({units,type})=>{
    const raw=units.toString().padStart(7,'0'),value=raw.slice(0,-6)+'.'+raw.slice(-6);
    return {amount:type==='UVT'?formatGroupedAmount(value,'full'):formatGroupedAmount(value,2).replace(/\.00$/,''),unit:'\u00a0'+platformDisplayText(type),uvt:type==='UVT'};
  }),...devices];
}
const orderRewards=computed(()=>quote.value?rewardTotals(quote.value.expectedRewards):[]);
function rewardsFor(productNo:string){
  if(!quote.value)return [];
  const lines=quote.value.items.filter(line=>line.productNo===productNo).map(line=>line.lineId);
  return rewardTotals(quote.value.expectedRewards.filter(entry=>lines.includes(entry.lineId)));
}
const quoteWarning = computed(() => {
  const current = quote.value;
  if (!current) return '';
  return [...current.warnings, ...current.expectedRewards.map(reward => reward.message)]
    .map(message => localized(message, locale.code)).find(Boolean) ?? '';
});
const quotedTiers = computed(() => {
  const current = quote.value;
  const policy = props.policy;
  if (!current || current.eligibility !== 'ELIGIBLE' || !policy?.serverCanonical
    || current.bundlePolicyVersion !== policy.policyVersion) return null;
  const rate = bundleDiscountForCount(current.itemCount, policy.tiers);
  const expected = quoteBundleAmountUsdt([Number(current.subtotalUsdt)], rate)?.discountUsdt;
  const micros = (amount: string | number) => Math.round(Number(amount) * 1_000_000);
  // The total discount can also include an activity discount that is unrelated to the bundle tier.
  const bundleDiscount = micros(current.discountUsdt) - micros(current.promotionDiscountUsdt ?? 0);
  return expected !== undefined && bundleDiscount > 0 && bundleDiscount === micros(expected) ? policy.tiers : null;
});
const termsMissing = computed(() => quote.value?.expectedRewards.some(({ disclosure }) =>
  !disclosure || [disclosure.title, disclosure.terms, disclosure.refundTerms, disclosure.benefitDescription]
    .some(text => !text?.zh?.trim() || !text.en?.trim() || !text.vi?.trim())) ?? false);
const inventoryPlacement = computed((): InventoryPlacement | null => {
  const current = quote.value;
  if (!current) return null;
  const slots = current.assignableSlots ?? (app.remoteSlotsUsed === null ? null : Math.max(0, app.slotCap - app.remoteSlotsUsed));
  const count = current.inventoryQuantity ?? (slots === null ? 0 : Math.max(0, current.quantity - slots));
  return count === 0 ? null : { count, full: slots === 0 };
});
const inventoryNote = computed(() => {
  const placement = inventoryPlacement.value;
  if (!placement) return '';
  return placement.full ? t.value.tradein.fullSlotsInventoryNotice
    : fmt(t.value.tradein.partialSlotsInventoryNotice, { count: placement.count });
});
// The dashed 「添加」 tile scrolls to 「继续添加」 and moves focus there (same in-page jump as the rule guides' directory).
function jumpToSuggestions(){
  const reduce=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(typeof document!=='undefined'){const target=document.getElementById('bundle-more');target?.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});target?.focus({preventScroll:true});}
}
function selectedProductUnavailable(id: string) {
  return (catalogStatus.value === 'ready' && !productFor(id))
    || (!!scopeId.value && !!activity.value && !activity.value.productNos.includes(id));
}
function selectedProductBlock(id: string) {
  if (catalogStatus.value === 'ready') {
    const product = productFor(id);
    if (product && (!isProductAvailable(product, phase.value) || productOutOfStock(product))) return t.value.store.temporarilyOutOfStock;
  }
  return selectedProductUnavailable(id) ? t.value.promotion.noMatchingProducts : '';
}
/** Tile tag (03 §3.8 neutral unavailable): one short word on one line; the full reason is in the tray note. */
function tileTag(id: string) {
  const reason = selectedProductBlock(id);
  if (!reason) return '';
  return reason === t.value.store.temporarilyOutOfStock ? t.value.bundle.tileOutOfStock : t.value.bundle.tileUnavailable;
}
const selectionBlock = computed(() => selection.value.map(item => selectedProductBlock(item.productNo)).find(Boolean) ?? '');
const productsReady = computed(() => catalogStatus.value === 'ready' && !selectionBlock.value);
const canReadQuote=computed(()=>visible.value&&foregroundReadAllowed()&&signedIn.value&&app.accountKey!=='default'
  &&validEntryItems(selection.value,2)&&productsReady.value&&(!scopeId.value||contextStatus.value==='ready'&&available.value));
const canContinue=computed(()=>canReadQuote.value&&quoteStatus.value==='ready'&&quote.value?.eligibility==='ELIGIBLE'&&!termsMissing.value);
const canOpenDevices=computed(()=>visible.value&&signedIn.value&&!selectionBlock.value&&!activityProductsBlock.value&&quoteBlock.value==='capacity');
useAutoRecovery({
  active:()=>visible.value,
  failed:()=>canReadQuote.value&&(quoteStatus.value==='error'||quoteBlock.value==='unavailable'),
  retry:()=>refreshQuote(),
  ...repeatWithoutPull,
});
function invalidate(preserveBlock=false){
  fence.invalidate();
  clearTimeout(expiryTimer);
  quote.value=null;
  quoteStatus.value='idle';
  quoteExpired.value=false;
  if(!preserveBlock){quoteBlock.value=null;quoteIneligible.value=false;capacityRecheckPending.value=false;}
}
watch(selection,()=>{invalidate();writeAccountRow(storageKey,app.accountKey,{items:selection.value,entryItems:props.initialItems});},{deep:true,flush:'sync'});
watch([()=>activity.value?.version,()=>locale.code],()=>{invalidate();termsOpen.value=false;},{flush:'sync'});
watch(productCatalogPresentation, snapshot => {
  if (quoteBlock.value === 'outOfStock' && selection.value.every(item =>
    productHasStock(snapshot?.products.find(product => product.id === item.productNo)))) invalidate();
});
watch([()=>app.accountKey,()=>app.accountBindingEpoch],()=>{invalidate();termsOpen.value=false;restore();});
watch(canReadQuote, ready => {
  if (!ready && (quote.value || quoteStatus.value === 'loading')) invalidate(true);
});
watch([selection, canReadQuote, quoteStatus, quoteBlock, quoteIneligible], (_, __, onCleanup) => {
  if (!canReadQuote.value || quoteStatus.value !== 'idle' || quoteBlock.value || quoteIneligible.value) return;
  const timer = setTimeout(() => { void refreshQuote(); }, 200);
  onCleanup(() => clearTimeout(timer));
}, { immediate: true });
function add(productNo:string){if(selection.value.length>=8||totalUnits.value>=100||!suggestions.value.some(product=>product.id===productNo))return;selection.value=[...selection.value,{productNo,quantity:1}];}
function remove(productNo:string){selection.value=selection.value.filter(item=>item.productNo!==productNo);}
function changeQuantity(productNo:string,delta:number){
  const item=selection.value.find(entry=>entry.productNo===productNo);
  if(!item||item.quantity+delta<1||totalUnits.value+delta>100||selectedProductUnavailable(productNo))return;
  selection.value=selection.value.map(entry=>entry.productNo===productNo?{...entry,quantity:entry.quantity+delta}:entry);
}
function clearScope(){invalidate();void navTo(promotionStoreHref());}
function signIn(){void navTo('/pages/login/login?return='+encodeURIComponent(promotionBundleHref(scopeId.value,selection.value)));}
async function refreshQuote(recheckCapacity=false){
  const block=quoteBlock.value;
  if(block&&block!=='unavailable'&&!(recheckCapacity&&block==='capacity'))return;
  if(!canReadQuote.value||quoteStatus.value==='loading')return;
  const ticket=fence.next(),identity=`${app.accountKey}:${app.accountBindingEpoch}`,chosen=selection.value.map(item=>({...item}));
  quote.value=null;quoteStatus.value='loading';
  try{
    const result=await promotionApi.quote(chosen,scopeId.value||null);
    if(!visible.value||!fence.current(ticket)||identity!==`${app.accountKey}:${app.accountBindingEpoch}`)return;
    if(quoteIncludesPhoneGift(result)){
      quoteBlock.value='unavailable';
      quoteStatus.value='idle';
      // Re-read the filtered campaign. Quote recovery only runs if the selection still qualifies.
      if(scopeId.value)await refreshContext();
      return;
    }
    quoteBlock.value=null;
    const lifetime = Date.parse(result.expiresAt) - Date.parse(result.serverTime);
    if (!isEntryQuoteFresh(result.expiresAt, result.serverTime, 0)) {
      quoteExpired.value = true;
      quoteStatus.value = 'error';
      return;
    }
    quoteExpired.value=false;quoteReceivedAt=clockNow();quote.value=result;quoteStatus.value='ready';
    expiryTimer = setTimeout(expireQuote, lifetime);
  }catch(cause){
    if(!visible.value||!fence.current(ticket)||identity!==`${app.accountKey}:${app.accountBindingEpoch}`)return;
    quoteBlock.value=checkoutQuoteBlock(cause);
    quoteIneligible.value=asApiError(cause).message==='PROMOTION_NOT_ELIGIBLE_OR_UNAVAILABLE';
    quoteStatus.value=quoteBlock.value||quoteIneligible.value?'idle':'error';
  }
}
const footerNote = computed(() => {
  if (scopeId.value && contextStatus.value === 'ready' && !available.value)
    return localized(activity.value?.eligibilityMessage,locale.code) || t.value.promotion.disabled;
  if (selectionBlock.value) return selectionBlock.value;
  if (activityProductsBlock.value) return activityProductsBlock.value;
  if (quoteIneligible.value || (quote.value && quote.value.eligibility !== 'ELIGIBLE')) return t.value.promotion.disabledNote;
  // Expired quotes are read again on their own (03 §3.5.2), so the note only says it is updating; the checkout keeps
  // its own quoteExpired copy.
  if (quoteExpired.value) return t.value.promotion.quoteUpdating;
  const block = checkoutQuoteBlockCopy(quoteBlock.value, t.value);
  if (block) return block;
  if (termsMissing.value) return t.value.promotion.termsMissing;
  if (inventoryNote.value) return inventoryNote.value;
  if (quoteWarning.value) return quoteWarning.value;
  if (selection.value.length < 2) return t.value.promotion.selectTwo;
  // A failed quote read is read again on its own (03 §3.5.2): the note stays the reading note, never a retry the page does not offer.
  return signedIn.value && !quote.value ? t.value.promotion.loading : '';
});
// The page renders these states and actions in its existing tray.
const footer=computed(()=>singleActivityProduct.value||(scopeId.value&&!activity.value)?null:{
  note:footerNote.value,
  signedIn:signedIn.value,canContinue:canOpenDevices.value||canContinue.value,
  continueLabel:canOpenDevices.value?t.value.myDevices.inventoryTitle:t.value.bundle.checkout,
  showTotal:selection.value.length>=2,
  total:quote.value&&quoteStatus.value==='ready'?quote.value.amountUsdt:null,
  saved:quote.value&&quoteStatus.value==='ready'&&Number(quote.value.discountUsdt)>0?quote.value.discountUsdt:null,
  devices:canOpenDevices.value,
  continue:continueCheckout,signIn,
});
// The single-model action for the page's bottom bar (same handler as before).
const single=computed(()=>singleActivityProduct.value?{label:commerceCopy(locale.code).singlePurchase,open:openSingleProduct}:null);
defineExpose({footer,single});
function freshQuote(){return !!quote.value&&isEntryQuoteFresh(quote.value.expiresAt,quote.value.serverTime,clockNow()-quoteReceivedAt);}
function expireQuote(){
  invalidate();
  quoteExpired.value=true;
}
async function continueCheckout(){
  if(canOpenDevices.value){void navTo('/pages/me/devices');return;}
  if(!quote.value)return;
  if(!freshQuote()){expireQuote();return;}
  if(!canContinue.value)return;
  // Devices going to inventory (the tray note) need the user's confirmation before checkout (PRD §7.3).
  const placement=inventoryPlacement.value;
  if(placement&&!await confirmInventoryPlacement(t.value,placement,'checkout'))return;
  if(!freshQuote()){expireQuote();return;}
  if(canContinue.value)void navTo(promotionCheckoutHref(selection.value,scopeId.value));
}
onHide(()=>{visible.value=false;capacityRecheckPending.value=false;invalidate(true);termsOpen.value=false;});
onShow(()=>{
  const recheckCapacity=!visible.value&&quoteBlock.value==='capacity';
  visible.value=true;invalidate(recheckCapacity);
  if(recheckCapacity)capacityRecheckPending.value=true;
});
watch(()=>capacityRecheckPending.value&&quoteBlock.value==='capacity'&&canReadQuote.value,ready=>{
  if(!ready)return;
  capacityRecheckPending.value=false;
  void refreshQuote(true);
},{flush:'post'});
onBeforeUnmount(()=>{visible.value=false;fence.invalidate();clearTimeout(expiryTimer);});
</script>
<style src="./promotion.css"></style>
<style scoped>
/* Page column (board B): the shared hero and list carry their own 16px sides; 24 above, 24 + chassis 40 below. */
.promotion-bundle { display: flex; flex-direction: column; padding: 24px 0; color: var(--v5-ink); }
.promotion-bundle__status { margin: 0 16px; display: flex; flex-direction: column; gap: 8px; }
.promotion-bundle__single { margin: 12px 16px 0; display: flex; flex-direction: column; gap: 12px; }
/* Activity strip: coral tint (.nx-tint gives the 7% / 5% fill, soft rim and light shadow). */
.promotion-bundle__activity { --nx-tint: var(--v5-brand-2); margin: 0 16px 12px; padding: 16px; border-radius: var(--ui-radius-surface); }
.promotion-bundle__activity-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.promotion-bundle__activity-title { min-width: 0; color: var(--v5-ink); font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); overflow-wrap: break-word; }
.promotion-bundle__rules { margin-left: auto; white-space: nowrap; }
.promotion-bundle__reward { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; margin-top: 8px; }
.promotion-bundle__reward-key { color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.promotion-bundle__reward-value { white-space: nowrap; }
.promotion-bundle__reward-value .promotion-bundle__reward-amount { font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); }
.promotion-bundle__reward-sep { color: var(--v5-ink-4); }
/* Reward figures in the main ink; the UVT unit in the UVT ink (01 §1.1.1 #4). */
.promotion-bundle__reward-amount { color: var(--v5-ink); font-weight: 500; font-family: var(--font-amount); font-variant-numeric: tabular-nums; }
.promotion-bundle__reward-unit { margin-left: 2px; color: var(--v5-ink-3); font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.promotion-bundle__reward-unit.is-uvt { color: var(--v5-nex-ink); }
.promotion-bundle__warning { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; color: var(--v5-warning-ink); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; }
.promotion-bundle__warning svg { flex: none; margin-top: 1px; }
/* A chosen model that can no longer be bought: the shared neutral tag under its meta, own width, one line. */
.promotion-bundle__tile-tag { align-self: flex-start; margin-top: 6px; }
.promotion-bundle__tile-note { display: block; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; }
.promotion-bundle__tile-reward { display: block; margin-top: 4px; font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space: nowrap; }
/* Quantity stepper (board B tile): a flat surface-3 pill, 32 visible, each side 44 wide with a 44 tall hit area; the
   value is a stat figure that screen readers hear change. Not glass: it sits in the soft-glass focal card (P-67). */
.promotion-bundle__stepper { align-self: flex-start; display: inline-flex; align-items: center; height: 32px; margin-top: 8px; border-radius: 999px; background: var(--v5-surface-3); }
.promotion-bundle__step { position: relative; width: 44px; height: 32px; display: grid; place-items: center; color: var(--v5-ink); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.promotion-bundle__step::after { content: ""; position: absolute; left: 0; right: 0; top: -6px; bottom: -6px; }
.promotion-bundle__step[aria-disabled="true"] { color: var(--v5-ink-4); cursor: default; }
.promotion-bundle__step:active:not([aria-disabled="true"]) { opacity: .6; }
.promotion-bundle__step:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; border-radius: 999px; }
.promotion-bundle__qty { min-width: 24px; text-align: center; color: var(--v5-ink); font: 500 15px/20px var(--font-metric); font-variant-numeric: tabular-nums; }
.promotion-bundle__estimate-note { display: block; margin: 8px 18px 0; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); overflow-wrap: break-word; }
.promotion-bundle__catalog { margin: 12px 16px 0; }
.promotion-bundle__section { display: block; margin-top: var(--ui-space-section-gap); }
.promotion-bundle__links { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; margin: var(--ui-space-section-gap) 16px 0; }
.promotion-bundle__note { color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; }
.promotion-action { position:relative;isolation:isolate;overflow:hidden; }
.promotion-action text { position:relative;z-index:1; }
/* Room for the tray: a hidden copy of its rows (same widths: 12 sides, 8 padding and gap). The page already ends 64
   below the last link (24 + chassis 40); the tray needs its height + 22 + 16, so the copy gives back 26. */
.bundle-bar-space { visibility:hidden; display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0 12px -26px; padding:8px; }
.bundle-bar-space__note { flex:1 1 100%; padding:4px 12px 0; font:var(--ui-type-meta-weight,400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align:center; overflow-wrap:break-word; text-wrap:pretty; }
.bundle-bar-space__copy { flex:1 1 auto; min-width:0; padding:0 12px; }
.bundle-bar-space__total { display:block; font:500 20px/24px var(--font-amount); white-space:nowrap; }
.bundle-bar-space__meta { display:block; font:var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); white-space:nowrap; }
.bundle-bar-space__cta { flex:0 0 auto; min-width:150px; margin-left:auto; box-sizing:border-box; min-height:48px; padding:14px 46px 14px 20px; font:var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); white-space:nowrap; }
.bundle-bar-space__note + .bundle-bar-space__cta, .bundle-bar-space__cta--wide { flex:1 1 100%; }
</style>
