import type { PublicPromotion, PublicRewardSpec } from '@/api/promotion-contracts';
import { parseServerTimestamp } from '@/api/server-time';
import type { Messages } from '@/i18n/messages/en';
import { fmt } from '@/i18n/format';
import { landingCopy } from '@/i18n/promotion-landing';
import { ambassadorCount } from '@/i18n/ambassador';
import { sessionVault } from '@/api/runtime';
import { getProduct } from '@/mock/products';
import { productCatalogState } from '@/store/product-catalog';
import { displayDeadline, localized, rewardAmount } from './promotion-display';

/** Purchase offers with a dedicated landing page; other templates keep the store entry. */
export type LandingKind = 'gift' | 'first' | 'repurchase';
export function landingKind(activity: Pick<PublicPromotion, 'template'>): LandingKind | null {
  return activity.template === 'SKU_GIFT' ? 'gift' : activity.template === 'FIRST_PURCHASE' ? 'first' : activity.template === 'REPURCHASE' ? 'repurchase' : null;
}
export function promotionLandingHref(activityId: string): string {
  return '/pages/events/promotion-detail?id=' + encodeURIComponent(activityId);
}
/** Every running template has its own activity page; referral and bundle join the purchase offers. */
export type ActivityPageKind = LandingKind | 'referral' | 'bundle';
export function activityPageKind(activity: Pick<PublicPromotion, 'template'>): ActivityPageKind | null {
  return landingKind(activity) ?? (activity.template === 'DIRECT_REFERRAL' ? 'referral' : activity.template === 'MULTI_PRODUCT' ? 'bundle' : null);
}

// The store catalog supplies current names and prices for a signed-in session.
function catalogReady(): boolean {
  void productCatalogState.revision;
  return (productCatalogState.status === 'ready' || (productCatalogState.status === 'loading' && productCatalogState.serverCanonical)) && !!sessionVault.read();
}
export function landingProduct(sku: string) {
  return catalogReady() ? getProduct(sku) : undefined;
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
  return parts.asset === 'DISCOUNT' ? `${copy.orderDiscount} · ${parts.amount}\u00a0${parts.unit}` : `${parts.amount}\u00a0${parts.unit}`;
}

/** Remaining days use the published clock of the same read, never the device date. */
export function promotionRemaining(activity: Pick<PublicPromotion, 'endsAt' | 'serverTime'>, copy: Messages['promotion']): string {
  const remaining = Date.parse(activity.endsAt) - Date.parse(activity.serverTime);
  if (!Number.isFinite(remaining) || remaining <= 0) return copy.ended;
  return remaining < 86400000 ? copy.endsToday : fmt(copy.daysRemaining, { n: Math.ceil(remaining / 86400000) });
}

function submillisecondNanoseconds(timestamp: string): number {
  const fraction = /\.(\d{4,9})/.exec(timestamp)?.[1] ?? '';
  return Number(fraction.slice(3).padEnd(6, '0'));
}

export function promotionRepurchaseInterval(activity: PublicPromotion | null) {
  if (activity?.template !== 'REPURCHASE' || !activity.repurchaseWindow || !activity.lastValidPurchaseAt) return null;
  const { minDays, maxDays } = activity.repurchaseWindow;
  if (minDays === null && maxDays === null) return null;
  const serverMs = parseServerTimestamp(activity.serverTime);
  const purchaseMs = parseServerTimestamp(activity.lastValidPurchaseAt);
  if (serverMs === null || purchaseMs === null) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const elapsedMs = serverMs - purchaseMs;
  let daysSincePurchase = Math.floor(elapsedMs / dayMs);
  // Java Instants can carry finer precision than Date at an exact day boundary.
  if (elapsedMs % dayMs === 0 && submillisecondNanoseconds(activity.serverTime) < submillisecondNanoseconds(activity.lastValidPurchaseAt)) {
    daysSincePurchase -= 1;
  }
  if (daysSincePurchase < 0) return null;

  return {
    daysSincePurchase,
    minDays,
    maxDays,
    withinWindow: (minDays === null || daysSincePurchase >= minDays) && (maxDays === null || daysSincePurchase <= maxDays),
  };
}

/** Rule summaries and terms for the shared PromotionTerms sheet. */
export function promotionTermsRules(activity: PublicPromotion, copy: Messages['promotion'], productName: (sku: string) => string, language: string) {
  const landing = landingCopy(language);
  const rules = activity.rewardRules.map(rule => {
    const rewards = [rule.buyerReward, rule.inviterReward].filter((reward): reward is NonNullable<typeof reward> => !!reward);
    return { id: rule.ruleId, text: productName(rule.productNo) + ' · ' + copy.rulePer + ' ' + rule.minBuyQty + ' · ' + (rule.repeatMode === 'PER_GROUP' ? copy.perGroup : copy.oncePerOrder) + '\n' + rewards.map(reward => (reward.beneficiaryRole === 'BUYER' ? copy.buyer : copy.inviter) + ' · ' + rewardPartsText(rewardParts(activity, reward), copy)).join(' / ') + '\n' + [rule.maxGroups.mode === 'LIMITED' ? ambassadorCount(landing.rewardLimitOrder, rule.maxGroups.value) : '', rule.maxGroupsPerPerson.mode === 'LIMITED' ? ambassadorCount(landing.rewardLimitPerson, rule.maxGroupsPerPerson.value) : ''].filter(Boolean).join(' · ') };
  });
  // A referral offer states how the friend's first purchase is counted, after the rules that pay for it.
  const condition = activity.firstPurchaseCondition;
  if (!condition) return rules;
  return [...rules, { id: 'first-purchase', text: [condition.mode === 'FIRST_ELIGIBLE_UNIT' ? landing.firstPurchaseByUnit : landing.firstPurchaseByOrder, condition.restoreAfterRefund ? landing.firstPurchaseRefund : ''].filter(Boolean).join('\n') }];
}
export function promotionTermsText(activity: PublicPromotion, copy: Messages['promotion'], language: string): string {
  return [localized(activity.terms, language), copy.deadline + ' · ' + displayDeadline(activity.endsAt, language)].join('\n\n');
}
