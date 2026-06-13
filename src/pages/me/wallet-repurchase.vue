<!--
  Re-invest Boost (ported from Nexion-prototype/app/(main)/me/wallet/repurchase/page.tsx).
  Funnels into another buy-in: +50 pts on $100, 90d lock at 35% APY, 1.5× cultivation,
  Genesis lottery ticket. Cross-store orchestration in handler (debit + points.earn +
  stake + bills.add). framer stagger → CSS nx-step-in. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/wallet" />
      <view class="px-4 flex items-center justify-end" style="padding-top: 8px; padding-bottom: 8px">
        <view class="flex items-center active:scale-[0.98]" :style="howLinkStyle" @click="goHow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
          <text style="margin: 0 6px">{{ w.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- hero -->
        <view :style="heroStyle">
          <view class="flex items-center" style="gap: 8px">
            <view class="grid place-items-center" :style="heroIconBoxStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
            </view>
            <view>
              <text class="block" :style="heroTitleStyle">{{ w.hero }}</text>
              <text class="block" :style="heroPtsStyle">{{ currentPtsLine }}</text>
            </view>
          </view>

          <view class="grid grid-cols-2" :style="benefitsGridStyle">
            <view v-for="(b, i) in benefitTiles" :key="b.text" class="flex items-center nx-step-in" :style="benefitStyle(b.tint, i)">
              <view v-html="b.icon" />
              <text :style="benefitTextStyle">{{ b.text }}</text>
            </view>
          </view>
        </view>

        <!-- amount input -->
        <view :style="cardStyle" style="padding: 20px">
          <text class="block" :style="monoLabelStyle">{{ w.amountLabel }}</text>
          <view class="flex items-baseline" style="gap: 8px; margin-top: 8px">
            <text class="shrink-0" :style="dollarStyle">$</text>
            <input
              :value="String(amount)"
              type="digit"
              :style="amountInputStyle"
              @input="onAmount"
            />
            <text class="shrink-0" :style="usdtStyle">USDT</text>
          </view>
          <view class="grid grid-cols-4" style="gap: 8px; margin-top: 12px">
            <view v-for="p in presets" :key="p" :style="presetStyle(amount === p)" @click="amount = p">
              <text>${{ p }}</text>
            </view>
          </view>
          <view style="margin-top: 12px">
            <text :style="balanceLabelStyle">{{ w.balanceLabel }}</text>
            <text :style="balanceValueStyle"> ${{ user.usdtBalance.toFixed(2) }}</text>
          </view>
        </view>

        <!-- projection -->
        <view :style="cardStyle" style="padding: 16px">
          <text class="block" :style="monoLabelStyle">{{ w.after90 }}</text>
          <view style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px">
            <Row :label="w.principal" :value="`$${amount.toFixed(2)}`" />
            <Row :label="w.interest" :value="`+$${projectedYield.toFixed(2)}`" tint="var(--v5-brand)" />
            <Row :label="w.contribPts" :value="`+${earnPoints} pts`" tint="var(--v5-warning)" />
            <view :style="dividerStyle" />
            <Row :label="w.unlockable" :value="`$${(amount + projectedYield).toFixed(2)}`" bold />
          </view>
        </view>

        <!-- CTA -->
        <view class="nx-repurchase-submit-cta w-full flex items-center justify-center active:scale-[0.98]" :style="ctaStyle" @click="handleRepurchase">
          <text>{{ ctaLabel }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="canSubmit ? 'var(--v5-ink)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>

        <text class="block" :style="lockedNoticeStyle">{{ w.lockedNotice }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import Row from "@/components/me/repurchase-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { usePoints } from "@/store/points";
import { useStaking } from "@/store/staking";

const PRESETS = [100, 200, 500, 1000];

const t = useT();
const w = computed(() => t.value.repurchase);
const app = useApp();
const bills = useBills();
const points = usePoints();
const staking = useStaking();

const user = computed(() => app.user);
const amount = ref<number>(200);
const presets = PRESETS;

const earnPoints = computed(() => Math.floor(amount.value / 2));
const projectedYield = computed(() => amount.value * 0.35 * (90 / 365));
const canSubmit = computed(() => amount.value > 0 && amount.value <= user.value.usdtBalance);

const currentPtsLine = computed(() => fmt(w.value.currentPtsLine, { n: points.points }));
const ctaLabel = computed(() => fmt(w.value.cta, { amount: amount.value.toFixed(2) }));

const BENEFIT_SVG = {
  sparkles: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>`,
  zap: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>`,
  diamond: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></svg>`,
};

const benefitTiles = computed(() => [
  { icon: BENEFIT_SVG.sparkles, text: fmt(w.value.benefits.points, { n: earnPoints.value }), tint: "var(--v5-brand)" },
  { icon: BENEFIT_SVG.zap, text: w.value.benefits.apy, tint: "var(--v5-warning)" },
  { icon: BENEFIT_SVG.check, text: w.value.benefits.cultivation, tint: "var(--v5-tech-cyan)" },
  { icon: BENEFIT_SVG.diamond, text: w.value.benefits.genesis, tint: "var(--v5-brand-2)" },
]);

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onAmount(e: Event) {
  amount.value = Math.max(0, parseFloat(detailVal(e)) || 0);
}

function handleRepurchase() {
  if (!canSubmit.value) return;
  if (!app.debitBalance(amount.value)) {
    toast.error(w.value.insufficient, fmt(w.value.insufficientSub, { a: user.value.usdtBalance.toFixed(2) }));
    return;
  }
  // Cross-store orchestration in the handler (stores don't import each other).
  points.earn(earnPoints.value, `Re-invest $${amount.value}`);
  staking.stake(amount.value, 90);
  bills.add({
    type: "stake",
    symbol: "USDT",
    amount: -amount.value,
    status: "posted",
    memo: `Re-invest · 90d stake (+${earnPoints.value} points)`,
    ref: `REINVEST-${Date.now().toString(36).toUpperCase()}`,
  });
  toast.success(w.value.toastSuccess, fmt(w.value.toastSubtitle, { p: earnPoints.value, a: amount.value }));
  amount.value = 200;
}

function goHow() {
  uni.navigateTo({ url: "/pages/me/wallet-repurchase-how", fail: () => {} });
}

const howLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0 14px",
  minHeight: "44px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};
const heroStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "16px",
  background:
    "radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--v5-brand) 18%, transparent) 0%, transparent 65%), var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-brand) 30%, transparent)",
};
const heroIconBoxStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "12px", background: "color-mix(in srgb, var(--v5-brand) 20%, transparent)" };
const heroTitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontWeight: 600, fontSize: "18px", letterSpacing: "-0.014em", color: "var(--v5-ink)" };
const heroPtsStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "2px" };
const benefitsGridStyle: CSSProperties = { marginTop: "12px", gap: "8px" };
function benefitStyle(tint: string, i: number): CSSProperties {
  return {
    gap: "6px",
    padding: "8px",
    borderRadius: "8px",
    background: `color-mix(in srgb, ${tint} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${tint} 30%, transparent)`,
    animationDelay: `${i * 0.08}s`,
  };
}
const benefitTextStyle: CSSProperties = { fontSize: "11px", color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)" };
const cardStyle: CSSProperties = { background: "var(--v5-surface)", border: "1px solid var(--v5-border)", borderRadius: "16px" };
const monoLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-ink-3)", letterSpacing: "0.06em" };
const dollarStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "24px", color: "var(--v5-ink-3)" };
const amountInputStyle: CSSProperties = { fontFamily: "var(--font-v5)", flex: "1", minWidth: "0", background: "transparent", fontSize: "28px", fontWeight: 600, color: "var(--v5-ink)" };
const usdtStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
function presetStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600,
    background: active ? "var(--v5-brand)" : "var(--v5-surface-2)",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-2)",
  };
}
const balanceLabelStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)" };
const balanceValueStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "11px", color: "var(--v5-ink-2)", marginLeft: "4px" };
const dividerStyle: CSSProperties = { height: "1px", background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)", margin: "8px 0" };
const ctaStyle = computed<CSSProperties>(() => ({
  width: "100%",
  height: "48px",
  borderRadius: "999px",
  fontSize: "14px",
  fontWeight: 600,
  background: canSubmit.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  color: canSubmit.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
  boxShadow: canSubmit.value ? "var(--v5-spotlight-brand)" : "none",
}));
const lockedNoticeStyle: CSSProperties = { padding: "0 8px", fontSize: "11px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
</script>
