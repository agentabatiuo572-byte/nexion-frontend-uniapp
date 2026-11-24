<!-- Store bundle entry (board B「台阶」): a solid card (01 §1.1.2 纯色) in the store column, three machines on a floor
     light at the left and the bundle price stairs at the right; one in-card text action (03 §3.1 P-67 .nx-card-footer,
     .nx-card-action). Stair heights are the real rates (max rate = the tallest bar, 4px floor), so they are data.
     Unknown tiers (null) render the degraded card: no stairs, no rate, no "more is cheaper" claim.
     Personal: the account's bundle draft has models, so the card speaks about that draft and its next tier. -->
<template>
  <view class="bundle-entry" :class="{ 'bundle-entry--degraded': !steps.length }" data-testid="store-bundle-entry" role="group" :aria-label="cardLabel" @click="open">
    <view class="bundle-entry__head">
      <view class="bundle-entry__eyebrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
        <text>{{ personal ? t.bundle.yourBundle : t.promotion.bundle }}</text>
      </view>
      <text class="bundle-entry__title" role="heading" aria-level="3">{{ title }}</text>
      <text v-if="!steps.length && !personal" class="bundle-entry__desc">{{ t.bundle.degradedBody }}</text>
    </view>
    <view class="bundle-entry__viz">
      <view class="bundle-entry__cluster" :class="'bundle-entry__cluster--' + layout" aria-hidden="true">
        <view class="bundle-entry__floor" />
        <CatalogMachineImage v-for="(machine, index) in machines" :key="machine.id" class="bundle-entry__machine" :class="'bundle-entry__machine--' + index" :sku="machine.id" :image-url="machine.imageUrl" scope-key="store-bundle-entry" />
        <view v-if="ghost" class="bundle-entry__ghost"><NxIcon name="plus" :size="16" /></view>
      </view>
      <view v-if="steps.length" class="bundle-entry__stairs" role="img" :aria-label="stairsLabel">
        <view v-for="(step, index) in steps" :key="step.minItems" class="bundle-entry__step" :class="{ 'is-top': !personal && index === steps.length - 1, 'is-current': personal && step.minItems === current?.minItems }" aria-hidden="true">
          <text class="bundle-entry__value"><text class="bundle-entry__minus">−</text>{{ pctText(step.pct) }}%</text>
          <view v-viz-inview class="bundle-entry__bar nx-viz-rise" :style="{ '--bundle-bar': step.pct / maxPct, animationDelay: index * 100 + 'ms' }" />
          <text class="bundle-entry__label">{{ tierLabel(step, index) }}</text>
        </view>
      </view>
    </view>
    <view class="nx-card-footer bundle-entry__footer">
      <text v-if="note" class="nx-card-footer__note" :class="{ 'bundle-entry__hint': personal }">{{ note }}</text>
      <view class="nx-card-action" role="button" tabindex="0" @click.stop="open" @keydown.enter.prevent="open" @keydown.space.prevent="open">
        <text>{{ personal ? t.bundle.continueBundle : t.bundle.entryGo }}</text><NxIcon name="arrow-right" :size="16" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import { vVizInview } from "@/lib/viz-inview";
import { navTo } from "@/lib/route";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { bundleCurrentStep, bundlePct, bundleSteps, bundleTierHint, bundleTierLabel } from "@/lib/bundle-tiers";
import type { BundleDiscountTier } from "@/store/cart";
import type { Product } from "@/mock/products";

const props = defineProps<{
  /** Server bundle tiers; null while unknown or unreadable (the degraded card). */
  tiers: ReadonlyArray<BundleDiscountTier> | null;
  /** Purchasable hardware in catalogue order: the default card shows three of them. */
  products: ReadonlyArray<Product>;
  /** Models in the account's bundle draft that are still purchasable. */
  selected: ReadonlyArray<Product>;
}>();
const t = useT();

const steps = computed(() => bundleSteps(props.tiers));
const maxPct = computed(() => Math.max(...steps.value.map((step) => step.pct), 0) || 1);
const rising = computed(() => (props.tiers?.length ?? 0) > 1 && steps.value.length === props.tiers?.length);
const count = computed(() => props.selected.length);
const personal = computed(() => count.value > 0);
const current = computed(() => bundleCurrentStep(steps.value, count.value));
const next = computed(() => steps.value.find((step) => step.minItems > count.value) ?? null);
const pctText = bundlePct;
const tierLabel = (_step: BundleDiscountTier, index: number) => bundleTierLabel(steps.value, index, t.value.bundle);
const title = computed(() => {
  if (personal.value) {
    return current.value
      ? `${fmt(t.value.bundle.selectedLead, { n: count.value })}\u00a0−${pctText(current.value.pct)}%`
      : fmt(t.value.bundle.selectedCount, { n: count.value });
  }
  if (!steps.value.length) return t.value.bundle.degradedTitle;
  return rising.value ? t.value.bundle.entryTitleB : t.value.promotion.bundle;
});
const note = computed(() => bundleTierHint(steps.value, count.value, t.value.bundle));
const stairsLabel = computed(() => steps.value.map((step, index) => `${tierLabel(step, index)} −${pctText(step.pct)}%`).join(", "));
const cardLabel = computed(() => [personal.value ? t.value.bundle.yourBundle : t.value.promotion.bundle, title.value].join(", "));

/** A small, a middle and a large model (the most expensive rack is left out so the group keeps one scale). */
const showcase = computed(() => {
  const byPrice = [...props.products].sort((left, right) => left.price - right.price);
  const pool = byPrice.length > 3 ? byPrice.slice(0, -1) : byPrice;
  if (pool.length <= 3) return pool;
  return [pool[0], pool[Math.round((pool.length - 1) / 2)], pool[pool.length - 1]];
});
const machines = computed(() => (personal.value ? props.selected.slice(0, 3) : showcase.value)
  .map((product) => ({ id: product.id, imageUrl: product.imageUrl ?? null })));
/** The dashed spot says "one more model" while a cheaper tier is still ahead. */
const ghost = computed(() => personal.value && machines.value.length < 3 && (!!next.value || !steps.value.length));
const layout = computed(() => (personal.value ? `personal-${machines.value.length}` : "default"));

function open() {
  void navTo("/pages/store/bundle");
}
</script>

<style scoped>
.bundle-entry { --bundle-stair-max: 96px; --bundle-scale: 1; position: relative; overflow: hidden; border-radius: var(--ui-radius-surface); background: var(--v5-surface); border: 1px solid var(--v5-border); cursor: pointer; -webkit-tap-highlight-color: transparent; }
[data-theme="light"] .bundle-entry { box-shadow: var(--v5-glass-shadow); }
.bundle-entry__head { padding: 20px 20px 0; }
.bundle-entry__eyebrow { display: flex; align-items: center; gap: 6px; color: var(--v5-ink-3); font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); }
.bundle-entry__eyebrow svg { flex: none; }
.bundle-entry__eyebrow text { white-space: nowrap; }
.bundle-entry__title { display: block; margin-top: 8px; color: var(--v5-ink); font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); overflow-wrap: break-word; }
.bundle-entry__desc { display: block; margin-top: 4px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); overflow-wrap: break-word; text-wrap: pretty; }
.bundle-entry__viz { position: relative; height: 156px; margin: 12px 20px 0; }
.bundle-entry--degraded .bundle-entry__viz { height: 100px; }
.bundle-entry__cluster { position: absolute; left: -8px; bottom: 0; width: 150px; height: 140px; }
.bundle-entry--degraded .bundle-entry__cluster { left: 50%; margin-left: -75px; }
/* Floor light under the machines (01 §1.1.2 page effect, device teal into sky); static, it carries no data. */
.bundle-entry__floor { position: absolute; left: -6px; right: -6px; bottom: 0; height: 40px; border-radius: 50%; opacity: .34; pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--v5-tech-cyan) 70%, transparent) 0, color-mix(in srgb, var(--v5-aura-sky) 30%, transparent) 42%, transparent 70%); }
[data-theme="light"] .bundle-entry__floor { opacity: .22; }
/* Machines stand still (store images do not float here); sizes follow the board and shrink by a tenth at 360. */
.bundle-entry__machine { position: absolute; }
.bundle-entry__cluster--default .bundle-entry__machine--0 { left: 0; bottom: -5px; width: calc(80px * var(--bundle-scale)); height: calc(80px * var(--bundle-scale)); z-index: 1; }
.bundle-entry__cluster--default .bundle-entry__machine--1 { left: calc(26px * var(--bundle-scale)); bottom: 7px; width: calc(92px * var(--bundle-scale)); height: calc(92px * var(--bundle-scale)); z-index: 2; }
.bundle-entry__cluster--default .bundle-entry__machine--2 { left: calc(48px * var(--bundle-scale)); bottom: -20px; width: calc(102px * var(--bundle-scale)); height: calc(102px * var(--bundle-scale)); z-index: 3; }
.bundle-entry__cluster--personal-1 .bundle-entry__machine--0, .bundle-entry__cluster--personal-2 .bundle-entry__machine--0 { left: 0; bottom: -6px; width: calc(88px * var(--bundle-scale)); height: calc(88px * var(--bundle-scale)); z-index: 1; }
.bundle-entry__cluster--personal-2 .bundle-entry__machine--1 { left: calc(48px * var(--bundle-scale)); bottom: -12px; width: calc(100px * var(--bundle-scale)); height: calc(100px * var(--bundle-scale)); z-index: 2; }
.bundle-entry__cluster--personal-3 .bundle-entry__machine--0 { left: 0; bottom: -5px; width: calc(80px * var(--bundle-scale)); height: calc(80px * var(--bundle-scale)); z-index: 1; }
.bundle-entry__cluster--personal-3 .bundle-entry__machine--1 { left: calc(26px * var(--bundle-scale)); bottom: 7px; width: calc(92px * var(--bundle-scale)); height: calc(92px * var(--bundle-scale)); z-index: 2; }
.bundle-entry__cluster--personal-3 .bundle-entry__machine--2 { left: calc(48px * var(--bundle-scale)); bottom: -20px; width: calc(102px * var(--bundle-scale)); height: calc(102px * var(--bundle-scale)); z-index: 3; }
/* The empty spot for the next model: a dashed floor ring and a plus, decoration only. */
.bundle-entry__ghost { position: absolute; bottom: -2px; width: calc(64px * var(--bundle-scale)); height: calc(64px * var(--bundle-scale)); display: grid; place-items: center; color: var(--v5-ink-4); }
.bundle-entry__cluster--personal-1 .bundle-entry__ghost { left: calc(60px * var(--bundle-scale)); }
.bundle-entry__cluster--personal-2 .bundle-entry__ghost { left: calc(88px * var(--bundle-scale)); }
.bundle-entry__ghost::before { content: ""; position: absolute; left: 12%; right: 12%; bottom: 14%; height: 26%; border: 1.5px dashed color-mix(in srgb, var(--v5-ink) 24%, transparent); border-radius: 50%; }
.bundle-entry__ghost > * { position: relative; margin-top: 6%; }
.bundle-entry__stairs { position: absolute; right: 0; bottom: 0; display: flex; align-items: flex-end; gap: 8px; }
.bundle-entry__step { width: 48px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
/* Each rate is a stat figure (10.1 卡内主数值, JetBrains Mono for a non-money metric); the top rate is the card's one
   key number: brand and one step larger (the large discount figure, 10.2 exception pending). */
.bundle-entry__value { color: var(--v5-ink); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
.bundle-entry__minus { margin-right: -.18em; }
.bundle-entry__step.is-top .bundle-entry__value { font-size: 20px; line-height: 24px; color: var(--v5-brand); }
.bundle-entry__bar { width: 100%; height: max(4px, calc(var(--bundle-stair-max) * var(--bundle-bar))); border-radius: 10px 10px 4px 4px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--v5-ink) 14%, transparent), color-mix(in srgb, var(--v5-ink) 6%, transparent)); }
.bundle-entry__step.is-top .bundle-entry__bar { background: linear-gradient(180deg, color-mix(in srgb, var(--v5-tech-cyan) 60%, transparent), color-mix(in srgb, var(--v5-aura-sky) 12%, transparent)); }
.bundle-entry__step.is-current .bundle-entry__bar { background: linear-gradient(180deg, color-mix(in srgb, var(--v5-brand) 60%, transparent), color-mix(in srgb, var(--v5-brand) 12%, transparent)); }
.bundle-entry__label { color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space: nowrap; }
.bundle-entry__step.is-current .bundle-entry__value, .bundle-entry__step.is-current .bundle-entry__label { color: var(--v5-brand); }
.bundle-entry__step.is-current .bundle-entry__label { font-weight: 500; }
.bundle-entry__footer { margin: 16px 20px 0; padding-bottom: 16px; }
/* The draft's next step is the one sentence that asks for action, so it reads in the main ink. */
.nx-card-footer__note.bundle-entry__hint { color: var(--v5-ink); }
.bundle-entry .nx-card-action text { white-space: nowrap; }
@media (max-width: 374px) { .bundle-entry { --bundle-stair-max: 84px; --bundle-scale: .9; } }
</style>
