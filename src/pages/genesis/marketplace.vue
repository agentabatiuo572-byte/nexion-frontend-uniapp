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
        <!-- Collection hero -->
        <view class="relative overflow-hidden" :style="heroStyle">
          <view class="flex items-start" style="gap: 12px">
            <view class="grid place-items-center shrink-0" :style="avatarStyle">
              <text style="font-size: 28px">👑</text>
            </view>
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 6px">
                <text class="truncate" :style="collTitleStyle">Nexion Genesis Node</text>
                <text class="shrink-0" :style="verifiedStyle">✓</text>
              </view>
              <text class="block" :style="ercLineStyle">{{ t.marketplace.erc721Line }}</text>
            </view>
          </view>

          <!-- 4-stat grid -->
          <view class="grid grid-cols-4" :style="statGridStyle">
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.floor }}</text>
              <text class="tabular-nums" :style="statValStyle('var(--v5-success)')">${{ (FLOOR / 1000).toFixed(1) }}K</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.vol24h }}</text>
              <text class="tabular-nums" :style="statValStyle()">${{ (VOL_24H / 1000).toFixed(0) }}K</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.listed }}</text>
              <text class="tabular-nums" :style="statValStyle()">{{ LISTED }}</text>
            </view>
            <view class="flex flex-col">
              <text :style="statLabelStyle">{{ t.marketplace.owners }}</text>
              <text class="tabular-nums" :style="statValStyle()">{{ OWNERS }}</text>
            </view>
          </view>

          <!-- 7-day floor delta -->
          <view class="flex items-center justify-between" :style="floorDeltaStyle" role="button" tabindex="0" :aria-label="t.marketplace.viewOpenSea" @click.capture="openSeaOpen = true">
            <text class="flex items-center" style="gap: 6px; font-family: var(--font-v5); font-size: 12px; color: var(--v5-ink-3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
              <text>{{ t.marketplace.floorUp }} </text>
              <text class="tabular-nums" style="color: var(--v5-success); font-weight: 600">+18%</text>
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
          <view :style="tabPillStyle(tab === 'listings')" @click="tab = 'listings'"><text>{{ listingsTabText }}</text></view>
          <view :style="tabPillStyle(tab === 'activity')" @click="tab = 'activity'"><text>{{ t.marketplace.activityTab }}</text></view>
          <view :style="tabPillStyle(tab === 'mine')" @click="tab = 'mine'"><text>{{ mineTabText }}</text></view>
        </view>

        <!-- LISTINGS TAB -->
        <template v-if="tab === 'listings'">
          <scroll-view scroll-x class="nx-sort-row">
            <view class="flex items-center" style="gap: 6px; white-space: nowrap">
              <text class="inline-flex items-center" :style="sortLabelStyle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                <text>{{ t.marketplace.sortLabel }}</text>
              </text>
              <view :style="sortPillStyle(sortKey === 'floor')" @click="sortKey = 'floor'"><text>{{ t.marketplace.sortPriceAsc }}</text></view>
              <view :style="sortPillStyle(sortKey === 'recent')" @click="sortKey = 'recent'"><text>{{ t.marketplace.sortRecent }}</text></view>
              <view :style="sortPillStyle(sortKey === 'lastSale')" @click="sortKey = 'lastSale'"><text>{{ t.marketplace.sortLastSale }}</text></view>
            </view>
          </scroll-view>

          <view class="grid grid-cols-2" style="gap: 10px">
            <ListingCard v-for="l in sortedListings" :key="l.tokenId" :l="l" @buy="handleBuy(l)" />
          </view>
        </template>

        <!-- ACTIVITY TAB -->
        <view v-else-if="tab === 'activity'" class="overflow-hidden" :style="listCardStyle">
          <ActivityRow v-for="(e, i) in SEED_ACTIVITY" :key="e.id" :e="e" :is-last="i === SEED_ACTIVITY.length - 1" />
        </view>

        <!-- MINE TAB -->
        <template v-else>
          <view v-if="ownedCount === 0" class="text-center" :style="emptyCardStyle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 8px"><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></svg>
            <text class="block" style="font-size: 13.5px; color: var(--v5-ink)">{{ t.marketplace.noTokensTitle }}</text>
            <text class="block" style="font-size: 11px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.4">{{ t.marketplace.noTokensSub }}</text>
            <view class="inline-block active:scale-95" :style="reserveBtnStyle" @click="goGenesis">
              <text>{{ t.marketplace.reservePrimary }}</text>
            </view>
          </view>
          <view v-else class="grid grid-cols-2" style="gap: 10px">
            <MyTokenCard v-for="id in ownedTokenIds" :key="id" :token-id="id" />
          </view>
        </template>

        <text class="block px-2" style="font-size: 10.5px; color: var(--v5-ink-3); line-height: 1.5">{{ t.marketplace.royaltyFooter }}</text>
      </view>
    </view>

    <OpenSeaModal v-model:open="openSeaOpen" />
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
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useGenesis } from "@/store/genesis";
import { toast } from "@/store/ui";

const FLOOR = 25_000;
const VOL_24H = 1_247_300;
const LISTED = 89;
const OWNERS = 953;
const ONE_DAY = 86400 * 1000;
const HOUR = 3600_000;

const t = useT();
const app = useApp();
const bills = useBills();
const genesis = useGenesis();

const tab = ref<"listings" | "activity" | "mine">("listings");
const sortKey = ref<"floor" | "recent" | "lastSale">("floor");
const openSeaOpen = ref(false);

const now = Date.now();
const SEED_LISTINGS: Listing[] = [
  { tokenId: 7, priceUSDT: 32_500, lastSaleUSDT: 9_999, seller: "0x4f8b2c7e1a90", listedAt: now - 1 * HOUR, traits: { tier: "Founder #007", boost: "2.5×", mintYear: 2026 } },
  { tokenId: 23, priceUSDT: 28_900, lastSaleUSDT: 24_500, seller: "0xa1d9c2e8b720", listedAt: now - 3 * HOUR, traits: { tier: "Founder #023", boost: "2.5×", mintYear: 2026 } },
  { tokenId: 142, priceUSDT: 26_800, lastSaleUSDT: 22_300, seller: "0x91e3f8074bcd", listedAt: now - 8 * HOUR, traits: { tier: "Founder #142", boost: "2.5×", mintYear: 2026 } },
  { tokenId: 388, priceUSDT: 25_400, lastSaleUSDT: 20_100, seller: "0x6b4c1afe2d83", listedAt: now - 14 * HOUR, traits: { tier: "Founder #388", boost: "2.5×", mintYear: 2026 } },
  { tokenId: 501, priceUSDT: 25_100, lastSaleUSDT: 9_999, seller: "0xc7e29a4f8b16", listedAt: now - 1 * ONE_DAY, traits: { tier: "Founder #501", boost: "2.5×", mintYear: 2026 } },
  { tokenId: 627, priceUSDT: 25_000, lastSaleUSDT: 9_999, seller: "0x29ab78ed4c10", listedAt: now - 2 * ONE_DAY, traits: { tier: "Founder #627", boost: "2.5×", mintYear: 2026 } },
  { tokenId: 784, priceUSDT: 24_800, lastSaleUSDT: 9_999, seller: "0xf2b04e9d318a", listedAt: now - 2.5 * ONE_DAY, traits: { tier: "Founder #784", boost: "2.5×", mintYear: 2026 } },
  { tokenId: 829, priceUSDT: 24_500, lastSaleUSDT: 9_999, seller: "0xae73c1b80249", listedAt: now - 3 * ONE_DAY, traits: { tier: "Founder #829", boost: "2.5×", mintYear: 2026 } },
];

const SEED_ACTIVITY: ActivityEvent[] = [
  { id: "a-1", kind: "sale", tokenId: 12, priceUSDT: 27_500, from: "0x4f8b2c7e1a90", to: "0x6a1c93f0e2b8", ts: now - 18 * 60_000 },
  { id: "a-2", kind: "list", tokenId: 7, priceUSDT: 32_500, from: "0x4f8b2c7e1a90", to: "—", ts: now - 1 * HOUR },
  { id: "a-3", kind: "sale", tokenId: 218, priceUSDT: 25_900, from: "0xa1d9c2e8b720", to: "0x91e3f8074bcd", ts: now - 4 * HOUR },
  { id: "a-4", kind: "transfer", tokenId: 88, from: "0xc7e29a4f8b16", to: "0x6b4c1afe2d83", ts: now - 6 * HOUR },
  { id: "a-5", kind: "sale", tokenId: 451, priceUSDT: 25_400, from: "0x29ab78ed4c10", to: "0xae73c1b80249", ts: now - 8 * HOUR },
  { id: "a-6", kind: "list", tokenId: 142, priceUSDT: 26_800, from: "0x91e3f8074bcd", to: "—", ts: now - 8 * HOUR },
  { id: "a-7", kind: "mint", tokenId: 847, from: "—", to: "0x4f8b2c7e1a90", ts: now - 12 * HOUR },
  { id: "a-8", kind: "sale", tokenId: 64, priceUSDT: 25_100, from: "0xf2b04e9d318a", to: "0xae73c1b80249", ts: now - 14 * HOUR },
];

const ownedCount = computed(() => genesis.myOwned);
const ownedTokenIds = computed(() => genesis.ownedTokenIds);

const listingsTabText = computed(() => fmt(t.value.marketplace.listingsTab, { n: LISTED }));
const mineTabText = computed(() => fmt(t.value.marketplace.mineTab, { n: ownedCount.value }));

const sortedListings = computed(() => {
  const arr = [...SEED_LISTINGS];
  if (sortKey.value === "floor") arr.sort((a, b) => a.priceUSDT - b.priceUSDT);
  if (sortKey.value === "recent") arr.sort((a, b) => b.listedAt - a.listedAt);
  if (sortKey.value === "lastSale") arr.sort((a, b) => b.lastSaleUSDT - a.lastSaleUSDT);
  return arr;
});

function handleBuy(l: Listing) {
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
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): debit + purchase + bill.
  // PRODUCTION: server validates listing, debits buyer, credits seller minus
  // royalty, transfers tokenId, writes bills atomically (PRD §9.11e).
  const r = genesis.purchase(1, [l.tokenId]);
  if (r.ok) {
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
  }
}

function goGenesis() {
  uni.navigateTo({ url: "/pages/genesis/genesis", fail: () => {} });
}

// ── styles ──
const heroStyle: CSSProperties = {
  padding: "18px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const avatarStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #D4AF5A 0%, #E2C97C 100%)",
  boxShadow: "0 4px 12px rgba(212,175,90,0.25)",
};
const collTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "18px",
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
  fontSize: "10px",
  fontWeight: 500,
};
const ercLineStyle: CSSProperties = {
  marginTop: "3px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
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
  fontSize: "10px",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.04em",
};
function statValStyle(tint?: string): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: "14px",
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
  minHeight: "32px",
  padding: "0 6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-brand)",
  fontWeight: 500,
};
const tabsStyle: CSSProperties = { gap: "4px", padding: "4px", borderRadius: "12px", background: "var(--v5-surface-2)" };
function tabPillStyle(active: boolean): CSSProperties {
  return {
    height: "40px",
    borderRadius: "8px",
    background: active ? "var(--v5-brand)" : "transparent",
    color: active ? "var(--v5-ink)" : "var(--v5-ink-3)",
    fontFamily: "var(--font-v5)",
    fontSize: "12.5px",
    fontWeight: 500,
    letterSpacing: "-0.005em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
const sortLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
  marginRight: "4px",
  flexShrink: 0,
};
function sortPillStyle(active: boolean): CSSProperties {
  return {
    flexShrink: 0,
    height: "44px",
    padding: "0 14px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 500,
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    letterSpacing: "0.06em",
    background: active ? "var(--v5-brand)" : "var(--v5-surface-2)",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
const listCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const emptyCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
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
  fontSize: "12.5px",
};
</script>

<style scoped>
.nx-sort-row {
  width: 100%;
  white-space: nowrap;
}
</style>
