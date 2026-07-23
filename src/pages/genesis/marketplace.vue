<!--
  Genesis Marketplace — OpenSea-style secondary market for Genesis Node NFTs
  (ported from Nexion-prototype/app/(main)/genesis/marketplace/page.tsx).

  Collection hero (4-stat grid + 7d floor delta + fake OpenSea redirect) →
  segmented tabs (listings / activity / mine) → sort pills + listing grid /
  activity feed / owned-token grid. Wrapped in <AppChassis active="me">. Buy
  composes app.debitBalance + genesis.purchase + bills.add in the handler.
  SEED_LISTINGS / SEED_ACTIVITY are faithful English mock arrays.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/genesis/genesis" />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- Collection hero — de-carded: sits on the page floor. -->
        <view :style="heroStyle">
          <view class="flex items-start" style="gap: 12px">
            <view class="grid place-items-center shrink-0" :style="avatarStyle">
              <text style="font-size: 28px">👑</text>
            </view>
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 6px">
                <text class="truncate" :style="collTitleStyle">NexGrid Genesis Node</text>
                <text class="shrink-0" :style="verifiedStyle">✓</text>
              </view>
              <text class="block" :style="ercLineStyle">{{ t.marketplace.erc721Line }}</text>
            </view>
          </view>

          <!-- 4-stat grid -->
          <view class="grid grid-cols-4" :style="statGridStyle">
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.floor }}</text>
              <text class="tabular-nums" :style="statValStyle('var(--v5-success)')">${{ (stats.floor / 1000).toFixed(1) }}K</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.vol24h }}</text>
              <text class="tabular-nums" :style="statValStyle()">${{ (stats.vol24h / 1000).toFixed(0) }}K</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.listed }}</text>
              <text class="tabular-nums" :style="statValStyle()">{{ stats.listed }}</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.owners }}</text>
              <text class="tabular-nums" :style="statValStyle()">{{ stats.owners }}</text>
            </view>
          </view>

          <!-- 7-day floor delta -->
          <view class="flex items-center justify-between" :style="floorDeltaStyle" role="button" tabindex="0" :aria-label="t.marketplace.viewOpenSea" @click.capture="openSeaOpen = true">
            <text class="flex items-center" style="gap: 6px; font-family: var(--font-v5); font-size: 12px; color: var(--v5-ink-3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
              <text>{{ t.marketplace.floorUp }} </text>
              <text class="tabular-nums" style="color: var(--v5-success); font-weight: 600">+{{ stats.floorDeltaPct }}%</text>
              <text> {{ t.marketplace.past7d }}</text>
            </text>
            <view class="inline-flex items-center active:opacity-80" :style="viewOpenSeaStyle" @click.stop="openSeaOpen = true">
              <text style="pointer-events: none">{{ t.marketplace.viewOpenSea }} </text>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            </view>
          </view>
        </view>

        <!-- Tabs -->
        <view class="grid grid-cols-3" :style="tabsStyle">
          <view class="active:opacity-70 transition-opacity" :style="tabPillStyle(tab === 'listings')" @click="tab = 'listings'"><text>{{ listingsTabText }}</text></view>
          <view class="active:opacity-70 transition-opacity" :style="tabPillStyle(tab === 'activity')" @click="tab = 'activity'"><text>{{ t.marketplace.activityTab }}</text></view>
          <view class="active:opacity-70 transition-opacity" :style="tabPillStyle(tab === 'mine')" @click="tab = 'mine'"><text>{{ mineTabText }}</text></view>
        </view>

        <!-- LISTINGS TAB -->
        <template v-if="tab === 'listings'">
          <scroll-view scroll-x class="nx-sort-row">
            <view class="flex items-center" style="gap: 6px; white-space: nowrap">
              <text class="inline-flex items-center" :style="sortLabelStyle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                <text>{{ t.marketplace.sortLabel }}</text>
              </text>
              <view class="active:opacity-70 transition-opacity" :style="sortPillStyle(sortKey === 'floor')" @click="sortKey = 'floor'"><text>{{ t.marketplace.sortPriceAsc }}</text></view>
              <view class="active:opacity-70 transition-opacity" :style="sortPillStyle(sortKey === 'recent')" @click="sortKey = 'recent'"><text>{{ t.marketplace.sortRecent }}</text></view>
              <view class="active:opacity-70 transition-opacity" :style="sortPillStyle(sortKey === 'lastSale')" @click="sortKey = 'lastSale'"><text>{{ t.marketplace.sortLastSale }}</text></view>
            </view>
          </scroll-view>

          <view class="grid grid-cols-2" style="gap: 10px">
            <ListingCard v-for="l in sortedListings" :key="l.tokenId" :l="l" @buy="handleBuy(l)" />
          </view>
        </template>

        <!-- ACTIVITY TAB(真实成交 + 虚拟成交混排,FEAT-GEN10)-->
        <view v-else-if="tab === 'activity'" class="overflow-hidden" :style="listCardStyle">
          <ActivityRow v-for="(e, i) in mergedActivity" :key="e.id" :e="e" :is-last="i === mergedActivity.length - 1" />
        </view>

        <!-- MINE TAB -->
        <template v-else>
          <view v-if="ownedCount === 0" class="text-center" :style="emptyCardStyle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 8px"><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></svg>
            <text class="block" style="font-size: 13px; color: var(--v5-ink)">{{ t.marketplace.noTokensTitle }}</text>
            <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.375">{{ t.marketplace.noTokensSub }}</text>
            <view class="inline-block active:scale-95" :style="reserveBtnStyle" @click="goGenesis">
              <text>{{ t.marketplace.reservePrimary }}</text>
            </view>
          </view>
          <view v-else class="grid grid-cols-2" style="gap: 10px">
            <MyTokenCard v-for="id in ownedTokenIds" :key="id" :token-id="id" />
          </view>
        </template>

        <text class="block px-2" style="font-size: 12px; color: var(--v5-ink-3); line-height: 1.625">{{ t.marketplace.royaltyFooter }}</text>
      </view>
    </view>

    <OpenSeaModal v-model:open="openSeaOpen" />
    <!-- 资格门 sheet(二级同门,FEAT-GEN08;达标 CTA → 预售页)-->
    <GenesisEligibilitySheet v-model:open="eligSheetOpen" @subscribe="onEligSubscribe" />
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import ListingCard, { type Listing } from "@/components/genesis/listing-card.vue";
import ActivityRow, { type ActivityEvent } from "@/components/genesis/activity-row.vue";
import MyTokenCard from "@/components/genesis/my-token-card.vue";
import OpenSeaModal from "@/components/genesis/opensea-modal.vue";
import GenesisEligibilitySheet from "@/components/genesis/eligibility-sheet.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { onMounted, onUnmounted } from "vue";
import { useBills } from "@/store/bills";
import { useGenesis, GENESIS_ELIGIBILITY } from "@/store/genesis";
import { useGenesisConfig } from "@/store/genesis-config";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { toast } from "@/store/ui";

const ONE_DAY = 86400 * 1000;
const HOUR = 3600_000;

const t = useT();
const app = useApp();
const bills = useBills();
const genesis = useGenesis();
const cfg = useGenesisConfig();
const { gate, eligible, gatesSecondary } = useGenesisEligibility();

// 盘面展示统计（运营可配 admin G4，FEAT-GEN09；替换原硬编码 FLOOR/VOL_24H/... ）。
const stats = computed(() => cfg.config.marketStats);

const eligSheetOpen = ref(false);

const tab = ref<"listings" | "activity" | "mine">("listings");
const sortKey = ref<"floor" | "recent" | "lastSale">("floor");
const openSeaOpen = ref(false);

const now = Date.now();
const SEED_LISTINGS: Listing[] = [
  { tokenId: 7, priceUSDT: 16_500, lastSaleUSDT: 7_999, seller: "0x4f8b2c7e1a90", listedAt: now - 1 * HOUR, traits: { tier: "Founder #007", boost: "2.0×", mintYear: 2026 } },
  { tokenId: 23, priceUSDT: 15_200, lastSaleUSDT: 11_999, seller: "0xa1d9c2e8b720", listedAt: now - 3 * HOUR, traits: { tier: "Founder #023", boost: "1.5×", mintYear: 2026 } },
  { tokenId: 142, priceUSDT: 14_600, lastSaleUSDT: 11_999, seller: "0x91e3f8074bcd", listedAt: now - 8 * HOUR, traits: { tier: "Founder #142", boost: "1.5×", mintYear: 2026 } },
  { tokenId: 388, priceUSDT: 14_100, lastSaleUSDT: 9_999, seller: "0x6b4c1afe2d83", listedAt: now - 14 * HOUR, traits: { tier: "Founder #388", boost: "1.5×", mintYear: 2026 } },
  { tokenId: 501, priceUSDT: 13_800, lastSaleUSDT: 7_999, seller: "0xc7e29a4f8b16", listedAt: now - 1 * ONE_DAY, traits: { tier: "Founder #501", boost: "2.0×", mintYear: 2026 } },
  { tokenId: 627, priceUSDT: 13_500, lastSaleUSDT: 9_999, seller: "0x29ab78ed4c10", listedAt: now - 2 * ONE_DAY, traits: { tier: "Founder #627", boost: "1.5×", mintYear: 2026 } },
  { tokenId: 784, priceUSDT: 13_400, lastSaleUSDT: 9_999, seller: "0xf2b04e9d318a", listedAt: now - 2.5 * ONE_DAY, traits: { tier: "Founder #784", boost: "1.5×", mintYear: 2026 } },
  { tokenId: 829, priceUSDT: 13_400, lastSaleUSDT: 11_999, seller: "0xae73c1b80249", listedAt: now - 3 * ONE_DAY, traits: { tier: "Founder #829", boost: "1.5×", mintYear: 2026 } },
];

const SEED_ACTIVITY: ActivityEvent[] = [
  { id: "a-1", kind: "sale", tokenId: 12, priceUSDT: 14_800, from: "0x4f8b2c7e1a90", to: "0x6a1c93f0e2b8", ts: now - 18 * 60_000 },
  { id: "a-2", kind: "list", tokenId: 7, priceUSDT: 16_500, from: "0x4f8b2c7e1a90", to: "—", ts: now - 1 * HOUR },
  { id: "a-3", kind: "sale", tokenId: 218, priceUSDT: 13_900, from: "0xa1d9c2e8b720", to: "0x91e3f8074bcd", ts: now - 4 * HOUR },
  { id: "a-4", kind: "transfer", tokenId: 88, from: "0xc7e29a4f8b16", to: "0x6b4c1afe2d83", ts: now - 6 * HOUR },
  { id: "a-5", kind: "sale", tokenId: 451, priceUSDT: 14_100, from: "0x29ab78ed4c10", to: "0xae73c1b80249", ts: now - 8 * HOUR },
  { id: "a-6", kind: "list", tokenId: 142, priceUSDT: 14_600, from: "0x91e3f8074bcd", to: "—", ts: now - 8 * HOUR },
  { id: "a-7", kind: "mint", tokenId: 847, from: "—", to: "0x4f8b2c7e1a90", ts: now - 12 * HOUR },
  { id: "a-8", kind: "sale", tokenId: 64, priceUSDT: 13_800, from: "0xf2b04e9d318a", to: "0xae73c1b80249", ts: now - 14 * HOUR },
];

const ownedCount = computed(() => genesis.myOwned);
const ownedTokenIds = computed(() => genesis.ownedTokenIds);

const listingsTabText = computed(() => fmt(t.value.marketplace.listingsTab, { n: stats.value.listed }));
const mineTabText = computed(() => fmt(t.value.marketplace.mineTab, { n: ownedCount.value }));

// 承接成交后本地移除(mock 演示态,刷新重置;真后台由 server 单源回写挂单状态)。
const soldTokenIds = ref<Set<number>>(new Set());

// listedAt 约定:opsListing 种子存负偏移(相对 now)→ resolve 为绝对 ts;
// 运营新建的存绝对 epoch(正值)直接用。
function resolveListedAt(v: number): number {
  return v < 0 ? now + v : v;
}

// 挂单池 = 运营挂单(FEAT-GEN10)+ 种子卖单,合并去重、剔除已成交。UI 不暴露 source。
const mergedListings = computed<Listing[]>(() => {
  const ops: Listing[] = cfg.config.opsListings.map((o) => ({
    tokenId: o.tokenId,
    priceUSDT: o.priceUSDT,
    lastSaleUSDT: o.lastSaleUSDT,
    seller: o.seller,
    listedAt: resolveListedAt(o.listedAt),
    traits: o.traits,
  }));
  const seen = new Set<number>();
  const out: Listing[] = [];
  for (const l of [...ops, ...SEED_LISTINGS]) {
    if (soldTokenIds.value.has(l.tokenId) || seen.has(l.tokenId)) continue;
    seen.add(l.tokenId);
    out.push(l);
  }
  return out;
});

const sortedListings = computed(() => {
  const arr = [...mergedListings.value];
  if (sortKey.value === "floor") arr.sort((a, b) => a.priceUSDT - b.priceUSDT);
  if (sortKey.value === "recent") arr.sort((a, b) => b.listedAt - a.listedAt);
  if (sortKey.value === "lastSale") arr.sort((a, b) => b.lastSaleUSDT - a.lastSaleUSDT);
  return arr;
});

// ── FOMO 成交流(FEAT-GEN10)：虚拟成交（引擎自动 + 运营手动注单）与真实成交混排。
// 🔴 虚拟成交永不进 bills / 不动 soldSlots / 不动持仓 —— 纯展示流。
const FOMO_ADDR_POOL = [
  "0x4f8b2c7e1a90", "0xa1d9c2e8b720", "0x91e3f8074bcd", "0x6b4c1afe2d83",
  "0xc7e29a4f8b16", "0x29ab78ed4c10", "0xf2b04e9d318a", "0xae73c1b80249",
  "0x3d70e91ac428", "0x8b52f0173de6",
];
const liveFomo = ref<ActivityEvent[]>([]); // 引擎运行时生成(ephemeral,刷新重来)
let fomoTimer: ReturnType<typeof setTimeout> | null = null;
let fomoCountToday = 0;

function pickAddr(exclude?: string): string {
  const i = Math.floor(Math.random() * FOMO_ADDR_POOL.length);
  const a = FOMO_ADDR_POOL[i];
  return a === exclude ? FOMO_ADDR_POOL[(i + 1) % FOMO_ADDR_POOL.length] : a;
}

/** 生成一条虚拟成交（价格=地板 ×(1±band)，随机 token/双方地址）。不碰任何账本。 */
function genFomoSale(seq: number): ActivityEvent {
  const band = Math.max(0, Math.min(0.9, cfg.config.fomoPriceBandPct)); // clamp 合法带,防误配(如把 15 当 0.15)产负价/0
  const floor = stats.value.floor;
  const price = Math.max(1, Math.round(floor * (1 + (Math.random() * 2 - 1) * band)));
  const from = pickAddr();
  return {
    id: `fomo-${seq}-${genesis.soldSlots}`,
    kind: "sale",
    tokenId: 100 + Math.floor(Math.random() * 800),
    priceUSDT: price,
    from,
    to: pickAddr(from),
    ts: Date.now(),
  };
}

function scheduleFomo() {
  if (!cfg.config.fomoEnabled) return;
  const { fomoIntervalMinMs: mn, fomoIntervalMaxMs: mx } = cfg.config;
  const delay = mn + Math.random() * Math.max(0, mx - mn);
  fomoTimer = setTimeout(() => {
    if (cfg.config.fomoEnabled && fomoCountToday < cfg.config.fomoDailyCap) {
      liveFomo.value = [genFomoSale(fomoCountToday), ...liveFomo.value].slice(0, 30);
      fomoCountToday += 1;
    }
    scheduleFomo();
  }, delay);
}

// activity 展示流 = 引擎虚拟成交 + 运营手动注单(config.fomoActivity)+ 种子，按 ts 倒序。
const mergedActivity = computed<ActivityEvent[]>(() => {
  const manual = cfg.config.fomoActivity.map((e) => ({ ...e, ts: resolveListedAt(e.ts) }));
  return [...liveFomo.value, ...manual, ...SEED_ACTIVITY].sort((a, b) => b.ts - a.ts);
});

onMounted(() => {
  scheduleFomo();
});
onUnmounted(() => {
  if (fomoTimer) clearTimeout(fomoTimer);
});

function handleBuy(l: Listing) {
  // 资格门(FEAT-GEN08,appliesTo=both 时二级同门):确认前拦截,零资金动作。
  // 打开资格 sheet 引导补齐,而非仅 toast。
  if (gatesSecondary.value && !eligible.value) {
    eligSheetOpen.value = true;
    return;
  }
  // 单人限购同样约束二级承接(store 层 acquireSecondary L4 兜底)。
  if (gate.value.capRemaining < 1) {
    toast.error(
      t.value.genesisEligibility.toastCapReached,
      fmt(t.value.genesisEligibility.toastCapReachedSub, { n: GENESIS_ELIGIBILITY.perUserCap }),
    );
    return;
  }
  if (!app.debitBalance(l.priceUSDT)) {
    toast.error(
      t.value.marketplace.insufficient,
      fmt(t.value.marketplace.insufficientDesc, {
        need: l.priceUSDT.toLocaleString(),
        balance: app.user.usdtBalance.toFixed(2),
      }),
    );
    return;
  }
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): debit + acquire + bill.
  // 🔴 二级承接 = 转让(acquireSecondary),不是主售铸造(purchase)——不动 soldSlots/档价、
  // 不受售罄门影响。承接失败(已持有该 token)必须退款,杜绝「扣钱不给货」。
  // PRODUCTION: server validates listing, debits buyer, credits seller minus
  // royalty, transfers tokenId, writes bills atomically (PRD §9.11e).
  const ok = genesis.acquireSecondary(l.tokenId);
  if (ok) {
    soldTokenIds.value = new Set(soldTokenIds.value).add(l.tokenId); // 承接后从盘面移除
    bills.add({
      type: "purchase",
      symbol: "USDT",
      amount: -l.priceUSDT,
      status: "posted",
      memo: `Genesis secondary · token #${l.tokenId}`,
      ref: `GENESIS-SEC-${l.tokenId}`,
    });
    toast.success(
      fmt(t.value.marketplace.acquiredToast, { id: l.tokenId }),
      fmt(t.value.marketplace.acquiredDesc, {
        paid: l.priceUSDT.toLocaleString(),
        held: ownedCount.value,
      }),
    );
  } else {
    // 承接失败(已持有该 token)→ 退款;文案如实说「已退款」,不复用成功话术(审计 P2-2)。
    app.creditBalance(l.priceUSDT);
    toast.error(t.value.marketplace.acquireFailedTitle, t.value.marketplace.acquireFailedRefunded);
  }
}

function goGenesis() {
  uni.navigateTo({ url: "/pages/genesis/genesis", fail: () => {} });
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
  borderRadius: "16px",
  background: "linear-gradient(135deg, var(--v5-genesis-gold-on-dark) 0%, #E2C97C 100%)",
  boxShadow: "0 4px 12px color-mix(in srgb, var(--v5-genesis-gold-on-dark) 25%, transparent)",
};
const collTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const verifiedStyle: CSSProperties = {
  padding: "2px 6px",
  borderRadius: "4px",
  background: "var(--v5-success-soft)",
  color: "var(--v5-success)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
};
const ercLineStyle: CSSProperties = {
  marginTop: "3px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  letterSpacing: "0.02em",
};
const statGridStyle: CSSProperties = {
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px dashed var(--v5-border-strong)",
  gap: "8px",
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
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid var(--v5-border)",
};
const viewOpenSeaStyle: CSSProperties = {
  // 《07》tap≥44:原 32px
  minHeight: "44px",
  padding: "0 6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-brand)",
  fontWeight: 500,
};
const tabsStyle: CSSProperties = { gap: "4px", padding: "4px", borderRadius: "12px", background: "var(--v5-surface-2)" };
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
  marginRight: "4px",
  flexShrink: 0,
};
function sortPillStyle(active: boolean): CSSProperties {
  return {
    flexShrink: 0,
    height: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 500,
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    letterSpacing: "0.04em",
    background: active ? "var(--v5-brand-soft)" : "var(--v5-surface-2)",
    color: active ? "var(--v5-brand)" : "var(--v5-ink-3)",
    // 零-border(《03》§6):选中态靠 brand-soft 底 + brand 文字表达,不描边。
    // 两态都不带 border,状态切换无 1px 位移。
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
// Activity feed — single filled surface container, no border (rows carry hairlines).
const listCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
};
// Empty state — dashed outline, no fill (whitelist empty-state idiom).
const emptyCardStyle: CSSProperties = {
  borderRadius: "16px",
  border: "1px dashed var(--v5-border-strong)",
  padding: "32px",
};
const reserveBtnStyle: CSSProperties = {
  marginTop: "12px",
  padding: "0 20px",
  height: "48px",
  lineHeight: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand-2)",
  fontWeight: 600,
  fontSize: "13px",
};
</script>

<style scoped>
.nx-sort-row {
  width: 100%;
  white-space: nowrap;
}
</style>
