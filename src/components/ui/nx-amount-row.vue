<!--
  NxAmountRow — one "long name + amount" list row (design system 04.6 收益流水): the name keeps one line and ends in an
  ellipsis, the amount and its unit never break and stay right-aligned, so stacked rows form one amount column.
  Pass the amount already formatted and masked ("+0.029745 USDT", or "+0.029745" when a header row carries the unit). `detail` follows the name in the
  muted colour inside the same ellipsis ("SDXL · Demo Studio"); `time` adds a fixed clock column after the amount.
  `lines="2"` lets the name take a second line before the ellipsis, for narrow rows that also carry a time column.
  When every row has the same unit, write it once: put `<NxAmountRow header :amount="unit" />` first (pass `time=""` too
  when the rows have a time column, so the columns line up), give rows the bare number and `:unit` so screen readers
  still hear it. Lists that mix units keep the unit in each row's amount.
  Rows divide themselves; place them directly in one container.
-->
<template>
  <view class="nx-amount-row" :class="{ 'nx-amount-row--compact': compact, 'nx-amount-row--header': header }" :aria-hidden="header ? 'true' : undefined">
    <text class="nx-amount-row__name" :class="{ 'nx-amount-row__name--two': lines === 2 }">{{ name ?? "" }}<text v-if="detail" class="nx-amount-row__detail"> · {{ detail }}</text></text>
    <text class="nx-amount-row__amount" :class="{ 'nx-amount-row__amount--muted': tone === 'muted' }">{{ amount }}<text v-if="unit && !header" class="nx-sr-only"> {{ unit }}</text></text>
    <text v-if="time !== undefined" class="nx-amount-row__time">{{ time }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{ name?: string; amount: string; detail?: string; time?: string; unit?: string; header?: boolean; tone?: "success" | "muted"; compact?: boolean; lines?: 1 | 2 }>();
</script>

<style scoped>
.nx-amount-row { display: flex; align-items: center; gap: var(--v5-space-3); min-height: 44px; }
.nx-amount-row + .nx-amount-row { border-top: 1px solid var(--v5-border); }
/* uni <text> defaults to white-space: pre-line, so nowrap is set on each text, never inherited from the row. */
.nx-amount-row__name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 14px/20px var(--font-v5); color: var(--v5-ink); }
.nx-amount-row__name--two { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; overflow-wrap: break-word; }
.nx-amount-row__detail { font-weight: 400; color: var(--v5-ink-3); white-space: nowrap; }
.nx-amount-row__amount { flex: none; font: 500 14px/20px var(--font-metric); color: var(--v5-success-ink); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.nx-amount-row__amount--muted { color: var(--v5-ink-3); }
.nx-amount-row__time { flex: none; width: 38px; font: 400 12px/16px var(--font-metric); color: var(--v5-ink-4); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.nx-amount-row--header { min-height: 24px; }
.nx-amount-row--header .nx-amount-row__amount { font: 500 11px/16px var(--font-metric); color: var(--v5-ink-3); letter-spacing: .04em; }
.nx-amount-row--compact { gap: calc(var(--v5-space-2) + var(--v5-space-1) / 2); min-height: 36px; padding: var(--v5-space-1) 0; box-sizing: border-box; }
.nx-amount-row--compact .nx-amount-row__name { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-2); }
.nx-amount-row--compact .nx-amount-row__amount { font: 500 12px/16px var(--font-metric); }
.nx-amount-row--compact.nx-amount-row--header { min-height: 24px; padding: 0 0 var(--v5-space-1); }
.nx-amount-row--compact.nx-amount-row--header .nx-amount-row__amount { font: 500 11px/16px var(--font-metric); color: var(--v5-ink-3); }
</style>
