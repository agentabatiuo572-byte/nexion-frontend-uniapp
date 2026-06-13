<!--
  Store (main list page) — ported from Nexion-prototype/app/(main)/store/page.tsx.
  v5 light-fintech tier ladder upgrade flow, top→bottom:
    StoreHero → ClusterLadder → VsPhoneHero → TradeinWindowBanner →
    "Recommended" header + featured ProductCard → PurchaseTicker →
    "More tiers" header + rest ProductCards → "Coming soon" LockedProductCards →
    Orders entry chip → footer note.
  Gen-2 products (Pro v2 / Rack P2) are phase-gated: shown as live cards once the
  platform phase is reached, otherwise rendered as locked "Coming soon" cards.
  Wrapped in <AppChassis active="store">; entrance via <CardStagger>.
-->
<template>
  <AppChassis active="store">
    <CardStagger class="px-4 pt-3 pb-4 space-y-3" style="color: var(--v5-ink)">
      <StoreHero />
      <ClusterLadder />
      <VsPhoneHero />

      <!-- Sprint 2 finale — phase + legacy-ownership trade-in window -->
      <TradeinWindowBanner />

      <SectionHeader :title="t.store.secRecommended">
        <template #right>
          <text class="font-mono-tabular inline-flex items-center gap-1" :style="amberTagStyle">{{ t.store.secRecommendedTag }}</text>
        </template>
      </SectionHeader>
      <ProductCard v-if="featured" :product="featured" featured />

      <PurchaseTicker />

      <SectionHeader :title="t.store.secMoreTiers" />
      <ProductCard v-for="p in restProducts" :key="p.id" :product="p" />

      <!-- "Coming soon" — gen-2 phase-locked -->
      <view v-if="lockedProducts.length > 0">
        <SectionHeader :title="t.store.secComingSoon">
          <template #right>
            <text class="font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.store.comingSoonNote }}</text>
          </template>
        </SectionHeader>
        <view class="space-y-2.5">
          <LockedProductCard v-for="p in lockedProducts" :key="p.id" :product="p" />
        </view>
      </view>

      <!-- Orders entry -->
      <view class="flex items-center justify-center gap-1.5" :style="ordersChipStyle" role="button" tabindex="0" :aria-label="t.store.ordersChip" @tap.stop="goOrders" @click.stop="goOrders">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
        <text>{{ t.store.ordersChip }}</text>
        <text v-if="orderCount > 0" class="tabular-nums ml-0.5" style="color: var(--v5-brand); font-weight: 600">{{ orderCount }}</text>
      </view>

      <text class="block text-center font-mono-tabular" style="margin-top: 4px; padding-bottom: 8px; font-size: 12px; color: var(--v5-ink-3)">{{ t.store.pageFooter }}</text>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import SectionHeader from "@/components/store/section-header.vue";
import StoreHero from "@/components/store/store-hero.vue";
import ClusterLadder from "@/components/store/cluster-ladder.vue";
import VsPhoneHero from "@/components/store/vs-phone-hero.vue";
import TradeinWindowBanner from "@/components/store/tradein-window-banner.vue";
import ProductCard from "@/components/store/product-card.vue";
import PurchaseTicker from "@/components/store/purchase-ticker.vue";
import LockedProductCard from "@/components/store/locked-product-card.vue";
import { useT } from "@/i18n/use-t";
import { PRODUCTS } from "@/mock/products";
import { useOrders } from "@/store/orders";
import { useProductPhase } from "@/composables/use-product-phase";
import { isPhaseReached } from "@/store/product-phase";
import { navTo } from "@/lib/route";

const t = useT();
const orders = useOrders();
const phase = useProductPhase();

// mounted guard: phase override persists in storage, rehydrates client-only —
// mirror the source's mounted gate so locked/unlocked split is stable.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const orderCount = computed(() => orders.orders.length);

const unlockedProducts = computed(() =>
  PRODUCTS.filter((p) => {
    if (!p.unlocksAtPhase) return true;
    if (!mounted.value) return false;
    return isPhaseReached(phase.value, p.unlocksAtPhase);
  }),
);
const lockedProducts = computed(() =>
  PRODUCTS.filter((p) => {
    if (!p.unlocksAtPhase) return false;
    if (!mounted.value) return true;
    return !isPhaseReached(phase.value, p.unlocksAtPhase);
  }),
);

// Featured = first active product (S1)
const featured = computed(
  () => unlockedProducts.value.find((p) => p.id === "stellarbox-s1") ?? unlockedProducts.value[0],
);
const restProducts = computed(() =>
  unlockedProducts.value.filter((p) => p.id !== featured.value?.id),
);

function goOrders() {
  navTo("/store/orders");
}

const amberTagStyle: CSSProperties = {
  fontSize: "10.5px",
  padding: "2px 7px",
  borderRadius: "4px",
  background: "var(--v5-brand-2-soft)",
  color: "var(--v5-brand-2)",
  border: "1px solid var(--v5-brand-2-border)",
  fontWeight: 500,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
const ordersChipStyle: CSSProperties = {
  marginTop: "8px",
  padding: "11px 18px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border-strong)",
  borderRadius: "999px",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink-2)",
  fontWeight: 500,
};
</script>
