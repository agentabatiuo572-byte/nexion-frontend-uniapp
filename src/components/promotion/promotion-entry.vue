<template>
  <view v-if="items.length || (!listRead && status !== 'ready') || status === 'error' || mode !== 'home'" class="promotion promotion-entry" :class="{'promotion-entry-home':mode==='home'}" :data-testid="'promotion-entry-'+mode">
    <view v-if="mode==='events'" class="entry-navigation">
      <text class="promotion-title">{{ t.promotion.promotionList }}</text>
      <view class="promotion-link" role="button" tabindex="0" @click="navTo('/pages/me/rewards-list?cat=promotion')" @keydown.enter.prevent="navTo('/pages/me/rewards-list?cat=promotion')" @keydown.space.prevent="navTo('/pages/me/rewards-list?cat=promotion')"><text>{{ t.promotion.rewards }}</text><text aria-hidden="true">›</text></view>
    </view>
    <view v-if="!items.length&&!listRead" class="entry-placeholder" role="status" :aria-busy="status==='loading'" :aria-label="status==='loading'?t.promotion.loading:undefined"><text v-if="mode==='home'" class="promotion-title">{{ t.promotion.promotionList }}</text><view /><view /></view>

    <view v-if="status==='ready'&&!items.length&&mode==='events'" class="entry-status">
      <text class="promotion-title">{{ t.promotion.empty }}</text><text class="promotion-copy">{{ t.promotion.emptyNote }}</text>
      <NxButton class="entry-cta" size="medium" :label="t.promotion.allProducts" @click="navTo(promotionStoreHref())"><text>{{ t.promotion.allProducts }}</text><text aria-hidden="true">→</text></NxButton>
    </view>
    <view class="entry-list" :class="{ 'entry-list--home': mode==='home' }"><view class="entry-track" :style="mode==='home' ? { transform: `translateX(-${activeIndex * 100}%)` } : undefined">
    <view v-for="(activity, index) in items" :key="activity.activityId" :inert="mode==='home' && index!==activeIndex ? true : undefined" :aria-hidden="mode==='home' && index!==activeIndex ? 'true' : undefined" :class="[mode==='home'?'entry-advert':eventLanding(activity)?'entry-landing':'entry-event', 'entry-kind-'+activityKind(activity), { 'entry-advert--banner': mode==='home' && bannerReady(activity) }]" :data-color-scheme="theme.resolved" :data-activity-id="activity.activityId" :data-activity-kind="activityKind(activity)">
      <view v-if="mode==='home'" class="entry-advert-target" role="button" :tabindex="active && index===activeIndex ? 0 : -1" :aria-hidden="!active || index!==activeIndex" :aria-label="localized(activity.title,locale.code)+' · '+t.promotion.browse" @click="active && navTo(offerHref(activity))" @keydown.enter.prevent="active && navTo(offerHref(activity))" @keydown.space.prevent="active && navTo(offerHref(activity))" />
      <CatalogMachineImage v-if="mode==='home'&&bannerUrl(activity)" :key="bannerKey(activity)" v-show="bannerReady(activity)" class="entry-artwork" v-bind="bannerImageProps(activity)" />
      <view v-if="mode==='home'&&!bannerReady(activity)&&promoSlots(activity).length" class="entry-product-art" aria-hidden="true"><CatalogMachineImage v-for="slot in promoSlots(activity)" :key="slot.role" :sku="slot.sku" :image-url="slot.imageUrl" :scope-key="activity.activityId+':'+slot.role" :refresh-key="catalogRefreshKey" :class="slot.role==='purchase' ? 'entry-main-image' : 'entry-gift-image'" /></view>
      <text v-if="mode==='home'" class="entry-remaining">{{ homeRemaining(activity) }}</text>
      <view v-if="mode==='events'&&!eventLanding(activity)&&activityKind(activity)!=='plain'" class="entry-event-art"><TeamArt :kind="activityArt(activity)" :size="activityKind(activity)==='spark'?88:144" /></view>
      <view v-if="mode==='home'" class="entry-copy">
        <template v-if="!bannerReady(activity)">
        <text class="entry-label">{{ activityKind(activity)==='gift' ? t.promotion.giftBadge : t.promotion.activityBadge }}</text>
        <text class="entry-title">{{ localized(activity.title,locale.code) }}</text>
        <text v-if="homeRewardSummary(activity)" class="entry-benefit">{{ homeRewardSummary(activity) }}</text>
        </template>
        <text class="entry-home-deadline" role="button" tabindex="0" :aria-label="t.promotion.homeRulesLink" @click.stop="termsActivity=activity" @keydown.enter.stop.prevent="termsActivity=activity" @keydown.space.stop.prevent="termsActivity=activity">{{ t.promotion.homeRulesLink }} ›</text>
      </view>
      <view v-if="mode==='events'&&!eventLanding(activity)" class="entry-event-copy">
        <text class="entry-eyebrow">{{ t.promotion.activityBadge }}</text>
        <text class="entry-title">{{ localized(activity.title,locale.code) }}</text>
        <view v-if="activity.rewardRules.length" class="entry-benefits">
          <view v-for="rule in activity.rewardRules" :key="rule.ruleId" class="entry-benefit-row">
            <text v-if="activityKind(activity)==='spark'" class="entry-condition">{{ t.promotion.rulePer }} {{ rule.minBuyQty }}</text>
            <text class="entry-benefit">{{ rewardSummary(rule.buyerReward,t.promotion,rule.buyerReward.disclosure.deviceName) }}</text>
            <text v-if="rule.inviterReward" class="entry-inviter-benefit">{{ t.promotion.inviter }} · {{ rewardSummary(rule.inviterReward,t.promotion,rule.inviterReward.disclosure.deviceName) }}</text>
          </view>
        </view>
        <text v-if="activity.eligibilityMessage" class="promotion-copy entry-eligibility">{{ localized(activity.eligibilityMessage,locale.code) }}</text>
      </view>
      <view v-if="mode==='events'&&!eventLanding(activity)" class="entry-event-footer">
        <text class="entry-deadline">{{ t.promotion.deadline }} · {{ displayDeadline(activity.endsAt,locale.code) }}</text>
        <view class="entry-event-actions">
          <view class="promotion-link" role="button" tabindex="0" @click="termsActivity=activity" @keydown.enter.prevent="termsActivity=activity" @keydown.space.prevent="termsActivity=activity"><text>{{ t.promotion.rulesLink }}</text><text aria-hidden="true">›</text></view>
          <NxButton class="entry-cta" size="medium" :label="t.promotion.browse" @click="navTo(promotionStoreHref(activity.activityId))"><text>{{ t.promotion.browse }}</text><text aria-hidden="true">→</text></NxButton>
        </view>
      </view>
      <!-- Purchase gift, first purchase and repurchase open their own landing page; the
           terms link keeps opening the existing sheet. -->
      <view v-for="card in landingCards(activity)" :key="card.kind" class="entry-card entry-press" :class="'entry-card--'+card.kind" :style="{ animationDelay: (index*0.06+0.06)+'s' }" role="link" tabindex="0" :aria-label="localized(activity.title,locale.code)" @click="navTo(promotionLandingHref(activity.activityId))" @keydown.enter.prevent="navTo(promotionLandingHref(activity.activityId))">
        <template v-if="card.kind==='gift'">
          <view class="entry-card__copy"><text class="entry-card__buy">{{ fmt(landing.cardBuy,{name:card.buyName}) }}</text><text class="entry-card__get">{{ card.discount ? '' : landing.cardGet.split('{reward}')[0] }}<text class="entry-card__keep">{{ card.rewardText }}</text>{{ card.discount ? '' : landing.cardGet.split('{reward}')[1] }}</text></view>
          <view class="entry-card__main"><CatalogMachineImage class="entry-card__fill" :sku="card.buySku" :image-url="card.buyImage" :scope-key="activity.activityId+':card-main'" :refresh-key="catalogRefreshKey" /></view>
          <view v-if="card.giftSku" class="entry-card__gift entry-pop"><CatalogMachineImage class="entry-card__fill" :sku="card.giftSku" :image-url="card.giftImage" :scope-key="activity.activityId+':card-gift'" :refresh-key="catalogRefreshKey" /></view>
          <view class="entry-card__days"><NxTag tone="warning">{{ homeRemaining(activity) }}</NxTag></view>
        </template>
        <view v-else-if="card.kind==='first'" class="entry-card__stub">
          <text class="entry-card__eyebrow">{{ card.discount ? t.promotion.orderDiscount : landing.cardFirstEyebrow }}</text>
          <text class="entry-card__amount" :class="{ 'entry-card__amount--long': card.parts.amount.length>4 }">{{ card.parts.amount }}</text>
          <text class="entry-card__unit" :class="{ 'entry-card__unit--uvt': card.parts.asset==='UVT' }">{{ card.parts.unit }}</text>
        </view>
        <view v-else class="entry-card__well">
          <view class="entry-card__slot"><CatalogMachineImage class="entry-card__slot-image" :sku="card.buySku" :image-url="card.buyImage" :scope-key="activity.activityId+':card-slot'" :refresh-key="catalogRefreshKey" /><text class="entry-card__plus entry-pop" aria-hidden="true">+</text></view>
          <view class="entry-card__bonus"><text class="entry-card__bonus-amount">{{ card.discount ? '−' : '+' }}{{ card.parts.asset==='DEVICE' ? card.rewardText : card.parts.amount }}</text><text v-if="card.parts.asset!=='DEVICE'" class="entry-card__unit" :class="{ 'entry-card__unit--uvt': card.parts.asset==='UVT' }">{{ card.parts.unit }}</text></view>
        </view>
        <template v-if="card.kind==='first'"><view class="entry-card__tear" aria-hidden="true" /><view class="entry-card__notch entry-card__notch--top" aria-hidden="true" /><view class="entry-card__notch entry-card__notch--bottom" aria-hidden="true" /></template>
        <view v-if="card.kind!=='gift'" class="entry-card__body">
          <view class="entry-card__head"><text class="entry-card__title">{{ localized(activity.title,locale.code) }}</text><NxTag tone="warning">{{ homeRemaining(activity) }}</NxTag></view>
          <text class="entry-card__note">{{ card.kind==='first' ? (card.discount ? landing.cardFirstNoteDiscount : landing.cardFirstNote) : fmt(landing.cardRepurchaseNote,{name:card.buyName}) }}</text>
          <view class="entry-card__link" role="button" tabindex="0" @click.stop="termsActivity=activity" @keydown.enter.stop.prevent="termsActivity=activity" @keydown.space.stop.prevent="termsActivity=activity"><text>{{ t.promotion.rulesLink }} ›</text></view>
        </view>
        <view v-else class="entry-card__link entry-card__link--corner" role="button" tabindex="0" @click.stop="termsActivity=activity" @keydown.enter.stop.prevent="termsActivity=activity" @keydown.space.stop.prevent="termsActivity=activity"><text>{{ t.promotion.rulesLink }} ›</text></view>
      </view>
    </view>
    </view></view>
    <view v-if="mode==='home'&&items.length>1" class="entry-pagination" role="button" tabindex="0" :aria-label="`${t.promotion.nextOffer} · ${activeIndex+1} / ${items.length}`" @click="cycleOffer(1)" @keydown.enter.prevent="cycleOffer(1)" @keydown.space.prevent="cycleOffer(1)" @keydown.right.prevent="cycleOffer(1)" @keydown.left.prevent="cycleOffer(-1)">
      <view v-for="(_,index) in items" :key="index" class="entry-page-dot" :class="{selected:activeIndex===index}" aria-hidden="true" />
    </view>
    <NxButton v-if="hasMore&&mode==='events'" class="entry-cta" size="medium" :busy="status==='loading'" :label="status==='loading'?t.promotion.loading:t.promotion.more" @click="load(false)"><text>{{ status==='loading'?t.promotion.loading:t.promotion.more }}</text><text aria-hidden="true">→</text></NxButton>
    <PromotionTerms :open="!!termsActivity" :title="localized(termsActivity?.title,locale.code)" :terms="termsText" :rules="termsRules" :disclosures="promotionDisclosures(termsActivity)" @close="termsActivity=null" />
  </view>
</template>
<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { toast } from "@/store/ui";
import { fmt } from '@/i18n/format';
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue';
import { onHide,onShow } from '@/composables/use-tab-page-lifecycle';
import { apiRuntimeConfig,promotionApi,remoteApiEnabled,sessionVault } from '@/api/runtime';
import type { PublicPromotion } from '@/api/promotion-contracts';
import { useApp } from '@/store/app';
import { useLocaleStore } from '@/store/locale';
import { useTheme } from '@/store/theme';
import { useT } from '@/i18n/use-t';
import { getProduct } from '@/mock/products';
import { productCatalogState,refreshProductCatalog,revalidateProductCatalog } from '@/store/product-catalog';
import { navTo } from '@/lib/route';
import { localized,displayDeadline,rewardSummary } from '@/lib/promotion-display';
import { createPromotionReadFence,isPromotionActive,promotionDisclosures,promotionStoreHref } from '@/lib/promotion-entry';
import NxButton from '@/components/ui/nx-button.vue';
import NxTag from '@/components/ui/nx-tag.vue';
import TeamArt from '@/components/team/team-art.vue';
import PromotionTerms from './promotion-terms.vue';
import CatalogMachineImage from '@/components/catalog-machine-image.vue';
import { promotionMachineSlots } from '@/components/catalog-machine-image';
import { readHomePromotions } from '@/store/home-promotions';
import { landingCopy } from '@/i18n/promotion-landing';
import { landingKind,landingProductImage,landingProductName,litePromotion,promotionLandingHref,promotionRemaining,promotionTermsRules,promotionTermsText,rewardParts,rewardPartsText } from '@/lib/promotion-landing';
const props=withDefaults(defineProps<{mode?:'home'|'events';activities?:PublicPromotion[];active?:boolean}>(),{mode:'home',active:true});
const app=useApp(),locale=useLocaleStore(),theme=useTheme(),t=useT();
const landing=computed(()=>landingCopy(locale.code));
const items=ref<PublicPromotion[]>([]),status=ref<'idle'|'loading'|'ready'|'error'>('idle');
const listRead=ref(false);
useAutoRecovery({ failed: () => props.active && status.value === "error", retry: () => load(true) });
const cursor=ref<string|null>(null),hasMore=ref(false),activeIndex=ref(0),termsActivity=ref<PublicPromotion|null>(null);
const loadedBanners=ref(new Set<string>()),imageRefresh=ref(0);
const catalogRefreshKey=computed(()=>imageRefresh.value);
// Presentation follows published reward types. Purchase rewards do not imply
// a claimed voucher or a completed milestone; those have separate event data.
function activityKind(activity:PublicPromotion):'gift'|'coupon'|'spark'|'plain' {
  const rewards=activity.rewardRules.flatMap(rule=>[rule.buyerReward,...(rule.inviterReward?[rule.inviterReward]:[])]);
  if(rewards.some(reward=>reward.type==='DEVICE'))return 'gift';
  if(rewards.some(reward=>reward.type==='DISCOUNT_USDT'))return 'coupon';
  return rewards.length?'spark':'plain';
}
// Lite: campaign cards show only non-phone products and rules; phone-only offers are hidden.
function liteActive(activities:PublicPromotion[]){return activities.filter(isPromotionActive).flatMap(activity=>litePromotion(activity)??[]);}
function activityArt(activity:PublicPromotion){const kind=activityKind(activity);return kind==='plain'?'spark':kind;}
function promoSlots(activity:PublicPromotion) {
  void app.accountKey;void app.accountBindingEpoch;void productCatalogState.revision;
  const ready=(productCatalogState.status==='ready'||(productCatalogState.status==='loading'&&productCatalogState.serverCanonical))&&!!sessionVault.read();
  return promotionMachineSlots(activity).map(slot=>({...slot,imageUrl:ready?getProduct(slot.sku)?.imageUrl:undefined}));
}
const fence=createPromotionReadFence();let visible=true,pendingTicket:number|null=null;
// The published banner contract has no theme variants. In light mode use the
// same published rules and catalog images in a theme-aware, readable layout.
function bannerUrl(activity:PublicPromotion){return theme.resolved==='dark'&&activity.bannerImageUrl?apiRuntimeConfig.baseUrl.replace(/\/+$/,'')+activity.bannerImageUrl:null;}
function bannerKey(activity:PublicPromotion){return JSON.stringify([app.accountKey,app.accountBindingEpoch,locale.code,activity.activityId,activity.version,bannerUrl(activity),imageRefresh.value]);}
function bannerReady(activity:PublicPromotion){return !!bannerUrl(activity)&&loadedBanners.value.has(bannerKey(activity));}
function bannerImageProps(activity:PublicPromotion){
  const key=bannerKey(activity);
  return {sku:activity.activityId,imageUrl:bannerUrl(activity),scopeKey:JSON.stringify([locale.code,activity.version]),refreshKey:imageRefresh.value,onReady:(ready:boolean)=>{
    if(!visible||!items.value.some(item=>bannerKey(item)===key))return;
    if(ready)loadedBanners.value.add(key);else loadedBanners.value.delete(key);
  }};
}
function clear(resetBanners=true){items.value=[];listRead.value=false;cursor.value=null;hasMore.value=false;activeIndex.value=0;termsActivity.value=null;if(resetBanners){imageRefresh.value++;loadedBanners.value.clear();}}
function publicName(id:string){void productCatalogState.status;return sessionVault.read()?getProduct(id)?.name??id:id;}
function homeRewardSummary(activity:PublicPromotion) {
  const reward=activity.rewardRules[0]?.buyerReward;
  if(!reward)return '';
  return localized(reward.disclosure.benefitDescription,locale.code)
    || rewardSummary(reward,t.value.promotion,reward.disclosure.deviceName || (reward.type==='DEVICE'?publicName(reward.giftProductNo):null));
}
function homeRemaining(activity:PublicPromotion){return promotionRemaining(activity,t.value.promotion);}
function cycleOffer(delta:number){if(items.value.length)activeIndex.value=(activeIndex.value+delta+items.value.length)%items.value.length;}
// Home offers rotate on their own; any change of offer (auto or tapped) restarts the countdown.
let autoplayTimer:ReturnType<typeof setInterval>|null=null;
function stopAutoplay(){if(autoplayTimer!==null){clearInterval(autoplayTimer);autoplayTimer=null;}}
function startAutoplay(){stopAutoplay();if(props.mode==='home'&&props.active&&visible&&items.value.length>1&&!termsActivity.value)autoplayTimer=setInterval(()=>cycleOffer(1),5000);}
const termsRules=computed(()=>termsActivity.value?promotionTermsRules(termsActivity.value,t.value.promotion,publicName):[]);
const termsText=computed(()=>termsActivity.value?promotionTermsText(termsActivity.value,t.value.promotion,locale.code):'');
// Purchase gift, first purchase and repurchase have a landing page; other offers keep the store filter.
function offerHref(activity:PublicPromotion){return landingKind(activity)?promotionLandingHref(activity.activityId):promotionStoreHref(activity.activityId);}
function eventLanding(activity:PublicPromotion){return props.mode==='events'?landingKind(activity):null;}
function landingCards(activity:PublicPromotion){
  const kind=eventLanding(activity),rule=activity.rewardRules[0];
  if(!kind||!rule)return [];
  void app.accountKey;void app.accountBindingEpoch;
  const reward=rule.buyerReward,parts=rewardParts(activity,reward),giftSku=reward.type==='DEVICE'?reward.giftProductNo:null;
  return [{kind,parts,discount:parts.asset==='DISCOUNT',rewardText:rewardPartsText(parts,t.value.promotion),buySku:rule.productNo,buyName:landingProductName(activity,rule.productNo),buyImage:landingProductImage(rule.productNo),giftSku,giftImage:giftSku?landingProductImage(giftSku):undefined}];
}
async function load(reset:boolean,preserveImages=false){
  if(!visible)return;
  if(!reset&&(status.value==='loading'||!hasMore.value)) return;
  if(props.activities===undefined&&pendingTicket!==null&&fence.current(pendingTicket))return;
  if(reset&&!preserveImages){imageRefresh.value++;loadedBanners.value.clear();termsActivity.value=null;}
  // Join a shared read already in flight; otherwise explicitly revalidate the catalog.
  const catalogRead=reset&&remoteApiEnabled&&sessionVault.read()
    ?preserveImages?revalidateProductCatalog():refreshProductCatalog(productCatalogState.status!=='loading'):Promise.resolve();
  if(props.activities!==undefined){fence.invalidate();items.value=liteActive(props.activities);listRead.value=true;cursor.value=null;hasMore.value=false;activeIndex.value=Math.min(activeIndex.value,Math.max(0,items.value.length-1));status.value='ready';await catalogRead;return;}
  const ticket=fence.next(),identity=`${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`;
  pendingTicket=ticket;
  status.value='loading';
  if(!remoteApiEnabled){clear();status.value=props.mode==='home'?'ready':'error';return;}
  try{
    const read=props.mode==='home'&&reset?readHomePromotions(identity,!!sessionVault.read(),!preserveImages)
      :promotionApi.list({limit:20,cursor:reset?null:cursor.value,...(props.mode==='home'?{placement:'home.purchase-promotion' as const}:{})},!!sessionVault.read());
    const [page]=await Promise.all([read,catalogRead]);
    if(!fence.current(ticket)||identity!==`${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`)return;
    const rows=reset?[]:items.value;
    items.value=[...new Map([...rows,...liteActive(page.items)].map(item=>[item.activityId,item])).values()];
    activeIndex.value=Math.min(activeIndex.value,Math.max(0,items.value.length-1));
    cursor.value=page.nextCursor;hasMore.value=page.hasMore;status.value='ready';
    listRead.value=true;
  }catch(cause){if(fence.current(ticket)&&identity===`${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`){
    if(cause instanceof Error && 'status' in cause && (cause.status===401||cause.status===403))clear();
    if(reset)status.value='error';else{status.value='ready';toast.error(t.value.promotion.error);}
  }}finally{if(pendingTicket===ticket)pendingTicket=null;}
}
async function move(delta:number){
  const next=activeIndex.value+delta;if(next<0)return;
  if(next>=items.value.length&&hasMore.value)await load(false);
  if(next<items.value.length)activeIndex.value=next;
}
watch([()=>app.accountKey,()=>app.accountBindingEpoch,()=>locale.code],()=>{
  fence.invalidate();clear();status.value='idle';
  if(visible)void load(true);
},{flush:'sync'});
watch(()=>props.activities,(next,previous)=>{if(visible&&(next!==undefined||previous!==undefined))void load(true,true);},{immediate:true});
watch(()=>theme.resolved,()=>{imageRefresh.value++;loadedBanners.value.clear();});
watch([()=>items.value.length,()=>props.active,termsActivity,activeIndex],startAutoplay);
onMounted(()=>{void load(true,true);startAutoplay();});onShow(()=>{visible=true;void load(true,true);startAutoplay();});
onHide(()=>{visible=false;termsActivity.value=null;stopAutoplay();});
onBeforeUnmount(()=>{visible=false;stopAutoplay();fence.invalidate();clear();});
</script>
<style src="./promotion.css"></style>
<style scoped>
.promotion-entry { display: flex; flex-direction: column; gap: var(--ui-space-inset); }
.promotion-entry:not(.promotion-entry-home) { gap: var(--ui-space-card-gap); }
.entry-navigation { margin-top: calc(var(--ui-space-section-gap) - var(--ui-space-card-gap)); }
.entry-navigation .promotion-title { font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.entry-navigation .promotion-link { margin: -10px 0; gap: 4px; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3); }
.promotion-entry-home { gap: 0; }
.entry-list, .entry-track { display: contents; }
.entry-list--home { display: block; overflow: hidden; border-radius: 24px; }
.entry-list--home > .entry-track { display: flex; transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1); }
.entry-list--home .entry-advert { flex: 0 0 100%; box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) { .entry-list--home > .entry-track { transition: none; } }
.entry-placeholder { min-height:146px;box-sizing:border-box;padding:20px;border-radius:24px;background:var(--v5-surface);border:1px solid var(--v5-border); }
.entry-placeholder > view { width:70%;height:18px;border-radius:8px;background:var(--v5-surface-2); }
.entry-placeholder > view + view { width:50%;height:30px;margin-top:18px; }
.entry-retry { width: auto; }
.entry-status { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-row-y); padding: var(--ui-space-inline) 0; }
.entry-status.nx-inline-recovery { display:grid; align-items:center; gap:12px; }
.entry-status.nx-inline-recovery .promotion-title { text-wrap: balance; }
.entry-advert,.entry-event { position: relative; overflow: hidden; border: 1px solid var(--v5-border); border-radius: 24px; background: var(--v5-surface); }
.entry-advert { min-height: 146px; border: 0; background: radial-gradient(70% 90% at 82% 72%,rgba(158,220,29,.24),transparent 62%),radial-gradient(50% 70% at 100% 0%,rgba(255,255,255,.08),transparent 60%),linear-gradient(135deg,#171717,#101010); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }
.entry-advert[data-color-scheme="light"] { --promotion-copy-ink: var(--v5-ink); background: radial-gradient(70% 90% at 82% 72%,color-mix(in srgb,var(--v5-brand) 12%,transparent),transparent 64%),linear-gradient(135deg,var(--ui-spotlight-top),var(--ui-ticket-bottom)); box-shadow: inset 0 0 0 1px var(--v5-border); }
.entry-advert[data-color-scheme="light"]::before { background-image: radial-gradient(circle,color-mix(in srgb,var(--v5-brand) 12%,transparent) 1px,transparent 1px); }
.entry-advert[data-color-scheme="light"] .entry-label { color: var(--v5-brand); }
.entry-advert[data-color-scheme="light"] .entry-home-deadline { color: var(--v5-ink-3); }
.entry-advert[data-color-scheme="light"] .entry-product-art::before { background: radial-gradient(ellipse,color-mix(in srgb,var(--v5-brand) 22%,transparent),transparent 70%); }
.entry-advert::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle,rgba(255,255,255,.07) 1px,transparent 1px) 0 0/14px 14px; mask-image: linear-gradient(90deg,transparent 30%,#000 75%); pointer-events: none; }
.entry-advert-target { position: absolute; inset: 0; z-index: 1; border-radius: inherit; }
.entry-advert-target:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -3px; }
.entry-artwork { position: absolute; inset: 0; width: 100%; height: 100%; }
.entry-advert .entry-copy { position: relative; display: flex; flex-direction: column; padding: 18px 18px 16px; min-height: 146px; box-sizing: border-box; color: var(--promotion-copy-ink, #f5f7fa); }
.entry-advert:has(.entry-product-art) .entry-copy { padding-right: 148px; }
.entry-label,.entry-eyebrow { display: block; color: var(--v5-brand); font: 500 12px/1.5 var(--font-v5); }
.entry-title { display: block; margin-top: 7px; font: 600 23px/1.3 var(--font-v5); overflow-wrap: anywhere; }
.entry-advert .entry-label { font-size: 12.5px; color: #c8f25a; }
.entry-advert .entry-title { margin-top: 6px; font-size: 19px; line-height: 25px; }
.entry-advert .promotion-copy { color: var(--v5-ink-2); font-size: 12px; line-height: 1.5; }
.entry-copy,.entry-event-copy { min-width: 0; }
.entry-benefit { display: block; margin-top: 5px; color: var(--v5-ink-2); font: 500 14px/1.5 var(--font-v5); overflow-wrap: anywhere; }
.entry-advert .entry-benefit { margin-top: 0; color: inherit; font: 600 19px/25px var(--font-v5); }
.entry-advert.entry-kind-gift .entry-title { color: var(--v5-ink-2); font: 500 var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5); }
.entry-advert.entry-kind-gift .entry-benefit { margin-top: 4px; color: var(--v5-brand); font: 600 var(--ui-type-profile)/var(--ui-type-profile-lh) var(--font-v5); }
.entry-home-deadline { position: relative; z-index: 2; align-self: flex-start; margin-top: auto; padding: 13px 0; margin-bottom: -13px; color: #9aa2b2; font: 400 12px/18px var(--font-v5); white-space: nowrap; }
.entry-home-deadline:focus-visible { outline: 2px solid var(--v5-brand); }
.entry-remaining { position: absolute; top: 12px; right: 16px; z-index: 2; pointer-events: none; color: var(--v5-warning-ink); font: 500 11px/18px var(--font-v5); white-space: nowrap; }
.entry-advert--banner .entry-remaining { padding:2px 7px;border-radius:6px;background:var(--v5-surface); }
.entry-advert--banner .entry-home-deadline { padding-inline:8px;border-radius:8px;background:var(--v5-surface);color:var(--v5-ink-2); }
.entry-product-art { position: absolute; right: 0; width: 160px; inset-block: 0; pointer-events: none; }
.entry-product-art::before { content: ''; position: absolute; right: 18px; bottom: 16px; width: 120px; height: 20px; background: radial-gradient(ellipse,rgba(200,242,90,.4),transparent 70%); }
.entry-main-image { position: absolute; right: 34px; top: 30px; width: 108px; height: 108px; animation: promotion-float 4.2s ease-in-out infinite; }
.entry-gift-image { position: absolute; right: 12px; bottom: 10px; width: 76px; height: 76px; animation: promotion-float 4.2s ease-in-out -1.6s infinite; }
@keyframes promotion-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@media(prefers-reduced-motion:reduce) { .entry-main-image,.entry-gift-image { animation: none; } }
.entry-event { display: grid; grid-template-columns: minmax(0,1fr) 128px; padding: var(--ui-space-section); gap: var(--ui-space-inset) 0; }
.entry-event-copy { position: relative; z-index: 1; grid-column: 1; grid-row: 1; }
.entry-event-art { display: flex; align-items: center; justify-content: center; grid-column: 2; grid-row: 1; pointer-events: none; }
.entry-event-art :deep(.team-art) { max-width: none; }
.entry-event.entry-kind-gift { background: radial-gradient(ellipse at 88% 40%,color-mix(in srgb,var(--v5-brand) 9%,transparent),transparent 56%),var(--v5-surface); }
.entry-event.entry-kind-gift .entry-event-art { align-self: center; }
.entry-benefits { margin-top: var(--ui-space-inline); }
.entry-benefit-row + .entry-benefit-row { margin-top: var(--ui-space-inline); }
.entry-inviter-benefit,.entry-condition { display: block; margin-top: 4px; color: var(--v5-ink-3); font: 400 12px/1.5 var(--font-v5); }
.entry-eligibility { margin-top: var(--ui-space-row-y); }
.entry-event-footer { position: relative; z-index: 1; grid-column: 1 / -1; }
.entry-deadline { display: block; color: var(--v5-ink-3); font: 400 11px/1.5 var(--font-v5); overflow-wrap: anywhere; }
.entry-event-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-top: var(--ui-space-row-y); }
.promotion-link { gap: 8px; color: var(--v5-ink-2); }
.entry-cta { max-width: 100%; }
.entry-event.entry-kind-coupon { grid-template-columns: minmax(0,1fr) 94px; border-radius: 16px; }
.entry-kind-coupon .entry-event-copy { padding-right: 18px; }
.entry-kind-coupon .entry-event-art { border-left: 1px dashed var(--v5-border); margin: -20px -20px -16px 0; overflow: hidden; }
.entry-kind-coupon .entry-event-art :deep(.team-art) { transform: rotate(-12deg); }
.entry-kind-coupon .entry-event-footer { border-top: 1px dashed var(--v5-border); padding-top: 14px; }
.entry-event.entry-kind-spark { grid-template-columns: minmax(0,1fr) 72px; }
.entry-kind-spark .entry-event-art { align-self: start; }
.entry-kind-spark .entry-benefits { margin-top: 18px; padding-left: 14px; border-left: 1px solid var(--v5-border); }
.entry-kind-spark .entry-benefit-row { position: relative; }
.entry-kind-spark .entry-benefit-row::before { content: ''; position: absolute; left: -18px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--v5-brand); }
.entry-kind-spark .entry-benefit { font-size: 20px; }
.entry-kind-plain .entry-event-copy { grid-column: 1 / -1; }
.entry-pagination,.entry-navigation { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-inline); }
.entry-pagination { position: relative; justify-content: center; gap: 6px; min-height: 44px; margin: -9px 0 -19px; cursor: pointer; }
.entry-page-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--v5-ink-4); }
.entry-page-dot.selected { width: 16px; background: var(--v5-brand); }
.entry-pagination:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; border-radius: 12px; }
@media(max-width:374px) {
  .entry-advert:has(.entry-product-art) .entry-copy { padding-right: 105px; }
  .entry-product-art { right: 0; width: 130px; }
  .entry-main-image { right: 24px; width: 96px; height: 96px; }
  .entry-gift-image { right: 10px; width: 68px; height: 68px; }
  .entry-advert .entry-title,.entry-advert .entry-benefit { font-size: 17px; line-height: 22px; }
  .entry-home-deadline { font-size: 11px; }
  .entry-event { padding: var(--ui-space-inset); grid-template-columns: minmax(0,1fr) 104px; }
  .entry-title { font-size: 20px; }
  .entry-kind-coupon .entry-event-art { margin: -16px -16px -16px 0; }
}
/* Landing cards (P-58): plain surfaces, no play-type label, remaining days top right. */
.entry-landing { display: block; }
.entry-card { position: relative; display: block; overflow: hidden; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); color: var(--v5-ink); cursor: pointer; animation: entry-card-rise .5s cubic-bezier(.2,.8,.2,1) backwards; }
.entry-card:focus-visible, .entry-card__link:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -3px; }
.entry-card__fill { position: absolute; inset: 0; }
.entry-card__link { display: inline-flex; align-items: flex-end; align-self: flex-start; box-sizing: border-box; min-height: 44px; margin: auto 0 -13px; padding: 12px 0 13px; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.entry-card__link--corner { position: absolute; left: 8px; bottom: 3px; z-index: 1; margin: 0; padding: 13px 10px; }
.entry-card--gift { height: 184px; }
.entry-card__copy { position: absolute; left: 18px; top: 20px; width: min(176px, 52%); }
/* Purchase line stays body/500 and the gift line profile/600 in brand (04.2, 10.2). */
.entry-card__buy { display: block; font: 500 var(--ui-type-body)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.entry-card__get { display: block; margin-top: 4px; font: 600 var(--ui-type-profile)/var(--ui-type-profile-lh) var(--font-v5); color: var(--v5-brand); overflow-wrap: anywhere; }
.entry-card__keep { white-space: nowrap; }
.entry-card__days { position: absolute; right: 14px; top: 14px; z-index: 1; }
.entry-card__main { position: absolute; right: 70px; top: 44px; width: 118px; height: 118px; }
.entry-card__gift { position: absolute; right: 12px; top: 90px; width: 78px; height: 78px; }
.entry-card--first { display: grid; grid-template-columns: 112px minmax(0,1fr); min-height: 132px; }
.entry-card__stub { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 6px; background: var(--v5-surface-2); text-align: center; min-width: 0; }
.entry-card__eyebrow { font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.entry-card__amount { margin-top: 2px; font: 500 36px/40px var(--font-amount); letter-spacing: -.03em; font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.entry-card__amount--long { font-size: 26px; line-height: 32px; }
.entry-card__unit { font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.entry-card__unit--uvt { color: var(--v5-nex-ink); }
.entry-card__tear { position: absolute; left: 111px; top: 12px; bottom: 12px; border-left: 1.5px dashed var(--v5-border-strong); }
.entry-card__notch { position: absolute; left: 103px; width: 18px; height: 18px; border-radius: 50%; background: var(--v5-bg); }
.entry-card__notch--top { top: -9px; }
.entry-card__notch--bottom { bottom: -9px; }
.entry-card__body { display: flex; flex-direction: column; min-width: 0; padding: 16px 14px 16px 18px; }
.entry-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.entry-card__title { min-width: 0; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.entry-card__note { display: block; margin-top: 4px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.entry-card--repurchase { display: flex; gap: 14px; min-height: 132px; box-sizing: border-box; padding: 10px; }
.entry-card--repurchase .entry-card__body { flex: 1; padding: 6px 4px 6px 0; }
.entry-card__well { flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 104px; padding: 10px 0; border-radius: 16px; background: var(--v5-surface-2); }
.entry-card__slot { position: relative; display: grid; place-items: center; width: 64px; height: 64px; box-sizing: border-box; border: 1.5px dashed var(--v5-aura-sky); border-radius: 16px; }
.entry-card__slot-image { width: 54px; height: 54px; }
.entry-card__plus { position: absolute; right: -8px; top: -8px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; background: var(--v5-aura-sky); color: white; font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); }
.entry-card__bonus { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 3px; padding: 0 6px; }
.entry-card__bonus-amount { font: 500 18px/22px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--v5-ink); overflow-wrap: anywhere; }
.entry-pop { animation: entry-card-pop .45s cubic-bezier(.2,.8,.2,1) .5s backwards; }
.entry-press { transition: transform 120ms ease-out; }
.entry-press:active { transform: scale(.97); }
@keyframes entry-card-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes entry-card-pop { 0% { opacity: 0; transform: scale(.6); } 70% { transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
@media (max-width:374px) {
  .entry-card__copy { width: 56%; }
  .entry-card__main { right: 56px; width: 100px; height: 100px; top: 52px; }
  .entry-card__gift { width: 68px; height: 68px; top: 98px; }
  .entry-card--first { grid-template-columns: 96px minmax(0,1fr); }
  .entry-card__tear { left: 95px; }
  .entry-card__notch { left: 87px; }
  .entry-card__well { width: 92px; }
}
@media (prefers-reduced-motion: reduce) {
  .entry-card, .entry-pop { animation: none; }
  .entry-press { transition: none; }
  .entry-press:active { transform: none; }
}
</style>
