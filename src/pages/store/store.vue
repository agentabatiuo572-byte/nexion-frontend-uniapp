<!--
  Store (main list page) — ported from Nexion-prototype/app/(main)/store/page.tsx.
  v5 light-fintech tier ladder upgrade flow, top→bottom:
    StoreHero → ClusterLadder → VsPhoneHero → TradeinWindowBanner →
    "Recommended" header + featured ProductCard → PurchaseTicker →
    "More tiers" header + rest ProductCards → "Coming soon" LockedProductCards →
    footer note. (Orders entry moved to Me → Account — see me.vue.)
  Phase-gated products (Pro v2 / Rack P2, unlocksAtPhase): shown as live cards
  once the platform phase is reached, otherwise as locked "Coming soon" cards.
  Wrapped in <AppChassis active="store">; entrance via <CardStagger>.
-->
<template>
  <AppChassis active="store">
    <CardStagger class="px-4 pt-3 pb-4 space-y-6" style="color: var(--v5-ink)">
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
import { useProductPhase } from "@/composables/use-product-phase";
import { isPhaseReached } from "@/store/product-phase";

const t = useT();
const phase = useProductPhase();

// mounted guard: phase override persists in storage, rehydrates client-only —
// mirror the source's mounted gate so locked/unlocked split is stable.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

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

// "热门" tag — border line removed per request, soft bg kept (V5 inner-chip rule:
// soft bg tint + content color, no border).
const amberTagStyle: CSSProperties = {
  fontSize: "10.5px",
  padding: "2px 7px",
  borderRadius: "4px",
  background: "var(--v5-brand-2-soft)",
  color: "var(--v5-brand-2)",
  fontWeight: 500,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
</script>
