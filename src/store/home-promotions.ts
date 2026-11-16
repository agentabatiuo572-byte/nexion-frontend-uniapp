import { captureTabSnapshotWrite, saveTabSnapshot, invalidateTabSnapshots, type PromotionEntrySnapshot } from "@/lib/tab-first-screen-snapshot";
import { isTransientReadFailure } from "@/lib/remote-read-failure";
import { localized, rewardSummary } from "@/lib/promotion-display";
import { promotionMachineSlots } from "@/components/catalog-machine-image";
import { landingKind, litePromotion, promotionLandingHref } from "@/lib/promotion-landing";
import { promotionStoreHref } from "@/lib/promotion-entry";
import { useLocaleStore } from "@/store/locale";
import { getT } from "@/i18n/use-t";
import { runPassiveTabRead, invalidateBeforePassiveTabRead, passiveTabReadScope } from "@/lib/passive-tab-read";
import { apiRuntimeConfig, promotionApi } from '@/api/runtime';
import { ApiError } from '@/api/errors';
import type { PublicPromotionPage } from '@/api/promotion-contracts';

// One first-page placement, shared by Home and the Store advert. No command uses it.
let current: { key: string; page: PublicPromotionPage | null; at: number; retryAt: number;
  error: unknown; pending: Promise<PublicPromotionPage> | null } | null = null;
/** Current display result only; never promotion eligibility or claim authority. */
export function getHomePromotions(scope: string, authenticated: boolean): PublicPromotionPage | null {
  const key = JSON.stringify([apiRuntimeConfig.baseUrl, apiRuntimeConfig.environment, scope, authenticated, passiveTabReadScope(false)]);
  return current?.key === key ? current.page : null;
}
export function readHomePromotions(scope: string, authenticated: boolean, force = false): Promise<PublicPromotionPage> {
  const key = JSON.stringify([apiRuntimeConfig.baseUrl, apiRuntimeConfig.environment, scope, authenticated, passiveTabReadScope(false)]);
  if (current?.key === key && Date.now() < current.retryAt) return Promise.reject(current.error);
  if (!force) return runPassiveTabRead("home-promotions", () => readHomePromotions(scope, authenticated, true), [scope, authenticated]);
  invalidateBeforePassiveTabRead("home-promotions");
  if (current?.key !== key) current = { key, page: null, at: 0, retryAt: 0, error: null, pending: null };
  const state = current;
  const snapshotWrite = captureTabSnapshotWrite();
  const language = useLocaleStore().code, copy = getT().promotion;
  if (state.pending) return state.pending;
  if (Date.now() < state.retryAt) return Promise.reject(state.error);
  const request = promotionApi.list({ limit: 20, placement: 'home.purchase-promotion' }, authenticated)
    .then(page => {
      if (current !== state) return page;
      state.page = page; state.at = Date.now(); state.retryAt = 0;
      saveTabSnapshot(snapshotWrite, "promotions", page.items.filter(item => item.state === "ACTIVE").flatMap(item => litePromotion(item) ?? []).map((item): PromotionEntrySnapshot => {
        const rewards = item.rewardRules.flatMap(rule => [rule.buyerReward, ...(rule.inviterReward ? [rule.inviterReward] : [])]);
        const reward = item.rewardRules[0]?.buyerReward;
        return { displayOnly: true, activityId: item.activityId, version: item.version, template: item.template, title: item.title,
          startsAt: item.startsAt, endsAt: item.endsAt, serverTime: item.serverTime, bannerImageUrl: item.bannerImageUrl ?? null,
          kind: rewards.some(row => row.type === "DEVICE") ? "gift" : rewards.some(row => row.type === "DISCOUNT_USDT") ? "coupon" : rewards.length ? "spark" : "plain",
          benefit: reward ? localized(reward.disclosure.benefitDescription, language) || rewardSummary(reward, copy, reward.disclosure.deviceName || (reward.type === "DEVICE" ? reward.giftProductNo : null)) : "",
          href: landingKind(item) ? promotionLandingHref(item.activityId) : promotionStoreHref(item.activityId), slots: promotionMachineSlots(item) };
      }), page.items[0]?.serverTime ?? null);
      return page;
    })
    .catch(cause => {
      if (current !== state) throw cause;
      state.error = cause;
      if (cause instanceof ApiError && cause.status === 429) state.retryAt = Date.now() + (cause.retryAfterMs ?? 30_000);
      if (!isTransientReadFailure(cause)) { state.page = null; invalidateTabSnapshots(["promotions"], snapshotWrite); }
      throw cause;
    }).finally(() => { if (state.pending === request) state.pending = null; });
  state.pending = request;
  return request;
}
