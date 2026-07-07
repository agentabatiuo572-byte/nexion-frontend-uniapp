<!--
  TradeinWindowBanner — FEAT-DEV02 升级置换横幅(/store 顶部)。
  旧版按平台 phase + 代际固定抵扣($300/$800)已删;现按「用户最优可置换设备」
  动态派生:可抵额 = 阶梯引擎真值,目标 = 该设备最低升级价 SKU。无合格设备即隐藏。
  Tapping routes to /me/devices (the trade-in entry).
-->
<template>
  <view v-if="best" class="mb-3">
    <view class="block relative overflow-hidden" :style="rootStyle" role="button" tabindex="0" :aria-label="w.cta" @click.stop="go">
      <view class="absolute inset-0 pointer-events-none" :style="radialStyle" />

      <view class="relative flex items-center gap-1.5" :style="labelStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="m16 12-4-4-4 4" /><path d="M12 16V8" /></svg>
        <text>{{ w.label }}</text>
      </view>

      <text class="block relative mt-2" style="font-size: 18px; font-weight: 600; color: var(--v5-ink); line-height: 1.2">{{ title }}</text>
      <text class="block relative mt-1.5" style="font-size: 12px; color: var(--v5-ink-3); line-height: 1.4">{{ body }}</text>

      <view class="relative mt-3 flex items-center justify-end">
        <view class="inline-flex items-center gap-1.5" :style="ctaStyle">
          <text>{{ w.cta }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
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
import { PRODUCTS } from "@/mock/products";
import { computeTradeInCredit, TRADEIN_LADDER_RULES } from "@/mock/tradein-config";
import { navTo } from "@/lib/route";

const t = useT();
const app = useApp();
const w = computed(() => t.value.store.tradeinUpgrade);

// 最优可置换设备:抵扣额最高者;目标取其最低升级价 SKU(最易达成的下一档)。
const best = computed(() => {
  let out: { name: string; credit: number; target: string; net: number } | null = null;
  for (const d of app.visibleDevices) {
    const paid = d.paidPriceUsdt ?? 0;
    if (paid <= 0 || !TRADEIN_LADDER_RULES.applyTo.includes(d.kind)) continue;
    const targets = PRODUCTS.filter((p) => p.price > paid);
    if (targets.length === 0) continue;
    const target = targets.reduce((a, b) => (a.price < b.price ? a : b));
    const credit = computeTradeInCredit(
      paid,
      Math.max(0, d.cumulativeEarningsUsdt ?? 0),
      target.price,
    );
    if (credit <= 0) continue;
    if (!out || credit > out.credit) {
      out = {
        name: d.name,
        credit,
        target: target.name,
        net: Math.max(0, +(target.price - credit).toFixed(2)),
      };
    }
  }
  return out;
});

const title = computed(() =>
  best.value
    ? fmt(w.value.title, { name: best.value.name, credit: best.value.credit.toFixed(2) })
    : "",
);
const body = computed(() =>
  best.value
    ? fmt(w.value.body, { target: best.value.target, net: best.value.net.toLocaleString() })
    : "",
);

const rootStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "16px",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 40%, transparent)",
  background:
    "linear-gradient(160deg, color-mix(in srgb, var(--v5-brand-2) 14%, transparent) 0%, var(--v5-surface) 70%)",
};

const radialStyle: CSSProperties = {
  background:
    "radial-gradient(60% 80% at 95% 0%, color-mix(in srgb, var(--v5-brand-2) 20%, transparent), transparent 70%)",
};

const labelStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
};

const ctaStyle: CSSProperties = {
  height: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand-2)",
  fontSize: "12.5px",
  fontWeight: 600,
};

function go() {
  navTo("/me/devices");
}
</script>
