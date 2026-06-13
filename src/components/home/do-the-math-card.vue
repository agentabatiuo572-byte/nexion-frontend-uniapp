<!--
  DoTheMathCard — ZONE 5 upgrade ROI math (ported from mission-control.tsx
  DoTheMathCard + MathBar inline). Headline compares the next tier vs the user's
  current device (colored inline spans rendered via a placeholder-segment split
  so word order works in any locale), two rate bars, a 3-stat grid, and a CTA.
  Hidden at top tier (multiplier 0). Grid bg uses the brand token (theme-aware)
  rather than the source's hardcoded light-blue rgba (would leak in dark).
-->
<template>
  <view v-if="promo.multiplier !== 0">
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.doMathTitle }}</text>
      <text class="font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.home.doMathInteractive }}</text>
    </view>

    <view class="relative overflow-hidden" style="background: var(--v5-surface); border: 1px solid var(--v5-border); border-radius: 16px; padding: 16px">
      <view :style="gridBgStyle" />
      <view class="relative">
        <view style="font-family: var(--font-v5); font-weight: 600; font-size: 18px; color: var(--v5-ink); letter-spacing: -0.018em; line-height: 1.35">
          <text v-for="(s, i) in headlineSegs" :key="i" :style="s.color ? { color: s.color } : {}">{{ s.text }}</text>
        </view>

        <view class="mt-4 flex flex-col gap-2.5">
          <!-- base rate bar -->
          <view>
            <view class="flex justify-between items-baseline font-mono-tabular mb-1" style="font-size: 12px; color: var(--v5-ink-3)">
              <text style="color: var(--v5-ink-3)">{{ baseShort }}</text>
              <text class="tabular-nums" style="color: var(--v5-ink); font-weight: 500">{{ baseRate }}</text>
            </view>
            <view class="rounded-full overflow-hidden" style="height: 3px; background: var(--v5-surface-3)">
              <view class="h-full rounded-full" :style="{ width: baseWidthPct + '%', background: 'var(--v5-ink-4)', opacity: 0.72 }" />
            </view>
          </view>
          <!-- target rate bar -->
          <view>
            <view class="flex justify-between items-baseline font-mono-tabular mb-1" style="font-size: 12px; color: var(--v5-ink-3)">
              <text style="color: var(--v5-brand)">{{ promo.targetName }}</text>
              <text class="tabular-nums" style="color: var(--v5-ink); font-weight: 500">{{ targetRate }}</text>
            </view>
            <view class="rounded-full overflow-hidden" style="height: 3px; background: var(--v5-surface-3)">
              <view class="h-full rounded-full" style="width: 100%; background: linear-gradient(90deg, var(--v5-brand), var(--v5-success)); opacity: 0.72" />
            </view>
          </view>
        </view>

        <view class="mt-4 pt-3 grid grid-cols-3" style="border-top: 1px dashed var(--v5-border-strong)">
          <view v-for="s in stats" :key="s.k">
            <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-4)">{{ s.k }}</text>
            <text class="block tabular-nums" :style="{ marginTop: '3px', fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '18px', color: s.tone, letterSpacing: '-0.014em' }">{{ s.v }}</text>
          </view>
        </view>

        <view class="mt-3.5 w-full flex items-center justify-center gap-1.5 active:opacity-80 transition-opacity" style="padding: 11px 16px; border-radius: 999px; background: var(--v5-brand-soft); color: var(--v5-brand); border: 1px solid var(--v5-brand-border); font-family: var(--font-v5); font-weight: 600; font-size: 13.5px; letter-spacing: -0.005em" @click="goStore">
          <text style="color: var(--v5-brand)">{{ t.home.doMathSeeCta }}</text>
          <text class="font-mono-tabular" style="opacity: 0.8; font-size: 12px; color: var(--v5-brand)">→</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { derivePromoUpgrade } from "@/store/device-types";

const t = useT();
const app = useApp();

const promo = computed(() => derivePromoUpgrade(app.devices));
const baseShort = computed(() => (promo.value.baseKind === "phone" ? "phone" : promo.value.baseName));
const baseWidthPct = computed(() => Math.max(0.4, (promo.value.baseDaily / promo.value.targetDaily) * 100));
const baseRate = computed(() => `$${promo.value.baseDaily.toFixed(2)} /d`);
const targetRate = computed(() => `$${promo.value.targetDaily.toFixed(2)} /d`);

// Render the headline by splitting the i18n template around {target}/{mult}/{base}
// placeholders → colored segments. Works regardless of per-locale word order.
const headlineSegs = computed(() => {
  const tpl = t.value.home.doMathHeadline;
  const vars: Record<string, { text: string; color: string }> = {
    target: { text: promo.value.targetName, color: "var(--v5-ink)" },
    mult: { text: `${promo.value.multiplier}×`, color: "var(--v5-success)" },
    base: { text: baseShort.value, color: "var(--v5-brand-2)" },
  };
  const segs: { text: string; color?: string }[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl)) !== null) {
    if (m.index > last) segs.push({ text: tpl.slice(last, m.index) });
    const v = vars[m[1]];
    segs.push(v ? { text: v.text, color: v.color } : { text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < tpl.length) segs.push({ text: tpl.slice(last) });
  return segs;
});

const stats = computed(() => [
  { k: t.value.home.doMathDaily, v: `$${promo.value.targetDaily.toFixed(2)}`, tone: "var(--v5-ink)" },
  { k: t.value.home.doMathPayback, v: `${promo.value.targetPayback} d`, tone: "var(--v5-brand)" },
  { k: fmt(t.value.home.doMathVs, { base: baseShort.value }), v: `${promo.value.multiplier}×`, tone: "var(--v5-success)" },
]);

const gridBgStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  backgroundImage:
    "linear-gradient(to right, color-mix(in oklab, var(--v5-brand) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--v5-brand) 6%, transparent) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  pointerEvents: "none",
  opacity: 0.6,
};

function goStore() {
  uni.navigateTo({ url: `/pages/store/detail?id=${promo.value.targetKind}`, fail: () => {} });
}
</script>
