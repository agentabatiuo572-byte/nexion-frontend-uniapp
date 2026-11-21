<template>
  <view class="promotion promotion-main" data-testid="promotion-bundle">
    <view>
      <text class="promotion-title">{{ activity ? localized(activity.title,locale.code) : !scopeId?t.promotion.bundle:contextStatus==='ready'?t.promotion.disabled:contextStatus==='error'?t.promotion.error:t.promotion.loading }}</text>
      <text v-if="!scopeId||activity" class="promotion-copy">{{ t.promotion.quantityLimit }}</text>
      <text v-if="scopeId&&(contextStatus==='loading'||contextStatus==='idle')" class="promotion-copy" role="status">{{ t.promotion.loading }}</text>
      <text v-if="scopeId && !activity && contextStatus === 'error'" class="promotion-copy">—</text>
      <text v-if="scopeId&&activity&&contextStatus==='ready'&&!available" class="promotion-copy">{{ localized(activity.eligibilityMessage,locale.code)||t.promotion.disabledNote }}</text>
    </view>
    <view v-if="singleActivityProduct" class="promotion-flat" data-testid="single-activity-guidance"><text class="promotion-copy">{{ commerceCopy(locale.code).singleActivity }}</text><view class="promotion-action primary" role="button" tabindex="0" @click="openSingleProduct" @keydown.enter.prevent="openSingleProduct" @keydown.space.prevent="openSingleProduct"><text>{{ commerceCopy(locale.code).singlePurchase }}</text></view></view>
    <template v-else-if="!scopeId||activity">
    <view class="promotion-flat">
      <text class="promotion-title">{{ t.promotion.selected }}</text>
      <text v-if="!selection.length" class="promotion-copy">{{ t.promotion.selectTwo }}</text>
      <view v-for="item in selection" :key="item.productNo" class="bundle-item">
        <view class="promotion-row">
          <image v-if="imageFor(item.productNo)" class="promotion-image" :src="imageFor(item.productNo)" mode="aspectFill" :alt="nameFor(item.productNo)" />
          <view class="promotion-grow">
            <text class="bundle-name">{{ nameFor(item.productNo) }}</text>
            <text v-if="levelsFor(item.productNo)" class="promotion-copy">{{ levelsFor(item.productNo) }}</text>
            <text v-if="!productFor(item.productNo)" class="promotion-copy">{{ t.promotion.noMatchingProducts }}</text>
            <view class="bundle-stepper" :aria-label="nameFor(item.productNo)+' · '+t.promotion.quantity">
              <view role="button" :tabindex="item.quantity<=1?-1:0" :aria-disabled="item.quantity<=1" :aria-label="t.uiChrome.decreaseQty" @click="changeQuantity(item.productNo,-1)"><NxIcon name="minus" /></view>
              <text aria-live="polite">{{ item.quantity }}</text>
              <view role="button" :aria-label="t.uiChrome.increaseQty" :tabindex="totalUnits>=100?-1:0" :aria-disabled="totalUnits>=100" @click="changeQuantity(item.productNo,1)"><NxIcon name="plus" /></view>
            </view>
          </view>
          <view class="bundle-remove" role="button" tabindex="0" :aria-label="t.promotion.removeSelection+' · '+nameFor(item.productNo)" @click="remove(item.productNo)"><NxIcon name="close" :size="20" /></view>
        </view>
      </view>
    </view>
    <view v-if="catalogStatus!=='ready'" class="promotion-flat" role="status"><text class="promotion-copy">{{ catalogStatus==='loading'?t.store.catalogLoadingBody:'—' }}</text></view>
    <view v-if="suggestions.length" class="promotion-flat">
      <text class="promotion-title">{{ t.promotion.buyMore }}</text>
      <view v-for="product in suggestions" :key="product.id" class="promotion-row">
        <image v-if="imageFor(product.id)" class="promotion-image" :src="imageFor(product.id)" mode="aspectFill" :alt="product.name" />
        <view class="promotion-grow"><text class="bundle-name">{{ product.name }}</text><text v-if="product.taskLevels.length" class="promotion-copy">{{ productTaskLevelsText(t,product.taskLevels) }}</text><view class="promotion-link" role="button" tabindex="0" @click="navTo(promotionDetailHref(product.id,scopeId))"><text>{{ t.promotion.detail }}</text></view></view>
        <view class="bundle-add" role="button" :aria-label="fmt(t.uiChrome.addItem,{name:product.name})" :tabindex="selection.length>=8||totalUnits>=100?-1:0" :aria-disabled="selection.length>=8||totalUnits>=100" @click="add(product.id)"><NxIcon name="plus" /></view>
      </view>
    </view>
    <view class="promotion-flat">
      <text class="promotion-title">{{ t.promotion.expected }}</text>
      <text v-if="quoteStatus==='loading'" class="promotion-copy" role="status">{{ t.promotion.loading }}</text>
      <text v-else-if="quoteStatus==='error'" class="promotion-copy" role="alert">{{ t.promotion.errorNote }}</text>
      <template v-if="quote">
        <RewardRows :expected="quote.expectedRewards" :lines="quote.items" />
        <text v-for="(warning,index) in quote.warnings" :key="index" class="promotion-copy">{{ localized(warning,locale.code) }}</text>
        <view class="promotion-summary"><text>{{ t.promotion.subtotal }}</text><CheckoutAmount :value="quote.subtotalUsdt" currency="USD" /></view>
        <view class="promotion-summary"><text>{{ t.promotion.discount }}</text><text class="bundle-discount">{{ formatCheckoutReviewAmount(quote.discountUsdt,'USD',{discount:true}) }}</text></view>
        <view class="promotion-summary total"><text>{{ t.promotion.total }}</text><CheckoutAmount :value="quote.amountUsdt" currency="USD" /></view>
      </template>
      <text class="promotion-copy">{{ t.promotion.rewardNote }}</text>
    </view>
    <view v-if="activity" class="promotion-link bundle-link" role="button" tabindex="0" @click="termsOpen=true" @keydown.enter.prevent="termsOpen=true" @keydown.space.prevent="termsOpen=true"><text class="nx-after-chevron">{{ t.promotion.rulesLink }}</text></view>
    <view class="promotion-link bundle-link" role="button" tabindex="0" @click="navTo(promotionStoreHref(scopeId))" @keydown.enter.prevent="navTo(promotionStoreHref(scopeId))" @keydown.space.prevent="navTo(promotionStoreHref(scopeId))"><text class="nx-after-chevron">{{ t.promotion.buyMore }}</text></view>
    <PromotionTerms :open="termsOpen" :title="localized(activity?.title,locale.code)" :terms="ruleTerms" :disclosures="promotionDisclosures(activity)" @close="termsOpen=false" />
    </template>
    <view v-if="scopeId" class="promotion-link bundle-link" role="button" tabindex="0" @click="clearScope" @keydown.enter.prevent="clearScope" @keydown.space.prevent="clearScope"><text class="nx-after-chevron">{{ activity?t.promotion.ordinary:t.promotion.allProducts }}</text></view>
    <!-- Keeps the last link clear of the page's bottom action tray (04 §4.0): an invisible copy of the tray's rows. -->
    <view v-if="footer" class="bundle-bar-space" aria-hidden="true">
      <text v-if="footer.note" class="bundle-bar-space__note">{{ footer.note }}</text>
      <template v-if="footer.signedIn"><text class="bundle-bar-space__text">{{ t.promotion.quote }}</text><text class="bundle-bar-space__cta">{{ t.promotion.continue }}</text></template>
      <text v-else class="bundle-bar-space__cta">{{ t.promotion.signIn }}</text>
    </view>
  </view>
</template>
<script setup lang="ts">
import NxIcon from "@/components/ui/nx-icon.vue";
import CheckoutAmount from '@/components/checkout/CheckoutAmount.vue';
import { formatCheckoutReviewAmount } from '@/lib/checkout-review-amount';
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue';
import { onHide,onShow } from '@dcloudio/uni-app';
import { commerceCopy } from '@/lib/commerce-review';
import { promotionApi,sessionVault } from '@/api/runtime';
import { checkoutQuoteBlock,type CheckoutQuoteBlock } from '@/api/promotion-api';
import type { Quote } from '@/api/promotion-contracts';
import { useT } from '@/i18n/use-t';
import { useApp } from '@/store/app';
import { useLocaleStore } from '@/store/locale';
import { productCatalogPresentation,productCatalogState,refreshProductCatalog } from '@/store/product-catalog';
import { useProductPhase } from '@/composables/use-product-phase';
import { isProductAvailable } from '@/store/product-availability';
import { usePromotionContext } from '@/composables/use-promotion-context';
import { readAccountRow,writeAccountRow } from '@/store/account-scoped-storage';
import { catalogProductImageUrl } from '@/lib/product-image';
import { productTaskLevelsText } from '@/lib/product-copy';
import { checkoutQuoteBlockCopy,localized,displayDeadline,rewardSummary } from '@/lib/promotion-display';
import { navTo } from '@/lib/route';
import { fmt } from '@/i18n/format';
import { createPromotionReadFence,isEntryQuoteFresh,restoreEntrySelection,promotionBundleHref,promotionCheckoutHref,promotionDetailHref,promotionDisclosures,promotionStoreHref,validEntryItems,type EntryItem,type EntrySelectionDraft } from '@/lib/promotion-entry';

import RewardRows from './reward-rows.vue';
import PromotionTerms from './promotion-terms.vue';
const props=defineProps<{activityId:string;initialItems:EntryItem[]}>();
const app=useApp(),locale=useLocaleStore(),t=useT(),phase=useProductPhase();
const scopeId=ref(props.activityId),selection=ref<EntryItem[]>([]),termsOpen=ref(false);
const {activity,status:contextStatus,available,refresh:refreshContext}=usePromotionContext(scopeId);
const quote=ref<Quote|null>(null),quoteStatus=ref<'idle'|'loading'|'ready'|'error'>('idle');
const quoteBlock=ref<CheckoutQuoteBlock|null>(null);
const fence=createPromotionReadFence();const visible=ref(true);
const clockNow=()=>typeof performance!=='undefined'?performance.now():Date.now();
let quoteReceivedAt=0;let expiryTimer:ReturnType<typeof setInterval>|null=null;
const storageKey='growth-promotion-selection:'+props.activityId;
function restore(initial:EntryItem[]=props.initialItems){
  const saved=readAccountRow<EntrySelectionDraft>(storageKey,app.accountKey);
  selection.value=restoreEntrySelection(initial,saved);
}
restore(props.initialItems);
const catalogStatus=computed(()=>productCatalogState.status);
useAutoRecovery({ failed: () => catalogStatus.value === "error", retry: () => refreshProductCatalog(true) });
useAutoRecovery({ failed: () => contextStatus.value === "error", retry: () => refreshContext() });
const catalog=computed(()=>productCatalogPresentation.value?.products??[]);
const productFor=(id:string)=>catalog.value.find(product=>product.id===id);
const levelsFor=(id:string)=>productTaskLevelsText(t.value,productFor(id)?.taskLevels??[]);
const nameFor=(id:string)=>productFor(id)?.name??t.value.uiChrome.unavailable;
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
const singleActivityProduct=computed(()=>{if(!scopeId.value||!available.value||catalogStatus.value!=='ready')return null;const products=catalog.value.filter(p=>p.productType!=='SHARE'&&isProductAvailable(p,phase.value)&&activity.value?.productNos.includes(p.id));return products.length===1?products[0]:null;});
function openSingleProduct(){if(singleActivityProduct.value)void navTo(promotionDetailHref(singleActivityProduct.value.id,scopeId.value));}
const suggestions=computed(()=>catalog.value.filter(product=>!selection.value.some(item=>item.productNo===product.id)&&product.productType!=='SHARE'&&isProductAvailable(product,phase.value)&&(!scopeId.value||activity.value?.productNos.includes(product.id))));
const productsReady=computed(()=>catalogStatus.value==='ready'&&selection.value.every(item=>{const product=productFor(item.productNo);return product&&isProductAvailable(product,phase.value)&&(!scopeId.value||activity.value?.productNos.includes(item.productNo));}));
const canReadQuote=computed(()=>visible.value&&signedIn.value&&validEntryItems(selection.value,2)&&productsReady.value&&(!scopeId.value||available.value));
const canQuote=computed(()=>canReadQuote.value&&quoteStatus.value!=='loading'&&!quoteBlock.value);
const canContinue=computed(()=>canQuote.value&&quoteStatus.value==='ready'&&quote.value?.eligibility==='ELIGIBLE');
useAutoRecovery({
  active:()=>visible.value,
  failed:()=>quoteBlock.value==='unavailable'&&canReadQuote.value,
  retry:refreshQuote,
  repeatMs:30_000,
  quiet:false,
});
function invalidate(preserveBlock=false){
  fence.invalidate();
  quote.value=null;
  quoteStatus.value='idle';
  if(!preserveBlock)quoteBlock.value=null;
}
watch(selection,()=>{invalidate();writeAccountRow(storageKey,app.accountKey,{items:selection.value,entryItems:props.initialItems});},{deep:true,flush:'sync'});
watch([()=>activity.value?.version,()=>locale.code],()=>{invalidate(true);termsOpen.value=false;},{flush:'sync'});
watch([()=>app.accountKey,()=>app.accountBindingEpoch],()=>{invalidate();termsOpen.value=false;restore();});
function add(productNo:string){if(selection.value.length>=8||totalUnits.value>=100||!suggestions.value.some(product=>product.id===productNo))return;selection.value=[...selection.value,{productNo,quantity:1}];}
function remove(productNo:string){selection.value=selection.value.filter(item=>item.productNo!==productNo);}
function changeQuantity(productNo:string,delta:number){const item=selection.value.find(entry=>entry.productNo===productNo);if(!item||item.quantity+delta<1||totalUnits.value+delta>100)return;selection.value=selection.value.map(entry=>entry.productNo===productNo?{...entry,quantity:entry.quantity+delta}:entry);}
function clearScope(){invalidate();void navTo(promotionStoreHref());}
function signIn(){void navTo('/pages/login/login?return='+encodeURIComponent(promotionBundleHref(scopeId.value,selection.value)));}
async function refreshQuote(){
  if(!canReadQuote.value||quoteStatus.value==='loading'||(quoteBlock.value&&quoteBlock.value!=='unavailable'))return;
  const ticket=fence.next(),identity=`${app.accountKey}:${app.accountBindingEpoch}`,chosen=selection.value.map(item=>({...item}));
  quote.value=null;quoteStatus.value='loading';
  try{
    const result=await promotionApi.quote(chosen,scopeId.value||null);
    if(!visible.value||!fence.current(ticket)||identity!==`${app.accountKey}:${app.accountBindingEpoch}`)return;
    quoteBlock.value=null;quoteReceivedAt=clockNow();quote.value=result;quoteStatus.value='ready';
  }catch(cause){
    if(!visible.value||!fence.current(ticket)||identity!==`${app.accountKey}:${app.accountBindingEpoch}`)return;
    quoteBlock.value=checkoutQuoteBlock(cause);
    quoteStatus.value=quoteBlock.value?'idle':'error';
  }
}
// Display-only hand-off to the page's bottom action tray (pages/store/bundle.vue #pageFixed); the reason a disabled
// primary has sits above it there (03 §3.1, 04 §4.0).
const footer=computed(()=>singleActivityProduct.value||(scopeId.value&&!activity.value)?null:{
  note:checkoutQuoteBlockCopy(quoteBlock.value,t.value)||(selection.value.length<2?t.value.promotion.selectTwo:quote.value&&quote.value.eligibility!=='ELIGIBLE'?t.value.promotion.disabledNote:signedIn.value&&!quote.value&&quoteStatus.value==='idle'?t.value.promotion.awaitingQuote:''),
  signedIn:signedIn.value,canQuote:canQuote.value,canContinue:canContinue.value,quote:requestQuote,continue:continueCheckout,signIn,
});
defineExpose({footer});
function requestQuote(){if(canQuote.value)void refreshQuote();}
function freshQuote(){return !!quote.value&&isEntryQuoteFresh(quote.value.expiresAt,quote.value.serverTime,clockNow()-quoteReceivedAt);}
function continueCheckout(){if(!quote.value)return;if(!freshQuote()){invalidate();return;}if(canContinue.value)void navTo(promotionCheckoutHref(selection.value,scopeId.value));}
onMounted(()=>{expiryTimer=setInterval(()=>{if(quote.value&&!freshQuote())invalidate();},1000);});
onHide(()=>{visible.value=false;invalidate(true);termsOpen.value=false;});
onShow(()=>{visible.value=true;invalidate(true);});
onBeforeUnmount(()=>{visible.value=false;fence.invalidate();if(expiryTimer)clearInterval(expiryTimer);});
</script>
<style src="./promotion.css"></style>
<style scoped>
.bundle-name { display:block;font-size:var(--ui-type-card-title);font-weight: var(--ui-type-card-title-weight);overflow-wrap:anywhere; }
.bundle-stepper { display:flex;align-items:center;border:1px solid var(--v5-border);border-radius:999px;width:max-content;max-width:100%;margin-top:var(--ui-space-row-y);overflow:hidden; }
.bundle-stepper view,.bundle-add,.bundle-remove { min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:20px; }
.bundle-stepper view { background:var(--v5-surface-2); }
.bundle-stepper text { min-width:32px;text-align:center;font-variant-numeric:tabular-nums; }
.bundle-add { color:var(--v5-brand); }
[aria-disabled=true] { opacity:.4; }
.promotion-action { position:relative;isolation:isolate;overflow:hidden; }
.promotion-action text { position:relative;z-index:1; }
@media(max-width:340px){.promotion-image{width:52px;height:52px}.promotion-row{gap:9px}}
/* Entries to the next layer are text links: 13/18, 500, secondary ink with a trailing chevron (03 §3.1, §3.9). */
/* Same discount format as the checkout summary that follows: minus sign, brand, tabular figures. */
.bundle-discount { color:var(--v5-brand); font-variant-numeric:tabular-nums; }
.bundle-link { align-self:flex-start; color:var(--v5-ink-3); font:500 13px/18px var(--font-v5); }
/* Same rows and widths as the tray (12px page sides vs 16 here); the page already ends 20 (gap) + 28 + 40 below the
   last link, so this adds the rest of tray + 22 + 16 (04 §4.0). */
.bundle-bar-space { visibility:hidden; display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0 -4px -50px; padding:8px; }
.bundle-bar-space__note { flex:1 1 100%; padding:4px 12px 0; font:var(--ui-type-meta-weight,400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align:center; overflow-wrap:anywhere; text-wrap:pretty; }
.bundle-bar-space__text,.bundle-bar-space__cta { flex:1 1 auto; box-sizing:border-box; min-height:48px; padding:14px 20px; font:var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); white-space:nowrap; }
.bundle-bar-space__text { padding-inline:12px; }
.bundle-bar-space__cta { padding-right:46px; } /* 20 + the 6 gap and 20 arrow the real button always carries */
</style>
