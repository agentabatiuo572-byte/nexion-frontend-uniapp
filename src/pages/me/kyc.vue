<!--
  KYC-Express explainer — ported from
  Nexion-prototype/app/(main)/me/security/kyc-express/page.tsx.
  Zero-jargon explainer: when it triggers / what you provide / what we never
  ask / what you unlock / trust+partners / FAQ + start CTA.

  uni route is /pages/me/kyc (uni has no nested [seg]/kyc-express path); the
  back chevron returns to /pages/me/security. Reuses the ported how-it-works
  primitives (how-hero / how-section / how-callout-box / how-step-row /
  how-icon-row / how-faq-row). lucide section icons → inline svg in the icon
  slot. CTA routes to wallet topup with the kyc deposit flag.
-->
<template>
  <AppChassis active="me">
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/security" :title="k.pageTitle" />

      <HowHero :label="k.heroLabel" :title="k.heroTitle" :sub="k.heroSub" accent="purple" />

      <!-- §1 WHEN IT TRIGGERS -->
      <HowSection :title="k.whyTitle" accent="amber">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
        </template>
        <text class="block" :style="sectionLeadStyle">{{ k.whySub }}</text>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <HowCalloutBox :title="k.triggers.a.label" :body="k.triggers.a.body" tone="amber" />
          <HowCalloutBox :title="k.triggers.b.label" :body="k.triggers.b.body" tone="amber" />
          <HowCalloutBox :title="k.triggers.c.label" :body="k.triggers.c.body" tone="amber" />
          <HowCalloutBox :title="k.triggers.d.label" :body="k.triggers.d.body" tone="amber" />
        </view>
      </HowSection>

      <!-- §2 WHAT YOU PROVIDE -->
      <HowSection :title="k.stepsTitle" accent="lemon">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></svg>
        </template>
        <view style="display: flex; flex-direction: column; gap: 12px">
          <HowStepRow :n="1" :title="k.steps.a.title" :body="k.steps.a.body" accent="lemon" />
          <HowStepRow :n="2" :title="k.steps.b.title" :body="k.steps.b.body" accent="lemon" />
          <HowStepRow :n="3" :title="k.steps.c.title" :body="k.steps.c.body" accent="lemon" />
        </view>
      </HowSection>

      <!-- §3 WHAT WE NEVER ASK -->
      <HowSection :title="k.privacyTitle" accent="purple">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </template>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <HowIconRow :emoji="k.privacy.a.emoji" :label="k.privacy.a.label" :body="k.privacy.a.body" />
          <HowIconRow :emoji="k.privacy.b.emoji" :label="k.privacy.b.label" :body="k.privacy.b.body" />
          <HowIconRow :emoji="k.privacy.c.emoji" :label="k.privacy.c.label" :body="k.privacy.c.body" />
        </view>
      </HowSection>

      <!-- §4 WHAT YOU UNLOCK -->
      <HowSection :title="k.unlockTitle" accent="lemon">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287z" /></svg>
        </template>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <HowIconRow :emoji="k.unlock.a.emoji" :label="k.unlock.a.label" :body="k.unlock.a.body" />
          <HowIconRow :emoji="k.unlock.b.emoji" :label="k.unlock.b.label" :body="k.unlock.b.body" />
          <HowIconRow :emoji="k.unlock.c.emoji" :label="k.unlock.c.label" :body="k.unlock.c.body" />
          <HowIconRow :emoji="k.unlock.d.emoji" :label="k.unlock.d.label" :body="k.unlock.d.body" />
        </view>
      </HowSection>

      <!-- §5 TRUST / PARTNERS -->
      <HowSection :title="k.trustTitle" accent="purple">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
        </template>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <HowCalloutBox :title="k.trust.a.label" :body="k.trust.a.body" tone="purple" />
          <HowCalloutBox :title="k.trust.b.label" :body="k.trust.b.body" tone="purple" />
          <HowCalloutBox :title="k.trust.c.label" :body="k.trust.c.body" tone="purple" />
        </view>
      </HowSection>

      <!-- §6 FAQ -->
      <HowSection :title="k.faqTitle" accent="lemon">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
        </template>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <HowFaqRow :q="k.faqs.a.q" :a="k.faqs.a.a" />
          <HowFaqRow :q="k.faqs.b.q" :a="k.faqs.b.a" />
          <HowFaqRow :q="k.faqs.c.q" :a="k.faqs.c.a" />
          <HowFaqRow :q="k.faqs.d.q" :a="k.faqs.d.a" />
        </view>
      </HowSection>

      <!-- CTA -->
      <view style="padding: 0 16px; margin-top: 20px">
        <view class="w-full flex items-center justify-center active:scale-95" :style="ctaStyle" @click="startKyc">
          <text :style="ctaLabelStyle">{{ k.cta }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
        <text class="block text-center" :style="ctaNoteStyle">{{ k.ctaNote }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import HowHero from "@/components/how/how-hero.vue";
import HowSection from "@/components/how/how-section.vue";
import HowCalloutBox from "@/components/how/how-callout-box.vue";
import HowStepRow from "@/components/how/how-step-row.vue";
import HowIconRow from "@/components/how/how-icon-row.vue";
import HowFaqRow from "@/components/how/how-faq-row.vue";
import { useT } from "@/i18n/use-t";

const t = useT();
const k = computed(() => t.value.kycExpress);

function startKyc() {
  uni.navigateTo({ url: "/pages/me/wallet-topup?kyc=1", fail: () => {} });
}

const sectionLeadStyle: CSSProperties = {
  marginBottom: "12px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.55,
};
const ctaStyle: CSSProperties = {
  gap: "8px",
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
};
const ctaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--v5-on-brand)",
};
const ctaNoteStyle: CSSProperties = {
  marginTop: "8px",
  fontFamily: "var(--font-v5)",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};
</script>
