<template>
  <NxSheet :open="open" :title="title || t.promotion.rules" @close="emit('close')">
    <view v-for="(entry,index) in uniqueDisclosures" :key="index" class="promotion-rule-section">
      <text class="promotion-title promotion-title--section">{{ sectionTitle(entry) }}</text>
      <DisclosureDetails :disclosure="entry" :shared-terms="!!shared.terms" :shared-refund="!!shared.refund" />
    </view>
    <view v-if="shared.terms || shared.refund" class="promotion-rule-section">
      <text v-if="shared.terms" class="promotion-copy" style="white-space:pre-wrap">{{ shared.terms }}</text>
      <template v-if="shared.refund"><text class="promotion-title promotion-title--sub" :style="shared.terms ? 'margin-top:16px' : ''">{{ t.promotion.returnPolicy }}</text><text class="promotion-copy" style="white-space:pre-wrap">{{ shared.refund }}</text></template>
    </view>
    <view v-for="rule in rules" :key="rule.id" class="promotion-rule-section"><text class="promotion-copy" style="white-space:pre-wrap">{{ rule.text }}</text></view>
    <text v-if="uniqueTerms" class="promotion-copy" style="white-space:pre-wrap;margin-top:14px">{{ uniqueTerms }}</text>
  </NxSheet>
</template>
<script setup lang="ts">
import NxSheet from '@/components/ui/nx-sheet.vue';
import { computed } from 'vue';
import { useT } from '@/i18n/use-t';
import { useLocaleStore } from '@/store/locale';
import { localized } from '@/lib/promotion-display';
import type { PromotionDisclosure } from '@/lib/promotion-entry';
import { landingCopy } from '@/i18n/promotion-landing';
import DisclosureDetails from './disclosure-details.vue';
import { uniquePromotionParagraphs } from '@/lib/promotion-paragraphs';
const props=defineProps<{open:boolean;title?:string;terms?:string;disclosures?:PromotionDisclosure[];rules?:{id:string;text:string}[]}>();
const emit=defineEmits<{(e:'close'):void}>();const t=useT();const locale=useLocaleStore();
const uniqueDisclosures = computed(() => Array.from(new Map((props.disclosures ?? []).map(entry => [JSON.stringify(entry), entry])).values()));
// Referral offers publish the buyer's and the inviter's reward under the same title, so the groups are named by who gets them.
const hasInviter = computed(() => uniqueDisclosures.value.some(entry => entry.role === 'DIRECT_INVITER'));
function sectionTitle(entry: PromotionDisclosure) {
  if (!hasInviter.value) return localized(entry.title,locale.code);
  const copy = landingCopy(locale.code);
  return entry.role === 'DIRECT_INVITER' ? copy.termsInviterReward : copy.termsFriendReward;
}
// Terms and refund rules come from the offer, so every group usually repeats them; identical text is shown once.
const shared = computed(() => {
  const list = uniqueDisclosures.value;
  const same = (pick: (entry: PromotionDisclosure) => string) => list.length > 1 && list.every(entry => pick(entry) === pick(list[0])) ? pick(list[0]) : '';
  const refund = same(entry => localized(entry.refundTerms,locale.code));
  const terms = same(entry => localized(entry.terms,locale.code));
  return { refund, terms: terms ? uniquePromotionParagraphs(terms, [refund, ...list.map(entry => localized(entry.benefitDescription,locale.code))]) : '' };
});
const uniqueTerms = computed(() => {
  const value = props.terms?.trim() ?? '';
  return uniquePromotionParagraphs(value, uniqueDisclosures.value.flatMap(entry => [localized(entry.terms,locale.code),localized(entry.refundTerms,locale.code),localized(entry.benefitDescription,locale.code)]));
});
</script>
<style src="./promotion.css"></style>

<style scoped>.promotion-rule-section + .promotion-rule-section { margin-top:24px;padding-top:24px;border-top:1px solid var(--v5-border); }</style>
