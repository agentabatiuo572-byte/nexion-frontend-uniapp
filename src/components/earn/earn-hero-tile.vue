<!--
  EarnHeroTile — the Earn tab's device-earnings tile (range total + UVT), the focal block of the bento.
  It owns the countUp renderjs module: uni binds a renderjs module to the component's root element,
  and the Earn page's root in the tab host is a Fragment, so the module must live on a single-root
  component like this one.
-->
<template>
  <view class="earn-tile--hero nx-tint" role="group" :aria-label="auditCopy.deviceRevenue">
    <view class="earn-hero__row">
      <view class="earn-hero__label"><text>{{ auditCopy.deviceRevenue }} · {{ periodLabel }}</text><DataVisibilityToggle class="earn-hero__eye" /></view>
      <text class="earn-scope">{{ auditCopy.revenueScope }}</text>
    </view>
    <view :id="totalCount.hostId" class="earn-hero__amount" aria-hidden="true" :count-up="totalCount.config.value" :change:count-up="countUp.update">
      <text v-if="!visibility.hidden" class="earn-hero__currency nx-count--prefix">{{ totalPrefix || '$' }}</text>
      <text v-if="visibility.hidden" class="earn-hero__int">{{ visibility.mask(totalInt) }}</text>
      <text v-else class="earn-hero__int nx-count--int">{{ totalInt }}</text>
      <text v-if="totalKnown && !visibility.hidden" class="earn-hero__dec nx-count--frac">.{{ totalCents }}</text>
    </view>
    <text class="nx-sr-only">{{ totalA11y }}</text>
    <text :id="nexCount.hostId" class="earn-hero__nex" aria-hidden="true" :count-up="nexCount.config.value" :change:count-up="countUp.update"><text class="nx-count--int">{{ visibility.mask(nex === null ? '—' : `+${nexFmt}`) }}</text><text class="earn-hero__nex-unit">UVT</text></text>
    <text class="nx-sr-only">{{ visibility.mask(nex === null ? '—' : `+${nexFmt}`) }} UVT</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatAmount } from "@/lib/amount-display";
import { formatUsdOverviewParts } from "@/lib/usd-display";
import { useViewCountUp } from "@/composables/use-count-up";
import { useAuditUiCopy } from "@/i18n/audit-ui";
import { useDataVisibility } from "@/store/data-visibility";
import DataVisibilityToggle from "@/components/ui/data-visibility-toggle.vue";

const props = defineProps<{ total: number | null; nex: number | null; periodLabel: string }>();
const visibility = useDataVisibility();
const auditCopy = useAuditUiCopy();

// Only the first figure counts up; a period switch during the count converges to the new value, a later one shows it directly.
const totalCount = useViewCountUp(() => props.total, "usd");
const totalParts = computed(() => formatUsdOverviewParts(props.total));
const totalKnown = computed(() => totalParts.value !== null);
const totalPrefix = computed(() => totalParts.value?.prefix ?? "");
const totalInt = computed(() => totalParts.value?.integer ?? "—");
const totalCents = computed(() => totalParts.value?.fraction ?? "");
// The visible digits count up in the view layer and are hidden from screen readers; this is the final text.
const totalA11y = computed(() => visibility.hidden ? visibility.mask(totalInt.value)
  : totalKnown.value ? `${totalPrefix.value || "$"}${totalInt.value}.${totalCents.value}` : "—");
const nexCount = useViewCountUp(() => props.nex, "plus");
const nexFmt = computed(() => props.nex === null ? "—" : formatAmount(props.nex));
</script>

<script module="countUp" lang="renderjs">
import { countUpView } from "@/lib/count-up-view";
// @ts-expect-error vue-tsc 1.x treats uni's renderjs custom block as a second normal script.
export default countUpView;
</script>

<style scoped>
/* Earn's focal block: the big tile keeps its original amber as a tinted solid (01 §1.1.2); the other tiles stay neutral. */
.earn-tile--hero { position: relative; min-width: 0; box-sizing: border-box; overflow: hidden; --nx-tint: var(--v5-warning); grid-column: 1 / -1; padding: 16px 18px 18px; border-radius: 24px; }
.earn-hero__row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.earn-hero__label { display: flex; align-items: center; gap: 2px; min-width: 0; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-2); }
.earn-hero__eye { margin: -12px 0; color: var(--v5-ink-3); }
.earn-scope { color: var(--v5-ink-2); font: 400 12px/16px var(--font-v5); text-align: right; max-width: 50%; }
.earn-hero__amount { position: relative; display: flex; align-items: baseline; gap: 4px; margin-top: 10px; font-family: var(--font-amount); font-weight: 600; letter-spacing: -.024em; line-height: 1; color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.earn-hero__currency { font-size: 20px; font-weight: 500; color: var(--v5-ink-3); }
/* -0.024em is set on each part so it scales with that part's size (em letter-spacing inherits as a fixed length). */
.earn-hero__int { font-size: 52px; letter-spacing: -.024em; }
.earn-hero__dec { font-size: 34px; color: var(--v5-ink-3); letter-spacing: -.024em; }
.earn-hero__nex { position: relative; display: block; margin-top: 10px; font: 600 15px/20px var(--font-metric); color: var(--v5-nex-ink); font-variant-numeric: tabular-nums; }
.earn-hero__nex-unit { margin-left: 3px; font: 500 12px/16px var(--font-v5); letter-spacing: .04em; }
@media (max-width: 374px) {
  .earn-hero__int { font-size: 46px; }
}
</style>
