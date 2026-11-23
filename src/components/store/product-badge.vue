<template>
  <view class="product-badge" :class="{ 'product-badge--detail': detail }"><NxTag :tone="TONE[kind]" class="product-badge__tag" :class="{ 'product-badge__tag--strong': kind === 'flagship' }"><NxIcon v-if="icon" :name="icon" :size="12" /><text class="product-badge__text" :aria-label="label">{{ label }}</text></NxTag></view>
</template>
<script setup lang="ts">
// Store marketing badge (推荐、热销、旗舰…): one NxTag (design system 03 §3.8) floating inside the top-left of the
// product image, used by the store card and the product detail. Each type has its own hue: recommended brand,
// best seller coral, trending amber, upgrade pick teal, low barrier sky, flagship monochrome ink; plus a 12px glyph.
// Operator text the App does not know (`custom`) shows as written, neutral and without a glyph.
// The badge stays on one line: a label wider than the image ends in an ellipsis instead of wrapping over the machine,
// and the full text stays in the DOM for screen readers (03 §3.8).
import { computed } from "vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import type { ProductBadgeKind } from "@/mock/products";

const props = defineProps<{ label: string; kind: ProductBadgeKind; detail?: boolean }>();
const TONE = { recommended: "brand", bestSeller: "coral", trending: "warning", upgradePick: "teal", flagship: "neutral", lowBarrier: "sky", custom: "neutral" } as const;
const icon = computed(() => ({ recommended: "star", bestSeller: "flame", trending: "trending-up", upgradePick: "chevrons-up", flagship: "crown", lowBarrier: "sprout", custom: null } as const)[props.kind]);
</script>
<style scoped>
.product-badge { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; max-width: calc(100% - 20px); pointer-events: none; }
.product-badge--detail { top: 16px; left: 16px; max-width: calc(100% - 32px); }
.product-badge .product-badge__tag { flex: 0 1 auto; min-width: 0; max-width: 100%; }
.product-badge :deep(.nx-native-svg) { flex: none; margin-right: 4px; }
/* uni-app wraps the slot in one span inside the tag's text element: that span is the row (glyph + label) and may shrink. */
.product-badge :deep(.product-badge__tag > span) { display: flex; align-items: center; min-width: 0; max-width: 100%; }
.product-badge__text { display: block; flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-badge__text :deep(span) { white-space: inherit; }
.product-badge .product-badge__tag--strong { color: var(--v5-ink); }
</style>
