<!-- Bundle page focal card (board B「组合格」), shared by the plain bundle and the activity bundle: the selected count
     and the current bundle rate, the tier tags (a rule, not a progress track), one hint sentence, one tile per
     selected model with a dashed "add" tile, the same-model rule line, and (plain mode) the combined daily estimate.
     Soft glass (01 §1.1.2: the page's one focal block), so nothing inside it is a glass control (03 §3.1 P-67).
     Unknown tiers (null) show no rate, tags or hint. Tiles take extra rows (reward, quantity) through the tile slot. -->
<template>
  <view class="bundle-hero nx-soft-glass" role="region" :aria-label="title">
    <view class="bundle-hero__head">
      <text class="bundle-hero__title" role="heading" aria-level="2">{{ title }}</text>
      <text v-if="current" class="bundle-hero__figure"><text class="bundle-hero__minus">−</text>{{ bundlePct(current.pct) }}%</text>
    </view>
    <view v-if="steps.length" class="bundle-hero__tags" role="list" :aria-label="t.bundle.tiersAria">
      <NxTag v-for="(step, index) in steps" :key="step.minItems" role="listitem" :aria-current="step === current ? 'true' : undefined" :tone="step === current ? 'brand' : 'neutral'" :label="tagLabel(index)" />
    </view>
    <text v-if="hint" class="bundle-hero__hint">{{ hint }}</text>
    <view class="bundle-hero__grid">
      <view v-for="item in items" :key="item.id" class="bundle-hero__tile" :class="{ 'nx-viz-pop': popped.has(item.id) }">
        <CatalogMachineImage class="bundle-hero__image" :sku="item.id" :image-url="item.imageUrl" scope-key="bundle-tile" />
        <view class="bundle-hero__remove nx-reverse-action" role="button" tabindex="0" :aria-label="fmt(t.uiChrome.removeItem, { name: item.label ?? item.name })" @click.stop="emit('remove', item.id)" @keydown.enter.prevent="emit('remove', item.id)" @keydown.space.prevent="emit('remove', item.id)"><text>{{ t.promotion.removeSelection }}</text></view>
        <text class="bundle-hero__name">{{ item.name }}</text>
        <text class="bundle-hero__meta bundle-hero__price">{{ priceText(item.price) }}</text>
        <text class="bundle-hero__meta">{{ t.bundle.estimateShort }} <text class="bundle-hero__estimate">{{ item.estimate }}</text></text>
        <slot name="tile" :item="item" />
      </view>
      <view v-for="slot in addSlots" :key="'add' + slot" class="bundle-hero__add" role="button" :tabindex="addDisabled ? -1 : 0" :aria-disabled="addDisabled" :aria-label="t.bundle.add"
        @click="addDisabled || emit('add')" @keydown.enter.prevent="addDisabled || emit('add')" @keydown.space.prevent="addDisabled || emit('add')">
        <NxIcon name="plus" :size="20" /><text>{{ t.bundle.add }}</text>
      </view>
    </view>
    <view class="bundle-hero__rules-row">
      <text class="bundle-hero__rules">{{ rules }}</text>
      <slot name="rules-end" />
    </view>
    <view v-if="daily" class="bundle-hero__daily">
      <text class="bundle-hero__daily-key">{{ t.bundle.estimatedDaily }}</text>
      <text class="bundle-hero__daily-value">{{ daily }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import { formatGroupedAmount } from "@/lib/amount-display";
import { bundleCurrentStep, bundlePct, bundleSteps, bundleTierHint, bundleTierLabel } from "@/lib/bundle-tiers";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import type { BundleDiscountTier } from "@/store/cart";

/** label: the name screen readers use for the tile's actions when the visible name is a placeholder (a model no longer sold). */
export interface BundleTile { id: string; name: string; label?: string; imageUrl?: string | null; price: number | null; estimate: string }
const props = defineProps<{
  /** Models selected (one per model; several units of one model still count once). */
  count: number;
  /** Server bundle tiers; null while unknown (no rate, tags or hint). */
  tiers: ReadonlyArray<BundleDiscountTier> | null;
  items: ReadonlyArray<BundleTile>;
  /** The rule line under the tiles. */
  rules: string;
  /** Combined daily estimate ("$31–39/天"); empty hides the row. */
  daily?: string;
  /** Shows the dashed "add" tile. */
  addable?: boolean;
  addDisabled?: boolean;
}>();
const emit = defineEmits<{ (event: "remove", id: string): void; (event: "add"): void }>();
const t = useT();

const steps = computed(() => bundleSteps(props.tiers));
const current = computed(() => bundleCurrentStep(steps.value, props.count));
const hint = computed(() => bundleTierHint(steps.value, props.count, t.value.bundle));
const title = computed(() => props.count === 0 ? t.value.bundle.startTitle : fmt(t.value.bundle.selectedCount, { n: props.count }));
function tagLabel(index: number): string {
  return `${bundleTierLabel(steps.value, index, t.value.bundle)} −${bundlePct(steps.value[index].pct)}%`;
}
function priceText(price: number | null): string {
  const text = formatGroupedAmount(price);
  return text === "-" ? "—" : `$${text}`;
}

/** Dashed 「添加」 tiles: two while nothing is chosen (the smallest bundle), then one after the chosen models. */
const addSlots = computed(() => (props.addable ? Math.max(1, 2 - props.items.length) : 0));

/** A model added after the first render pops in once (07: one-time feedback; reduced motion shows it still). */
const popped = ref(new Set<string>());
watch(() => props.items.map((item) => item.id), (ids, previous) => {
  popped.value = new Set(previous ? ids.filter((id) => !previous.includes(id)) : []);
});
</script>

<style scoped>
.bundle-hero { position: relative; margin: 0 16px; padding: 20px; border-radius: var(--ui-radius-surface); color: var(--v5-ink); }
.bundle-hero__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.bundle-hero__title { min-width: 0; color: var(--v5-ink); font: var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); overflow-wrap: break-word; }
/* The page's one key figure: the current bundle rate (JetBrains Mono for a non-money metric, brand). 24/28 is the
   large-discount-figure exception the coordinator registers in 10.2. */
.bundle-hero__figure { flex: none; color: var(--v5-brand); font: 500 24px/28px var(--font-metric); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.bundle-hero__minus { margin-right: -.18em; }
.bundle-hero__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.bundle-hero__hint { display: block; margin-top: 10px; color: var(--v5-ink); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; text-wrap: pretty; }
.bundle-hero__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
/* Tiles are in-card blocks (01 §1.3: card → surface-2 block, no deeper). */
.bundle-hero__tile { position: relative; display: flex; flex-direction: column; justify-content: flex-end; min-width: 0; min-height: 128px; padding: 10px 12px 12px; box-sizing: border-box; border-radius: 16px; background: var(--v5-surface-2); }
.bundle-hero__image { position: absolute; left: 4px; top: -6px; width: 84px; height: 84px; pointer-events: none; }
.bundle-hero__remove { position: absolute; right: 12px; top: 10px; z-index: 1; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.bundle-hero__remove::after { content: ""; position: absolute; top: calc(50% - 22px); bottom: calc(50% - 22px); left: -10px; right: -10px; }
.bundle-hero__remove:active { opacity: .6; }
.bundle-hero__remove:focus-visible, .bundle-hero__add:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 8px; }
.bundle-hero__name { display: block; margin-top: 56px; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.bundle-hero__meta { display: block; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); font-variant-numeric: tabular-nums; }
.bundle-hero__price { color: var(--v5-ink); font-weight: 500; white-space: nowrap; }
/* Tile estimates stay in the secondary ink: the card's one key number is the current rate (01 §1.1.1 #4). */
.bundle-hero__estimate { white-space: nowrap; }
.bundle-hero__add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 128px; box-sizing: border-box; border-radius: 16px; border: 1.5px dashed color-mix(in srgb, var(--v5-ink) 20%, transparent); color: var(--v5-ink-3); font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.bundle-hero__add:active { opacity: .6; }
.bundle-hero__add[aria-disabled="true"] { opacity: .5; cursor: default; }
.bundle-hero__rules-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; margin-top: 10px; }
.bundle-hero__rules { flex: 1 1 10em; min-width: 0; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; text-wrap: pretty; }
.bundle-hero__daily { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 16px -20px -20px; padding: 12px 20px; border-top: 1px solid var(--v5-border); }
.bundle-hero__daily-key { min-width: 0; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.bundle-hero__daily-value { color: var(--v5-ink); font: 500 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
