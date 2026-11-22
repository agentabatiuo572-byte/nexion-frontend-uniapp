<template>
  <view class="product-badge" :class="{ 'product-badge--detail': detail }"><NxTag :tone="kind === 'recommended' || kind === 'upgradePick' ? 'brand' : 'neutral'" wrap class="product-badge__tag"><NxIcon v-if="icon" :name="icon" :size="12" />{{ label }}</NxTag></view>
</template>
<script setup lang="ts">
// Store marketing badge (推荐、热销、旗舰…): one NxTag (design system 03 §3.8) floating inside the top-left of the
// product image, used by the store card and the product detail. Editorial picks take the brand tone, the rest neutral;
// the 12px glyph tells the types apart. Operator text the App does not know (`custom`) shows as written, without a glyph.
import { computed } from "vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import type { ProductBadgeKind } from "@/lib/product-copy";

const props = defineProps<{ label: string; kind: ProductBadgeKind; detail?: boolean }>();
const icon = computed(() => ({ recommended: "star", bestSeller: "flame", trending: "trending-up", upgradePick: "chevrons-up", flagship: "crown", lowBarrier: "sprout", custom: null } as const)[props.kind]);
</script>
<style scoped>
.product-badge { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; max-width: calc(100% - 20px); pointer-events: none; }
.product-badge--detail { top: 16px; left: 16px; max-width: calc(100% - 32px); }
.product-badge :deep(.nx-native-svg) { margin-right: 4px; }
</style>
