<template>
  <AppChassis active="home">
    <view class="home-overview">
      <view class="home-earnings-cluster" data-home-section="earnings">
        <GreetingHeader />
        <TechMoneyCard />
      </view>
      <DailyCheckInRow />
      <!-- #ifdef H5 -->
      <view v-if="auth.isAuthenticated" class="phone-policy-notice" role="status" data-testid="home-app-download-banner">
        <view class="phone-policy-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="2" width="13" height="20" rx="3" /><path d="M12 7v7m-3-3 3 3 3-3M10.5 18.5h3" /></svg></view>
        <text class="phone-policy-copy">{{ t.phonePolicy.webNotice }}</text>
        <view class="phone-policy-action" role="button" tabindex="0" @click="goAppDownload" @keydown.enter.prevent="goAppDownload" @keydown.space.prevent="goAppDownload"><text class="phone-policy-pill nx-frosted-button">{{ t.phonePolicy.download }}</text></view>
      </view>
      <!-- #endif -->
      <HomeBenefits />
      <HomeActionList ref="homeActions" />
      <MyFleetSection />
      <PromotionEntry v-if="homePromotions.length" mode="home" :activities="homePromotions" />
      <view v-else-if="!homePromotionRead && (homePromotionStatus === 'idle' || homePromotionStatus === 'loading')" class="home-promotion-skeleton" role="status" aria-busy="true" :aria-label="t.coreReview.loadingOffers"><view /><view /></view>
      <LiveFeedCard />
      <OnGridSection ref="homeGrid" />
      <HomeNetworkSnapshot />
      <DoTheMathCard />
      <MarketBoardCard />
      <TrustChipWall ref="homeTrust" />
    </view>
  </AppChassis>
</template>
<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { onShow, onHide, onLoad } from '@/composables/use-tab-page-lifecycle';
import AppChassis from '@/components/tab-page-frame.vue';
import GreetingHeader from '@/components/home/greeting-header.vue';
import TechMoneyCard from '@/components/home/tech-money-card.vue';
import DailyCheckInRow from '@/components/home/daily-check-in-row.vue';
import HomeActionList from '@/components/home/action-list.vue';
import MyFleetSection from '@/components/home/my-fleet-section.vue';
import PromotionEntry from '@/components/promotion/promotion-entry.vue';
import HomeBenefits from '@/components/home/home-benefits.vue';
import HomeNetworkSnapshot from '@/components/home/network-snapshot.vue';
import LiveFeedCard from '@/components/home/live-feed-card.vue';
import OnGridSection from '@/components/home/on-grid-section.vue';
import DoTheMathCard from '@/components/home/do-the-math-card.vue';
import MarketBoardCard from '@/components/home/market-board-card.vue';
import TrustChipWall from '@/components/home/trust-chip-wall.vue';
import { useT } from '@/i18n/use-t';
import { useLocaleStore } from '@/store/locale';
import { useConfig } from '@/store/config';
import { useApp } from '@/store/app';
import { useFreeTrial } from '@/store/free-trial';
import { remoteApiEnabled, sessionVault } from '@/api/runtime';
import type { PublicPromotion } from '@/api/promotion-contracts';
import { createPromotionReadFence, isPromotionActive } from '@/lib/promotion-entry';
import { readHomePromotions } from '@/store/home-promotions';
import { registerActivePageRefresh } from '@/lib/active-page-refresh';
import { useNexFaucet } from '@/store/nex-faucet';
import { useProfile } from '@/store/profile';
import { useVoucher } from '@/store/voucher';
import { revalidateProductCatalog, settleProductCatalogRefresh } from '@/store/product-catalog';
import { useTabFirstLoad } from '@/lib/tab-first-load';
import { navTo } from '@/lib/route';
// #ifdef H5
import { useAuth } from '@/store/auth';
// #endif
const t = useT(), locale = useLocaleStore(), config = useConfig(), app = useApp();
// #ifdef H5
const auth = useAuth();
function goAppDownload() { navTo('/pages/register/success?download=1'); }
// #endif
const homePromotions = ref<PublicPromotion[]>([]);
const homePromotionStatus = ref<'idle'|'loading'|'ready'|'error'>('idle');
const homePromotionRead=ref(false);
const fence = createPromotionReadFence();
const visible = ref(true);
let pendingTicket:number|null=null;
let releaseActiveRefresh = () => {};
const homeActions = ref<{ refresh: () => Promise<unknown> } | null>(null);
const homeGrid = ref<{ refresh: () => Promise<unknown> } | null>(null);
const homeTrust = ref<{ refresh: () => Promise<unknown> } | null>(null);
useTabFirstLoad(visible, async current => {
  await Promise.allSettled([
    app.ensureHomeTruth(), useFreeTrial().refreshVisible(),
    useNexFaucet().ensureRemote(10_000), useProfile().ensureAvatar(),
    useVoucher().revalidateRemote(), config.revalidate(), homeActions.value?.refresh(),
    (async () => {
      const ready = await settleProductCatalogRefresh(revalidateProductCatalog());
      if (ready && current()) await app.ensureRemoteFleet();
    })(),
  ]);
});
async function refreshVisibleHome() {
  if (!visible.value) return;
  fence.invalidate(); pendingTicket = null;
  await Promise.allSettled([
    refresh(), app.ensureHomeTruth(), app.ensureRemoteFleet(),
    useFreeTrial().refreshVisible(),
    useNexFaucet().ensureRemote(), useProfile().ensureAvatar(),
    homeActions.value?.refresh(), homeGrid.value?.refresh(), homeTrust.value?.refresh(),
  ]);
}
async function refresh(passive=false) {
  if (!visible.value) return;
  if(pendingTicket!==null&&fence.current(pendingTicket))return;
  const ticket = fence.next(), scope = `${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`;
  pendingTicket=ticket;
  homePromotionStatus.value = 'loading';
  void config.revalidate();
  if (!remoteApiEnabled) { homePromotions.value = []; homePromotionStatus.value = 'ready'; return; }
  try {
    const response = await readHomePromotions(scope, !!sessionVault.read(), !passive);
    if (!fence.current(ticket) || scope !== `${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`) return;
    homePromotions.value = response.items.filter(activity => isPromotionActive(activity) && activity.placement === 'home.purchase-promotion');
    homePromotionStatus.value = 'ready';
    homePromotionRead.value=true;
  } catch (cause) {
    if (fence.current(ticket) && scope === `${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`) {
      if(cause instanceof Error&&'status' in cause&&(cause.status===401||cause.status===403))homePromotions.value=[];
      homePromotionStatus.value = 'error';
    }
  } finally {if(pendingTicket===ticket)pendingTicket=null;}
}
onShow(() => { visible.value = true; releaseActiveRefresh(); releaseActiveRefresh = registerActivePageRefresh(refreshVisibleHome); app.setTaskReadPageVisible("home", true); void refresh(true); void useFreeTrial().refreshVisible(); });
onHide(() => { releaseActiveRefresh(); visible.value = false; app.setTaskReadPageVisible("home", false); });
onUnmounted(() => { releaseActiveRefresh(); visible.value = false; app.setTaskReadPageVisible("home", false); fence.invalidate(); });
onLoad(() => locale.ensureSystemDetected());
watch(() => [app.accountKey, app.accountBindingEpoch, locale.code], () => { fence.invalidate(); homePromotions.value = []; homePromotionRead.value=false;void refresh(true); },{flush:'sync'});
</script>
<style scoped>
.home-overview { display: flex; flex-direction: column; gap: 20px; padding: 12px 16px 16px; color: var(--v5-ink); }
.home-earnings-cluster { display: flex; flex-direction: column; }
/* The glass check-in sits 28px under the earnings line, over the hero's floor glow. */
.home-overview > .daily-check-in-row { margin-top:8px; }
.home-promotion-skeleton { min-height:180px;box-sizing:border-box;padding:20px;border-radius:22px;background:var(--v5-surface);border:1px solid var(--v5-border); }
.home-promotion-skeleton > view { width:70%;height:18px;margin-bottom:14px;border-radius:8px;background:var(--v5-surface-2); }
.home-promotion-skeleton > view + view { width:45%;height:44px;margin-top:36px; }
/* Download reminder: one compact strip in the plain content-card material — sky icon block, one message, brand glass S.
   Long languages drop the button to its own right-aligned line instead of squeezing the message. */
.phone-policy-notice { display: flex; flex-wrap: wrap; align-items: center; gap: 0 10px; box-sizing: border-box; min-height: 56px; padding: 5px 6px 5px 12px; border-radius: 18px; background: var(--v5-surface); border: 1px solid var(--v5-border); box-shadow: var(--v5-glass-shadow); }
.phone-policy-icon { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, var(--v5-aura-sky) 14%, transparent); color: var(--v5-aura-sky); }
.phone-policy-copy { flex: 1 1 10em; min-width: 0; font: 400 13px/18px var(--font-v5); color: var(--v5-ink); text-wrap: balance; word-break: keep-all; overflow-wrap: anywhere; }
.phone-policy-action { flex: none; display: flex; margin-left: auto; align-items: center; min-height: 44px; border-radius: var(--v5-radius-full); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.phone-policy-action:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.phone-policy-pill { --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); --ui-button-solid: color-mix(in srgb, var(--v5-brand) 12%, var(--v5-surface)); display: inline-flex; align-items: center; min-height: 32px; box-sizing: border-box; padding: 7px 12px; border-radius: var(--v5-radius-full); font: 500 13px/18px var(--font-v5); white-space: nowrap; transition: transform 200ms ease; }
.phone-policy-action:active .phone-policy-pill { transform: scale(.97); transition-duration: 100ms; }
@media (prefers-reduced-motion: reduce) { .phone-policy-action:active .phone-policy-pill { transform: none; } }
</style>
