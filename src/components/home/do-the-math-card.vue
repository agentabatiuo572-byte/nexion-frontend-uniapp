<!--
  DoTheMathCard — ZONE 5 upgrade ROI math (ported from mission-control.tsx
  DoTheMathCard + MathBar inline). Headline compares the next tier vs the user's
  current device (colored inline spans rendered via a placeholder-segment split
  so word order works in any locale), two rate bars, a 3-stat grid, and a CTA.
  Hidden at top tier (multiplier 0). Grid bg uses the brand token (theme-aware)
  rather than the source's hardcoded light-blue rgba (would leak in dark).
-->
<template>
  <view v-if="promo.multiplier !== 0" class="do-math">
    <view class="do-math__header">
      <text class="do-math__title">{{ t.home.doMathTitle }}</text>
    </view>

    <view class="do-math-card">
      <view class="do-math-card__grid" />
      <view class="do-math-card__content">
        <view class="do-math-headline">
          <text v-for="(s, i) in headlineSegs" :key="i" :class="s.kind ? `do-math-headline__${s.kind}` : ''">{{ s.text }}</text>
        </view>

        <view class="do-math-bars">
          <view class="do-math-bar">
            <view class="do-math-bar__row">
              <text class="do-math-bar__label">{{ baseShort }}</text>
              <text class="do-math-bar__amount">{{ baseRate }}</text>
            </view>
            <view class="do-math-bar__track">
              <view class="do-math-bar__fill do-math-bar__fill--base" :style="{ width: baseWidthPct + '%' }" />
            </view>
          </view>
          <view class="do-math-bar">
            <view class="do-math-bar__row">
              <text class="do-math-bar__label do-math-bar__label--target">{{ promo.targetName }}</text>
              <text class="do-math-bar__amount">{{ targetRate }}</text>
            </view>
            <view class="do-math-bar__track">
              <view class="do-math-bar__fill do-math-bar__fill--target" />
            </view>
          </view>
        </view>

        <view class="do-math-stats">
          <view v-for="s in stats" :key="s.k" class="do-math-stat">
            <text class="do-math-stat__label">{{ s.k }}</text>
            <text class="do-math-stat__value" :style="{ color: s.tone }">{{ s.v }}</text>
          </view>
        </view>

        <view class="do-math-cta" :class="{ 'do-math-cta--light': theme.mode === 'light' }" @click="goStore">
          <view class="do-math-cta__inner">
            <text class="do-math-cta__label">{{ t.home.doMathSeeCta }}</text>
            <view class="do-math-cta__arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { derivePromoUpgrade } from "@/store/device-types";
import { useTheme } from "@/store/theme";

const t = useT();
const app = useApp();
const theme = useTheme();

const promo = computed(() => derivePromoUpgrade(app.visibleDevices));
const baseShort = computed(() => (promo.value.baseKind === "phone" ? "phone" : promo.value.baseName));
const baseWidthPct = computed(() => Math.max(0.4, (promo.value.baseDaily / promo.value.targetDaily) * 100));
const baseRate = computed(() => `$${promo.value.baseDaily.toFixed(2)} /天`);
const targetRate = computed(() => `$${promo.value.targetDaily.toFixed(2)} /天`);

// Render the headline by splitting the i18n template around {target}/{mult}/{base}
// placeholders → colored segments. Works regardless of per-locale word order.
const headlineSegs = computed(() => {
  const tpl = t.value.home.doMathHeadline;
  const vars: Record<string, { text: string; kind?: "target" | "mult" | "base" }> = {
    target: { text: promo.value.targetName, kind: "target" },
    mult: { text: `${promo.value.multiplier}×`, kind: "mult" },
    base: { text: baseShort.value, kind: "base" },
  };
  const segs: { text: string; kind?: "target" | "mult" | "base" }[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl)) !== null) {
    if (m.index > last) segs.push({ text: tpl.slice(last, m.index) });
    const v = vars[m[1]];
    segs.push(v ? { text: v.text, kind: v.kind } : { text: m[0] });
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

function goStore() {
  uni.navigateTo({ url: `/pages/store/detail?id=${promo.value.targetKind}`, fail: () => {} });
}
</script>

<style scoped>
.do-math__header {
  margin: 0 2px 16px;
}

.do-math__title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--v5-ink);
}

.do-math-card {
  position: relative;
  overflow: hidden;
  padding: 16px;
  border-radius: 16px;
  background: var(--v5-surface-bg);
  box-shadow: none;
}

.do-math-card__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.6;
  background-image:
    linear-gradient(to right, color-mix(in oklab, var(--v5-brand) 6%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklab, var(--v5-brand) 6%, transparent) 1px, transparent 1px);
  background-size: 24px 24px;
}

.do-math-card__content {
  position: relative;
  z-index: 1;
}

.do-math-headline {
  font-family: var(--font-v5);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.018em;
  color: var(--v5-ink);
}

.do-math-headline__base {
  color: var(--v5-brand-2);
}

.do-math-headline__mult {
  color: var(--v5-success);
}

.do-math-headline__target {
  color: var(--v5-ink);
}

.do-math-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.do-math-bar__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--v5-ink-3);
}

.do-math-bar__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--v5-ink-3);
}

.do-math-bar__label--target {
  color: var(--v5-brand);
}

.do-math-bar__amount {
  flex-shrink: 0;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--v5-ink);
}

.do-math-bar__track {
  overflow: hidden;
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: var(--v5-surface-3);
}

.do-math-bar__fill {
  height: 100%;
  border-radius: inherit;
  opacity: 0.72;
}

.do-math-bar__fill--base {
  background: var(--v5-ink-4);
}

.do-math-bar__fill--target {
  width: 100%;
  background: linear-gradient(90deg, var(--v5-brand), var(--v5-success));
}

.do-math-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--v5-border-strong);
}

.do-math-stat {
  min-width: 0;
}

.do-math-stat__label {
  display: block;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--v5-ink-4);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.do-math-stat__value {
  display: block;
  margin-top: 3px;
  font-family: var(--font-v5);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.014em;
  font-variant-numeric: tabular-nums;
}

.do-math-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  margin-top: 16px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--v5-brand);
  color: var(--v5-on-brand);
  box-shadow: none;
  box-sizing: border-box;
  transition: opacity 0.16s ease;
}

.do-math-cta:active {
  opacity: 0.8;
}

.do-math-cta__inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transform: translateX(4px);
}

.do-math-cta__label {
  font-family: var(--font-v5);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.005em;
  color: currentColor;
  transform: translateX(-2px);
}

.do-math-cta__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  color: currentColor;
  opacity: 0.9;
}

.do-math-cta__arrow svg {
  display: block;
  width: 10px;
  height: 10px;
}

.do-math-cta--light {
  border: 1px solid rgba(77,139,255,0.75);
  background: linear-gradient(135deg, #4D8BFF 0%, #176DFF 100%);
  color: #FFFFFF;
  box-shadow: 0 0 18px rgba(77,139,255,0.32);
}
</style>
