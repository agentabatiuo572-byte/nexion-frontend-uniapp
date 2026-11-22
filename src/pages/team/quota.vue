<template>
  <AppChassis active="team">
    <view class="quota-page nx-viz-motion">
      <SubPageHeader :back="conditionsOnly ? conditionBackHref : focusedProductId ? `/pages/store/detail?id=${encodeURIComponent(focusedProductId)}` : '/pages/team/team'" :title="conditionsOnly ? t.store.purchaseEligibilityProductPolicy : t.quota.pageTitle" plain design />
      <view v-if="conditionsOnly && conditionPageEmpty" class="quota-content quota-page-failure" role="alert">
        <text class="quota-page-failure__copy">{{ conditionEligibility.unavailable ? t.store.coCapacityProductUnavailable : t.store.purchaseEligibilityError }}</text>
        <view class="nx-card-recovery-action quota-page-failure__reload" role="button" tabindex="0" @click="conditionPageAction" @keydown.enter.prevent="conditionPageAction" @keydown.space.prevent="conditionPageAction"><text>{{ conditionEligibility.unavailable ? t.profile.back : t.ui.reload }}</text></view>
      </view>
      <view v-else-if="conditionsOnly" class="quota-content">
        <text class="quota-headline">{{ focusedProductName }}</text>
        <PurchaseEligibilityPanel :status="conditionEligibility.displaySnapshot ? 'ready' : conditionEligibility.status" :snapshot="conditionEligibility.displaySnapshot" />
      </view>
      <view v-else-if="!focusedTierPresent" class="quota-content quota-state">
        <text class="quota-headline">{{ focusedProductName }}</text>
        <text class="quota-body" role="note">{{ t.quota.focusedTierMissing }}</text>
        <NxButton variant="secondary" :label="t.store.gateLockedCta" @click="go(focusedProductHref)"><text>{{ t.store.gateLockedCta }}</text><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></NxButton>
      </view>
      <view v-else class="quota-content">
        <view class="quota-hero nx-tint">
          <!-- Entered from a product: the hero names it; its image and price are on the card right below, not repeated here. -->
          <text v-if="heroTier && focusedProductId" class="quota-headline">{{ heroTier.name }}</text>
          <view class="quota-invite-count">
            <view ref="inviteRingRef" class="quota-ring" :style="{ '--nx-viz-ring': inviteRingInView === false ? 0 : inviteRingPct, transition: inviteRingInView === false ? 'none' : VIZ_RING_TRANSITION }"><view class="quota-ring__hole nx-num-metric"><text class="quota-invite-count__number">{{ visibility.mask(activeDirectText) }}</text><text>{{ visibility.hidden ? '' : remoteApiEnabled && !remoteSnapshot ? '/—' : `/${directInvites}` }}</text></view></view>
            <view class="quota-invite-count__copy"><text>{{ t.quota.yourInvites }}</text><text v-if="inviteStepText" class="quota-invite-count__step">{{ inviteStepText }}</text><text class="quota-body">{{ t.quota.heroBody }}</text></view>
          </view>
        </view>

        <view v-if="remoteApiEnabled && !remoteSnapshot && !remoteError" class="quota-state" role="status" aria-live="polite" :aria-busy="remoteRefreshing"><text>{{ remoteRefreshing ? auditCopy.loading : '—' }}</text></view>
        <view v-if="remoteApiEnabled && !catalogDisplayReady" class="quota-state"><text class="quota-section-title">{{ t.quota.availableDevices }}</text><text>—</text></view>
        <view v-if="quotaReady && !focusedTiers.length" class="quota-state" role="status"><text>{{ t.empty.listTitle }}</text></view>
        <view v-if="focusedTiers.length" class="quota-devices-heading"><text class="quota-section-title">{{ t.quota.availableDevices }}</text><NxButton variant="link" size="small" :label="t.empty.devicesCta" @click="go('/pages/store/store')"><text class="nx-after-chevron">{{ t.empty.devicesCta }}</text></NxButton></view>
        <!-- One tier: a full-width card. Two or more: a carousel where the next card peeks in, with position dots (04.2). -->
        <QuotaTierCard v-if="focusedTiers.length === 1" class="quota-single" :tier="focusedTiers[0]" wide :pending="remoteApiEnabled && !remoteSnapshot" :action-blocked="!quotaReady" :blocked-note="quotaBlockedNote" @navigate="go" />
        <template v-else-if="focusedTiers.length">
          <scroll-view scroll-x class="quota-carousel" :show-scrollbar="false" @scroll="onCarouselScroll">
            <view class="quota-carousel__track"><QuotaTierCard v-for="tier in focusedTiers" :key="tier.productId" :tier="tier" :pending="remoteApiEnabled && !remoteSnapshot" :action-blocked="!quotaReady" :blocked-note="quotaBlockedNote" @navigate="go" /></view>
          </scroll-view>
          <view class="quota-dots" aria-hidden="true"><view v-for="(tier, index) in focusedTiers" :key="tier.productId" class="quota-dot" :class="{ 'quota-dot--active': index === carouselIndex }" /></view>
        </template>

        <view class="quota-footer">
          <NxButton variant="secondary" :label="t.rank.conditionsLabel" @click="go('/pages/team/rank')" />
          <NxButton variant="secondary" :label="t.quota.inviteFriendsTitle" @click="go('/pages/team/team?intent=share')" />
        </view>
        <text v-if="!remoteApiEnabled" class="quota-caption quota-invite-hint">{{ inviteHint }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useDataVisibility } from "@/store/data-visibility";
import { formatAmount } from "@/lib/amount-display";
import { navBack, navTo, takeNavigationQuery } from "@/lib/route";
import { computed, ref, watch } from "vue";
import { onLoad, onShow, onHide, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NxButton from '@/components/ui/nx-button.vue';
import QuotaTierCard, { type QuotaTier, type QuotaCondition } from "@/components/team/quota-tier-card.vue";
import PurchaseEligibilityPanel from "@/components/store/purchase-eligibility-panel.vue";
import { useRemotePurchaseEligibility } from "@/store/purchase-eligibility";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { networkReauditCopy } from "@/i18n/network-reaudit";
import { fmt } from "@/i18n/format";
import { remoteApiEnabled, teamQuotaApi, apiRuntimeConfig } from "@/api/runtime";
import { subscribeRuntimeRevision } from "@/api/order-api";
import type { TeamQuotaSnapshot } from "@/api/team-quota-api";
import { getProduct as getMockProduct, annualRoiPct as mockAnnualRoiPct, type Product } from "@/mock/products";
import { productCatalogPresentation, productCatalogDisplayProof, isProductCatalogDisplayCurrent, productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { specText } from "@/lib/product-copy";
import { useNetwork } from "@/store/network";
import { useVRank } from "@/store/v-rank";
import { useConfig } from "@/store/config";
import { useApp } from "@/store/app";
import { isCurrentTeamP31718Request, type TeamP31718Request } from "@/lib/team-p3-17-18-request-scope";
import { isAnnualizedQuotaPerk } from "@/lib/quota-perk";
import { useScrollGrowProgress, VIZ_RING_TRANSITION } from "@/composables/use-scroll-grow-progress";
import { uiLocale } from "@/i18n";

const t = useT();
const visibility = useDataVisibility();
const locale = useLocaleStore();
const auditCopy = computed(() => networkReauditCopy(locale.code));
const network = useNetwork();
const vRank = useVRank();
const cfg = useConfig();
const app = useApp();
const remoteSnapshot = ref<TeamQuotaSnapshot | null>(null);
const remoteError = ref<string | null>(null);
const remoteRefreshing = ref(false);
// A retained catalog proof permits presentation only; it never enables actions.
const catalogDisplayReady = computed(() => isProductCatalogDisplayCurrent() && productCatalogPresentation.value !== null);
let quotaMounted = true;
let quotaRequestGeneration = 0;
function captureQuotaRequest(): TeamP31718Request {
  return {
    accountKey: app.accountKey,
    accountEpoch: app.accountBindingEpoch,
    generation: quotaRequestGeneration,
  };
}
function quotaRequestIsCurrent(request: TeamP31718Request): boolean {
  return isCurrentTeamP31718Request(request, {
    mounted: quotaMounted,
    accountKey: app.accountKey,
    accountEpoch: app.accountBindingEpoch,
    generation: quotaRequestGeneration,
  });
}
function resetQuotaPageState(): void {
  quotaRequestGeneration += 1;
  remoteSnapshot.value = null;
  remoteError.value = null;
  remoteRefreshing.value = false;
}
async function refreshRemoteQuota() {
  if (remoteRefreshing.value) return;
  const request = captureQuotaRequest();
  remoteRefreshing.value = true;
  remoteError.value = null;
  try {
    const value = await teamQuotaApi.snapshot();
    if (quotaRequestIsCurrent(request)) remoteSnapshot.value = value;
  } catch {
    if (quotaRequestIsCurrent(request)) remoteError.value = auditCopy.value.quotaLoadError;
  } finally {
    if (quotaRequestIsCurrent(request)) remoteRefreshing.value = false;
  }
}
watch([() => app.accountKey, () => app.accountBindingEpoch], () => {
  resetQuotaPageState();
  if (quotaMounted && remoteApiEnabled && app.accountKey !== "default") {
    void refreshProductCatalog(true);
    void refreshRemoteQuota();
  }
});
watch(() => locale.code, () => {
  resetQuotaPageState();
  if (quotaMounted && remoteApiEnabled) void refreshRemoteQuota();
}, { flush: 'sync' });
onLoad((options) => {
  const query = new URLSearchParams(takeNavigationQuery("/pages/team/quota"));
  const fallback = query.get("product");
  const requested = typeof options?.product === "string" ? options.product.trim() : fallback?.trim() ?? "";
  focusedProductId.value = requested.slice(0, 64);
  conditionsOnly.value = (options?.intent ?? query.get("intent")) === "tradein-conditions";
  // An explicit new entry can revisit an earlier terminal result. Its own recovery still stops on 404.
  if (remoteApiEnabled && conditionsOnly.value && conditionEligibility.value.unavailable) void readConditionEligibility();
});

onShow(() => {
  quotaMounted = true;
  // The tier cards render catalog-owned names/perks (BUG 34/33), so the
  // catalog must be observed here too — a direct entry never visits the store.
  void refreshProductCatalog();
  if (remoteApiEnabled) {
    if (conditionsOnly.value) void retryConditionEligibility();
    else void refreshRemoteQuota();
  }
});
onHide(() => {
  quotaMounted = false;
  quotaRequestGeneration += 1;
  remoteRefreshing.value = false;
});
onUnload(() => {
  quotaMounted = false;
  stopQuotaRuntime();
  resetQuotaPageState();
});
// 礼包 NEX 数量单源派生自 platform config。
const inviteHint = computed(() => remoteApiEnabled ? "—" : fmt(t.value.quota.inviteFriendsHint, { inviterNex: formatAmount(cfg.config.rewards.inviterReward.nexAmount), nex: formatAmount(cfg.config.rewards.welcomeGift.nexAmount) }));

const members = computed(() => network.members);
const directInvites = computed(() => remoteApiEnabled ? remoteSnapshot.value?.facts.directInvites ?? "—" : members.value.filter((m) => m.layer === 1).length);
const activeDirect = computed(() => remoteApiEnabled ? remoteSnapshot.value?.facts.activeDirect ?? 0 : members.value.filter((m) => m.layer === 1 && m.status === "active").length);
const { elRef: inviteRingRef, inView: inviteRingInView } = useScrollGrowProgress();
// Share of direct invites that are active, drawn as the hero ring (hidden data shows an empty ring).
const inviteRingPct = computed(() => {
  const total = directInvites.value;
  return visibility.hidden || typeof total !== "number" || total <= 0 ? 0 : Math.min(100, activeDirect.value / total * 100);
});
// The next step reads from the same counts as the ring: invited friends who are not active yet.
const inviteStepText = computed(() => {
  const total = directInvites.value;
  if (visibility.hidden || typeof total !== "number" || total <= 0 || (remoteApiEnabled && !remoteSnapshot.value)) return "";
  const n = Math.max(0, total - activeDirect.value);
  const copy = ({
    zh: { pending: "还有 {n} 位好友未激活", pendingOne: "还有 {n} 位好友未激活", allActive: "邀请的好友已全部激活" },
    en: { pending: "{n} invited friends are not active yet", pendingOne: "{n} invited friend is not active yet", allActive: "All invited friends are active" },
    vi: { pending: "Còn {n} người bạn chưa kích hoạt", pendingOne: "Còn {n} người bạn chưa kích hoạt", allActive: "Bạn bè đã mời đều đã kích hoạt" },
    id: { pending: "{n} teman yang diundang belum aktif", pendingOne: "{n} teman yang diundang belum aktif", allActive: "Semua teman yang diundang sudah aktif" },
    ms: { pending: "{n} rakan dijemput belum aktif", pendingOne: "{n} rakan dijemput belum aktif", allActive: "Semua rakan dijemput sudah aktif" },
    fil: { pending: "{n} inimbitahang kaibigan ang hindi pa aktibo", pendingOne: "{n} inimbitahang kaibigan ang hindi pa aktibo", allActive: "Aktibo na lahat ng inimbitahan" },
    ru: { pending: "Приглашённые друзья, ещё не прошедшие активацию: {n}", pendingOne: "Приглашённые друзья, ещё не прошедшие активацию: {n}", allActive: "Все приглашённые друзья прошли активацию" },
    kk: { pending: "Шақырылған {n} дос әлі белсенді емес", pendingOne: "Шақырылған {n} дос әлі белсенді емес", allActive: "Шақырылған достардың бәрі белсенді" },
    uz: { pending: "Taklif qilingan {n} doʻst hali faol emas", pendingOne: "Taklif qilingan {n} doʻst hali faol emas", allActive: "Taklif qilingan barcha doʻstlar faol" },
  })[uiLocale(locale.code)];
  return n > 0 ? fmt(n === 1 ? copy.pendingOne : copy.pending, { n }) : copy.allActive;
});
const activeDirectText = computed(() => remoteApiEnabled && !remoteSnapshot.value ? "—" : String(activeDirect.value));

// Single source: tiers derive from the catalog products that carry a
// purchaseGate (name/price/锁额/解锁条件/perks all from getProduct + gate config,
// with live progress from network/v-rank). No hardcoded device economics here —
// the page mirrors §4 PurchaseGate + the store catalog (fixes stale $899/$3,499/
// "800-1,100 NEX/day" that drifted out of sync with the recalibrated catalog).
/**
 * 🔴 zentao #246:从商品详情页点「查看解锁条件」时带过来的商品 id。
 *
 * 此前详情页硬编码跳到 `/pages/team/quota`,而配额页只列**它自己的**档位 ——
 * 用户在看 Pro v2,跳过来看到的却是另一件商品的配额,即「查看解锁条件」指向了别人的条件。
 * 现在带上 id 并据此定位;若该商品根本不在配额档位里,页面**明说**,而不是静默展示无关档位。
 */
const focusedProductId = ref("");
const conditionsOnly = ref(false);
const conditionBackHref = "/pages/me/devices";
const { eligibility: conditionEligibility, retry: readConditionEligibility } = useRemotePurchaseEligibility(
  focusedProductId, () => conditionsOnly.value,
);
const conditionPageEmpty = computed(() => conditionEligibility.value.unavailable
  || (conditionEligibility.value.status === "error" && !conditionEligibility.value.displaySnapshot));
function retryConditionEligibility(): Promise<boolean> {
  const { status, unavailable } = conditionEligibility.value;
  return unavailable || status === "loading" ? Promise.resolve(false) : readConditionEligibility();
}
function conditionPageAction(): void {
  if (conditionEligibility.value.unavailable) navBack(conditionBackHref);
  else void retryConditionEligibility();
}
// Clear synchronously, including A→B→A, before a scheduled account read can run.
watch([() => app.accountKey, () => app.accountBindingEpoch,
  () => apiRuntimeConfig.environment, () => apiRuntimeConfig.baseUrl, focusedProductId], resetQuotaPageState, { flush: 'sync' });
watch(() => productCatalogDisplayProof.value && JSON.stringify([
  productCatalogDisplayProof.value.bindingEpoch, productCatalogDisplayProof.value.revision,
]), (proof, previous) => {
  if (previous && proof !== previous) resetQuotaPageState();
  if (proof && proof !== previous && quotaMounted && remoteApiEnabled && !remoteSnapshot.value) void refreshRemoteQuota();
}, { flush: 'sync' });
const stopQuotaRuntime = subscribeRuntimeRevision(scope => {
  if (!isProductCatalogDisplayCurrent(scope)) resetQuotaPageState();
});
const focusedProductHref = computed(() => `/pages/store/detail?id=${encodeURIComponent(focusedProductId.value)}`);
const focusedProductName = computed(() => catalogProduct(focusedProductId.value)?.name ?? focusedProductId.value);

function buildTier(productId: string, tint: string): QuotaTier | null {
  const p = getMockProduct(productId);
  const g = p?.purchaseGate;
  if (!p || !g) return null;
  const conditions: QuotaCondition[] = [];
  if (g.rankMin != null && g.rankMin > 0)
    conditions.push({ label: fmt(t.value.quota.condRank, { v: g.rankMin }), current: vRank.myRank, required: g.rankMin, kind: "invites" });
  if (g.activeDirectMin != null && g.activeDirectMin > 0)
    conditions.push({ label: t.value.quota.condActivatedDirect, current: activeDirect.value, required: g.activeDirectMin, kind: "invites" });
  if (g.teamComputePointsMin != null && g.teamComputePointsMin > 0)
    conditions.push({ label: t.value.quota.condTeamVol, current: vRank.teamComputePoints ?? 0, required: g.teamComputePointsMin, kind: "volume" });
  return {
    productId,
    imageUrl: p.imageUrl,
    name: p.name,
    price: p.price,
    monthlyStock: g.quotaCap ?? 0,
    soldThisMonth: g.quotaSold ?? 0,
    available: (g.quotaCap ?? 0) > (g.quotaSold ?? 0),
    unlockKind: g.mode,
    conditions,
    perks: [
      fmt(auditCopy.value.estimatedDaily, { n: formatAmount(p.dailyEarnNEX) }),
      // A Cloud Share shows no video memory.
      p.productType === "SHARE" ? specText(t.value, p.gpu, "—") : `${specText(t.value, p.gpu, "—")} · ${specText(t.value, p.vram, "—", "vram")}`,
    ],
    roiBasis: p.productType === "SHARE" ? undefined : { dailyEarn: p.dailyEarn, price: p.price, roi: mockAnnualRoiPct(p) },
    tint,
  };
}

// BUG 34/33: quota rows carry their own display_name/perk strings, which drift
// from the live catalog the store renders ("UVELBox Pro" vs the catalog's
// "StellarBox Pro"; raw "80.000000 NEX/day"). The catalog is the single naming
// and economics source — the server already refuses a quota snapshot whose
// productNo is missing from it (AppTeamQuotaService → TEAM_QUOTA_CATALOG_NOT_READY)
// — so the card renders catalog facts and only falls back to the server row
// while the catalog read has not landed.
function catalogProduct(productId: string): Product | undefined {
  if (!catalogDisplayReady.value) return undefined;
  return productCatalogPresentation.value?.products.find((p) => p.id === productId);
}
function catalogProductName(productId: string, fallback: string): string {
  return catalogProduct(productId)?.name ?? fallback;
}
function catalogProductPerks(productId: string, fallback: readonly string[]): string[] {
  const p = catalogProduct(productId);
  if (!p) return fallback.filter((perk) => !isAnnualizedQuotaPerk(perk)).map(quotaPerkText);
  // Annualized output is rendered only with its complete calculation basis.
  return [
    fmt(auditCopy.value.estimatedDaily, { n: formatAmount(p.dailyEarnNEX) }),
    p.productType === "SHARE" ? specText(t.value, p.gpu, "—") : `${specText(t.value, p.gpu, "—")} · ${specText(t.value, p.vram, "—", "vram")}`,
  ];
}
/**
 * 年化 ROI 的推导输入,与上面那条 perk 文案**同源同算**(都走 annualRoiPct),
 * 所以页面上的比例与列出的算式不可能各说各话。
 */
function catalogProductRoiBasis(productId: string): QuotaTier["roiBasis"] {
  const p = catalogProduct(productId);
  if (!p || p.productType === "SHARE") return undefined;
  return { dailyEarn: p.dailyEarn, price: p.price, roi: mockAnnualRoiPct(p), revision: productCatalogPresentation.value?.revision };
}

// The server row's perk strings are unlocalized and carry the raw column scale
// ("80.000000 NEX/day"). Until the catalog read lands they are the only facts
// available, so render them through the same localized, two-decimal
// line the catalog path uses (BUG 33) instead of printing the raw column.
const QUOTA_PERK_GEN = /^(\d+(?:\.\d+)?)\s*(?:NEX|UVT)\s*\/\s*day$/i;
function quotaPerkText(perk: string): string {
  const match = QUOTA_PERK_GEN.exec(perk.trim());
  if (!match) return perk;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return perk;
  return fmt(auditCopy.value.estimatedDaily, { n: formatAmount(match[1]) });
}

/** 请求聚焦的商品是否确实在配额档位里(空 id = 未指定,不提示)。 */
const focusedTierPresent = computed(() =>
  !focusedProductId.value || (remoteApiEnabled && !remoteSnapshot.value)
  || (remoteApiEnabled && !catalogDisplayReady.value)
  || tiers.value.some((tier) => tier.productId === focusedProductId.value));
const focusedTiers = computed(() => focusedProductId.value
  ? tiers.value.filter((tier) => tier.productId === focusedProductId.value) : tiers.value);

const tiers = computed<QuotaTier[]>(() =>
  remoteApiEnabled
    ? (!catalogDisplayReady.value ? [] : remoteSnapshot.value?.tiers ?? []).map((tier, index) => ({
      productId: tier.productId, imageUrl: tier.imageUrl, name: catalogProductName(tier.productId, tier.name), price: catalogProduct(tier.productId)?.price ?? tier.price,
      monthlyStock: tier.monthlyStock, soldThisMonth: tier.soldThisMonth, usedThisMonth: tier.usedThisMonth, remaining: tier.remaining,
      available: tier.available,
      unlockKind: tier.unlockKind === "EITHER" ? "either" : "all",
      conditions: tier.conditions.map((condition) => ({
        label: condition.kind === "teamComputePoints" ? t.value.quota.condTeamVol
          : condition.kind === "rank" ? fmt(t.value.quota.condRank, { v: condition.required })
          : t.value.quota.condActivatedDirect,
        current: condition.current, required: condition.required,
        kind: condition.kind === "teamComputePoints" ? "volume" : "invites",
      })), perks: catalogProductPerks(tier.productId, tier.perks),
      roiBasis: catalogProductRoiBasis(tier.productId), tint: index % 2 ? "var(--v5-warning)" : "var(--v5-brand)",
    }))
    : [buildTier("stellarbox-pro", "var(--v5-brand)"), buildTier("stellarrack-p1", "var(--v5-warning)")].filter(
      (x): x is QuotaTier => x !== null,
    ),
);

function go(url: string) {
  navTo(url);
}

// Which carousel card is in view, for the position dots. One step is a card plus the 12px gap;
// the track's 20px side padding is taken off the scroll width first.
const carouselIndex = ref(0);
function onCarouselScroll(event: { detail: { scrollLeft: number; scrollWidth: number } }) {
  const count = focusedTiers.value.length;
  const step = (event.detail.scrollWidth - 40 + 12) / count;
  carouselIndex.value = Math.min(count - 1, Math.round(event.detail.scrollLeft / step));
}

const heroTier = computed(() => focusedTiers.value[0]);
const quotaReady = computed(() => !remoteApiEnabled || (catalogDisplayReady.value && remoteSnapshot.value !== null && !remoteRefreshing.value && !remoteError.value && productCatalogState.status === 'ready'));
// The reason shown under a blocked buy: a failed read says so; otherwise the read is still running.
const quotaBlockedNote = computed(() => quotaReady.value ? "" : remoteError.value || productCatalogState.status === "error" ? t.value.quota.unconfirmedNote : t.value.quota.updatingNote);
useAutoRecovery({ failed: () => remoteApiEnabled && !conditionsOnly.value && !!remoteError.value && !remoteRefreshing.value, retry: refreshRemoteQuota });
useAutoRecovery({ failed: () => remoteApiEnabled && productCatalogState.status === "error", retry: () => refreshProductCatalog(true) });
useAutoRecovery({ failed: () => remoteApiEnabled && conditionsOnly.value && conditionEligibility.value.status === "error"
  && !conditionEligibility.value.unavailable, retry: retryConditionEligibility });
</script>

<style scoped>
.quota-page { color:var(--v5-ink);padding-bottom:28px; }.quota-content { padding:var(--v5-space-3) var(--v5-space-5) 0; }
.quota-headline { display:block;font:600 var(--ui-type-page-title)/var(--ui-type-page-title-lh) var(--font-v5);letter-spacing:-.02em;overflow-wrap:break-word; }
.quota-body { display:block;margin-top:var(--v5-space-2);font:var(--ui-type-body-weight) var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5);color:var(--v5-ink-2);overflow-wrap:break-word; }.quota-caption { display:block;font:var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.quota-state { padding-block:28px;display:flex;flex-direction:column;gap:var(--ui-space-inset); }
.quota-page-failure { min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--v5-space-2);text-align:center; }
.quota-page-failure__copy { color:var(--v5-ink-2);font:var(--ui-type-body-weight) var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5);overflow-wrap:break-word; }
.quota-page-failure .quota-page-failure__reload { margin:0;align-self:center; }
@media(max-width:374px) { .quota-content { padding-inline:var(--v5-space-4); } }
/* Hero: the page's one focal card, brand tint (01 §1.1.2); overview title, amount and the invite ring. */
.quota-hero { --nx-tint: var(--v5-brand); margin-top: var(--v5-space-1); padding: var(--ui-space-inset-hero); border-radius: var(--ui-radius-surface); }
.quota-hero .quota-headline { font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); letter-spacing:-.01em; }
.quota-invite-count { display:flex; align-items:center; gap:var(--ui-space-inset); margin-top:var(--ui-space-inset); }
.quota-hero > .quota-invite-count:first-child { margin-top:0; }
.quota-ring { display: grid; place-items: center; flex: none; width: 72px; height: 72px; border-radius: 999px; background: conic-gradient(var(--v5-brand) calc(var(--nx-viz-ring) * 1%), var(--v5-surface-3) 0); }
.quota-ring__hole { display:flex; align-items:center; justify-content:center; width:58px; height:58px; border-radius:999px; background:var(--v5-surface); font:var(--ui-type-metric-value-weight) var(--ui-type-metric-value)/var(--ui-type-metric-value-lh) var(--font-metric); color:var(--v5-ink); white-space:nowrap; }
.quota-invite-count__copy { flex:1; min-width:0; font:400 var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
.quota-invite-count__copy > text { display:block; }
.quota-invite-count__step { margin-top:2px; font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); color:var(--v5-ink); }
.quota-invite-count .quota-body { margin-top:var(--v5-space-1); font:inherit; color:inherit; }
/* Section title and its link share a line; the link drops to the next line, right-aligned, when they do not fit (03 §3.9). */
.quota-devices-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; column-gap:var(--v5-space-3); margin-top:var(--ui-space-section-gap); }
/* The link keeps its 44px hit area but overflows the 24px title line, so the section gap stays 32 and title-to-content 12. */
.quota-devices-heading > :deep(.nx-button) { margin-left:auto; margin-block:-10px; }
.quota-section-title { font:600 var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.quota-single { margin-top:var(--v5-space-3); }
/* Two equal buttons side by side; when their one-line labels do not both fit (vi), the row wraps and each takes the full width. */
.quota-footer { display:flex; flex-wrap:wrap; gap:var(--v5-space-3); margin-top:var(--ui-space-section-gap); }
.quota-footer > :deep(.nx-button) { flex:1 1 0; min-width:max-content; box-sizing:border-box; }
.quota-invite-hint { margin-top:var(--v5-space-3); }
/* Carousel (2+ tiers): the next card peeks, the last card ends on the page margin. */
.quota-carousel { display: block; width: auto; margin: var(--v5-space-3) calc(-1 * var(--v5-space-5)) 0; container-type: inline-size; white-space: nowrap; }
.quota-carousel :deep(.uni-scroll-view) { scroll-snap-type: x mandatory; scroll-padding-inline: var(--v5-space-5); scrollbar-width: none; }
.quota-carousel :deep(.uni-scroll-view::-webkit-scrollbar) { display: none; }
.quota-carousel__track { display: inline-flex; align-items: stretch; gap: var(--ui-space-inline); padding: 0 var(--v5-space-5) var(--v5-space-1); vertical-align: top; white-space: normal; }
/* Each card leaves 36px of the next one showing, so it reads as more to swipe. */
.quota-carousel__track > :deep(.quota-tier) { flex: none; width: 280px; width: calc(100cqw - 88px); scroll-snap-align: start; }
.quota-dots { display:flex; justify-content:center; gap:6px; margin-top:var(--v5-space-3); }
.quota-dot { width:6px; height:6px; border-radius:999px; background:color-mix(in srgb,var(--v5-ink) 20%,transparent); }
.quota-dot--active { width:16px; background:var(--v5-brand); }
@media (max-width: 374px) { .quota-carousel { margin-inline: calc(-1 * var(--v5-space-4)); } .quota-carousel :deep(.uni-scroll-view) { scroll-padding-inline: var(--v5-space-4); } .quota-carousel__track { padding-inline: var(--v5-space-4); } .quota-carousel__track > :deep(.quota-tier) { width: calc(100cqw - 80px); } }
</style>
