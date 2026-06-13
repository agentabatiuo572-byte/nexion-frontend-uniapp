<!--
  Referral landing (ported from Nexion-prototype/app/ref/[code]/page.tsx).
  Public full-screen entry for users arriving via a shared /ref link. Establishes
  sponsor social proof + dangles the $5 + 200 NEX gift, then pushes into register
  with the ref code preserved. No chassis (full-bleed, like onboarding). Reads the
  code from `?code=` (the source's dynamic [code] segment). Literal dark hex from
  source mapped to v5 tokens.
-->
<template>
  <view :style="rootStyle">
    <view :style="cornerGlowStyle" />

    <view class="relative" style="padding: 16px">
      <!-- Brand -->
      <view class="flex items-center" style="gap: 8px; margin-bottom: 16px">
        <view class="grid place-items-center" :style="brandMarkStyle">
          <text :style="brandMarkTextStyle">N</text>
        </view>
        <text :style="brandNameStyle">Nexion</text>
        <text :style="refChipStyle">REF/{{ codeUpper }}</text>
      </view>

      <!-- Sponsor hero -->
      <view :style="sponsorCardStyle">
        <view class="flex items-center" style="gap: 12px">
          <view class="grid place-items-center" :style="avatarStyle">
            <text :style="avatarTextStyle">{{ initial }}</text>
          </view>
          <view class="min-w-0" style="flex: 1">
            <view>
              <text :style="sponsorNameStyle">{{ sponsor.name }} </text>
              <text :style="sponsorTagStyle">· {{ t.ref.invitedYou }}</text>
            </view>
            <view class="flex items-center" style="gap: 6px; margin-top: 4px; flex-wrap: wrap">
              <text :style="vRankChipStyle">V{{ sponsor.vRank }} {{ sponsor.title }}</text>
              <text :style="cityLineStyle">{{ cityLine }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Gift hero -->
      <view class="text-center relative overflow-hidden" :style="giftCardStyle">
        <text class="block" :style="giftLabelStyle">{{ t.ref.welcomeGift }}</text>
        <view class="flex items-baseline justify-center" style="gap: 6px; margin-top: 8px">
          <text :style="giftAmountStyle">$5</text>
          <text :style="giftNexStyle">+ 200 NEX</text>
        </view>
        <text class="block" :style="giftSubStyle">{{ t.ref.welcomeGiftSub }}</text>
      </view>

      <!-- What you get -->
      <view :style="perksCardStyle">
        <view v-for="(p, i) in perks" :key="p.key" class="flex items-center" :style="perkRowStyle(i !== perks.length - 1)">
          <view class="grid place-items-center shrink-0" :style="perkIconBoxStyle(p.tint)">
            <view v-html="p.icon" />
          </view>
          <text :style="perkTextStyle" style="flex: 1">{{ perkLabel(p.key) }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M20 6 9 17l-5-5" /></svg>
        </view>
      </view>

      <!-- CTA -->
      <view class="w-full flex items-center justify-center active:scale-[0.98]" :style="ctaStyle" @click="goRegister">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>
        <text style="margin: 0 8px">{{ t.ref.claimCta }}</text>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>

      <view class="text-center" style="margin-top: 8px">
        <text :style="signinStyle">{{ t.ref.signinInstead }} </text>
        <text :style="signinLinkStyle" @click="goLogin">{{ t.ref.continue }}</text>
      </view>

      <!-- Network social proof -->
      <view :style="proofCardStyle">
        <view class="flex items-center" :style="proofHeadStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
          <text>{{ t.ref.thisMonth }}</text>
        </view>
        <view class="grid grid-cols-3 text-center" style="gap: 8px">
          <Stat :label="t.ref.newJoiners" value="28,432" tint="var(--v5-brand)" />
          <Stat :label="t.ref.countries" value="47" />
          <Stat :label="t.ref.paidOut" value="$1.2M" tint="var(--v5-warning)" />
        </view>
      </view>

      <!-- Partner wall -->
      <view :style="partnerCardStyle">
        <view class="flex items-center" :style="partnerHeadStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
          <text>{{ t.ref.backedAudited }}</text>
        </view>
        <view class="flex" style="flex-wrap: wrap; gap: 6px">
          <text v-for="name in PARTNER_LOGOS" :key="name" :style="partnerChipStyle">{{ name }}</text>
        </view>
        <view class="flex" :style="badgeRowStyle">
          <text>SOC 2 Type II</text>
          <text>ISO 27001</text>
          <text>GDPR · MSB</text>
          <text>CertiK audited</text>
        </view>
      </view>

      <!-- Footer -->
      <view class="text-center" :style="footerStyle">
        <text>{{ t.ref.legalLine }} </text>
        <text :style="footerLinkStyle" @click="goTerms">{{ t.ref.terms }}</text>
        <text> · </text>
        <text>{{ t.ref.privacy }}</text>
        <text> · </text>
        <text :style="footerLinkStyle" @click="goTrust">{{ t.ref.trustCenter }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import Stat from "@/components/trust/trust-stat.vue";
import { pickSponsor } from "@/mock/sponsors";

const PARTNER_LOGOS = ["NVIDIA", "Intel", "AMD", "OpenRouter", "OPPO", "TechCrunch"];

const t = useT();
const code = ref("");
onLoad((options) => {
  code.value = options?.code ?? "";
});

const codeUpper = computed(() => code.value.toUpperCase());
const sponsor = computed(() => pickSponsor(code.value));
const initial = computed(() => sponsor.value.name[0]);
const cityLine = computed(() => fmt(t.value.ref.sponsorCityLine, { city: sponsor.value.city, n: sponsor.value.downlines }));

const GIFT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>`;
const SPARK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>`;
const ZAP_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>`;
const USERS_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>`;

type PerkKey = "gift" | "day1" | "always" | "sponsor";
const perks: { key: PerkKey; icon: string; tint: string }[] = [
  { key: "gift", icon: GIFT_SVG, tint: "var(--v5-brand)" },
  { key: "day1", icon: SPARK_SVG, tint: "var(--v5-tech-cyan)" },
  { key: "always", icon: ZAP_SVG, tint: "var(--v5-warning)" },
  { key: "sponsor", icon: USERS_SVG, tint: "var(--v5-tech-cyan)" },
];
function perkLabel(k: PerkKey): string {
  return t.value.ref.perks[k];
}

function goRegister() {
  uni.navigateTo({ url: `/pages/register/register?ref=${encodeURIComponent(code.value)}`, fail: () => {} });
}
function goLogin() {
  uni.navigateTo({ url: `/pages/login/login?ref=${encodeURIComponent(code.value)}`, fail: () => {} });
}
function goTrust() {
  uni.navigateTo({ url: "/pages/trust/trust", fail: () => {} });
}
function goTerms() {
  uni.navigateTo({ url: "/pages/onboarding/terms", fail: () => {} });
}

const rootStyle: CSSProperties = { position: "relative", minHeight: "100vh", background: "var(--v5-bg)", paddingBottom: "24px" };
const cornerGlowStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  height: "260px",
  pointerEvents: "none",
  background:
    "radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--v5-brand-2) 22%, transparent) 0%, transparent 70%), radial-gradient(80% 60% at 50% 100%, color-mix(in srgb, var(--v5-brand) 10%, transparent) 0%, transparent 70%)",
};
const brandMarkStyle: CSSProperties = { width: "28px", height: "28px", borderRadius: "8px", background: "var(--v5-brand)" };
const brandMarkTextStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontWeight: 600, color: "var(--v5-on-brand)", fontSize: "14px" };
const brandNameStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontWeight: 600, fontSize: "15px", letterSpacing: "-0.01em", color: "var(--v5-ink)" };
const refChipStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
  padding: "2px 6px",
  borderRadius: "4px",
  background: "color-mix(in srgb, var(--v5-ink) 4%, transparent)",
};
const sponsorCardStyle: CSSProperties = { borderRadius: "16px", padding: "16px", marginBottom: "12px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)" };
const avatarStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, var(--v5-brand) 0%, var(--v5-tech-cyan) 100%)",
};
const avatarTextStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontWeight: 600, fontSize: "24px", color: "var(--v5-on-brand)" };
const sponsorNameStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "18px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.2 };
const sponsorTagStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const vRankChipStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  padding: "2px 6px",
  borderRadius: "4px",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
  color: "var(--v5-brand)",
  fontWeight: 600,
};
const cityLineStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", color: "var(--v5-ink-3)" };
const giftCardStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "12px",
  background:
    "radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--v5-brand) 22%, transparent) 0%, transparent 65%), var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-brand) 40%, transparent)",
};
const giftLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-brand)" };
const giftAmountStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "48px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const giftNexStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", color: "var(--v5-brand)", fontWeight: 600, lineHeight: 1 };
const giftSubStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "8px", lineHeight: 1.6 };
const perksCardStyle: CSSProperties = { borderRadius: "16px", marginBottom: "12px", overflow: "hidden", background: "var(--v5-surface)", border: "1px solid var(--v5-border)" };
function perkRowStyle(divider: boolean): CSSProperties {
  return { gap: "12px", padding: "12px 16px", borderBottom: divider ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)" : "none" };
}
function perkIconBoxStyle(tint: string): CSSProperties {
  return { width: "36px", height: "36px", borderRadius: "12px", background: `color-mix(in srgb, ${tint} 18%, transparent)` };
}
const perkTextStyle: CSSProperties = { fontSize: "12.5px", color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)", lineHeight: 1.4 };
const ctaStyle: CSSProperties = {
  width: "100%",
  height: "56px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, var(--v5-brand), color-mix(in srgb, var(--v5-brand) 80%, var(--v5-warning)))",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  boxShadow: "var(--v5-spotlight-brand)",
};
const signinStyle: CSSProperties = { fontSize: "10.5px", color: "var(--v5-ink-3)" };
const signinLinkStyle: CSSProperties = { fontSize: "10.5px", color: "var(--v5-brand)" };
const proofCardStyle: CSSProperties = { marginTop: "20px", borderRadius: "16px", padding: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)" };
const proofHeadStyle: CSSProperties = {
  marginBottom: "12px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink-3)",
};
const partnerCardStyle: CSSProperties = { marginTop: "12px", borderRadius: "16px", padding: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)" };
const partnerHeadStyle: CSSProperties = {
  marginBottom: "10px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink-3)",
};
const partnerChipStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: "999px",
  fontFamily: "var(--font-v5)",
  fontSize: "11px",
  fontWeight: 600,
  background: "color-mix(in srgb, var(--v5-ink) 4%, transparent)",
  color: "color-mix(in srgb, var(--v5-ink) 85%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-ink) 6%, transparent)",
};
const badgeRowStyle: CSSProperties = { marginTop: "12px", flexWrap: "wrap", gap: "4px 12px", fontSize: "10.5px", color: "var(--v5-ink-3)" };
const footerStyle: CSSProperties = { marginTop: "24px", fontSize: "10.5px", color: "var(--v5-ink-4)", lineHeight: 1.6, padding: "0 16px" };
const footerLinkStyle: CSSProperties = { color: "var(--v5-ink-3)" };
</script>
