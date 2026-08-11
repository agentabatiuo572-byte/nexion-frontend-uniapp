<!--
  Trust Center (ported from Nexion-prototype/app/(main)/trust/page.tsx).
  Institutional façade: compliance badges, audits/reserves, partner wall, investors,
  leadership, press, Q3 financials, NEX value-anchor, token listings, bug bounty.
  Every artifact is in-product reassurance signalling. Reuses CardStagger + extracted
  trust-* components. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <CardStagger style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- Hero -->
        <view :style="heroStyle">
          <view class="flex items-center" style="gap: 8px">
            <view class="grid place-items-center" :style="heroIconBoxStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            </view>
            <view style="flex: 1">
              <text class="block" :style="heroLabelStyle">{{ tr.heroLabel }}</text>
              <text class="block" :style="heroHeadlineStyle">{{ tr.heroHeadline }}</text>
            </view>
          </view>
          <view class="grid grid-cols-2 text-center" :style="heroStatsStyle">
            <Stat :label="tr.tvlOnChain" :value="trustSnapshotLabel" tint="var(--v5-brand)" />
            <Stat :label="tr.activeNodes" :value="activeDevicesText" />
          </view>
        </view>

        <view v-if="trustLoading" :style="cardStyle"><text :style="complianceBodyStyle">{{ tr.loadingDisclosure }}</text></view>
        <view v-else-if="error" :style="cardStyle">
          <text :style="complianceBodyStyle">{{ trustLoadErrorText }}</text>
          <text class="block active:opacity-70" :style="retryStyle" @click="loadTrustSections">{{ t.ui.retry }}</text>
        </view>
        <view v-else :style="cardStyle">
          <view v-for="section in trustSections" :key="section.sectionKey" :style="serverSectionStyle">
            <text class="block" :style="complianceLabelStyle">{{ section.description }}</text>
            <text class="block" :style="complianceBodyStyle">{{ section.structure }} · {{ section.version }}</text>
            <view v-for="field in section.fields" :key="field.key" :style="serverFieldStyle" @click="openHref(field.href)">
              <text :style="complianceLabelStyle">{{ field.label }}</text>
              <text class="block" :style="complianceBodyStyle">{{ field.value }}</text>
            </view>
          </view>
        </view>
        <view v-if="false">
        <!-- Compliance -->
        <SectionHeader :label="tr.complianceLabel">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /><circle cx="12" cy="8" r="6" /></svg></template>
        </SectionHeader>
        <view class="grid grid-cols-2" style="gap: 8px">
          <view v-for="c in COMPLIANCE" :key="c.label" :style="complianceCardStyle">
            <view class="flex items-center" style="gap: 6px">
              <view :style="dotStyle(c.tint)" />
              <text :style="complianceLabelStyle">{{ c.label }}</text>
            </view>
            <text class="block" :style="complianceBodyStyle">{{ c.body }}</text>
          </view>
        </view>

        <!-- Audits + Reserves -->
        <SectionHeader :label="tr.auditsLabel">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></template>
        </SectionHeader>
        <view :style="cardStyle">
          <DocRow primary="" secondary="" :cta="tr.download" />
          <DocRow primary="" secondary="" :cta="tr.viewOnChain" />
          <DocRow primary="" secondary="" :cta="tr.latest" last />
        </view>

        <!-- Partner wall -->
        <SectionHeader :label="tr.trustedBy" :suffix="tr.trustedSuffix">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></template>
        </SectionHeader>
        <view class="grid grid-cols-2" style="gap: 8px">
          <view v-for="p in PARTNERS" :key="p.name" :style="partnerCardStyle">
            <text class="block" :style="partnerNameStyle">{{ p.name }}</text>
            <text class="block" :style="partnerTagStyle">{{ p.tag }}</text>
          </view>
        </view>

        <!-- Investors -->
        <SectionHeader :label="tr.backedBy" :suffix="tr.backedSuffix">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></svg></template>
        </SectionHeader>
        <view :style="cardStyle">
          <view v-for="(i, idx) in INVESTORS" :key="i.name" class="flex items-center justify-between" :style="investorRowStyle(idx === INVESTORS.length - 1)">
            <text :style="investorNameStyle">{{ i.name }}</text>
            <text :style="investorStageStyle">{{ i.stage }}</text>
          </view>
        </view>

        <!-- Leadership -->
        <SectionHeader :label="tr.leadershipLabel" :suffix="tr.leadershipSuffix">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></svg></template>
        </SectionHeader>
        <view :style="cardStyle">
          <view v-for="(p, i) in LEADERSHIP" :key="p.name" class="flex items-center active:opacity-80" :style="leaderRowStyle(i === LEADERSHIP.length - 1)">
            <view class="grid place-items-center shrink-0" :style="leaderAvatarStyle(p.tint)">
              <text :style="leaderInitialStyle(p.tint)">{{ initials(p.name) }}</text>
            </view>
            <view class="min-w-0" style="flex: 1">
              <text class="block truncate" :style="leaderNameStyle">{{ p.name }}</text>
              <text class="block truncate" :style="leaderRoleStyle">{{ p.role }}</text>
              <text class="block truncate" :style="leaderPrevStyle">{{ p.prev }}</text>
            </view>
            <view class="flex items-center shrink-0" :style="inBadgeStyle">
              <text style="margin-right: 4px">in</text>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            </view>
          </view>
        </view>

        <!-- Press -->
        <SectionHeader :label="tr.inThePress">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" /></svg></template>
        </SectionHeader>
        <view :style="cardStyle">
          <view v-for="(p, i) in PRESS" :key="p.title" class="block active:opacity-80" :style="pressRowStyle(i === PRESS.length - 1)">
            <view class="flex items-center justify-between" style="margin-bottom: 2px">
              <text :style="pressOutletStyle">{{ p.outlet }}</text>
              <text :style="pressDateStyle">{{ p.date }}</text>
            </view>
            <text class="block" :style="pressTitleStyle">{{ p.title }}</text>
          </view>
        </view>

        <!-- Q3 financials -->
        <SectionHeader :label="tr.qtrLabel" :suffix="tr.qtrSuffix">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg></template>
        </SectionHeader>
        <view :style="cardStyle">
          <view class="flex items-center justify-between" :style="q3HeadStyle">
            <view class="flex items-center" style="gap: 8px">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
              <text :style="q3TitleStyle">{{ tr.qtrReportTitle }}</text>
            </view>
            <view class="flex items-center" :style="q3DownloadStyle">
              <text style="margin-right: 4px">{{ tr.q3DownloadCta }}</text>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            </view>
          </view>
          <view class="grid grid-cols-2">
            <view v-for="(row, i) in QTR_FINANCIALS" :key="row.metric" :style="q3CellStyle(i)">
              <text class="block" :style="q3MetricStyle">{{ row.metric }}</text>
              <view class="flex items-baseline" style="gap: 6px; margin-top: 2px">
                <text :style="q3ValueStyle">{{ row.value }}</text>
                <text :style="q3DeltaStyle">{{ row.delta }}</text>
              </view>
            </view>
          </view>
          <text class="block" :style="q3FootStyle">{{ tr.q3Footnote }}</text>
        </view>

        <!-- NEX anchor -->
        <SectionHeader :label="tr.nexAnchorLabel" :suffix="tr.nexAnchorSuffix">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-9" /><path d="M4 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><rect width="20" height="8" x="2" y="12" rx="2" /></svg></template>
        </SectionHeader>
        <NexAnchorSection />

        <!-- Listings -->
        <SectionHeader :label="tr.listingsLabel">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg></template>
        </SectionHeader>
        <view :style="cardStyle">
          <view v-for="(l, i) in LISTINGS" :key="l.exchange" class="flex items-center justify-between" :style="listingRowStyle(i === LISTINGS.length - 1)">
            <text :style="listingNameStyle">{{ l.exchange }}</text>
            <text :style="listingStateStyle(l.tint)">{{ l.state }}</text>
          </view>
        </view>

        <!-- Bug bounty -->
        <SectionHeader :label="tr.bugBountyLabel">
          <template #icon><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></svg></template>
        </SectionHeader>
        <view :style="bugCardStyle">
          <view class="flex items-start" style="gap: 10px">
            <view class="grid place-items-center shrink-0" :style="bugIconBoxStyle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /></svg>
            </view>
            <view style="flex: 1">
              <text class="block" :style="bugAmountStyle">{{ tr.bugBountyAmount }}</text>
              <text class="block" :style="bugHintStyle">{{ tr.bugBountyHint }}</text>
              <view class="flex items-center" :style="bugCtaStyle">
                <text style="margin-right: 4px">{{ tr.bugBountyCta }}</text>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
              </view>
            </view>
          </view>
        </view>
        </view>

        <!-- Footer -->
        <view class="text-center" style="padding-top: 12px; padding-bottom: 4px">
          <text :style="footerStyle">{{ tr.footer }} </text>
          <text :style="footerEmailStyle">compliance@nexgrid.ai</text>
        </view>
      </view>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import SectionHeader from "@/components/trust/trust-section-header.vue";
import Stat from "@/components/trust/trust-stat.vue";
import DocRow from "@/components/trust/trust-doc-row.vue";
import NexAnchorSection from "@/components/trust/nex-anchor-section.vue";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import { toast } from "@/store/ui";
import { navTo } from "@/lib/route";
import { publicStatsHealth } from "@/lib/platform-stats";
import { remoteApiEnabled, trustSectionApi } from "@/api/runtime";
import type { PublishedTrustField, PublishedTrustSection, TrustLocale } from "@/api/trust-section-api";

const t = useT();
const locale = useLocaleStore();
const tr = computed(() => t.value.trust);
const app = useApp();
const cfg = useConfig();
const global = computed(() => app.global);
const activeDevicesText = computed(() => {
  const health = publicStatsHealth(cfg.config.publicStats);
  return cfg.syncFailed || !health.devicesOk
    ? t.value.home.networkStatUpdating
    : global.value.activeDevices.toLocaleString();
});
const language = computed<TrustLocale>(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code as TrustLocale : "zh");
const trustSections = ref<(PublishedTrustSection & { fields: (PublishedTrustField & { href: string | null })[] })[]>([]);
const trustLoading = ref(true);
// 存 key 不存译文:译好的串快照进 ref 后不再跟随语言(uni 复用页面实例时,上一次访问
// 用的语言会留在错误提示上 —— 2026-08-10 实景走查在教程中心实测到这个形态)。
const trustLoadError = ref<"" | "errorOffline" | "errorGeoUnresolved" | "errorUnavailable">("");
const error = trustLoadError;
const trustLoadErrorText = computed(() => trustLoadError.value ? tr.value[trustLoadError.value] : "");
const trustSnapshotLabel = computed(() => trustSections.value.length ? `v${trustSections.value.length}` : "—");

function safeHref(field: PublishedTrustField): string | null {
  const raw = field.value.trim();
  const internal = raw.replace(/^\//, "");
  if (/^(trust\/nex|market\/market)$/.test(internal)) return `/pages/${internal}`;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch { return null; }
}
function openHref(href: string | null) {
  if (!href) return;
  if (href.startsWith("/")) { navTo(href); return; }
  // 外链按端分支 —— 写法抄 src/lib/share.ts:100-114。原先只有 plus.runtime 一条路,
  // 而 plus 只在 App 端注入,于是 H5 下每一条审计报告 / 链上链接都 100% 打不开;
  // 且 plusRuntime 原本在模块作用域读一次,App 端注入晚于模块求值时会永久失效,故改成调用时读。
  let opened = false;
  // #ifdef H5
  opened = !!window.open(href, "_blank");
  // #endif
  // #ifndef H5
  const plusRuntime = (globalThis as { plus?: { runtime?: { openURL: (u: string) => void } } }).plus?.runtime;
  if (plusRuntime) { plusRuntime.openURL(href); opened = true; }
  // #endif
  if (!opened) toast.error(t.value.trust.openFailed);
}
async function loadTrustSections() {
  trustLoading.value = true;
  trustLoadError.value = "";
  trustSections.value = [];
  if (!remoteApiEnabled) { trustLoading.value = false; trustLoadError.value = "errorOffline"; return; }
  try {
    const sections = await trustSectionApi.current();
    trustSections.value = sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({ ...field, href: safeHref(field) })) }));
    void Promise.allSettled(sections.map((section) => trustSectionApi.recordView(section.sectionKey, language.value)));
  } catch (error) {
    trustSections.value = [];
    trustLoadError.value = error instanceof Error && error.message.includes("GEO_COUNTRY_UNRESOLVED")
      ? "errorGeoUnresolved"
      : "errorUnavailable";
  } finally { trustLoading.value = false; }
}
onMounted(() => { void loadTrustSections(); });

const COMPLIANCE: { label: string; body: string; tint: string }[] = [];
const PARTNERS: { name: string; tag: string }[] = [];
const INVESTORS: { name: string; stage: string }[] = [];
const LEADERSHIP: { name: string; role: string; prev: string; tint: string }[] = [];
const PRESS: { outlet: string; title: string; date: string }[] = [];
const QTR_FINANCIALS: { metric: string; value: string; delta: string }[] = [];
const LISTINGS: { exchange: string; state: string; tint: string }[] = [];

function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("");
}

const heroStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "16px",
  background:
    "radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--v5-brand-2) 18%, transparent) 0%, transparent 65%), var(--v5-surface)",
};
const heroIconBoxStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "12px", background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)" };
const heroLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.16em", color: "var(--v5-brand-2)" };
const heroHeadlineStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.25, marginTop: "2px" };
const heroStatsStyle: CSSProperties = { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--v5-border)", gap: "8px" };
// De-carded form-b container (single surface, no border): rows carry their own
// hairline dividers. Used by Audits / Investors / Leadership / Press / Q3 / Listings.
const cardStyle: CSSProperties = { borderRadius: "16px", background: "var(--v5-surface)", overflow: "hidden" };
const serverSectionStyle: CSSProperties = { padding: "14px", borderBottom: "1px solid var(--v5-border)" };
const serverFieldStyle: CSSProperties = { marginTop: "10px" };
const retryStyle: CSSProperties = { marginTop: "12px", color: "var(--v5-brand)", fontSize: "13px" };
const complianceCardStyle: CSSProperties = { borderRadius: "12px", padding: "10px", background: "var(--v5-surface)" };
function dotStyle(tint: string): CSSProperties {
  return { width: "6px", height: "6px", borderRadius: "999px", background: tint };
}
const complianceLabelStyle: CSSProperties = { fontSize: "12px", fontWeight: 600, color: "var(--v5-ink)" };
const complianceBodyStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "4px", lineHeight: 1.375 };
const partnerCardStyle: CSSProperties = { borderRadius: "12px", padding: "12px", background: "var(--v5-surface)" };
const partnerNameStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "13px", fontWeight: 600, letterSpacing: "-0.025em" };
const partnerTagStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "4px" };
function investorRowStyle(last: boolean): CSSProperties {
  return { padding: "10px 16px", borderBottom: last ? "none" : "1px solid var(--v5-border)" };
}
const investorNameStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "13px", fontWeight: 600 };
const investorStageStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)" };
function leaderRowStyle(last: boolean): CSSProperties {
  return { gap: "12px", padding: "10px 12px", borderBottom: last ? "none" : "1px solid var(--v5-border)" };
}
function leaderAvatarStyle(tint: string): CSSProperties {
  return {
    width: "40px",
    height: "40px",
    borderRadius: "999px",
    background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 19%, transparent), color-mix(in srgb, ${tint} 6%, transparent))`,
  };
}
function leaderInitialStyle(tint: string): CSSProperties {
  return { fontFamily: "var(--font-v5)", fontSize: "15px", fontWeight: 600, color: tint };
}
const leaderNameStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const leaderRoleStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-brand)" };
const leaderPrevStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "2px" };
const inBadgeStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  background: "color-mix(in srgb, var(--v5-tech-cyan) 15%, transparent)",
  color: "var(--v5-tech-cyan)",
};
function pressRowStyle(last: boolean): CSSProperties {
  return { padding: "12px 16px", borderBottom: last ? "none" : "1px solid var(--v5-border)" };
}
const pressOutletStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.05em", color: "var(--v5-brand)" };
const pressDateStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)" };
const pressTitleStyle: CSSProperties = { fontSize: "13px", color: "var(--v5-ink)", lineHeight: 1.375 };
const q3HeadStyle: CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid var(--v5-border)",
  background: "linear-gradient(90deg, color-mix(in srgb, var(--v5-brand) 8%, transparent), transparent, color-mix(in srgb, var(--v5-tech-cyan) 8%, transparent))",
};
const q3TitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const q3DownloadStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-brand)" };
function q3CellStyle(i: number): CSSProperties {
  return {
    padding: "12px 16px",
    borderBottom: i < 2 ? "1px solid var(--v5-border)" : "none",
    borderRight: i % 2 === 0 ? "1px solid var(--v5-border)" : "none",
  };
}
const q3MetricStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const q3ValueStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1 };
const q3DeltaStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-success)" };
const q3FootStyle: CSSProperties = { padding: "8px 16px", borderTop: "1px solid var(--v5-border)", fontSize: "12px", color: "var(--v5-ink-4)", fontFamily: "var(--font-jet-mono), ui-monospace, monospace" };
function listingRowStyle(last: boolean): CSSProperties {
  return { padding: "10px 16px", borderBottom: last ? "none" : "1px solid var(--v5-border)" };
}
const listingNameStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "13px", fontWeight: 600 };
function listingStateStyle(tint: string): CSSProperties {
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "12px",
    padding: "2px 8px",
    borderRadius: "999px",
    background: `color-mix(in srgb, ${tint} 12.5%, transparent)`,
    color: tint,
  };
}
const bugCardStyle: CSSProperties = { borderRadius: "16px", padding: "16px", background: "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)" };
const bugIconBoxStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "12px", background: "color-mix(in srgb, var(--v5-brand-2) 20%, transparent)" };
const bugAmountStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const bugHintStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "4px", lineHeight: 1.375 };
const bugCtaStyle: CSSProperties = { marginTop: "8px", display: "inline-flex", minHeight: "44px", fontSize: "12px", color: "var(--v5-brand-2)", fontWeight: 600 };
const footerStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const footerEmailStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-brand)" };
</script>
