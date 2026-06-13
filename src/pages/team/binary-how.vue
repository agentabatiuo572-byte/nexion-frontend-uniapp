<!--
  Dual-Track (Balance Match) · How it works — ported from
  Nexion-prototype/app/(main)/team/binary/how-it-works/page.tsx.
  Custom radial-gradient hero + 6 page-local Sections (brand code-tag heads):
  what-is, SVG tree diagram + track totals, 3 steps, reward math card, Sarah
  timeline (TimelineRows), FAQ. Footer CTA back. Deep sub-page → <AppChassis active="team">.
  SetPageHeader → <SubPageHeader>. SVG TreeDiagram ported faithfully (P-013: uni
  webview renders inline SVG incl <text> nodes). banned hex #0F0F0F → var(--v5-surface).
  De-MLM'd wording kept (Track A/B, auto-placement, network partner).
-->
<template>
  <AppChassis active="team">
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/binary" />

      <!-- Hero -->
      <view class="mx-4 mt-2 relative overflow-hidden rounded-2xl" :style="heroStyle">
        <view class="absolute inset-0" :style="heroBgStyle" />
        <view class="relative">
          <text class="block" :style="heroLabelStyle">{{ w.heroLabel }}</text>
          <text class="block font-display" :style="heroTitleStyle">{{ w.heroTitle }}</text>
          <text class="block" :style="heroSubStyle">{{ w.heroSub }}</text>
        </view>
      </view>

      <!-- What is it -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <text>{{ w.s1Title }}</text>
        </view>
        <text class="block" :style="bodyStyle">{{ w.s1Para1 }}</text>
        <text class="block" :style="{ ...bodyStyle, marginTop: '8px' }">{{ w.s1Para2 }}</text>
      </view>

      <!-- Visual diagram -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" /><path d="M12 12v3" /></svg>
          <text>{{ w.s2Title }}</text>
        </view>
        <text class="block" :style="captionStyle">{{ w.s2Caption }}</text>
        <view class="rounded-xl border" :style="diagramCardStyle">
          <svg viewBox="0 0 340 160" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 156px">
            <!-- Connectors — You to two wings -->
            <line x1="170" y1="36" x2="86" y2="64" stroke="var(--v5-brand)" stroke-opacity="0.45" stroke-width="1.4" />
            <line x1="170" y1="36" x2="254" y2="64" stroke="var(--v5-tech-cyan)" stroke-opacity="0.5" stroke-width="1.4" />
            <!-- Connectors — wings to children -->
            <line x1="86" y1="90" x2="56" y2="124" stroke="var(--v5-brand)" stroke-opacity="0.32" stroke-width="1" />
            <line x1="86" y1="90" x2="86" y2="124" stroke="var(--v5-brand)" stroke-opacity="0.32" stroke-width="1" />
            <line x1="86" y1="90" x2="116" y2="124" stroke="var(--v5-brand)" stroke-opacity="0.32" stroke-width="1" />
            <line x1="254" y1="90" x2="224" y2="124" stroke="var(--v5-tech-cyan)" stroke-opacity="0.32" stroke-width="1" />
            <line x1="254" y1="90" x2="254" y2="124" stroke="var(--v5-tech-cyan)" stroke-opacity="0.32" stroke-width="1" />
            <line x1="254" y1="90" x2="284" y2="124" stroke="var(--v5-tech-cyan)" stroke-opacity="0.32" stroke-width="1" />

            <!-- You node -->
            <circle cx="170" cy="22" r="14" fill="var(--v5-surface)" stroke="var(--v5-ink)" stroke-opacity="0.55" stroke-width="1.5" />
            <text x="170" y="26" text-anchor="middle" font-size="10" fill="var(--v5-ink)" font-weight="600">{{ w.diagYou }}</text>

            <!-- Left wing main node -->
            <circle cx="86" cy="78" r="12" fill="var(--v5-brand)" fill-opacity="0.18" stroke="var(--v5-brand)" stroke-opacity="0.7" stroke-width="1.3" />
            <text x="86" y="81.5" text-anchor="middle" font-size="9" fill="var(--v5-brand)" font-weight="600">A</text>
            <text x="86" y="104" text-anchor="middle" font-size="9.5" fill="var(--v5-ink-3)">{{ w.diagLeftLabel }}</text>

            <!-- Right wing main node -->
            <circle cx="254" cy="78" r="12" fill="var(--v5-tech-cyan)" fill-opacity="0.22" stroke="var(--v5-tech-cyan-soft)" stroke-opacity="0.75" stroke-width="1.3" />
            <text x="254" y="81.5" text-anchor="middle" font-size="9" fill="var(--v5-tech-cyan-soft)" font-weight="600">B</text>
            <text x="254" y="104" text-anchor="middle" font-size="9.5" fill="var(--v5-ink-3)">{{ w.diagRightLabel }}</text>

            <!-- Left children -->
            <circle cx="56" cy="132" r="5.5" fill="var(--v5-brand)" fill-opacity="0.7" stroke="var(--v5-brand)" stroke-opacity="0.9" stroke-width="0.6" />
            <circle cx="86" cy="132" r="5.5" fill="var(--v5-brand)" fill-opacity="0.7" stroke="var(--v5-brand)" stroke-opacity="0.9" stroke-width="0.6" />
            <circle cx="116" cy="132" r="5.5" fill="var(--v5-brand)" fill-opacity="0.7" stroke="var(--v5-brand)" stroke-opacity="0.9" stroke-width="0.6" />
            <!-- Right children -->
            <circle cx="224" cy="132" r="5.5" fill="var(--v5-tech-cyan-soft)" fill-opacity="0.75" stroke="var(--v5-tech-cyan-soft)" stroke-opacity="0.9" stroke-width="0.6" />
            <circle cx="254" cy="132" r="5.5" fill="var(--v5-tech-cyan-soft)" fill-opacity="0.75" stroke="var(--v5-tech-cyan-soft)" stroke-opacity="0.9" stroke-width="0.6" />
            <circle cx="284" cy="132" r="5.5" fill="var(--v5-tech-cyan-soft)" fill-opacity="0.75" stroke="var(--v5-tech-cyan-soft)" stroke-opacity="0.9" stroke-width="0.6" />
          </svg>
          <view class="grid grid-cols-2" style="margin-top: 12px; gap: 8px">
            <view class="rounded-md border text-center" :style="trackTotalStyle('var(--v5-brand)')">
              <text class="block" :style="{ color: 'var(--v5-brand)', fontWeight: 500, fontSize: '10.5px' }">{{ w.diagLeftLabel }}</text>
              <text class="block font-display tabular-nums" :style="trackTotalAmtStyle">$3,000/mo</text>
            </view>
            <view class="rounded-md border text-center" :style="trackTotalStyle('var(--v5-brand-2)')">
              <text class="block" :style="{ color: 'var(--v5-brand-2)', fontWeight: 500, fontSize: '10.5px' }">{{ w.diagRightLabel }}</text>
              <text class="block font-display tabular-nums" :style="trackTotalAmtStyle">$2,000/mo</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 3 steps -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" /></svg>
          <text>{{ w.s3Title }}</text>
        </view>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <view v-for="st in steps" :key="st.n" class="flex items-start" style="gap: 12px">
            <text class="shrink-0 grid place-items-center font-display tabular-nums" :style="stepNumStyle">{{ st.n }}</text>
            <view class="min-w-0">
              <text class="block" :style="stepTitleStyle">{{ st.title }}</text>
              <text class="block" :style="stepBodyStyle">{{ st.body }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- How reward is calculated -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></svg>
          <text>{{ w.s4Title }}</text>
        </view>
        <text class="block" :style="{ fontSize: '12.5px', color: 'color-mix(in srgb, var(--v5-ink) 80%, transparent)', lineHeight: 1.6 }">{{ w.s4Intro }}</text>
        <view :style="mathCardStyle">
          <view class="grid grid-cols-2" style="gap: 12px">
            <view>
              <text class="block" :style="{ fontSize: '10px', letterSpacing: '0.16em', color: 'var(--v5-ink-3)' }">{{ w.diagLeftLabel }}</text>
              <text class="block font-display tabular-nums" :style="{ fontSize: '18px', fontWeight: 600, color: 'var(--v5-brand)', marginTop: '2px' }">$3,000</text>
            </view>
            <view>
              <text class="block" :style="{ fontSize: '10px', letterSpacing: '0.16em', color: 'var(--v5-ink-3)' }">{{ w.diagRightLabel }}</text>
              <text class="block font-display tabular-nums" :style="{ fontSize: '18px', fontWeight: 600, color: 'var(--v5-brand-2)', marginTop: '2px' }">$2,000</text>
            </view>
          </view>
          <view class="flex items-center justify-between" :style="mathTotalRowStyle">
            <view class="flex items-center" style="gap: 6px">
              <text :style="{ fontSize: '11px', color: 'var(--v5-ink-3)' }">{{ w.s4SmallerLabel }}</text>
              <text class="font-display tabular-nums" :style="{ color: 'color-mix(in srgb, var(--v5-ink) 90%, transparent)' }">$2,000</text>
              <text :style="{ color: 'var(--v5-ink-4)' }">× 10% =</text>
            </view>
            <text class="font-display tabular-nums" :style="{ fontSize: '20px', fontWeight: 600, color: 'var(--v5-brand)' }">$200</text>
          </view>
        </view>
        <view class="inline-flex items-center rounded-full border" :style="qualifyChipStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          <text>{{ w.s4Qualify }}</text>
        </view>
        <text class="block" :style="{ marginTop: '8px', fontSize: '12px', color: 'var(--v5-ink-3)', lineHeight: 1.45 }">{{ w.s4PlainTalk }}</text>
      </view>

      <!-- Sarah example -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <text>{{ w.s5Title }}</text>
        </view>
        <text class="block" :style="{ fontSize: '12px', color: 'var(--v5-ink-3)' }">{{ w.s5Intro }}</text>
        <view style="margin-top: 12px; display: flex; flex-direction: column; gap: 10px">
          <view v-for="tl in timeline" :key="tl.month" class="rounded-lg border" :style="timelineRowStyle(tl.highlight)">
            <view class="flex items-center justify-between">
              <text :style="{ fontSize: '11px', letterSpacing: '0.14em', color: 'var(--v5-brand)', fontWeight: 500 }">{{ tl.month }}</text>
              <text class="font-display tabular-nums" :style="{ fontSize: '14px', fontWeight: 600, color: tl.blocked ? 'var(--v5-brand-2)' : 'var(--v5-brand)' }">{{ tl.bonusVal }}</text>
            </view>
            <text class="block" :style="{ marginTop: '4px', fontSize: '12px', color: 'var(--v5-ink-2)', lineHeight: 1.45 }">{{ tl.text }}</text>
            <view class="flex items-center font-mono-tabular" :style="{ marginTop: '6px', gap: '12px', fontSize: '10.5px', color: 'var(--v5-ink-4)' }">
              <text>L {{ tl.leftVal }}</text>
              <text>·</text>
              <text>R {{ tl.rightVal }}</text>
            </view>
          </view>
        </view>
        <view class="rounded-lg border" :style="takeawayStyle">
          <text :style="{ color: 'var(--v5-brand-2)', marginRight: '4px' }">💡</text>
          <text :style="{ fontSize: '12px', color: 'var(--v5-ink-2)', lineHeight: 1.6 }">{{ w.s5Takeaway }}</text>
        </view>
      </view>

      <!-- FAQ -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" /></svg>
          <text>{{ w.faqTitle }}</text>
        </view>
        <view style="display: flex; flex-direction: column; gap: 10px">
          <view v-for="faq in faqs" :key="faq.q" class="rounded-lg border" :style="faqCardStyle">
            <text class="block" :style="faqQStyle">{{ faq.q }}</text>
            <text class="block" :style="faqAStyle">{{ faq.a }}</text>
          </view>
        </view>
      </view>

      <!-- Footer CTA -->
      <view class="mx-4 mt-6">
        <view class="flex items-center justify-center active:opacity-90" :style="ctaStyle" @click="goBack">
          <text :style="ctaTextStyle">{{ w.ctaBack }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";

const t = useT();
const w = computed(() => t.value.binaryHowItWorks);

const steps = computed(() => [
  { n: 1, title: w.value.step1Title, body: w.value.step1Body },
  { n: 2, title: w.value.step2Title, body: w.value.step2Body },
  { n: 3, title: w.value.step3Title, body: w.value.step3Body },
]);
const timeline = computed(() => [
  { month: w.value.s5M1Month, text: w.value.s5M1Text, leftVal: "$200", rightVal: "$200", bonusVal: `$0 ${w.value.s5BlockedTag}`, blocked: true, highlight: false },
  { month: w.value.s5M2Month, text: w.value.s5M2Text, leftVal: "$2,600", rightVal: "$2,200", bonusVal: "$220", blocked: false, highlight: false },
  { month: w.value.s5M3Month, text: w.value.s5M3Text, leftVal: "$4,500", rightVal: "$2,400", bonusVal: "$240", blocked: false, highlight: true },
]);
const faqs = computed(() => [
  { q: w.value.faqQ1, a: w.value.faqA1 },
  { q: w.value.faqQ2, a: w.value.faqA2 },
  { q: w.value.faqQ3, a: w.value.faqA3 },
  { q: w.value.faqQ4, a: w.value.faqA4 },
]);

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/team/binary", fail: () => {} }) });
}

// ─── styles ───
const heroStyle: CSSProperties = { padding: "20px" };
const heroBgStyle: CSSProperties = {
  background:
    "radial-gradient(70% 80% at 0% 0%, rgba(198,255,58,0.16) 0%, transparent 60%)," +
    "radial-gradient(70% 80% at 100% 100%, rgba(124,92,255,0.18) 0%, transparent 60%)," +
    "var(--v5-surface)",
};
const heroLabelStyle: CSSProperties = { fontSize: "10.5px", letterSpacing: "0.16em", color: "var(--v5-brand)", fontWeight: 500 };
const heroTitleStyle: CSSProperties = { marginTop: "8px", fontSize: "26px", lineHeight: 1.2, fontWeight: 600, color: "var(--v5-ink)" };
const heroSubStyle: CSSProperties = { marginTop: "8px", fontSize: "13.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const sectionStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "16px", padding: "16px" };
const sectionHeadStyle: CSSProperties = {
  gap: "6px",
  fontSize: "10.5px",
  letterSpacing: "0.16em",
  color: "var(--v5-brand)",
  fontWeight: 500,
  marginBottom: "12px",
};
const bodyStyle: CSSProperties = { fontSize: "13.5px", color: "var(--v5-ink-2)", lineHeight: 1.6 };
const captionStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const diagramCardStyle: CSSProperties = { marginTop: "12px", background: "var(--v5-surface)", borderColor: "color-mix(in srgb, var(--v5-border) 70%, transparent)", borderRadius: "12px", padding: "16px" };
function trackTotalStyle(color: string): CSSProperties {
  return { borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)`, padding: "6px 8px" };
}
const trackTotalAmtStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, marginTop: "2px", color: "var(--v5-ink)" };

const stepNumStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand) 14%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand) 40%, transparent)",
  color: "var(--v5-brand)",
  fontSize: "12px",
  fontWeight: 600,
};
const stepTitleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "color-mix(in srgb, var(--v5-ink) 95%, transparent)" };
const stepBodyStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const mathCardStyle: CSSProperties = {
  marginTop: "12px",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--v5-brand) 8%, transparent) 0%, var(--v5-on-brand) 50%, color-mix(in srgb, var(--v5-tech-cyan) 8%, transparent) 100%)",
  border: "1px solid var(--v5-border)",
  borderRadius: "12px",
  padding: "16px",
};
const mathTotalRowStyle: CSSProperties = { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--v5-border)" };
const qualifyChipStyle: CSSProperties = {
  marginTop: "12px",
  gap: "6px",
  padding: "4px 10px",
  background: "color-mix(in srgb, var(--v5-warning) 12%, transparent)",
  borderColor: "color-mix(in srgb, var(--v5-warning) 35%, transparent)",
  fontSize: "11px",
  color: "var(--v5-warning)",
};

function timelineRowStyle(highlight: boolean): CSSProperties {
  return {
    padding: "10px 12px",
    background: highlight ? "color-mix(in srgb, var(--v5-brand) 8%, transparent)" : "var(--v5-surface)",
    borderColor: highlight ? "color-mix(in srgb, var(--v5-brand) 40%, transparent)" : "var(--v5-border)",
  };
}
const takeawayStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  borderColor: "color-mix(in srgb, var(--v5-brand-2) 30%, transparent)",
  padding: "8px 12px",
};

const faqCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "10px", padding: "10px 12px" };
const faqQStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 600, color: "color-mix(in srgb, var(--v5-ink) 95%, transparent)" };
const faqAStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const ctaStyle: CSSProperties = { gap: "8px", height: "48px", borderRadius: "999px", background: "var(--v5-brand)" };
const ctaTextStyle: CSSProperties = { color: "var(--v5-on-brand)", fontSize: "14px", fontWeight: 600 };
</script>
