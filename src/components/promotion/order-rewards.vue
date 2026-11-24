<template>
  <!-- LOGIC: hide the whole card when it has no reward rows (decision ④; today a plain bundle shows only the refund note). -->
  <view v-if="loading || error || receipt?.promotionQuoteId || rewards.length" class="promotion promotion-flat order-rewards">
    <text class="promotion-title">{{ t.promotion.orderRewards }}</text><text class="promotion-copy">{{ t.promotion.refundNote }}</text>
    <text v-if="loading" class="promotion-copy" role="status">{{ t.promotion.loading }}</text>
    <RewardRows :expected="receipt?.rewards?.filter(row=>row.reward.type==='DISCOUNT_USDT')" :lines="receipt?.items" />
    <RewardRows v-if="rewards.length" :rewards="rewards" :lines="receipt?.items" />
    <RewardRows v-else :expected="receipt?.rewards?.filter(row=>row.reward.type!=='DISCOUNT_USDT')" :lines="receipt?.items" />
    <text v-if="error && !receipt && !rewards.length" class="promotion-copy">—</text>

    <view v-if="rewards.length||receipt?.rewards?.some(row=>row.reward.type!=='DISCOUNT_USDT')" class="promotion-link" role="link" tabindex="0" @click="navTo('/pages/me/rewards-list?cat=promotion&orderNo='+encodeURIComponent(orderNo))" @keydown.enter.prevent="navTo('/pages/me/rewards-list?cat=promotion&orderNo='+encodeURIComponent(orderNo))"><text class="nx-after-chevron">{{ t.promotion.rewards }}</text></view>
  </view>
</template>
<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import {ref,watch,onBeforeUnmount} from 'vue';import {useT} from '@/i18n/use-t';import {useApp} from '@/store/app';import {promotionApi,remoteApiEnabled} from '@/api/runtime';import type{PromotionOrder,Reward} from '@/api/promotion-api';import {navTo} from '@/lib/route';import RewardRows from './reward-rows.vue';
// The order's one pay entry is the detail page's bottom bar (contract P1); this card only reports discounts and rewards.
// LOGIC: paymentAllowed no longer drives anything here; the logic item can drop it with its binding in order-detail.vue.
const props=defineProps<{orderNo:string;paymentAllowed:boolean}>();const t=useT(),app=useApp();const receipt=ref<PromotionOrder|null>(null),rewards=ref<Reward[]>([]),error=ref(false),loading=ref(false);let generation=0,alive=true;
useAutoRecovery({ failed: () => error.value && !loading.value, retry: load });
async function load(){
  if(!props.orderNo||!remoteApiEnabled||loading.value)return;
  const request=++generation,account=app.accountKey,epoch=app.accountBindingEpoch;
  const current=()=>alive&&request===generation&&account===app.accountKey&&epoch===app.accountBindingEpoch;
  loading.value=true;error.value=false;
  const [order,page]=await Promise.allSettled([promotionApi.findOrder(props.orderNo),promotionApi.rewards({orderNo:props.orderNo,limit:100})]);
  if(!current())return;
  if(order.status==='fulfilled')receipt.value=order.value;
  if(page.status==='fulfilled')rewards.value=page.value.items;
  error.value=order.status==='rejected'||page.status==='rejected';loading.value=false;
}
watch(()=>[props.orderNo,app.accountKey,app.accountBindingEpoch],()=>{generation++;receipt.value=null;rewards.value=[];loading.value=false;error.value=false;void load();},{immediate:true});onBeforeUnmount(()=>{alive=false;generation++;});
</script>
<style src="./promotion.css"></style>
<style scoped>
/* Same solid block as the order summary above it (order-detail .order-block): card gap 12, radius 22, light shadow. */
.order-rewards { margin: var(--ui-space-card-gap) 16px 0; border-radius: var(--ui-radius-surface); background: var(--v5-content-surface); }
[data-theme="light"] .order-rewards { box-shadow: var(--v5-glass-shadow); }
.order-rewards .promotion-title + .promotion-copy { margin-top: var(--v5-space-1); }
/* 我的奖励 goes one level down: a text link, 13/18 500 in the muted ink with a trailing chevron (03 §3.9). */
.order-rewards .promotion-link { width: fit-content; color: var(--v5-ink-3); font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); }
</style>
