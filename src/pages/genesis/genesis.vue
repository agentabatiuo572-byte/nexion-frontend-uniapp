<!-- Genesis subscription: all supply, pricing and sale gates use the existing canonical projections. -->
<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/me" />
    <view class="genesis-page">
      <!-- 主视觉 = 透明底创世卡片图(环绕光圈 + 底座后方的地面光影),深浅主题各一张,由 CSS 按 data-theme 切换,只加载当前主题那张。 -->
      <view class="genesis-main-art" role="img" :aria-label="t.genesis.heroTitle" />
      <view class="genesis-seat genesis-edge">
        <view class="flex items-center justify-between" style="gap:8px">
          <view class="genesis-crown-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m2 7 5 5 5-8 5 8 5-5-2 12H4z"/></svg><text>{{ t.genesis.heroCrown }}</text></view>
          <view class="genesis-how" role="button" tabindex="0" @click="goHowItWorks">{{ t.genesis.howItWorksEntry }} →</view>
        </view>
        <text class="genesis-title">{{ t.genesis.heroTitle }}</text>
        <text v-if="showUrgency && supplyDisplay.known" class="genesis-description">{{ supplyCaption }}</text>
        <text class="genesis-description">{{ t.genesis.heroDisc }}</text>
        <view ref="salesBarRef" class="genesis-meter" :aria-label="supplyDisplay.known ? supplyDisplay.summary : '—'" role="img"><view v-for="n in 20" :key="n"><view v-if="supplyDisplay.known" :style="{ transform: `scaleX(${salesBarInView ? Math.max(0, Math.min(1, parseFloat(supplyDisplay.progressWidth) / 5 - (n - 1))) : 0})` }" /></view></view>
        <view class="genesis-meter-meta"><text>{{ t.genesis.soldOf }}</text><view v-if="supplyDisplay.known" class="genesis-meter-count"><text>{{ supplyDisplay.summary.split(" / ")[0] }}</text><text class="genesis-meter-total"> / {{ supplyDisplay.summary.split(" / ")[1] }}</text></view><text v-else class="genesis-meter-count">—</text></view>
        <text v-if="showUrgency" class="genesis-remaining">{{ remaining }} {{ t.genesis.leftSuffix }}</text>
      </view>
      <view class="genesis-section"><text>{{ t.genesis.tier.title }}</text><text v-if="!showUrgency" class="genesis-caption">{{ dockCtaText }}</text></view>
      <view class="genesis-tier-card">
        <view v-if="!tiers.length" class="genesis-tier" style="min-height:132px"><text>—</text></view>
        <view v-for="tr in tiers" :key="tr.id" class="genesis-tier" :class="{ 'genesis-tier--sold': tr.state === 'sold' }">
          <view class="genesis-gold-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 2-10 5 10 5 10-5-10-5ZM2 12l10 5 10-5M2 17l10 5 10-5"/></svg></view>
          <view class="flex-1 min-w-0"><view class="flex items-center" style="gap:6px"><text class="genesis-subtitle">{{ t.genesis.tier[tr.labelKey] }}</text><text v-if="tr.state === 'current' && dockActive" class="genesis-tier-chip">{{ t.genesis.tier.live }}</text><text v-else-if="tr.state === 'sold'" class="genesis-caption">{{ t.genesis.tier.soldOut }}</text></view><text class="genesis-tier-meta">{{ tr.state === 'current' && showUrgency ? fmt(t.genesis.tier.left, { n: tr.left }) : fmt(t.genesis.tier.seats, { n: tr.seatsTotal.toLocaleString(locale.code) }) }}</text></view>
          <view class="genesis-tier-price"><text class="genesis-amount"><text class="genesis-currency">$</text>{{ tr.priceText.split('.')[0] }}<text class="genesis-decimal">.{{ tr.priceText.split('.')[1] || '00' }}</text></text><text v-if="tr.state === 'current'" class="genesis-current">{{ t.genesis.tier.current }}</text></view>
        </view>
      </view>
      <view class="genesis-section"><text>{{ t.genesis.value.title }}</text></view>
      <view class="genesis-perks"><view v-for="p in PERKS" :key="p.name" class="genesis-perk"><view class="genesis-gold-icon genesis-perk-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path :d="p.path"/></svg></view><text class="genesis-subtitle">{{ p.name }}</text><text class="genesis-perk-desc">{{ p.desc }}</text></view></view>
      <view class="genesis-market-entry" :role="marketplaceEntryBlocked ? undefined : 'button'" :tabindex="marketplaceEntryBlocked ? -1 : 0" :aria-disabled="marketplaceEntryBlocked ? 'true' : undefined" :aria-label="marketplaceEntryBlocked ? undefined : t.genesis.viewMarketplace" @click="openMarketplaceEntry"><view class="genesis-gold-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9h18l-2-5H5zM5 9v11h14V9M9 20v-6h6v6"/></svg></view><view class="flex-1 min-w-0"><text class="genesis-subtitle block">{{ t.genesis.secLiveMarket }}</text><text class="genesis-caption block" style="margin-top:2px">{{ marketplaceEntryLabel }}</text></view><svg v-if="!marketplaceEntryBlocked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg></view>
      <view v-if="liveMarket.length" class="grid grid-cols-2" style="gap:10px;margin-top:12px"><NftCard v-for="n in liveMarket" :key="n.id" :id="n.id" :price="n.price" :ago="n.ago"/></view>
      <view class="genesis-section"><text>{{ t.genesis.faq.title }}</text></view>
      <view class="genesis-faq"><view v-for="k in faqKeys" :key="k" class="genesis-faq-row"><view class="genesis-faq-question" role="button" tabindex="0" :aria-expanded="expandedFaq === k" @click="expandedFaq = expandedFaq === k ? null : k"><text>{{ t.genesis.faq[k] }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" :style="{ transform: expandedFaq === k ? 'rotate(180deg)' : 'none' }"><path d="m6 9 6 6 6-6"/></svg></view><text v-if="expandedFaq === k" class="genesis-faq-answer">{{ faqAnswer(k) }}</text></view></view>
    </view>
    <template #pageFixed><view class="nx-genesis-dock nx-glass-bar"><NxButton variant="primary" :disabled="dockDisabled" @click="openSheet"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m2 7 5 5 5-8 5 8 5-5-2 12H4z"/></svg><text>{{ dockCtaText }}</text><text v-if="preSale && showTime" class="genesis-dock-number"> · {{ countdownDisplay }}</text><text v-else-if="dockShowsPrice" class="genesis-dock-number"> · ${{ priceText }}</text></NxButton></view></template>
    <GenesisPurchaseSheet v-model:open="sheetOpen" />
    <GenesisEligibilitySheet v-model:open="eligSheetOpen" @subscribe="onEligSubscribe" />
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatAmount as formatPlainAmount } from "@/lib/amount-display";
function formatAmount(value: Parameters<typeof formatPlainAmount>[0]): string {
  return formatPlainAmount(value).replace(/\B(?=(\d{3})+\.)/g, ",");
}
import { navTo } from "@/lib/route";
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import { onShow, onHide } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NftCard from "@/components/genesis/nft-card.vue";
import GenesisPurchaseSheet from "@/components/genesis/purchase-sheet.vue";
import GenesisEligibilitySheet from "@/components/genesis/eligibility-sheet.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useRemainderUiCopy } from "@/i18n/remainder-ui";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { useGenesis, GENESIS_ELIGIBILITY_POLICY } from "@/store/genesis";
import { useGenesisConfig } from "@/store/genesis-config";
import { useLocaleStore } from "@/store/locale";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";
import { toast } from "@/store/ui";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";
import { remoteApiEnabled } from "@/api/runtime";
import { subscribeRuntimeRevision } from "@/api/order-api";
import { deriveGenesisTierRows, type GenesisTierDisplayState } from "@/lib/genesis-tier-display";
import { resolveGenesisPrimaryCta, showGenesisPrimaryPrice } from "@/lib/genesis-primary-cta";
import { genesisSupplyDisplay } from "@/lib/genesis-supply-display";
import { presentGenesisRoyalty } from "@/lib/genesis-marketplace-presentation";

const t = useT();
const genesis = useGenesis();
const cfg = useGenesisConfig();
const refreshing = ref(false);
async function retryGenesis() {
  if(refreshing.value)return;
  refreshing.value=true;
  try { await refreshGenesisPage(true); } finally { refreshing.value=false; }
}
let refreshInFlight: Promise<void> | null = null;
let genesisPageVisible = false;
let refreshRequested = false;
const genesisReadFailed = ref(false);
useAutoRecovery({ failed: () => remoteApiEnabled && genesisReadFailed.value, retry: () => refreshGenesisPage(true) });

function refreshGenesisPage(recheck = false): Promise<void> {
  if (!genesisPageVisible) return Promise.resolve();
  if (refreshInFlight) {
    if (recheck) refreshRequested = true;
    return refreshInFlight;
  }
  genesisReadFailed.value = false;
  const operation = (async () => {
    do {
      refreshRequested = false;
      await cfg.refresh();
      if (!genesisPageVisible) return;
      await genesis.syncRemote();
      genesisReadFailed.value = !cfg.loaded || (genesis.remotePublicReadState === "unavailable" && genesis.remotePublicError !== "GENESIS_SERIES_UNAVAILABLE");
    } while (refreshRequested && genesisPageVisible);
  })();
  refreshInFlight = operation;
  void operation.finally(() => {
    if (refreshInFlight === operation) refreshInFlight = null;
  });
  return operation;
}

// A direct H5 hash-route load can mount this page without emitting uni-app's
// page-level onShow hook. Mount must therefore bootstrap the public Genesis
// projection; onShow remains the refresh path when navigating back later.
function showGenesisPage() {
  const returning = !genesisPageVisible;
  genesisPageVisible = true;
  void refreshGenesisPage(returning);
}
onMounted(showGenesisPage);
// 🔴 页面每次露出都重读配置(hydrate-once 修复):navigateBack 回到本页不触发
//   onMounted,只有 onShow 能接住「去了一趟别处、运营已切状态」的情形。
onShow(showGenesisPage);
onHide(() => {
  genesisPageVisible = false;
  refreshRequested = false;
});
const stopGenesisRevision = subscribeRuntimeRevision(() => {
  if (remoteApiEnabled && genesisPageVisible) void refreshGenesisPage(true);
});
onUnmounted(() => {
  genesisPageVisible = false;
  refreshRequested = false;
  stopGenesisRevision();
});
const locale = useLocaleStore();
const remainderCopy = useRemainderUiCopy();
const { eligible, gate } = useGenesisEligibility();
const { block, marketClosed, secondaryBlock, showUrgency, blockText, preSale, showTime, countdownDays, countdownClock } =
  useGenesisSaleGate();

const sheetOpen = ref(false);
const eligSheetOpen = ref(false);

// Value props — 运营可配（admin G4 权益配置）覆盖优先，未配置回退现 i18n 文案。
// config.perks[i] 空字段 → 用 i18n 缺省；四项图标固定。
const PERKS = computed(() => {
  const isZh = locale.code === "zh";
  const cp = cfg.config.perks;
  const fb = t.value.genesis.value;
  const pick = (i: number, name: string, desc: string) => {
    const p = cp[i];
    const cName = p ? (isZh ? p.nameZh : p.nameEn) : "";
    const cDesc = p ? (isZh ? p.descZh : p.descEn) : "";
    return { name: (cName || name).replace(/\bDAO\b\s*/gi, ""), desc: (cDesc || desc).replace(/vesting/gi, fb.releaseTerm) };
  };
  return [
    { path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 10l3-3 3 3M12 7v10", ...pick(0, fb.emissionName, fb.emissionDesc) },
    { path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18", ...pick(1, fb.poolName, fb.poolDesc) },
    { path: "M7 7h11l-3-3M17 17H6l3 3", ...pick(2, fb.daoName, fb.daoDesc) },
    { path: "M3 4h18v16H3ZM7 15v-3M12 15V9M17 15v-5", ...pick(3, fb.airdropName, fb.airdropDesc) },
  ];
});

// Secondary-market recent fills（价格随尾盘档溢价，非旧 $25K 地板叙事）。
const faqKeys = ["q1", "q2", "q3"] as const;
const expandedFaq = ref<typeof faqKeys[number] | null>("q1");
function answerKey(k: "q1" | "q2" | "q3"): "a1" | "a2" | "a3" {
  return k === "q1" ? "a1" : k === "q2" ? "a2" : "a3";
}
function faqAnswer(k: "q1" | "q2" | "q3"): string {
  const answer = t.value.genesis.faq[answerKey(k)];
  if (k !== "q2") return answer;
  if (remoteApiEnabled && genesis.remotePublicError === "GENESIS_SERIES_UNAVAILABLE")
    return t.value.genesis.marketClosed.seriesUnavailable;
  const royalty = presentGenesisRoyalty(genesis.remoteRoyaltyPct);
  return royalty === null ? t.value.genesis.royaltyUnavailable : fmt(answer, { royalty });
}

const sold = computed(() => genesis.soldSlots);
const total = computed(() => genesis.totalSlots);
const price = computed(() => genesis.unitPriceUSDT);
const remaining = computed(() => total.value - sold.value);
const supplyDisplay = computed(() => genesisSupplyDisplay(sold.value, total.value, genesis.remoteSupplyKnown));
const supplyCaption = computed(() => supplyDisplay.value.known
  ? fmt(remainderCopy.value.genesisSupply, { n: total.value.toLocaleString(locale.code) })
  : "");
const liveMarket = computed(() => remoteApiEnabled
  ? genesis.remoteListings.slice(0, 2).map((listing) => ({
      id: listing.tokenId,
      price: listing.priceUSDT,
      ago: ageText(listing.listedAt),
    }))
  : []);
function ageText(ts: number): string {
  // NftCard adds the localized "ago" suffix; pass a duration, not a full sentence.
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  const copy = remainderCopy.value;
  if (minutes < 60) return minutes === 1 && "listingMinute" in copy ? copy.listingMinute : fmt(copy.listingMinutes, { n: minutes });
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return hours === 1 && "listingHour" in copy ? copy.listingHour : fmt(copy.listingHours, { n: hours });
  }
  const days = Math.floor(minutes / 1440);
  return days === 1 && "listingDay" in copy ? copy.listingDay : fmt(copy.listingDays, { n: days });
}

// Dock 文案:**阻断原因来自唯一派生 `block`**(composable),本页不再自排优先级。
// 顺序由 genesisPurchaseBlock 定:配置未知 > 市场关闭 > 熔断 > 售罄 > 预售;
// 资格门仍在 openSheet 和服务端执行；主售文案不用账号资格覆盖。
const dockCtaText = computed(() => {
  return resolveGenesisPrimaryCta({
    block: block.value,
    blockedText: blockText.value,
    soldOut: t.value.genesis.ctaSoldOut,
    comingSoon: t.value.genesisEligibility.comingSoon,
    reserve: t.value.genesis.ctaReserve,
  });
});
const dockShowsPrice = computed(() => showGenesisPrimaryPrice(block.value));
/** 主按钮是否处于「可购买」外观(金色高光)。任一阻断态都退到中性面 —— 复用原本
 *  只给售罄用的那套中性样式,不另造 disabled 皮。 */
const dockActive = computed(() => block.value === null);
/** 是否置灰不可点。售罄**可点**(引导去二级市场),其余阻断态点了只给说明不开 sheet。 */
const dockDisabled = computed(() => block.value !== null && block.value !== "soldOut");
/** 阻断态的副说明(toast 第二行)。配置未知给「可重试」,其余给「持仓不受影响」定心。 */
const blockHintSub = computed(() => {
  if (block.value === "configUnavailable") return genesis.remotePublicError === "GENESIS_SERIES_UNAVAILABLE"
    ? t.value.genesis.marketClosed.seriesUnavailable : t.value.genesis.marketClosed.retryHint;
  if (block.value === "preSale") return "";
  return t.value.genesis.marketClosed.holdingsSafe;
});
// 倒计时副文本(showTime 时):「开售倒计时 {d天} HH:MM:SS」/「Opens in {d}d HH:MM:SS」。
const countdownDisplay = computed(() => {
  if (!showTime.value) return "";
  const dayPart = countdownDays.value > 0 ? fmt(t.value.genesisEligibility.countdownDay, { n: countdownDays.value }) + " " : "";
  return `${t.value.genesisEligibility.countdownLabel} ${dayPart}${countdownClock.value}`;
});

const priceText = computed(() => formatAmount(price.value));

// 阶梯档展示：累计售出决定各档 售罄/当前 态。档位读 live config(运营 G4 可配、可增删)。
// labelKey 按位置派生(不按 id 硬编码):首档=wl / 末档=Final tier / 中间=Public Tier —
// 运营增删档(t3/t4…)标签不错位、末档恒为 Final(修 id 硬编码致 label 错位)。
type TierLabelKey = "wl" | "t1" | "tail";
const tiers = computed(() =>
  remoteApiEnabled && !cfg.loaded ? [] : deriveGenesisTierRows(cfg.config.tiers, sold.value).map((tier, i, arr) => {
    const labelKey: TierLabelKey = i === 0 ? "wl" : i === arr.length - 1 ? "tail" : "t1";
    return {
      id: tier.id,
      labelKey,
      priceText: formatAmount(tier.priceUSDT),
      state: tier.state,
      left: tier.left,
      seatsTotal: tier.to - tier.from,
    };
  }),
);

const { elRef: salesBarRef, inView: salesBarInView } = useScrollGrowProgress();

/**
 * 阻断态的统一提示口。认购是动钱入口,被拦住时先把「钱怎么样了」说清楚 ——
 * 与 `blockHintSub` 的 holdingsSafe 同一目的,只是地区拒绝有自己更准的那句。
 * 🔴 翻译不出来(`null`)就是普通阻断态,原样走既有的 dockCtaText + blockHintSub,
 *    绝不能把「市场关闭 / 熔断 / 配置未知」说成地区受限。
 */
function toastBlocked() {
  const geo = geoPolicyUserMessage(block.value, t.value.geoPolicy);
  if (geo) toast.error(geo, t.value.geoPolicy.fundsSafeNote);
  else toast.info(dockCtaText.value, blockHintSub.value);
}

async function openSheet() {
  // 🔴 阻断判定**只问 `block` 一处**(FEAT-GEN10 ④)。改造前这里与 dockCtaText 各写一套
  //   if 链,两处顺序一致纯属巧合 —— 任一处加条件而另一处忘改就会「按钮与行为对不上」。
  if (block.value === "soldOut") {
    // 售罄 → 二级市场承接(GEN01 异常4);二级市场自身在关闭态也会锁,由该页自判。
    goMarketplace();
    return;
  }
  if (block.value === "configUnavailable") {
    // 🔴 配置未知 → 点按即**重试**(规格异常3 的重试动作,此前全链路零实现):
    //   重读配置源,成功即当场解锁;仍失败则给「可重试」说明。
    //   结果判定问派生 `block`,不摸原料 `.loaded`(④b 门):refresh 写共享 store,
    //   computed 同步失效,下一行读到的已是重读后的判定。
    await refreshGenesisPage(true);
    if (block.value !== "configUnavailable") {
      toast.success(t.value.genesis.marketClosed.retryOk);
    } else {
      toastBlocked();
    }
    return;
  }
  if (block.value !== null) {
    // 其余阻断态(市场关闭 / 熔断 / 预售未到):不开任何 sheet。
    // 🔴 禁静默无反馈(规格 ⑥):给出与按钮同一句说明,让用户知道不是点坏了。
    toastBlocked();
    return;
  }
  // 服务端资格未通过 → 展示原因，不打开购买 sheet。
  if (!eligible.value) {
    eligSheetOpen.value = true;
    return;
  }
  // 单人限购:已达上限不进购买 sheet(sheet 内 L3 + store L4 仍兜底)。
  if (gate.value.capReached) {
    toast.error(
      t.value.genesisEligibility.toastCapReached,
      fmt(t.value.genesisEligibility.toastCapReachedSub, { n: remoteApiEnabled ? genesis.remoteEligibility?.maxPerUser ?? 0 : GENESIS_ELIGIBILITY_POLICY.maxPerUser }),
    );
    return;
  }
  sheetOpen.value = true;
}

/** 资格 sheet 达标态「立即认购」→ 关资格 sheet、错开转场后开购买 sheet。 */
function onEligSubscribe() {
  eligSheetOpen.value = false;
  setTimeout(() => {
    sheetOpen.value = true;
  }, 260);
}
function goHowItWorks() {
  navTo("/pages/genesis/how-it-works");
}
/**
 * 二级市场入口与 marketClosed 同源:市场关闭 / 熔断 / 配置未知时不给入口,
 * 免得落地页同时说「暂未开放」又给重试按钮,让用户分不清是没开放还是网络坏了。
 * 售罄不在其中 —— 二级卖的是别人手里的存量,主售售罄恰恰是它该承接的场景。
 */
const marketplaceEntryBlocked = computed(() => secondaryBlock.value !== null);
const marketplaceEntryLabel = computed(() =>
  marketplaceEntryBlocked.value ? t.value.genesis.marketClosed.default : t.value.genesis.viewMarketplace);
function openMarketplaceEntry() {
  if (marketplaceEntryBlocked.value) return;
  goMarketplace();
}
function goMarketplace() {
  navTo("/pages/genesis/marketplace");
}

</script>

<style scoped>
.genesis-page { padding:3px 16px 120px; color:var(--v5-ink); --genesis-soft:color-mix(in srgb,var(--v5-genesis-gold) 16%,transparent); }
.genesis-main-art { display:block; width:calc(100% + 32px); margin:0 -16px; aspect-ratio:1366 / 1254; background:url("/static/img/genesis/genesis-card-dark.webp") center / contain no-repeat; }
[data-theme="light"] .genesis-main-art { background-image:url("/static/img/genesis/genesis-card-light.webp"); }
.genesis-seat { position:relative; margin:-24px 12px 0; padding:18px 18px 16px; border-radius:var(--ui-radius-surface); background:var(--v5-surface); }
.genesis-edge::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:1.5px; background:conic-gradient(from 160deg,transparent 0 40%,color-mix(in srgb,var(--v5-genesis-gold) 85%,transparent) 66%,transparent 92%); mask:linear-gradient(var(--v5-ink) 0 0) content-box,linear-gradient(var(--v5-ink) 0 0); mask-composite:exclude; pointer-events:none; }
.genesis-crown-chip { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 8px; border-radius:var(--v5-radius-full); background:var(--genesis-soft); color:var(--v5-genesis-gold); font-size:12px; line-height:16px; font-weight:500; }
.genesis-how { display:flex; align-items:center; min-height:44px; margin-block:-10px; font-size:13px; line-height:18px; font-weight:500; color:var(--v5-genesis-gold); }
.genesis-title { display:block; margin-top:var(--v5-space-3); font-size:24px; line-height:32px; font-weight:600; color:var(--v5-genesis-gold-hi); }
.genesis-description { display:block; margin-top:var(--v5-space-1); font-size:13px; line-height:20px; color:var(--v5-ink-3); }
.genesis-meter { display:grid; grid-template-columns:repeat(20,minmax(0,1fr)); gap:3px; margin-top:var(--v5-space-4); }
.genesis-meter > view { height:8px; border-radius:2px; background:color-mix(in srgb,var(--v5-ink) 10%,transparent); overflow:hidden; }
.genesis-meter > view > view { height:100%; background:var(--v5-genesis-gold); transform-origin:left; transition:transform 900ms ease; }
.genesis-meter-meta { display:flex; justify-content:space-between; margin-top:var(--v5-space-2); font-size:12px; line-height:16px; color:var(--v5-ink-3); }
.genesis-meter-count { display:flex; align-items:baseline; font:500 13px/18px var(--font-metric); color:var(--v5-ink); }
.genesis-meter-total { white-space:pre; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }
.genesis-remaining { display:block; margin-top:var(--v5-space-1); color:var(--v5-genesis-gold); font:12px/18px var(--font-metric); }
.genesis-section { display:flex; align-items:center; gap:var(--v5-space-2); margin:var(--v5-space-8) 4px 12px; font-size:17px; line-height:24px; font-weight:600; }
.genesis-section .genesis-caption { margin-left:auto; transform:translateY(2px); }
.genesis-caption { color:var(--v5-ink-3); font:400 12px/16px var(--font-v5); }
.genesis-refresh { flex:none; min-width:28px; min-height:44px; display:grid; place-items:center; margin-block:-11px; color:var(--v5-ink-3); }
.genesis-tier-card,.genesis-perk,.genesis-market-entry,.genesis-faq { background:var(--v5-surface); border-radius:var(--ui-radius-surface); }
.genesis-tier { display:flex; align-items:center; gap:var(--v5-space-3); padding:var(--v5-space-4); }
.genesis-tier + .genesis-tier { border-top:1px solid var(--v5-border); }
.genesis-tier--sold { opacity:.6; }
.genesis-gold-icon { display:grid; place-items:center; flex:none; width:40px; height:40px; border-radius:var(--ui-radius-icon); background:var(--genesis-soft); color:var(--v5-genesis-gold); }
.genesis-subtitle { font-size:15px; line-height:22px; font-weight:500; }
.genesis-tier-meta { display:inline; color:var(--v5-ink-3); font:400 12px/16px var(--font-metric); }
.genesis-tier-chip { border-radius:6px; padding:1px 5px; color:var(--v5-genesis-gold); background:var(--genesis-soft); font-size:10px; }
.genesis-tier-price { text-align:right; flex:none; }
.genesis-amount { display:block; font:500 20px/26px var(--font-amount); font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
.genesis-currency { font-size:.55em; margin-right:2px; letter-spacing:0; color:var(--v5-ink-3); }
.genesis-decimal { color:var(--v5-ink-3); }
.genesis-current { display:block; margin-top:2px; color:var(--v5-genesis-gold); font-size:12px; line-height:16px; }
.genesis-perks { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--v5-space-3); }
.genesis-perk { min-height:132px; padding:var(--v5-space-4); }
.genesis-perk-icon { width:40px; height:40px; }
.genesis-perk .genesis-subtitle { display:block; margin-top:var(--v5-space-3); }
.genesis-perk-desc { display:block; margin-top:0; color:var(--v5-ink-3); font-size:12px; line-height:18px; }
.genesis-market-entry { display:flex; align-items:center; gap:var(--v5-space-3); padding:14px 16px; margin-top:var(--v5-space-3); }
.genesis-market-entry .genesis-caption { display:inline; }
.genesis-faq-row + .genesis-faq-row { border-top:1px solid var(--v5-border); }
.genesis-faq-question { display:flex; align-items:center; justify-content:space-between; gap:var(--v5-space-3); min-height:52px; padding:0 16px; font-size:15px; line-height:22px; font-weight:500; }
.genesis-faq-question svg { flex:none; }
.genesis-faq-answer { display:block; padding:0 16px 14px; font-size:13px; line-height:20px; color:var(--v5-ink-2); }
.nx-genesis-dock { position:fixed; left:0; right:0; bottom:0; padding:var(--v5-space-3) 16px calc(30px + env(safe-area-inset-bottom)); }
.nx-genesis-dock .nx-button { width:100%; }
.genesis-dock-number { font-family:var(--font-metric); }
@media(prefers-reduced-motion:reduce) { .genesis-meter > view > view { transition:none; } }
</style>
