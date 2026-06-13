<!--
  Rank · How it works — ported from
  Nexion-prototype/app/(main)/team/rank/how-it-works/page.tsx.
  Custom radial-gradient hero + 6 page-local Sections (brand-2 code-tag heads):
  what-is, 13-rank ladder (VBadgeIcon), how-to-level (RequirementCards + 2 rule
  callouts), unlocks (UnlockRows), worked example (start card + PhaseRows + 2
  callouts), FAQ. Footer CTA back. Deep sub-page → <AppChassis>. SetPageHeader →
  <AppChassis active="team">. Section/RequirementCard/UnlockRow/PhaseRow/FaqRow are page-local
  (distinct brand-2 styling from how/* components). banned hex #0F0F0F → var(--v5-surface).
-->
<template>
  <AppChassis active="team">
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/rank" />

      <!-- Hero -->
      <view class="mx-4 mt-2 relative overflow-hidden rounded-2xl" :style="heroStyle">
        <view class="absolute inset-0" :style="heroBgStyle" />
        <view class="relative">
          <text class="block" :style="heroLabelStyle">{{ w.heroLabel }}</text>
          <text class="block font-display" :style="heroTitleStyle">{{ w.heroTitle }}</text>
          <text class="block" :style="heroSubStyle">{{ w.heroSub }}</text>
        </view>
      </view>

      <!-- §1 What is the Rank System -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
          <text>{{ w.s1Title }}</text>
        </view>
        <text class="block" :style="bodyStyle">{{ w.s1Para1 }}</text>
        <text class="block" :style="{ ...bodyStyle, marginTop: '8px' }">{{ w.s1Para2 }}</text>
      </view>

      <!-- §2 13 ranks at a glance -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>
          <text>{{ w.s2Title }}</text>
        </view>
        <text class="block" :style="{ ...captionStyle, marginBottom: '12px' }">{{ w.s2Caption }}</text>
        <view class="rounded-xl border" :style="ladderCardStyle">
          <view style="display: flex; flex-direction: column; gap: 6px">
            <view v-for="r in V_RANKS" :key="r.v" class="flex items-center" style="gap: 10px">
              <VBadgeIcon :v="r.v" :size="22" />
              <text class="font-display tabular-nums" :style="ladderVStyle">V{{ r.v }}</text>
              <text :style="ladderTitleStyle">{{ r.title }}</text>
              <text class="truncate" :style="ladderCnStyle">· {{ r.cnTitle }}</text>
              <text v-if="r.prizeName !== '—'" :style="ladderPrizeStyle">{{ r.prizeIcon }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- §3 How to level up -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" /></svg>
          <text>{{ w.s3Title }}</text>
        </view>
        <text class="block" :style="{ ...captionStyle, color: 'var(--v5-ink-2)', marginBottom: '12px' }">{{ w.s3Intro }}</text>
        <view style="display: flex; flex-direction: column; gap: 10px">
          <view v-for="req in requirements" :key="req.label" class="rounded-lg border" :style="reqCardStyle">
            <text class="block" :style="reqLabelStyle">{{ req.label }}</text>
            <text class="block" :style="reqBodyStyle">{{ req.body }}</text>
          </view>
        </view>
        <view class="rounded-lg border" :style="ruleBoxStyle('var(--v5-warning)')">
          <text class="block" :style="ruleTitleStyle('var(--v5-warning)')">⚠️ {{ w.s3RuleATitle }}</text>
          <text class="block" :style="ruleBodyStyle">{{ w.s3RuleABody }}</text>
        </view>
        <view class="rounded-lg border" :style="{ ...ruleBoxStyle('var(--v5-brand)'), marginTop: '8px' }">
          <text class="block" :style="ruleTitleStyle('var(--v5-brand)')">✓ {{ w.s3RuleBTitle }}</text>
          <text class="block" :style="ruleBodyStyle">{{ w.s3RuleBBody }}</text>
        </view>
      </view>

      <!-- §4 What you unlock -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="8" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>
          <text>{{ w.s4Title }}</text>
        </view>
        <text class="block" :style="{ ...captionStyle, color: 'var(--v5-ink-2)' }">{{ w.s4Intro }}</text>
        <view style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px">
          <view v-for="u in unlocks" :key="u.label" class="rounded-lg border flex items-start" :style="unlockRowStyle">
            <text class="shrink-0" style="font-size: 18px; line-height: 1">{{ u.emoji }}</text>
            <view class="min-w-0">
              <text class="block" :style="unlockLabelStyle">{{ u.label }}</text>
              <text class="block" :style="unlockBodyStyle">{{ u.body }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- §5 Worked example -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <text>{{ w.s5Title }}</text>
        </view>
        <text class="block" :style="{ fontSize: '12px', color: 'var(--v5-ink-3)' }">{{ w.s5Intro }}</text>

        <view class="rounded-xl border" :style="startCardStyle">
          <text class="block" :style="startLabelStyle">{{ w.s5StartLabel }}</text>
          <text class="block" :style="bodyStyle">{{ w.s5StartBody }}</text>
        </view>

        <view style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px">
          <view v-for="ph in phases" :key="ph.n" class="flex items-start" style="gap: 12px">
            <text class="shrink-0 grid place-items-center font-display tabular-nums" :style="phaseNumStyle">{{ ph.n }}</text>
            <view class="min-w-0">
              <text class="block" :style="phaseTitleStyle">{{ ph.title }}</text>
              <text class="block" :style="phaseBodyStyle">{{ ph.body }}</text>
            </view>
          </view>
        </view>

        <view class="rounded-xl border" :style="triggerCardStyle">
          <text class="block" :style="triggerLabelStyle">⚡ {{ w.s5TriggerLabel }}</text>
          <text class="block" :style="{ fontSize: '12.5px', color: 'color-mix(in srgb, var(--v5-ink) 90%, transparent)', lineHeight: 1.5 }">{{ w.s5TriggerBody }}</text>
        </view>

        <view class="rounded-xl border" :style="unlockResultCardStyle">
          <text class="block" :style="unlockResultLabelStyle">🎉 {{ w.s5UnlockLabel }}</text>
          <view style="display: flex; flex-direction: column; gap: 4px">
            <text class="block" :style="unlockResultItemStyle">• {{ w.s5Unlock1 }}</text>
            <text class="block" :style="unlockResultItemStyle">• {{ w.s5Unlock2 }}</text>
            <text class="block" :style="unlockResultItemStyle">• {{ w.s5Unlock3 }}</text>
            <text class="block" :style="unlockResultItemStyle">• {{ w.s5Unlock4 }}</text>
          </view>
        </view>
      </view>

      <!-- §6 FAQ -->
      <view class="mx-4 mt-4 rounded-2xl border" :style="sectionStyle">
        <view class="flex items-center" :style="sectionHeadStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
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
import VBadgeIcon from "@/components/team/v-badge-icon.vue";
import { useT } from "@/i18n/use-t";
import { V_RANKS } from "@/store/v-rank";

const t = useT();
const w = computed(() => t.value.rankHowItWorks);

const requirements = computed(() => [
  { label: w.value.req1Label, body: w.value.req1Body },
  { label: w.value.req2Label, body: w.value.req2Body },
  { label: w.value.req3Label, body: w.value.req3Body },
  { label: w.value.req4Label, body: w.value.req4Body },
]);
const unlocks = computed(() => [
  { emoji: "📈", label: w.value.unlock1Label, body: w.value.unlock1Body },
  { emoji: "🤝", label: w.value.unlock2Label, body: w.value.unlock2Body },
  { emoji: "🏆", label: w.value.unlock3Label, body: w.value.unlock3Body },
  { emoji: "🎁", label: w.value.unlock4Label, body: w.value.unlock4Body },
  { emoji: "🌱", label: w.value.unlock5Label, body: w.value.unlock5Body },
]);
const phases = computed(() => [
  { n: 1, title: w.value.s5Phase1Title, body: w.value.s5Phase1Body },
  { n: 2, title: w.value.s5Phase2Title, body: w.value.s5Phase2Body },
  { n: 3, title: w.value.s5Phase3Title, body: w.value.s5Phase3Body },
]);
const faqs = computed(() => [
  { q: w.value.faqQ1, a: w.value.faqA1 },
  { q: w.value.faqQ2, a: w.value.faqA2 },
  { q: w.value.faqQ3, a: w.value.faqA3 },
  { q: w.value.faqQ4, a: w.value.faqA4 },
]);

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/team/rank", fail: () => {} }) });
}

// ─── styles ───
const heroStyle: CSSProperties = { padding: "20px" };
const heroBgStyle: CSSProperties = {
  background:
    "radial-gradient(70% 80% at 0% 0%, rgba(124,92,255,0.18) 0%, transparent 60%)," +
    "radial-gradient(70% 80% at 100% 100%, rgba(198,255,58,0.16) 0%, transparent 60%)," +
    "var(--v5-surface)",
};
const heroLabelStyle: CSSProperties = { fontSize: "10.5px", letterSpacing: "0.16em", color: "var(--v5-brand-2)", fontWeight: 500 };
const heroTitleStyle: CSSProperties = { marginTop: "8px", fontSize: "26px", lineHeight: 1.2, fontWeight: 600, color: "var(--v5-ink)" };
const heroSubStyle: CSSProperties = { marginTop: "8px", fontSize: "13.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const sectionStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "16px", padding: "16px" };
const sectionHeadStyle: CSSProperties = {
  gap: "6px",
  fontSize: "10.5px",
  letterSpacing: "0.16em",
  color: "var(--v5-brand-2)",
  fontWeight: 500,
  marginBottom: "12px",
};
const bodyStyle: CSSProperties = { fontSize: "13.5px", color: "var(--v5-ink-2)", lineHeight: 1.6 };
const captionStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const ladderCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "color-mix(in srgb, var(--v5-border) 70%, transparent)", borderRadius: "12px", padding: "12px" };
const ladderVStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", width: "28px" };
const ladderTitleStyle: CSSProperties = { fontSize: "12px", color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)", fontWeight: 500 };
const ladderCnStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-4)" };
const ladderPrizeStyle: CSSProperties = { marginLeft: "auto", fontSize: "10.5px", color: "var(--v5-warning)" };

const reqCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "10px", padding: "10px 12px" };
const reqLabelStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 600, color: "var(--v5-brand)" };
const reqBodyStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

function ruleBoxStyle(color: string): CSSProperties {
  return {
    marginTop: "12px",
    borderRadius: "8px",
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
    padding: "8px 12px",
  };
}
function ruleTitleStyle(color: string): CSSProperties {
  return { fontSize: "12px", fontWeight: 600, marginBottom: "2px", color };
}
const ruleBodyStyle: CSSProperties = { fontSize: "12px", color: "color-mix(in srgb, var(--v5-ink) 80%, transparent)", lineHeight: 1.6 };

const unlockRowStyle: CSSProperties = { gap: "10px", background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "10px", padding: "10px 12px" };
const unlockLabelStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 600, color: "color-mix(in srgb, var(--v5-ink) 95%, transparent)" };
const unlockBodyStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const startCardStyle: CSSProperties = { marginTop: "12px", background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "12px", padding: "12px" };
const startLabelStyle: CSSProperties = { fontSize: "11px", letterSpacing: "0.14em", color: "var(--v5-brand-2)", marginBottom: "4px" };

const phaseNumStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 14%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 40%, transparent)",
  color: "var(--v5-brand-2)",
  fontSize: "12px",
  fontWeight: 600,
};
const phaseTitleStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 600, color: "color-mix(in srgb, var(--v5-ink) 95%, transparent)" };
const phaseBodyStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const triggerCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "12px",
  borderColor: "color-mix(in srgb, var(--v5-brand) 40%, transparent)",
  background: "color-mix(in srgb, var(--v5-brand) 8%, transparent)",
  padding: "12px",
};
const triggerLabelStyle: CSSProperties = { fontSize: "11px", letterSpacing: "0.14em", color: "var(--v5-brand)", marginBottom: "6px" };

const unlockResultCardStyle: CSSProperties = {
  marginTop: "8px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  borderColor: "color-mix(in srgb, var(--v5-brand-2) 30%, transparent)",
  padding: "12px",
};
const unlockResultLabelStyle: CSSProperties = { fontSize: "11px", letterSpacing: "0.14em", color: "var(--v5-brand-2)", marginBottom: "6px" };
const unlockResultItemStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-2)", lineHeight: 1.5 };

const faqCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "10px", padding: "10px 12px" };
const faqQStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 600, color: "color-mix(in srgb, var(--v5-ink) 95%, transparent)" };
const faqAStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const ctaStyle: CSSProperties = { gap: "8px", height: "48px", borderRadius: "999px", background: "var(--v5-brand)" };
const ctaTextStyle: CSSProperties = { color: "var(--v5-on-brand)", fontSize: "14px", fontWeight: 600 };
</script>
