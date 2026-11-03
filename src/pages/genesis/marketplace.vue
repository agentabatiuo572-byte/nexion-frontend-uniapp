<!--
  Genesis Marketplace — internal secondary market for Genesis Node seats.
  (ported from Nexion-prototype/app/(main)/genesis/marketplace/page.tsx).

  Collection hero (4-stat grid + 7d floor delta) →
  segmented tabs (listings / activity / mine) → sort pills + listing grid /
  activity feed / owned-token grid. Wrapped in <AppChassis active="me">. Buy
  is settled atomically by the canonical Genesis backend transaction.
  Activity and listings are server-canonical in remote mode.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/genesis/genesis" />

      <view class="px-4 marketplace-page" style="display: flex; flex-direction: column; gap: var(--ui-space-inline)">
        <!-- Collection hero — de-carded: sits on the page floor. -->
        <view class="marketplace-hero" :style="heroStyle">
          <view class="flex items-start" style="gap: var(--ui-space-inline)">
            <view class="grid place-items-center shrink-0" :style="avatarStyle">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 7 5 5 5-8 5 8 5-5-2 12H4z" /><path d="M4 21h16" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block truncate" :style="collTitleStyle">UVEL Genesis Node</text>
              <text class="block" :style="marketScopeLineStyle">{{ t.marketplace.internalMarketLine }}</text>
            </view>
          </view>

          <!-- 4-stat grid -->
          <view class="grid grid-cols-4" :style="statGridStyle">
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.floor }}</text>
              <text class="tabular-nums" :style="statValStyle('var(--v5-success)')">{{ stats.floor === null ? "—" : `$${formatGenesisPrice(stats.floor)}` }}</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.vol24h }}</text>
              <text class="tabular-nums" :style="statValStyle()">{{ stats.vol24h === null ? "—" : `$${formatGenesisPrice(stats.vol24h)}` }}</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.listed }}</text>
              <text class="tabular-nums" :style="statValStyle()">{{ stats.listed === null ? "—" : stats.listed }}</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.owners }}</text>
              <text class="tabular-nums" :style="statValStyle()">{{ stats.owners === null ? "—" : stats.owners }}</text>
            </view>
          </view>

          <!-- The canonical comparison may be unavailable; never invent a direction. -->
          <view v-if="secondaryBlock === null" class="flex items-center" :style="floorDeltaStyle">
            <text class="flex items-center" style="gap: 6px; font-family: var(--font-v5); font-size: 12px; color: var(--v5-ink-3)">
              <svg v-if="floorDelta.state === 'up'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
              <svg v-else-if="floorDelta.state === 'down'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 17h6v-6" /><path d="m22 17-8.5-8.5-5 5L2 7" /></svg>
              <svg v-else-if="floorDelta.state === 'flat'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round"><path d="M4 12h16" /></svg>
              <svg v-else-if="floorDelta.state === 'unavailable'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round"><path d="M7 12h10" /></svg>
              <text>{{ floorDeltaLabel }} </text>
              <text class="tabular-nums" :style="floorDeltaValueStyle">{{ floorDelta.value }}</text>
              <text> {{ t.marketplace.past7d }}</text>
            </text>
          </view>
<view v-if="secondaryBlock !== null" class="marketplace-closed" role="status"><view class="marketplace-lock" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></view><view><text class="marketplace-closed-title">{{ secondaryBlockText }}</text><text class="marketplace-closed-sub">{{ secondaryBlockSub }}</text></view></view>
        </view>

        <!-- 市场关闭说明(FEAT-GEN10 ⑥:二级市场一并锁闭**并说明**)。
             只说状态与影响,不做倒计时、不催 —— 关闭态禁紧迫感元素。 -->


        <view class="marketplace-info"><view class="marketplace-info-row"><text class="marketplace-fee-label">{{ t.marketplace.royaltyLabel }}</text><text class="marketplace-fee" :aria-label="marketplaceRoyaltyText">{{ presentGenesisRoyalty(genesis.remoteRoyaltyPct) ?? '—' }}</text><view v-if="marketReadNeedsRetry" class="nx-market-retry" role="button" :tabindex="marketplaceRead.busy ? -1 : 0" :aria-label="t.marketplace.retry" :aria-busy="marketplaceRead.busy" :aria-disabled="marketplaceRead.busy" @click="retryMarketplaceFacts()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg></view></view><view class="marketplace-info-row marketplace-info-learn" role="button" tabindex="0" @click="goGenesis"><text class="flex-1">{{ consumerCopy.learn }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></view></view>
        <!-- Tabs -->
        <GlassSegments v-model="tab" :options="marketTabOptions" :label="t.marketplace.pageTitle" class="marketplace-tabs" />

        <!-- LISTINGS TAB -->
        <template v-if="tab === 'listings'">
          <!-- A closed market and a failed read are independent. Keep read feedback
               compact when closed, and never present an unread list as empty. -->
          <EmptyState v-if="!publicDisplayReady && genesis.remotePublicReadState !== 'unavailable'" kind="empty-list" :compact="secondaryBlock !== null"
            :title="t.marketplace.marketLoading" :desc="t.marketplace.marketLoadingHint" />
          <EmptyState v-else-if="genesis.remotePublicReadState === 'unavailable'" kind="empty-list" :compact="secondaryBlock !== null"
            :title="t.marketplace.marketUnavailable" :desc="t.marketplace.marketUnavailableHint"
          />
          <template v-else-if="sortedListings.length > 0">
            <scroll-view scroll-x class="nx-sort-row">
              <view class="flex items-center" style="gap: 6px; white-space: nowrap" role="radiogroup" :aria-label="t.marketplace.sortLabel">
                <text class="inline-flex items-center" :style="sortLabelStyle">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                  <text>{{ t.marketplace.sortLabel }}</text>
                </text>
                <view class="nx-marketplace-sort active:opacity-70 transition-opacity" :style="sortPillStyle(sortKey === 'floor')" role="radio" :aria-checked="sortKey === 'floor'" :tabindex="sortKey === 'floor' ? 0 : -1" @click="selectSort('floor')"    @keydown.left.prevent="cycleSort(-1)" @keydown.right.prevent="cycleSort(1)"><text>{{ t.marketplace.sortPriceAsc }}</text></view>
                <view class="nx-marketplace-sort active:opacity-70 transition-opacity" :style="sortPillStyle(sortKey === 'recent')" role="radio" :aria-checked="sortKey === 'recent'" :tabindex="sortKey === 'recent' ? 0 : -1" @click="selectSort('recent')"    @keydown.left.prevent="cycleSort(-1)" @keydown.right.prevent="cycleSort(1)"><text>{{ t.marketplace.sortRecent }}</text></view>
                <view class="nx-marketplace-sort active:opacity-70 transition-opacity" :style="sortPillStyle(sortKey === 'lastSale')" role="radio" :aria-checked="sortKey === 'lastSale'" :tabindex="sortKey === 'lastSale' ? 0 : -1" @click="selectSort('lastSale')"    @keydown.left.prevent="cycleSort(-1)" @keydown.right.prevent="cycleSort(1)"><text>{{ t.marketplace.sortLastSale }}</text></view>
              </view>
            </scroll-view>

            <view class="grid grid-cols-2" style="gap: var(--ui-space-row-y)">
              <ListingCard v-for="l in sortedListings" :key="l.tokenId" :l="l" :disabled="secondaryBlock !== null || buyPending || !marketplaceCommandsReady" @buy="handleBuy(l)" />
            </view>
          </template>
          <!-- 一条挂单都没有 ——《06 缺省页规范》禁空容器/白屏。排序 pill 一并撤:
               对空列表排序点了没有可观测变化,属规范里的 dead control。
               关闭态不给「从一级预订」CTA:一级与二级同读 marketOpenState,那时跳过去是死路,
               而关闭原因顶部已有说明条讲清,这里不复述。 -->
          <view v-else class="marketplace-listings-empty"><view class="marketplace-empty-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m20.6 13.4-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg></view><text class="marketplace-empty-title">{{ t.empty.genesisListingsTitle }}</text><text class="marketplace-empty-desc">{{ primaryAvailable ? t.empty.genesisListingsDesc : consumerCopy.empty }}</text><NxButton v-if="secondaryBlock === null" variant="brand" size="medium" @click="goGenesis">{{ primaryEntryLabel }}</NxButton></view>
        </template>

        <!-- ACTIVITY TAB(真实成交 + 虚拟成交混排,FEAT-GEN10)-->
        <template v-else-if="tab === 'activity'">
          <!-- The shared footer retries reads without changing the market gate. -->
          <EmptyState v-if="!publicDisplayReady && genesis.remotePublicReadState !== 'unavailable'" kind="empty-list" :compact="secondaryBlock !== null"
            :title="t.marketplace.marketLoading" :desc="t.marketplace.marketLoadingHint" />
          <EmptyState v-else-if="genesis.remotePublicReadState === 'unavailable'" kind="empty-list" :compact="secondaryBlock !== null"
            :title="t.marketplace.marketUnavailable" :desc="t.marketplace.marketUnavailableHint"
          />
          <view v-else-if="mergedActivity.length > 0" :style="listCardStyle">
            <ActivityRow v-for="(e, i) in mergedActivity" :key="e.id" :e="e" :is-last="i === mergedActivity.length - 1" />
          </view>
          <!-- 同上:零事件时原样渲染 listCardStyle 会留一个零高度的空 surface 盒子。 -->
          <EmptyState v-else kind="empty-list" :title="t.empty.genesisActivityTitle" :desc="t.empty.genesisActivityDesc" />
          <view v-if="genesis.activityPage.cursor" class="active:opacity-70" role="button" tabindex="0" :aria-disabled="genesis.activityPage.busy ? 'true' : 'false'"
            :aria-busy="genesis.activityPage.busy ? 'true' : 'false'" style="padding:var(--ui-space-inline);text-align:center;color:var(--v5-brand)" @click="!genesis.activityPage.busy && genesis.loadMoreActivity()">
            <text :class="{ 'nx-market-read-retry-label': genesis.activityPage.error }">{{ genesis.activityPage.error ? t.orders.retry : t.orders.loadMore }}</text>
          </view>
        </template>

        <!-- MINE TAB -->
        <template v-else>
          <view v-if="!accountDisplayReady" class="text-center" :style="emptyCardStyle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 8px"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
            <text class="block" style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink)">{{ genesis.remoteAccountReadState === 'loading' ? t.marketplace.accountLoading : t.marketplace.accountUnavailable }}</text>
            <text v-if="genesis.remoteAccountReadState !== 'loading'" class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: var(--v5-space-1); line-height: 1.375">{{ t.marketplace.accountUnavailableHint }}</text>
          </view>
          <view v-else-if="ownedCount === 0" class="text-center" :style="emptyCardStyle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 8px"><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></svg>
            <text class="block" style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink)">{{ t.marketplace.noTokensTitle }}</text>
            <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: var(--v5-space-1); line-height: 1.375">{{ primaryAvailable ? t.marketplace.noTokensSub : consumerCopy.empty }}</text>
            <view class="inline-block active:scale-95" :style="reserveBtnStyle" role="button" tabindex="0" @click="goGenesis">
              <text>{{ primaryEntryLabel }}</text>
            </view>
          </view>
          <view v-else class="grid grid-cols-2" style="gap: var(--ui-space-row-y)">
            <MyTokenCard v-for="id in ownedTokenIds" :key="id" :token-id="id" :page-scope="listingPageScope" :read-ready="marketplaceCommandsReady" />
          </view>
        </template>

      </view>
    </view>

    <!-- 当前服务端资格 sheet；一级与二级使用同一策略。 -->
    <GenesisEligibilitySheet v-model:open="eligSheetOpen" @subscribe="onEligSubscribe" />
  </AppChassis>
</template>

<script setup lang="ts">
import { formatGenesisPrice } from "@/lib/genesis-marketplace-presentation";
import { navTo } from "@/lib/route";
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch, type CSSProperties } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import ListingCard, { type Listing } from "@/components/genesis/listing-card.vue";
import ActivityRow, { type ActivityEvent } from "@/components/genesis/activity-row.vue";
import MyTokenCard from "@/components/genesis/my-token-card.vue";
import GenesisEligibilitySheet from "@/components/genesis/eligibility-sheet.vue";
import NxButton from "@/components/ui/nx-button.vue";
import EmptyState from "@/components/empty-state.vue";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { useApp } from "@/store/app";
import { genesisConsumerCopyFor } from "./genesis-consumer-copy";
import { fmt } from "@/i18n/format";
import { useGenesis, GENESIS_ELIGIBILITY_POLICY } from "@/store/genesis";
import { useGenesisConfig } from "@/store/genesis-config";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";
import { toast } from "@/store/ui";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { ApiError } from "@/api/errors";
import { h3ObservationApi, remoteApiEnabled, sessionVault, apiRuntimeConfig } from "@/api/runtime";
import { subscribeRuntimeRevision } from "@/api/order-api";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { authenticatedPageObservationReporter } from "@/lib/authenticated-page-observation";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import { presentGenesisFloorDelta, presentGenesisMarketplaceActivityDescription, presentGenesisRoyalty } from "@/lib/genesis-marketplace-presentation";

const t = useT();
const locale = useLocaleStore();
const app = useApp();
const marketOwner = computed(() => JSON.stringify([app.accountKey, app.accountBindingEpoch, locale.code, apiRuntimeConfig?.environment]));
const publicReadOwner = ref('');
const accountReadOwner = ref('');
let marketEnvironmentInvalidated = false;
let marketOwnerGeneration = 0;
watch(marketOwner, () => {
  marketOwnerGeneration++;
  publicReadOwner.value = ''; accountReadOwner.value = '';
  void nextTick(() => { if (marketplacePageVisible) void retryMarketplaceFacts(true); });
}, { flush: 'sync' });
watch(() => apiRuntimeConfig?.environment, () => { marketEnvironmentInvalidated = true; }, { flush: 'sync' });
// Mark ownership only after a captured current request has actually settled successfully.
const publicDisplayReady = computed(() => publicReadOwner.value === marketOwner.value && genesis.remotePublicReadState !== 'unavailable');
const accountDisplayReady = computed(() => accountReadOwner.value === marketOwner.value && genesis.remoteAccountReadState !== 'unavailable');
const marketplaceCommandsReady = computed(() => !remoteApiEnabled || (!marketEnvironmentInvalidated && publicReadOwner.value === marketOwner.value && accountReadOwner.value === marketOwner.value && genesis.remotePublicReadState === 'ready' && genesis.remoteAccountReadState === 'ready'));
const consumerCopy = computed(() => genesisConsumerCopyFor(locale.code));
const genesis = useGenesis();
const cfg = useGenesisConfig();
let marketplacePageVisible = false;
let refreshInFlight: Promise<boolean> | null = null;
let refreshRequested = false;
let marketplaceObservationEpoch = 0;
const listingPageScope = reactive({ visible: false, epoch: 0 });
const marketplaceRead = reactive({ busy: false });
let releaseActiveRefresh = () => {};

async function refreshMarketplaceFacts(): Promise<void> {
  if (!remoteApiEnabled || !marketplacePageVisible) return;
  const scope = captureAccountScope();
  const pageEpoch = marketplaceObservationEpoch;
  const loaded = await retryMarketplaceFacts(true).catch(() => false);
  if (!loaded || genesis.remotePublicReadState !== "ready") return;

  await nextTick();
  if (!marketplacePageVisible || pageEpoch !== marketplaceObservationEpoch
    || genesis.remotePublicReadState !== "ready") return;

  void authenticatedPageObservationReporter.report({
    subject: "genesis-secondary-market",
    scope,
    session: sessionVault.read(),
    visible: () => marketplacePageVisible && pageEpoch === marketplaceObservationEpoch,
    isCurrent: isCurrentAccountScope,
    submit: () => h3ObservationApi.secondaryMarket(),
  });
}

async function retryMarketplaceFacts(recheck = false): Promise<boolean> {
  if (!marketplacePageVisible || marketEnvironmentInvalidated) return Promise.resolve(false);
  if (refreshInFlight) {
    if (recheck) refreshRequested = true;
    return refreshInFlight;
  }
  // Recovery only reads projections. Runtime revisions must re-read after an
  // in-flight result is fenced out, without replaying the weekly observation.
  marketplaceRead.busy = true;
  const operation = (async () => {
    try {
      let loaded = false;
      do {
        refreshRequested = false;
        await cfg.refresh();
        if (!marketplacePageVisible) return false;
        const owner = marketOwner.value;
        const ownerGeneration = marketOwnerGeneration;
        const binding = genesis.captureRemoteReadBinding();
        if (binding.accountKey !== String(app.accountKey).trim().toLowerCase()) return false;
        const publicRevision = genesis.remotePublicSuccessRevision;
        const accountRevision = genesis.remoteAccountSuccessRevision;
        loaded = await genesis.syncRemote();
        if (marketplacePageVisible && !marketEnvironmentInvalidated && owner === marketOwner.value && ownerGeneration === marketOwnerGeneration
          && genesis.captureRemoteReadBinding().epoch === binding.epoch) {
          if (genesis.remotePublicReadState === 'ready' && genesis.remotePublicSuccessRevision > publicRevision
            && genesis.remotePublicSuccessScope?.accountKey === binding.accountKey && genesis.remotePublicSuccessScope?.epoch === binding.epoch) publicReadOwner.value = owner;
          if (genesis.remoteAccountReadState === 'ready' && genesis.remoteAccountSuccessRevision > accountRevision
            && genesis.remoteAccountSuccessScope?.accountKey === binding.accountKey && genesis.remoteAccountSuccessScope?.epoch === binding.epoch) accountReadOwner.value = owner;
        }
      } while (refreshRequested && marketplacePageVisible);
      return loaded;
    } catch {
      return false;
    } finally {
      // Release with the final loop decision, before a queued revision can
      // mistake a completed operation for a read that will consume its flag.
      refreshInFlight = null;
      marketplaceRead.busy = false;
    }
  })();
  refreshInFlight = operation;
  return operation;
}

// 页面每次露出重读配置；直接 H5 hash-route 可能只触发 mount。
function showMarketplacePage() {
  if (marketplacePageVisible) return;
  marketplacePageVisible = true;
  listingPageScope.visible = true;
  releaseActiveRefresh();
  releaseActiveRefresh = registerActivePageRefresh(retryMarketplaceFacts);
  void refreshMarketplaceFacts();
}
onMounted(showMarketplacePage);
onShow(showMarketplacePage);
const stopMarketplaceRevision = subscribeRuntimeRevision(() => {
  if (remoteApiEnabled && marketplacePageVisible) void retryMarketplaceFacts(true).catch(() => {});
});
onHide(() => {
  marketplacePageVisible = false;
  refreshRequested = false;
  listingPageScope.visible = false;
  listingPageScope.epoch += 1;
  marketplaceObservationEpoch += 1;
  releaseActiveRefresh();
});
onUnmounted(() => {
  marketplacePageVisible = false;
  refreshRequested = false;
  listingPageScope.visible = false;
  listingPageScope.epoch += 1;
  marketplaceObservationEpoch += 1;
  releaseActiveRefresh();
  stopMarketplaceRevision();
});
const { gate, eligible, gatesSecondary } = useGenesisEligibility();
const { block, marketClosed, secondaryBlock, blockText } = useGenesisSaleGate();
const primaryAvailable = computed(() => block.value === null && secondaryBlock.value === null);
const primaryEntryLabel = computed(() => primaryAvailable.value ? t.value.marketplace.reservePrimary : consumerCopy.value.learn);
const marketReadNeedsRetry = computed(() => secondaryBlock.value === "configUnavailable"
  || genesis.remotePublicReadState === "unavailable"
  || genesis.remoteAccountReadState === "unavailable"
  || presentGenesisRoyalty(genesis.remoteRoyaltyPct) === null);
/** 阻断说明文案 —— 走 blockText 唯一出口(P1-3 收口:此前 4 处各写一份同款 switch)。
 *  二级的三种阻断(配置未知/关闭/熔断)与主判定共享同一批高优先档,blockText 恒能覆盖;
 *  兜底只防 TS 层面的 null(渲染点有 v-if 闸,可购买态整块不渲染)。
 *  上一版 `default:` 分支在可购买态也会算出「暂未开放」,靠外层 v-if 碰巧挡住 —— 已删。 */
const secondaryBlockText = computed(() => blockText.value ?? t.value.genesis.marketClosed.default);
const secondaryBlockSub = computed(() =>
  secondaryBlock.value === "configUnavailable"
    ? t.value.genesis.marketClosed.retryHint
    : t.value.genesis.marketClosed.holdingsSafe,
);

// 盘面展示统计（运营可配 admin G4，FEAT-GEN09；替换原硬编码 FLOOR/VOL_24H/... ）。
const stats = computed(() => {
  const remote = genesis.remoteMarketStats;
  return {
    floor: publicDisplayReady.value ? remote.floorUsdt : null,
    vol24h: publicDisplayReady.value ? remote.volume24hUsdt : null,
    listed: publicDisplayReady.value ? genesis.remoteListings.length : null,
    owners: publicDisplayReady.value ? remote.owners : null,
    floorDeltaPct: publicDisplayReady.value ? remote.floorDeltaPct : null,
  };
});
const floorDelta = computed(() => presentGenesisFloorDelta(stats.value.floorDeltaPct));
const floorDeltaLabel = computed(() => {
  if (floorDelta.value.state === "up") return t.value.marketplace.floorUp;
  if (floorDelta.value.state === "down") return t.value.marketplace.floorDown;
  if (floorDelta.value.state === "flat") return t.value.marketplace.floorFlat;
  return t.value.marketplace.floorUnavailable;
});
const marketplaceRoyaltyText = computed(() => {
  const royalty = presentGenesisRoyalty(genesis.remoteRoyaltyPct);
  return royalty === null
    ? t.value.marketplace.royaltyUnavailable
    : fmt(t.value.marketplace.royaltyFooter, { royalty });
});

const eligSheetOpen = ref(false);

const tab = ref<"listings" | "activity" | "mine">("listings");
const sortKey = ref<"floor" | "recent" | "lastSale">("floor");
type MarketplaceTab = "listings" | "activity" | "mine";
type MarketplaceSort = "floor" | "recent" | "lastSale";
const TAB_ORDER: MarketplaceTab[] = ["listings", "activity", "mine"];
const SORT_ORDER: MarketplaceSort[] = ["floor", "recent", "lastSale"];
function selectTab(next: MarketplaceTab) { tab.value = next; }
function selectSort(next: MarketplaceSort) { sortKey.value = next; }
function cycleTab(delta: number) {
  const index = TAB_ORDER.indexOf(tab.value);
  tab.value = TAB_ORDER[(index + delta + TAB_ORDER.length) % TAB_ORDER.length];
  void nextTick(() => {
    if (typeof document !== "undefined") document.querySelector<HTMLElement>('.nx-marketplace-tab[tabindex="0"]')?.focus();
  });
}
function cycleSort(delta: number) {
  const index = SORT_ORDER.indexOf(sortKey.value);
  sortKey.value = SORT_ORDER[(index + delta + SORT_ORDER.length) % SORT_ORDER.length];
  void nextTick(() => {
    if (typeof document !== "undefined") document.querySelector<HTMLElement>('.nx-marketplace-sort[tabindex="0"]')?.focus();
  });
}
const ownedCount = computed(() => genesis.myOwned);
const ownedTokenIds = computed(() => genesis.ownedTokenIds);

const listingsTabText = computed(() => fmt(t.value.marketplace.listingsTab, { n: stats.value.listed ?? "—" }));
const mineTabText = computed(() => fmt(t.value.marketplace.mineTab, {
  n: accountDisplayReady.value ? ownedCount.value : "—",
}));

// 承接成交后本地移除(mock 演示态,刷新重置;真后台由 server 单源回写挂单状态)。
const soldTokenIds = ref<Set<number>>(new Set());

// Real server listing pool. No local seed or operations registry participates.
const mergedListings = computed<Listing[]>(() => {
  return genesis.remoteListings.map((row) => ({
    ...row,
    lastSaleUSDT: genesis.remoteMarketStats.lastSaleUsdt,
    traits: { tier: `Founder #${row.tokenId}`, boost: "—", mintYear: 2026 },
  }));
});

const sortedListings = computed(() => {
  const arr = [...mergedListings.value];
  if (sortKey.value === "floor") arr.sort((a, b) => a.priceUSDT - b.priceUSDT);
  if (sortKey.value === "recent") arr.sort((a, b) => b.listedAt - a.listedAt);
  if (sortKey.value === "lastSale") arr.sort((a, b) => (b.lastSaleUSDT ?? -1) - (a.lastSaleUSDT ?? -1));
  return arr;
});

const mergedActivity = computed<ActivityEvent[]>(() => {
  const listings: ActivityEvent[] = genesis.remoteListings.map((listing) => ({
    id: `listing:${listing.holdingNo}`,
    kind: "list",
    tokenId: listing.tokenId,
    priceUSDT: listing.priceUSDT,
    from: listing.seller,
    to: "—",
    ts: listing.listedAt,
  }));
  const transactions: ActivityEvent[] = genesis.remoteTransactions.map((tx) => ({
    id: `transaction:${tx.orderNo}`,
    kind: "sale",
    priceUSDT: tx.amountUsdt,
    from: "—",
    to: "—",
    ts: tx.completedAt,
    description: presentGenesisMarketplaceActivityDescription(
      tx.orderType,
      fmt(tx.quantity === 1 ? t.value.marketplace.activityNodeOne : t.value.marketplace.activityNodeMany, { n: tx.quantity }),
      tx.orderNo,
      { primary: t.value.marketplace.activityPrimary, secondary: t.value.marketplace.activitySecondary },
    ),
  }));
  return [...listings, ...transactions].sort((a, b) => b.ts - a.ts);
});

const buyPending = ref(false);
async function handleBuy(listing: Listing) {
  if (!marketplaceCommandsReady.value) return;
  if (buyPending.value || !marketplacePageVisible) return;
  if (secondaryBlock.value !== null) {
    toast.error(secondaryBlockText.value, secondaryBlockSub.value);
    return;
  }
  if (gatesSecondary.value && !eligible.value) {
    eligSheetOpen.value = true;
    return;
  }
  if (gate.value.capRemaining < 1) {
    toast.error(
      t.value.genesisEligibility.toastCapReached,
      fmt(t.value.genesisEligibility.toastCapReachedSub, { n: remoteApiEnabled ? genesis.remoteEligibility?.maxPerUser ?? 0 : GENESIS_ELIGIBILITY_POLICY.maxPerUser }),
    );
    return;
  }
  const accountScope = captureAccountScope();
  const pageEpoch = marketplaceObservationEpoch;
  const expectedPrice = listing.priceUSDT;
  const isCurrent = () => marketplacePageVisible && pageEpoch === marketplaceObservationEpoch
    && isCurrentAccountScope(accountScope);
  buyPending.value = true;
  try {
    const purchased = await genesis.acquireSecondary(listing.tokenId, expectedPrice);
    if (!isCurrent()) return;
    if (purchased === "recovered" || purchased === "local-retirement-pending") {
      toast.info(purchased === "recovered" ? t.value.marketplace.commandRecovered : t.value.marketplace.commandLocalPending,
        t.value.marketplace.commandRecoveryHint);
      return;
    }
    if (purchased === true) {
      toast.success(
        fmt(t.value.marketplace.acquiredToast, { id: listing.tokenId }),
        fmt(t.value.marketplace.acquiredDesc, { paid: formatGenesisPrice(expectedPrice), held: ownedCount.value }),
      );
      return;
    }
    toast.error(t.value.marketplace.purchaseUnconfirmed, t.value.marketplace.purchaseUnconfirmedDesc);
  } catch (error) {
    if (!isCurrent()) return;
    const geoMessage = geoPolicyUserMessage(error, t.value.geoPolicy);
    if (geoMessage) {
      toast.error(geoMessage, t.value.geoPolicy.fundsSafeNote);
      return;
    }
    if (error instanceof ApiError && error.message === "GENESIS_WALLET_INSUFFICIENT") {
      toast.error(t.value.marketplace.insufficient);
    } else if (error instanceof ApiError && error.message === "GENESIS_LISTING_PRICE_CHANGED") {
      toast.info(t.value.marketplace.priceChanged, t.value.marketplace.purchaseUnconfirmedDesc);
    } else {
      toast.error(t.value.marketplace.purchaseUnconfirmed, t.value.marketplace.purchaseUnconfirmedDesc);
    }
  } finally {
    buyPending.value = false;
  }
}

function goGenesis() {
  navTo("/pages/genesis/genesis");
}

/** 资格 sheet 达标态「立即认购」→ 关 sheet 去预售页(资格已解锁,留本页承接亦可)。 */
function onEligSubscribe() {
  eligSheetOpen.value = false;
  goGenesis();
}

// ── styles ──
// De-carded hero: stats sit directly on the page floor (2px optical inset); the
// internal stat-grid + floor-delta dividers stay as hairlines.
const heroStyle: CSSProperties = {
  padding: "0 2px",
};
const avatarStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "var(--v5-radius-m)",
  background: "var(--v5-surface-2)",
  color: "var(--v5-genesis-gold-on-dark)",
};
const collTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const marketScopeLineStyle: CSSProperties = {
  marginTop: "3px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  letterSpacing: "0.02em",
};
const statGridStyle: CSSProperties = {
  // 去线(主人 2026-08-17 全站令):总间距沿用有线时代的 14+14。
  marginTop: "28px",
  gap: "var(--v5-space-2)",
};
const statLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.04em",
};
function statValStyle(tint?: string): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: "15px",
    color: tint ?? "var(--v5-ink)",
    marginTop: "2px",
    lineHeight: 1.1,
  };
}
const floorDeltaStyle: CSSProperties = {
  marginTop: "var(--v5-space-3)",
  paddingTop: "12px",
  borderTop: "1px solid var(--v5-border)",
};
const floorDeltaValueStyle = computed<CSSProperties>(() => ({
  color: floorDelta.value.state === "up" ? "var(--v5-success)"
    : floorDelta.value.state === "down" ? "var(--v5-danger)"
      : "var(--v5-ink-3)",
  fontWeight: 600,
}));
const tabsStyle: CSSProperties = { gap: "var(--v5-space-1)", padding: "var(--v5-space-1)", borderRadius: "var(--ui-radius-icon)", background: "var(--v5-surface)" };
function tabPillStyle(active: boolean): CSSProperties {
  return {
    // 《07》tap≥44:原 40px(同页 sortPill 已补,这条是同类)
    minHeight: "44px",
    borderRadius: "8px",
    background: active ? "var(--v5-brand)" : "transparent",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
    fontFamily: "var(--font-v5)",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: "-0.005em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
const sortLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
  marginRight: "var(--v5-space-1)",
  flexShrink: 0,
};
function sortPillStyle(active: boolean): CSSProperties {
  return {
    flexShrink: 0,
    height: "32px",
    padding: "0 12px",
    borderRadius: "var(--v5-radius-full)",
    fontSize: "12px",
    fontWeight: 500,
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    letterSpacing: "0.04em",
    background: active ? "var(--v5-brand-soft)" : "var(--v5-surface)", // 未选中 pill 贴页面底:原 surface-2 与页面底同色不可辨,改 L1(选中态不动)
    color: active ? "var(--v5-brand)" : "var(--v5-ink-3)",
    // 零-border(《03》§6):选中态靠 brand-soft 底 + brand 文字表达,不描边。
    // 两态都不带 border,状态切换无 1px 位移。
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
// Activity is an open ledger; listings and owned tokens retain their entity cards.
const listCardStyle: CSSProperties = { paddingBlock: "4px" };
// Empty state — dashed outline, no fill (whitelist empty-state idiom).
const emptyCardStyle: CSSProperties = {
  borderRadius: "var(--v5-radius-m)",
  border: "1px dashed var(--v5-border-strong)",
  padding: "var(--v5-space-8)",
};
const reserveBtnStyle: CSSProperties = {
  marginTop: "var(--v5-space-3)",
  padding: "0 20px",
  height: "48px",
  lineHeight: "48px",
  borderRadius: "var(--v5-radius-full)",
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand-2)",
  fontWeight: 600,
  fontSize: "13px",
};

import GlassSegments from "@/components/glass-segments.vue";
const marketTabOptions = computed(() => [
  { value: "listings", label: listingsTabText.value },
  { value: "activity", label: t.value.marketplace.activityTab },
  { value: "mine", label: mineTabText.value },
]);
const sortOptions = computed(() => [
  { value: "floor", label: t.value.marketplace.sortPriceAsc },
  { value: "recent", label: t.value.marketplace.sortRecent },
  { value: "lastSale", label: t.value.marketplace.sortLastSale },
]);
</script>

<style scoped>
.nx-market-info, .nx-market-retry {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--v5-brand);
  font-size: 13px;
  font-weight: 600;
}
.nx-market-retry { align-self: flex-start; padding: 0 12px; }
.nx-market-read-retry-label { font: 600 13px/20px var(--font-v5); }
.nx-market-retry[aria-disabled="true"] { opacity: 0.6; }
.nx-sort-row {
  width: 100%;
  white-space: nowrap;
}
</style>

<style scoped>
.marketplace-page { padding-top:3px; }
.marketplace-hero { position:relative; padding:18px 16px 16px!important; border-radius:var(--ui-radius-surface); background:var(--v5-surface); }
.marketplace-hero::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:1.5px; background:conic-gradient(from 160deg,transparent 0 40%,color-mix(in srgb,var(--v5-genesis-gold) 80%,transparent) 66%,transparent 92%); mask:linear-gradient(var(--v5-ink) 0 0) content-box,linear-gradient(var(--v5-ink) 0 0); mask-composite:exclude; pointer-events:none; }
.marketplace-hero > .flex { align-items:center; gap:14px!important; }
.marketplace-hero > .flex > view:first-child { width:52px!important; height:52px!important; border-radius:var(--v5-radius-m)!important; background:color-mix(in srgb,var(--v5-genesis-gold) 16%,transparent)!important; color:var(--v5-genesis-gold)!important; }
.marketplace-hero > .flex > view:nth-child(2) > text:first-child { font-size:16px!important; line-height:22px; }
.marketplace-hero > .flex > view:nth-child(2) > text:nth-child(2) { font:400 12px/16px var(--font-v5)!important; letter-spacing:0!important; margin-top:2px!important; }
.marketplace-hero > .grid { margin-top:14px!important; padding:var(--v5-space-3); gap:0!important; border-radius:var(--v5-radius-m); background:color-mix(in srgb,var(--v5-ink) 4%,transparent); box-shadow:inset 0 2px 8px color-mix(in srgb,var(--v5-bg) 45%,transparent), inset 0 0 0 1px var(--v5-border); }
.marketplace-hero > .grid > view { padding:0 4px; min-width:0; }
.marketplace-hero > .grid > view + view { padding-left:10px; border-left:1px solid var(--v5-border); }
.marketplace-hero > .grid > view > text:first-child { display:block; font:500 11px/14px var(--font-metric)!important; letter-spacing:.02em!important; color:var(--v5-ink-3)!important; }
.marketplace-hero > .grid > view > text:nth-child(2) { margin-top:6px!important; font:500 16px/20px var(--font-metric)!important; color:var(--v5-ink)!important; }
.marketplace-closed { display:flex; align-items:center; gap:var(--v5-space-2); margin-top:var(--v5-space-4); padding-top:14px; border-top:1px solid var(--v5-border); }
.marketplace-lock { display:grid; place-items:center; flex:none; width:28px; height:28px; border-radius:50%; background:var(--v5-surface-3); color:var(--v5-ink-2); }
.marketplace-closed-title { display:block; color:var(--v5-ink); font-size:15px; line-height:20px; font-weight:500; }
.marketplace-closed-sub { display:inline; color:var(--v5-ink-3); font-size:12px; line-height:16px; }
.marketplace-info { border-radius:var(--ui-radius-surface); background:var(--v5-surface); }
.marketplace-info-row { display:flex; align-items:center; gap:var(--v5-space-3); min-height:56px; padding:6px 16px; box-sizing:border-box; font-size:15px; line-height:20px; }
.marketplace-info-learn { padding-right:8px; }
.marketplace-info-learn > svg { margin-right:12px; }
.marketplace-info-row + .marketplace-info-row { border-top:1px solid var(--v5-border); }
.marketplace-fee-label { flex:1; color:var(--v5-ink-3); font-size:12px; line-height:16px; }
.marketplace-fee { font:500 14px/20px var(--font-metric); }
.marketplace-info .nx-market-retry { display:grid; place-items:center; flex:none; width:44px; height:44px; padding:0; margin:0 -8px 0 0; align-self:center; min-height:44px; color:var(--v5-ink-3); }
.marketplace-tabs { margin-top:var(--v5-space-2); height:40px; padding:var(--v5-space-1); gap:var(--v5-space-1); }
.marketplace-tabs :deep(.nx-glass-option) { min-height:32px; height:32px; }
.marketplace-listings-empty { padding:var(--v5-space-4) 24px 0!important; background:transparent!important; }
.marketplace-listings-empty :deep(.nx-empty-icon) { width:56px; height:56px; border-radius:18px; background:var(--v5-surface-2); }
</style>

<style scoped>
.marketplace-listings-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:var(--v5-space-4) 24px 0; }
.marketplace-empty-icon { display:grid; place-items:center; width:56px; height:56px; border-radius:18px; background:var(--v5-surface-2); color:var(--v5-ink-3); }
.marketplace-empty-title { margin-top:var(--v5-space-3); font-size:15px; line-height:22px; font-weight:500; }
.marketplace-empty-desc { margin-top:var(--v5-space-1); color:var(--v5-ink-3); font-size:13px; line-height:20px; }
</style>
