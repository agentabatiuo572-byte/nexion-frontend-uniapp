<!--
  Leadership Pool · How it works — ported from
  Nexion-prototype/app/(main)/team/leadership-pool/how-it-works/page.tsx.
  HowHero(purple) + 5 HowSections: what-is + votes-by-rank table + settlement
  timeline (StepRow) + 3 grow-share ways (IconRow) + FAQ + footer CTA(spotlight).
  Deep sub-page → <AppChassis active="team">. SetPageHeader → <SubPageHeader>. table → view rows.
-->
<template>
  <AppChassis active="team">
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/leadership-pool" />

      <HowHero :label="w.heroLabel" :title="w.heroTitle" :sub="w.heroSub" accent="purple" />

      <HowSection :title="w.s1Title" accent="purple">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
        </template>
        <text class="block" :style="paraStyle">{{ w.s1Para1 }}</text>
        <text class="block" :style="{ ...paraStyle, marginTop: '8px' }">{{ w.s1Para2 }}</text>
      </HowSection>

      <HowSection :title="w.s2Title" accent="purple">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4" /><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" /><path d="M22 19H2" /></svg>
        </template>
        <text class="block" :style="captionStyle">{{ w.s2Intro }}</text>
        <view class="rounded-xl border overflow-hidden" :style="tableCardStyle">
          <view class="flex items-center" :style="tableHeadStyle">
            <text :style="thLeftStyle">{{ w.colRank }}</text>
            <text :style="thRightStyle">{{ w.colVotes }}</text>
            <text :style="thRightStyle">{{ w.colShare }}</text>
          </view>
          <view
            v-for="(row, i) in voteRows"
            :key="row.r"
            class="flex items-center"
            :style="tableRowStyle(i === 0)"
          >
            <text class="font-display" :style="rankCellStyle">{{ row.r }}</text>
            <text class="font-display" :style="votesCellStyle">{{ row.v }}</text>
            <text :style="shareCellStyle">{{ row.s }}</text>
          </view>
        </view>
        <text class="block" :style="footnoteStyle">{{ w.s2Footnote }}</text>
      </HowSection>

      <HowSection :title="w.s3Title" accent="purple">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
        </template>
        <text class="block" :style="captionStyle">{{ w.s3Intro }}</text>
        <view style="display: flex; flex-direction: column; gap: 10px">
          <HowStepRow :n="1" :title="w.s3Step1Title" :body="w.s3Step1Body" accent="purple" />
          <HowStepRow :n="2" :title="w.s3Step2Title" :body="w.s3Step2Body" accent="purple" />
          <HowStepRow :n="3" :title="w.s3Step3Title" :body="w.s3Step3Body" accent="purple" />
        </view>
        <HowCalloutBox :title="`💡 ${w.s3HintTitle}`" :body="w.s3HintBody" tone="amber" />
      </HowSection>

      <HowSection :title="w.s4Title" accent="lemon">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
        </template>
        <text class="block" :style="paraStyle">{{ w.s4Intro }}</text>
        <view style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px">
          <HowIconRow emoji="🚀" :label="w.way1Label" :body="w.way1Body" />
          <HowIconRow emoji="💎" :label="w.way2Label" :body="w.way2Body" />
          <HowIconRow emoji="🤝" :label="w.way3Label" :body="w.way3Body" />
        </view>
      </HowSection>

      <HowSection :title="w.faqTitle" accent="lemon">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
        </template>
        <view style="display: flex; flex-direction: column; gap: 10px">
          <HowFaqRow :q="w.faqQ1" :a="w.faqA1" />
          <HowFaqRow :q="w.faqQ2" :a="w.faqA2" />
          <HowFaqRow :q="w.faqQ3" :a="w.faqA3" />
          <HowFaqRow :q="w.faqQ4" :a="w.faqA4" />
        </view>
      </HowSection>

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
import HowHero from "@/components/how/how-hero.vue";
import HowSection from "@/components/how/how-section.vue";
import HowStepRow from "@/components/how/how-step-row.vue";
import HowIconRow from "@/components/how/how-icon-row.vue";
import HowCalloutBox from "@/components/how/how-callout-box.vue";
import HowFaqRow from "@/components/how/how-faq-row.vue";
import { useT } from "@/i18n/use-t";

const t = useT();
const w = computed(() => t.value.poolHowItWorks);

const voteRows = [
  { r: "V3", v: 1, s: "≈ 0.005%" },
  { r: "V4", v: 2, s: "≈ 0.01%" },
  { r: "V5", v: 4, s: "≈ 0.02%" },
  { r: "V6", v: 8, s: "≈ 0.04%" },
  { r: "V7", v: 16, s: "≈ 0.08%" },
  { r: "V8", v: 32, s: "≈ 0.16%" },
  { r: "V9", v: 64, s: "≈ 0.32%" },
  { r: "V10", v: 128, s: "≈ 0.64%" },
];

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/team/leadership-pool", fail: () => {} }) });
}

// ─── styles ───
const paraStyle: CSSProperties = { fontSize: "13.5px", color: "var(--v5-ink-2)", lineHeight: 1.6 };
const captionStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-2)", marginBottom: "12px", lineHeight: 1.55 };
const footnoteStyle: CSSProperties = { marginTop: "8px", fontSize: "11px", color: "var(--v5-ink-4)" };

const tableCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "12px" };
const tableHeadStyle: CSSProperties = {
  padding: "8px 12px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const thLeftStyle: CSSProperties = { flex: "1", textAlign: "left" };
const thRightStyle: CSSProperties = { flex: "1", textAlign: "right" };
function tableRowStyle(isFirst: boolean): CSSProperties {
  return {
    padding: "8px 12px",
    borderTop: isFirst ? "1px solid var(--v5-border)" : "1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)",
    fontSize: "12px",
  };
}
const rankCellStyle: CSSProperties = { flex: "1", fontWeight: 600, color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)" };
const votesCellStyle: CSSProperties = { flex: "1", textAlign: "right", color: "var(--v5-brand-2)" };
const shareCellStyle: CSSProperties = { flex: "1", textAlign: "right", color: "var(--v5-brand)" };

const ctaStyle: CSSProperties = {
  gap: "6px",
  height: "50px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
};
const ctaTextStyle: CSSProperties = {
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
};
</script>
