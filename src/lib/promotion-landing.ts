import type { PublicPromotion, PublicRewardSpec } from '@/api/promotion-contracts';
import type { Messages } from '@/i18n/messages/en';
import { fmt } from '@/i18n/format';
import { sessionVault } from '@/api/runtime';
import { getProduct } from '@/mock/products';
import { getProductMedia } from '@/lib/product-media';
import { isLiteProduct } from '@/lib/lite-scope';
import { productCatalogState } from '@/store/product-catalog';
import { displayDeadline, localized, rewardAmount, rewardSummary } from './promotion-display';

/** Purchase offers with a dedicated landing page; other templates keep the store entry. */
export type LandingKind = 'gift' | 'first' | 'repurchase';
export function landingKind(activity: Pick<PublicPromotion, 'template'>): LandingKind | null {
  return activity.template === 'SKU_GIFT' ? 'gift' : activity.template === 'FIRST_PURCHASE' ? 'first' : activity.template === 'REPURCHASE' ? 'repurchase' : null;
}
export function promotionLandingHref(activityId: string): string {
  return '/pages/events/promotion-detail?id=' + encodeURIComponent(activityId);
}

// The store catalog is read for a signed-in session only. Anonymous visitors get the
// bundled artwork for a known SKU and no catalog name or price.
function catalogReady(): boolean {
  void productCatalogState.revision;
  return (productCatalogState.status === 'ready' || (productCatalogState.status === 'loading' && productCatalogState.serverCanonical)) && !!sessionVault.read();
}
export function landingProduct(sku: string) {
  return catalogReady() ? getProduct(sku) : undefined;
}
/** Lite never offers a phone for a new purchase; identity is the catalog product or, without a session, the SKU. */
export function landingProductNos(activity: Pick<PublicPromotion, 'productNos'>): string[] {
  return activity.productNos.filter(sku => isLiteProduct(landingProduct(sku) ?? { id: sku }));
}
/** Lite presentation of a campaign: phone products and rules that sell or give a phone are dropped (explicit identity). A campaign
 *  whose products or rules were all phones returns null and is not shown on the web. */
export function litePromotion<T extends Pick<PublicPromotion, 'productNos' | 'rewardRules' | 'bannerImageUrl'>>(activity: T): T | null {
  const lite = (sku: string) => isLiteProduct(landingProduct(sku) ?? { id: sku });
  // A rule that gives a phone as its gift is a phone rule too.
  const rewardRules = activity.rewardRules.filter(rule => lite(rule.productNo)
    && [rule.buyerReward, rule.inviterReward].every(reward => reward?.type !== 'DEVICE' || lite(reward.giftProductNo)));
  // A product whose rules were all dropped leaves the campaign (it stays an ordinary catalog item).
  const productNos = landingProductNos(activity).filter(sku => rewardRules.some(rule => rule.productNo === sku)
    || !activity.rewardRules.some(rule => rule.productNo === sku));
  if ((activity.productNos.length && !productNos.length) || (activity.rewardRules.length && !rewardRules.length)) return null;
  // The operator banner may picture the dropped phone offer, so a trimmed campaign uses the product and reward cards.
  return productNos.length === activity.productNos.length && rewardRules.length === activity.rewardRules.length
    ? activity : { ...activity, productNos, rewardRules, bannerImageUrl: null };
}
export function landingProductImage(sku: string): string | undefined {
  return catalogReady() ? getProduct(sku)?.imageUrl : getProductMedia(sku)?.src;
}
export function landingProductName(activity: PublicPromotion, sku: string): string {
  const gift = activity.rewardRules.flatMap(rule => [rule.buyerReward, rule.inviterReward])
    .find(reward => reward?.type === 'DEVICE' && reward.giftProductNo === sku);
  return landingProduct(sku)?.name ?? gift?.disclosure.deviceName ?? sku;
}

// An order discount lowers the order total at checkout; it is never credited as a USDT reward.
export type RewardParts = { amount: string; unit: string; asset: 'UVT' | 'USDT' | 'DEVICE' | 'DISCOUNT' };
export function rewardParts(activity: PublicPromotion, reward: PublicRewardSpec): RewardParts {
  if (reward.type === 'DEVICE') return { amount: String(reward.quantity), unit: reward.disclosure.deviceName ?? landingProductName(activity, reward.giftProductNo), asset: 'DEVICE' };
  // Whole amounts drop the ".00"; any other fraction stays as published.
  const amount = rewardAmount(reward).replace(/\.00$/, '');
  return reward.type === 'UVT' ? { amount, unit: 'UVT', asset: 'UVT' } : { amount, unit: 'USDT', asset: reward.type === 'DISCOUNT_USDT' ? 'DISCOUNT' : 'USDT' };
}
export function rewardPartsText(parts: RewardParts, copy: Pick<Messages['promotion'], 'orderDiscount'>): string {
  if (parts.asset === 'DEVICE') return `${parts.unit} × ${parts.amount}`;
  return parts.asset === 'DISCOUNT' ? `${copy.orderDiscount} · ${parts.amount} ${parts.unit}` : `${parts.amount} ${parts.unit}`;
}

/** Remaining days use the published clock of the same read, never the device date. */
export function promotionRemaining(activity: Pick<PublicPromotion, 'endsAt' | 'serverTime'>, copy: Messages['promotion']): string {
  const remaining = Date.parse(activity.endsAt) - Date.parse(activity.serverTime);
  if (!Number.isFinite(remaining) || remaining <= 0) return copy.ended;
  return remaining < 86400000 ? copy.endsToday : fmt(copy.daysRemaining, { n: Math.ceil(remaining / 86400000) });
}

/** Rule summaries and terms for the shared PromotionTerms sheet. */
export function promotionTermsRules(activity: PublicPromotion, copy: Messages['promotion'], productName: (sku: string) => string) {
  return activity.rewardRules.map(rule => {
    const rewards = [rule.buyerReward, rule.inviterReward].filter((reward): reward is NonNullable<typeof reward> => !!reward);
    return { id: rule.ruleId, text: productName(rule.productNo) + ' · ' + copy.rulePer + ' ' + rule.minBuyQty + ' · ' + (rule.repeatMode === 'PER_GROUP' ? copy.perGroup : copy.oncePerOrder) + '\n' + rewards.map(reward => (reward.beneficiaryRole === 'BUYER' ? copy.buyer : copy.inviter) + ' · ' + rewardSummary(reward, copy, reward.disclosure.deviceName)).join(' / ') + '\n' + [rule.maxGroups.mode === 'LIMITED' ? fmt(copy.orderRewardLimit, { n: rule.maxGroups.value }) : '', rule.maxGroupsPerPerson.mode === 'LIMITED' ? fmt(copy.personRewardLimit, { n: rule.maxGroupsPerPerson.value }) : ''].filter(Boolean).join(' · ') };
  });
}
export function promotionTermsText(activity: PublicPromotion, copy: Messages['promotion'], language: string): string {
  return [localized(activity.terms, language), copy.deadline + ' · ' + displayDeadline(activity.endsAt, language)].join('\n\n');
}
