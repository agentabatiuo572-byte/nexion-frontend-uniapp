<template>
  <view class="tdp" :class="{ 'tdp--locked': locked }">
    <text class="tdp__title">{{ copy.selectTitle }}</text>
    <text class="tdp__sub">{{ copy.selectSubtitle }}</text>
    <view v-if="locked" id="tdp-lock-note" class="tdp__lock">
      <svg class="tdp__lock-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      <text>{{ copy.lockNote }}</text>
    </view>
    <!-- Still placeholders while the first read is pending or keeps failing; a refresh over a filled list keeps the rows (03 §3.4). -->
    <view v-if="showSkeleton" class="tdp__list" aria-hidden="true">
      <view v-for="n in 3" :key="n" class="tdp-row tdp-row--skel"><view class="tdp-row__body"><view class="tdp-row__thumb" /><view class="tdp-row__main"><view class="tdp-row__skel tdp-row__skel--name" /><view class="tdp-row__skel tdp-row__skel--meta" /></view><view class="tdp-row__skel tdp-row__skel--price" /></view></view>
    </view>
    <!-- The lock is said on every radio (aria-disabled) and once for the group (describedby): an aria-disabled group would also
         disable the conditions link, which is the radio's sibling and stays usable (03 §3.5 单选行). -->
    <view v-else class="tdp__list" role="radiogroup" :aria-label="copy.selectTitle" :aria-describedby="locked ? 'tdp-lock-note' : undefined">
      <view v-for="row in rows" :key="row.option.productNo" class="tdp-row" :class="{ 'tdp-row--on': row.checked, 'tdp-row--off': !row.option.canBuy, 'tdp-row--tag': row.option.isTrialProduct, 'tdp-row--link': row.link, 'tdp-row--claim': row.claimPrice }">
        <view class="tdp-row__body" role="radio" :data-product-no="row.option.productNo" :aria-checked="row.checked ? 'true' : 'false'" :aria-disabled="row.selectable ? undefined : 'true'" :aria-label="row.aria" :tabindex="row.productNo === tabStop ? 0 : -1"
          @click="choose(row)" @keydown.space.stop.prevent="choose(row)" @keydown.enter.stop.prevent="choose(row)"
          @keydown.down.stop.prevent="move(row, 1)" @keydown.right.stop.prevent="move(row, 1)" @keydown.up.stop.prevent="move(row, -1)" @keydown.left.stop.prevent="move(row, -1)">
          <view class="tdp-row__thumb" aria-hidden="true"><image v-if="row.option.imageUrl" class="tdp-row__img" :src="row.option.imageUrl" mode="aspectFit" /></view>
          <view class="tdp-row__main">
            <text class="tdp-row__name">{{ row.option.productName }}</text>
            <view v-if="row.option.isTrialProduct" class="tdp-row__tagline"><NxTag tone="neutral">{{ copy.thisTrialTag }}</NxTag></view>
            <text v-if="row.reason" class="tdp-row__meta">{{ row.reason }}</text>
            <text v-else-if="row.estimate" class="tdp-row__meta"><text class="tdp-row__est-line">{{ row.estimate.label }}<text class="tdp-row__est">{{ row.estimate.value }}</text></text></text>
            <!-- Room for the conditions link, which is the radio's sibling (03 §3.5 单选行). -->
            <view v-if="row.link" class="tdp-row__link-space" />
          </view>
          <view v-if="row.due" class="tdp-row__price">
            <text class="tdp-row__due"><text class="tdp-row__cur">$</text>{{ row.due.whole }}<text class="tdp-row__dec">{{ row.due.decimals }}</text></text>
            <!-- A view, not a text: a uni <text> wraps its children in one span, which would leave the flex line with a single item. -->
            <view class="tdp-row__was" :class="{ 'tdp-row__was--claim': row.claimPrice }"><text v-if="row.claimPrice" class="tdp-row__claim">{{ copy.claimPrice }}</text><text class="tdp-row__strike">{{ row.was }}</text></view>
          </view>
          <text v-else-if="row.quoteFailed" class="tdp-row__unknown">—</text>
          <view class="tdp-row__radio" aria-hidden="true" />
        </view>
        <view v-if="row.link" class="tdp-row__link" role="link" tabindex="0" @click="emit('openConditions', row.option.productNo)" @keydown.enter.stop.prevent="emit('openConditions', row.option.productNo)"><text class="nx-after-chevron">{{ copy.viewConditions }}</text></view>
      </view>
    </view>
    <view v-if="showBalanceNote" class="tdp__note">
      <svg class="tdp__note-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v1" /><path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3" /><path d="M20 11h-4a2 2 0 0 0 0 4h4z" /></svg>
      <text>{{ copy.otherBalanceOnly }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
// 试用详情「专享限时折扣设备」选择区 (04 §4.6 试用详情与试用抵扣购买; 03 §3.5 单选行). Display only: the parent owns the
// read, the selection and the rule for when the section is shown at all; this renders what it is given.
import { computed } from "vue";
import type { TrialPurchaseOption } from "@/api/trial-api";
import NxTag from "@/components/ui/nx-tag.vue";
import { useTrialDetailCopy } from "@/i18n/trial-detail";
import { useT } from "@/i18n/use-t";
import { formatGroupedAmount } from "@/lib/amount-display";
import { formatEstimateRange } from "@/lib/estimate-display";
import { trialPurchaseReasonMessage } from "@/lib/trial-purchase-reason";
import { trialOptionReadFailed } from "@/store/trial-purchase-options";

const props = withDefaults(defineProps<{
  /** Rows in display order (the store already puts the user's trial device first, the rest by price). */
  options: TrialPurchaseOption[];
  selectedProductNo: string | null;
  status: "idle" | "unsupported" | "not-convertible" | "loading" | "ready" | "failed";
  /** A payment for this trial is in progress: every row at 50%, nothing checked, the reason under the title. */
  locked?: boolean;
  /** Daily estimate per productNo from the catalog; rows without one show no estimate line. */
  estimates?: Record<string, { low: number; high: number }>;
  /** productNos whose product detail is reachable; omitted = every row refused for unmet requirements gets the link. */
  conditionLinks?: string[];
}>(), { locked: false });
const emit = defineEmits<{ (event: "select", productNo: string): void; (event: "openConditions", productNo: string): void }>();
const copy = useTrialDetailCopy();
const t = useT();
function amountParts(value: number) {
  const text = formatGroupedAmount(value, 2);
  const at = text.indexOf(".");
  return at < 0 ? { whole: text, decimals: "" } : { whole: text.slice(0, at), decimals: text.slice(at) };
}

const showSkeleton = computed(() => props.options.length === 0 && (props.status === "loading" || props.status === "failed" || props.status === "idle"));
const rows = computed(() => props.options.map(option => {
  const selectable = option.canBuy && !props.locked;
  const quoteFailed = trialOptionReadFailed(option);
  const reason = option.canBuy ? "" : quoteFailed ? copy.value.quoteFailed
    : trialPurchaseReasonMessage(t.value, option.reasonCode) ?? copy.value.optionUnavailable;
  const range = props.estimates?.[option.productNo];
  // A symbol label (≈) reads without the separating dot (board note 14).
  const estimate = range ? { label: /^\p{L}/u.test(copy.value.estShort) ? `${copy.value.estShort} · ` : `${copy.value.estShort} `,
    value: `$${formatEstimateRange(range.low, range.high)}${t.value.store.cardPerDaySuffix}` } : null;
  const due = option.canBuy && option.quote ? amountParts(option.quote.amountUSD) : null;
  const was = option.priceUSD === null ? "" : `$${formatGroupedAmount(option.priceUSD, 2)}`;
  const claimPrice = option.isTrialProduct && option.marketPriceUSD !== undefined && option.marketPriceUSD !== option.priceUSD;
  const link = option.reasonCode === "PURCHASE_GATE_NOT_MET" && (props.conditionLinks?.includes(option.productNo) ?? true);
  const checked = !props.locked && option.canBuy && option.productNo === props.selectedProductNo;
  const aria = [option.productName, option.isTrialProduct ? copy.value.thisTrialTag : "", reason || (estimate ? estimate.label + estimate.value : ""),
    due ? `${copy.value.finalPrice} $${due.whole}${due.decimals}` : "", due ? `${claimPrice ? copy.value.claimPrice : copy.value.unitPrice} ${was}` : ""].filter(Boolean).join(", ");
  return { option, productNo: option.productNo, selectable, quoteFailed, reason, estimate, due, was, claimPrice, link, checked, aria };
}));
// Roving tab stop: the checked row, else the first selectable one (03 §3.5).
const tabStop = computed(() => rows.value.find(row => row.checked)?.productNo ?? rows.value.find(row => row.selectable)?.productNo ?? null);
const showBalanceNote = computed(() => !showSkeleton.value && props.options.some(option => !option.isTrialProduct) && props.options.some(option => option.canBuy));

function choose(row: { selectable: boolean; productNo: string }) {
  if (row.selectable) emit("select", row.productNo);
}
/** Arrow keys move to the next selectable row and select it, skipping rows that cannot be chosen. */
function move(row: { productNo: string }, delta: number) {
  const enabled = rows.value.filter(item => item.selectable);
  if (!enabled.length) return;
  const from = rows.value.findIndex(item => item.productNo === row.productNo);
  const ordered = delta > 0 ? [...rows.value.slice(from + 1), ...rows.value.slice(0, from + 1)] : [...rows.value.slice(0, from).reverse(), ...rows.value.slice(from).reverse()];
  const next = ordered.find(item => item.selectable);
  if (!next) return;
  emit("select", next.productNo);
  // uni-app hands handlers a normalized target: find the radio through the focused element's group.
  const group = (document.activeElement as HTMLElement | null)?.closest('[role="radiogroup"]');
  group?.querySelector<HTMLElement>(`[role="radio"][data-product-no="${next.productNo}"]`)?.focus();
}
</script>

<style scoped>
.tdp { min-width: 0; }
.tdp__title { display: block; color: var(--v5-ink); font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.tdp__sub { display: block; margin-top: 4px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); overflow-wrap: break-word; }
.tdp__lock { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.tdp__lock-icon { flex: none; width: 16px; height: 16px; margin-top: 2px; }
.tdp__list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.tdp__note { display: flex; align-items: center; gap: 6px; margin-top: 12px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.tdp__note-icon { flex: none; width: 14px; height: 14px; }

/* One row = a solid card (01 §1.1.2 纯色) holding the radio; the selected row is brand 10% with a 1.5px brand inner edge, no movement. */
.tdp-row { position: relative; border-radius: 16px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .tdp-row { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.tdp-row--on { background: color-mix(in srgb, var(--v5-brand) 10%, var(--v5-surface)); }
.tdp-row--on, [data-theme="light"] .tdp-row--on { box-shadow: inset 0 0 0 1.5px var(--v5-brand); }
.tdp-row__body { display: flex; align-items: center; gap: 12px; box-sizing: border-box; min-height: 72px; padding: 12px 14px 12px 12px; border-radius: inherit; cursor: pointer; }
.tdp-row--tag .tdp-row__body { min-height: 94px; }
.tdp-row__body[aria-disabled="true"] { cursor: default; }
.tdp-row__body:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; }
.tdp-row__body:active:not([aria-disabled="true"]) { opacity: .85; }
/* Device art has no backing block (01 §1.3); one draw size for every SKU, shifted up so the machine, not the image box, sits on the row's centre line. */
.tdp-row__thumb { position: relative; flex: none; width: 76px; height: 48px; }
.tdp-row__img { position: absolute; left: 50%; top: 50%; width: 96px; height: 96px; transform: translate(-50%, calc(-50% - 7px)); pointer-events: none; }
.tdp-row__main { flex: 1; min-width: 0; }
/* With 「领取时价格」 the name column is never narrower than its estimate line, so the price column, not the estimate, gives way. */
.tdp-row--claim .tdp-row__main { min-width: auto; }
.tdp-row__name { display: block; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
/* The trial tag holds its own line under the name in every language and width (03 §3.5). */
.tdp-row__tagline { display: flex; margin-top: 4px; }
.tdp-row__meta { display: block; margin-top: 4px; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; }
/* Label, dot and amount never break apart (04 §4.6 商品卡预估). */
.tdp-row__est-line, .tdp-row__est { white-space: nowrap; }
.tdp-row__est { color: var(--v5-ink); }
.tdp-row__link-space { height: 22px; }
.tdp-row__price { flex: 0 1 auto; display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
/* Proportional Montserrat digits as on the approved board: tabular figures widen the column ~9px and push names onto a second line at 360. */
.tdp-row__due { color: var(--v5-ink); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); white-space: nowrap; }
.tdp-row__cur { margin-right: 1px; color: var(--v5-ink-3); font-size: var(--ui-type-meta); }
.tdp-row__dec { color: var(--v5-ink-3); }
.tdp-row__was { margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space: nowrap; }
/* 「领取时价格」 sits beside the struck price while the row has the room and moves to its own line above it when it does
   not: the price column only takes what the name column leaves, so the measured width decides, in every language.
   The label breaks only between words. */
.tdp-row__was--claim { display: flex; flex-wrap: wrap; justify-content: flex-end; column-gap: 4px; white-space: normal; }
.tdp-row__claim { white-space: normal; text-align: right; }
.tdp-row__strike { text-decoration: line-through; white-space: nowrap; }
.tdp-row__unknown { flex: none; color: var(--v5-ink-3); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-v5); }
.tdp-row__radio { flex: none; width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--v5-ink-3); display: grid; place-items: center; }
.tdp-row--on .tdp-row__radio { box-shadow: inset 0 0 0 2px var(--v5-brand); }
.tdp-row--on .tdp-row__radio::after { content: ""; width: 12px; height: 12px; border-radius: 50%; background: var(--v5-brand); }
/* A row that cannot be chosen: art greyed at 50%, weaker circle, name in the secondary ink; reason and link keep full contrast. */
.tdp-row--off .tdp-row__img { filter: grayscale(1); opacity: .5; }
.tdp-row--off .tdp-row__name { color: var(--v5-ink-3); }
.tdp-row--off .tdp-row__radio { opacity: .5; box-shadow: inset 0 0 0 1.5px var(--v5-ink-4); }
/* The whole group is paused while a payment runs. */
.tdp--locked .tdp-row { opacity: .5; }
.tdp--locked .tdp-row__body { cursor: default; }
/* The conditions link sits over the row as the radio's sibling, aligned with the text column; 44px tall hit area. */
.tdp-row__link { position: absolute; left: 100px; bottom: 0; display: flex; align-items: flex-end; box-sizing: border-box; min-height: 44px; padding-bottom: 12px; color: var(--v5-ink-3); font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); white-space: nowrap; cursor: pointer; }
.tdp-row__link:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 6px; }
.tdp-row__link > text { white-space: nowrap; }
/* Static placeholders (same art slot and row height). */
.tdp-row--skel .tdp-row__body { cursor: default; }
.tdp-row--skel .tdp-row__thumb { border-radius: 12px; background: var(--v5-surface-2); }
.tdp-row__skel { height: 12px; border-radius: 6px; background: var(--v5-surface-2); }
.tdp-row__skel--name { width: 56%; }
.tdp-row__skel--meta { width: 34%; margin-top: 10px; }
.tdp-row__skel--price { flex: none; width: 60px; margin-right: 8px; }
@media (max-width: 374px) {
  .tdp-row--tag .tdp-row__body { min-height: 92px; }
  .tdp-row__thumb { width: 60px; }
  .tdp-row__img { width: 80px; height: 80px; transform: translate(-50%, calc(-50% - 6px)); }
  .tdp-row__link { left: 84px; }
}
</style>
