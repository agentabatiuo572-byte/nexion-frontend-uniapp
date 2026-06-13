<!--
  NEX v2 24-month lock vault (ported from Nexion-prototype/app/(main)/me/wallet/nex-v2-lock/page.tsx).
  Phase-gated (nexV2LockAvailable): pre-phase shows a locked card; in-phase shows the
  250% APY 24-month lock with amount input + maturity projection. Lock is a local
  stub flag + toast. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/wallet" />

      <!-- Hero -->
      <view class="mx-4 relative overflow-hidden" :style="heroStyle">
        <view :style="heroGlowStyle" />
        <view class="relative">
          <view class="flex items-center" style="gap: 8px; margin-bottom: 10px">
            <view class="grid place-items-center" :style="heroIconBoxStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </view>
            <text :style="heroLabelStyle">{{ w.heroLabel }}</text>
          </view>
          <text class="block" :style="heroTitleStyle">{{ heroTitle }}</text>
          <text class="block" :style="heroSubStyle">{{ w.heroSubtitle }}</text>
          <view class="grid grid-cols-3" style="gap: 8px; margin-top: 14px">
            <Stat :label="w.statsApy" value="250%" tint="var(--v5-success)" />
            <Stat :label="w.statsLock" value="24 mo" tint="var(--v5-brand)" />
            <Stat :label="w.statsMin" value="1,000 NEX" tint="var(--v5-warning)" />
          </view>
        </view>
      </view>

      <!-- Locked -->
      <view v-if="!available" class="mx-4" :style="lockedCardStyle">
        <view class="grid place-items-center" :style="lockBoxStyle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </view>
        <text class="block" :style="lockedTitleStyle">{{ w.lockedTitle }}</text>
        <text class="block" :style="lockedBodyStyle">{{ w.lockedBody }}</text>
        <view class="flex items-center" :style="lockedEtaStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
          <text>{{ w.lockedEta }}</text>
        </view>
      </view>

      <template v-else>
        <!-- Amount input -->
        <view class="mx-4" :style="inputCardStyle">
          <view class="flex items-baseline justify-between" style="margin-bottom: 8px">
            <text :style="amountLabelStyle">{{ w.amountLabel }}</text>
            <view class="active:opacity-70" @click="setMax">
              <text :style="balanceMaxStyle">{{ balanceMax }}</text>
            </view>
          </view>
          <input
            :value="amount"
            type="digit"
            :placeholder="minPlaceholder"
            placeholder-class="ph"
            :style="amountInputStyle"
            @input="onAmount"
          />
          <text class="block" :style="minHintStyle">{{ minHint }}</text>
        </view>

        <!-- Maturity projection -->
        <view v-if="amountNum > 0" class="mx-4" :style="projectionStyle">
          <text class="block" :style="projLabelStyle">{{ w.projectionLabel }}</text>
          <view class="flex items-baseline justify-between" style="margin-top: 10px">
            <text :style="projKeyStyle">{{ w.youLock }}</text>
            <text :style="projLockValStyle">{{ amountNum.toLocaleString() }} NEX</text>
          </view>
          <view class="flex items-baseline justify-between" style="margin-top: 6px">
            <text :style="projKeyStyle">{{ w.youReceive }}</text>
            <text :style="projReceiveStyle">{{ matureValueStr }} NEX</text>
          </view>
          <view class="flex items-baseline justify-between" style="margin-top: 4px">
            <text :style="projProfitKeyStyle">{{ w.profit }}</text>
            <text :style="projProfitValStyle">+{{ profitStr }} NEX</text>
          </view>
        </view>

        <!-- Risk callout -->
        <view class="mx-4" :style="riskCardStyle">
          <view class="flex items-start" style="gap: 8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <view style="flex: 1">
              <text :style="riskTitleStyle">{{ w.riskTitle }}</text>
              <text class="block" :style="riskBodyStyle">{{ w.riskBody }}</text>
            </view>
          </view>
        </view>

        <!-- CTA -->
        <view class="mx-4" style="margin-top: 16px">
          <view class="w-full flex items-center justify-center active:opacity-85" :style="ctaStyle" @click="onLock">
            <template v-if="locked">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
              <text>{{ w.lockedLabel }}</text>
            </template>
            <template v-else>
              <text>{{ lockCta }}</text>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="valid ? 'var(--v5-ink)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </template>
          </view>
          <text class="block text-center" :style="disclaimerStyle">{{ w.disclaimer }}</text>
        </view>
      </template>

      <!-- Footer FAQ -->
      <view class="mx-4" :style="faqCardStyle">
        <view class="flex items-center" :style="faqHeadStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
          <text :style="faqHeadTextStyle">{{ w.faqTitle }}</text>
        </view>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <text class="block" :style="faqItemStyle">{{ w.faq1 }}</text>
          <text class="block" :style="faqItemStyle">{{ w.faq2 }}</text>
          <text class="block" :style="faqItemStyle">{{ w.faq3 }}</text>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import Stat from "@/components/me/nex-lock-stat.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useProductPhase } from "@/composables/use-product-phase";
import { useApp } from "@/store/app";

const LOCK_MONTHS = 24;
const APY = 2.5;
const MIN_LOCK_NEX = 1_000;

const t = useT();
const w = computed(() => t.value.nexV2Lock);
const phase = useProductPhase();
const app = useApp();
const nexBalance = computed(() => app.user.nexBalance);

const amount = ref("");
const locked = ref(false);

const available = computed(() => phase.value.nexV2LockAvailable);
const amountNum = computed(() => parseFloat(amount.value) || 0);
const valid = computed(() => amountNum.value >= MIN_LOCK_NEX && amountNum.value <= nexBalance.value);
const matureValue = computed(() => amountNum.value * (1 + APY * (LOCK_MONTHS / 12)));
const profit = computed(() => matureValue.value - amountNum.value);

const heroTitle = "250% APY · 24-Month Founders Vault";
const matureValueStr = computed(() => matureValue.value.toLocaleString(undefined, { maximumFractionDigits: 0 }));
const profitStr = computed(() => profit.value.toLocaleString(undefined, { maximumFractionDigits: 0 }));
const balanceMax = computed(() => fmt(w.value.balanceMax, { n: nexBalance.value.toLocaleString() }));
const minPlaceholder = computed(() => fmt(w.value.minPlaceholder, { n: MIN_LOCK_NEX.toLocaleString() }));
const minHint = computed(() => fmt(w.value.minHint, { n: MIN_LOCK_NEX.toLocaleString() }));
const lockCta = computed(() => fmt(w.value.lockCta, { months: LOCK_MONTHS }));

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onAmount(e: Event) {
  amount.value = detailVal(e).replace(/[^0-9.]/g, "");
}
function setMax() {
  amount.value = String(Math.floor(nexBalance.value));
}
function onLock() {
  if (!valid.value || locked.value) return;
  locked.value = true;
  toast.success(fmt(w.value.lockToast, { n: amountNum.value.toLocaleString() }));
}

const heroStyle: CSSProperties = {
  marginTop: "8px",
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const heroGlowStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(45% 55% at 85% 15%, var(--v5-brand-2-soft) 0%, transparent 60%), radial-gradient(35% 45% at 15% 90%, var(--v5-success-soft) 0%, transparent 60%)",
  filter: "blur(8px)",
  pointerEvents: "none",
  opacity: 0.85,
};
const heroIconBoxStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "999px", background: "var(--v5-brand-2-soft)" };
const heroLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-brand-2)", letterSpacing: "0.06em" };
const heroTitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.25 };
const heroSubStyle: CSSProperties = { marginTop: "8px", fontSize: "13.5px", color: "var(--v5-ink-2)", lineHeight: 1.55 };
const lockedCardStyle: CSSProperties = { marginTop: "12px", borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "20px", textAlign: "center" };
const lockBoxStyle: CSSProperties = { width: "48px", height: "48px", borderRadius: "999px", background: "var(--v5-surface-2)", margin: "0 auto 12px" };
const lockedTitleStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "var(--v5-ink)" };
const lockedBodyStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.4 };
const lockedEtaStyle: CSSProperties = {
  marginTop: "12px",
  display: "inline-flex",
  padding: "4px 10px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-brand-2) 12%, transparent)",
  color: "var(--v5-brand-2)",
  fontSize: "10.5px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
};
const inputCardStyle: CSSProperties = { marginTop: "12px", borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "16px" };
const amountLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const balanceMaxStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", color: "var(--v5-brand-2)" };
const amountInputStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "30px",
  letterSpacing: "-0.022em",
  color: "var(--v5-ink)",
};
const minHintStyle: CSSProperties = { fontSize: "10.5px", color: "var(--v5-ink-4)", marginTop: "4px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace" };
const projectionStyle: CSSProperties = { marginTop: "12px", padding: "16px", borderRadius: "16px", background: "var(--v5-success-soft)" };
const projLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-success)", letterSpacing: "0.06em" };
const projKeyStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-3)" };
const projLockValStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12.5px", color: "var(--v5-ink)" };
const projReceiveStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontWeight: 600, fontSize: "18px", letterSpacing: "-0.014em", color: "var(--v5-success)" };
const projProfitKeyStyle: CSSProperties = { fontSize: "10.5px", color: "var(--v5-ink-4)" };
const projProfitValStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11.5px", fontWeight: 500, color: "var(--v5-brand-2)" };
const riskCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "16px",
  background: "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)",
  border: "1px solid var(--v5-border)",
  padding: "14px",
};
const riskTitleStyle: CSSProperties = { fontSize: "11.5px", fontWeight: 600, color: "var(--v5-brand-2)" };
const riskBodyStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-3)", marginTop: "4px", lineHeight: 1.6 };
const ctaStyle = computed<CSSProperties>(() => ({
  width: "100%",
  height: "50px",
  borderRadius: "999px",
  background: !valid.value || locked.value ? "var(--v5-surface-2)" : "var(--v5-brand-2)",
  color: !valid.value || locked.value ? "var(--v5-ink-4)" : "var(--v5-ink)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
}));
const disclaimerStyle: CSSProperties = { marginTop: "8px", fontSize: "10px", color: "var(--v5-ink-4)" };
const faqCardStyle: CSSProperties = { marginTop: "20px", borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "16px" };
const faqHeadStyle: CSSProperties = { marginBottom: "10px" };
const faqHeadTextStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-ink-3)", letterSpacing: "0.06em" };
const faqItemStyle: CSSProperties = { fontSize: "11.5px", color: "color-mix(in srgb, var(--v5-ink) 80%, transparent)", lineHeight: 1.6 };
</script>
