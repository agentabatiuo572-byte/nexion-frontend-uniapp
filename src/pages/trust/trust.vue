<template>
  <AppChassis active="me">
    <CardStagger class="trust-root" style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" plain solid />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <view class="nx-glass-card trust-hero">
          <view class="trust-hero__identity">
            <view class="trust-hero__mark" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
            </view>
            <view class="min-w-0">
              <text class="block trust-eyebrow">{{ center.operator }}</text>
              <text class="block trust-hero__name">{{ profile ? profile.legalName : "UVEL" }}</text>
            </view>
          </view>
          <view>
            <text class="block trust-hero__headline">{{ center.headline }}</text>
            <text class="block trust-hero__body">{{ center.subtitle }}</text>
          </view>
          <view v-if="profile" class="trust-chips">
            <view v-for="chip in center.chips" :key="chip" class="trust-chip"><text>✓ {{ chip }}</text></view>
          </view>
          <view v-if="profile" class="trust-facts">
            <view v-for="fact in profileFacts" :key="fact.label" class="trust-fact">
              <text class="block trust-fact__label">{{ fact.label }}</text>
              <text class="block trust-fact__value" :class="{ 'trust-fact__value--small': fact.small }">{{ fact.value }}</text>
            </view>
          </view>
        </view>

        <SectionHeader :label="center.credentialsTitle" />
        <view v-if="!documents" class="nx-glass-card" :style="stateCardStyle">
          <text :style="bodyStyle">{{ documentsStatus === 'error' ? center.documentsError : center.documentsLoading }}</text>
          <text v-if="documentsStatus === 'error'" class="block active:opacity-70" :style="retryStyle" role="button" tabindex="0" @click="refreshDocuments">{{ t.ui.retry }}</text>
        </view>
        <view v-for="card in credentialCards" v-else :key="card.slot" class="nx-glass-card trust-credential">
          <text class="block trust-credential__title">{{ card.title }}</text>
          <text class="block trust-credential__issuer">{{ card.issuer }}</text>
          <text v-if="card.note" class="block trust-credential__note">{{ card.note }}</text>
          <view class="trust-credential__facts">
            <view v-for="fact in card.facts" :key="fact.label" class="trust-credential__fact"><text>{{ fact.label }}</text><text class="trust-credential__value">{{ fact.value }}</text></view>
          </view>
          <view class="trust-credential__actions">
            <text v-if="card.verifyUrl" class="trust-link" role="link" tabindex="0" @click="openHref(card.verifyUrl)">{{ card.verifyLabel }} ↗</text>
            <view v-else />
            <text class="trust-view" role="button" tabindex="0" @click="navTo(`/pages/trust/document?slot=${card.slot}`)">{{ card.viewLabel }}</text>
          </view>
        </view>

        <view v-if="whitepaper" class="trust-whitepaper" role="link" tabindex="0" @click="navTo('/pages/trust/whitepaper')">
          <text class="block trust-whitepaper__eyebrow">WHITEPAPER{{ whitepaper.version ? ` · ${whitepaper.version}` : "" }}</text>
          <view class="trust-whitepaper__copy">
            <text class="block trust-whitepaper__title">{{ center.whitepaperTitle }}</text>
            <text class="block trust-whitepaper__body">{{ center.whitepaperBody }}</text>
          </view>
          <view class="trust-whitepaper__bottom"><text class="trust-whitepaper__meta">{{ whitepaperMeta }}</text><text class="trust-whitepaper__cta">{{ center.readWhitepaper }}</text></view>
        </view>

        <view class="nx-glass-card" v-if="loading" :style="stateCardStyle"><text :style="bodyStyle">{{ tr.loadingDisclosure }}</text></view>
        <view class="nx-glass-card" v-else-if="hasError" :style="stateCardStyle">
          <text :style="bodyStyle">{{ remoteApiEnabled ? tr.errorUnavailable : tr.errorOffline }}</text>
          <text v-if="remoteApiEnabled" class="block active:opacity-70" :style="retryStyle" @click="loadTrustSections">{{ t.ui.retry }}</text>
        </view>

        <template v-else>
          <template v-if="financialSection && financialMetrics.length">
            <SectionHeader :label="sectionLabel(sectionKey.financials)" />
            <view class="nx-glass-card grid grid-cols-2" :style="gridCardStyle">
              <view v-for="metric in financialMetrics" :key="metric.key" :style="metricStyle">
                <text class="block" :style="labelStyle">{{ metric.label }}</text>
                <view class="flex items-baseline" style="gap: 6px; margin-top: 4px">
                  <text :style="metricValueStyle">{{ metric.value }}</text>
                  <text v-if="metric.delta" :style="deltaStyle">{{ metric.delta }}</text>
                </view>
              </view>
            </view>
          </template>

          <template v-if="auditSection && verifiedAuditRows.length">
            <SectionHeader :label="sectionLabel(sectionKey.auditsReserves)" :suffix="auditSection.version" />
            <view class="nx-glass-card" :style="listCardStyle">
              <view v-for="(row, index) in verifiedAuditRows" :key="row.Primary" class="active:opacity-75" :style="listRowStyle(index === verifiedAuditRows.length - 1)"
                role="link" :tabindex="safeHref(row.Url) ? 0 : -1" :aria-disabled="safeHref(row.Url) ? 'false' : 'true'"
                @click="openHref(row.Url)" @keydown.enter.prevent="openHref(row.Url)">
                <view class="min-w-0" style="flex: 1">
                  <text class="block" :style="titleStyle">{{ row.Primary }}</text>
                  <text v-if="row.Secondary" class="block" :style="bodyStyle">{{ row.Secondary }}</text>
                  <text v-if="!safeHref(row.Url)" class="block" :style="bodyStyle">{{ tr.linkUnavailable }}</text>
                </view>
                <text v-if="safeHref(row.Url)" :style="linkStyle">↗</text>
              </view>
            </view>
          </template>

          <template v-if="leadershipSection && verifiedLeadershipRows.length">
            <SectionHeader :label="sectionLabel(sectionKey.leadership)" :suffix="leadershipSection.version" />
            <view class="nx-glass-card" :style="listCardStyle">
              <view v-for="(row, index) in verifiedLeadershipRows" :key="row.Name" :style="listRowStyle(index === verifiedLeadershipRows.length - 1)" @click="openHref(row.Url)">
                <view class="grid place-items-center" :style="avatarStyle"><text :style="avatarTextStyle">{{ initials(row.Name) }}</text></view>
                <view class="min-w-0" style="flex: 1">
                  <text class="block" :style="titleStyle">{{ row.Name }}</text>
                  <text class="block" :style="roleStyle">{{ row.Role }}</text>
                  <text v-if="row.Previous" class="block" :style="bodyStyle">{{ row.Previous }}</text>
                </view>
              </view>
            </view>
          </template>

        </template>
      </view>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { formatAmount } from "@/lib/amount-display";
import { computed, onUnmounted, type CSSProperties } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import SectionHeader from "@/components/trust/trust-section-header.vue";
import Stat from "@/components/trust/trust-stat.vue";
import { useT } from "@/i18n/use-t";
import { trustCenterCopy } from "@/i18n/trust-center";
import { useTrustDocuments } from "@/composables/use-trust-documents";
import { useLocaleStore } from "@/store/locale";
import { useConfig } from "@/store/config";
import { toast } from "@/store/ui";
import { navTo } from "@/lib/route";
import { remoteApiEnabled } from "@/api/runtime";
import type { PublishedTrustSection, TrustLocale } from "@/api/trust-section-api";
import { localizedTrustFieldValue, trustNumberedRows } from "@/lib/trust-fields";
import { recordPublishedTrustViews, usePublishedTrust } from "@/composables/use-published-trust";
import { subscribeRuntimeRevision } from "@/api/order-api";

const t = useT();
const cfg = useConfig();
const tr = computed(() => t.value.trust);
const locale = useLocaleStore();
const language = computed<TrustLocale>(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code as TrustLocale : "en");
const { sections, status, refresh } = usePublishedTrust();
const loading = computed(() => remoteApiEnabled && (status.value === "idle" || status.value === "loading"));
const hasError = computed(() => !remoteApiEnabled || status.value === "error");

function section(key: PublishedTrustSection["sectionKey"]) {
  return sections.value.find((item) => item.sectionKey === key);
}
function sectionLabel(key: PublishedTrustSection["sectionKey"]): string {
  const labels = {
    financials: tr.value.qtrLabel,
    leadership: tr.value.leadershipLabel,
    nexNarrative: tr.value.nexAnchorLabel,
    complianceBadges: tr.value.complianceLabel,
    auditsReserves: tr.value.auditsLabel,
    listings: tr.value.listingsLabel,
  };
  return labels[key];
}
const sectionKey = {
  financials: "financials", leadership: "leadership", nexNarrative: "nexNarrative",
  complianceBadges: "complianceBadges", auditsReserves: "auditsReserves", listings: "listings",
} as const satisfies Record<PublishedTrustSection["sectionKey"], PublishedTrustSection["sectionKey"]>;
const financialSection = computed(() => section(sectionKey.financials));
const leadershipSection = computed(() => section(sectionKey.leadership));
const narrativeSection = computed(() => section(sectionKey.nexNarrative));
const auditSection = computed(() => section(sectionKey.auditsReserves));

const narrativeHero = computed(() => localizedTrustFieldValue(narrativeSection.value?.fields ?? [], "hero", language.value) ?? "");
const narrativeSubhero = computed(() => localizedTrustFieldValue(narrativeSection.value?.fields ?? [], "subhero", language.value) ?? "");
const verified = computed(() => cfg.syncFailed ? null : cfg.config.verifiedStats);
const activeDevicesText = computed(() => verified.value?.onlineDevices.value.toLocaleString("en-US") ?? "—");
const financialMetrics = computed(() => {
  const v = verified.value;
  if (!v) return [];
  return [
    { key: "activeAccountsValue", label: tr.value.activeAccounts, value: v.activeAccounts.value.toLocaleString("en-US"), delta: null },
    { key: "devicesOnlineValue", label: tr.value.activeNodes, value: v.onlineDevices.value.toLocaleString("en-US"), delta: null },
    { key: "payoutsProcessedValue", label: tr.value.completedPayouts, value: formatAmount(v.completedPayoutUsdt.value), delta: null },
  ];
});
const auditRows = computed(() => trustNumberedRows(auditSection.value?.fields ?? [], "document", ["Primary", "Secondary", "Url"] as const, language.value));
const verifiedAuditRows = computed(() => auditRows.value.filter((row) => safeHref(row.Url)));
const leadershipRows = computed(() => trustNumberedRows(leadershipSection.value?.fields ?? [], "leader", ["Name", "Role", "Previous", "Url"] as const, language.value));
const verifiedLeadershipRows = computed(() => leadershipRows.value.filter((row) => safeHref(row.Url)));

const center = computed(() => trustCenterCopy(language.value));
const { documents, status: documentsStatus, refresh: refreshDocuments } = useTrustDocuments();
const profile = computed(() => documents.value?.profile ?? null);
const profileFacts = computed(() => {
  const value = profile.value;
  if (!value) return [];
  return [
    { label: center.value.factJurisdiction, value: value.jurisdiction === "New York, USA" ? center.value.newYork : value.jurisdiction, small: false },
    { label: center.value.factDosId, value: value.nyDosId, small: false },
    { label: center.value.factCapital, value: `US$${value.authorizedCapitalUsd.toLocaleString("en-US")}`, small: false },
    { label: center.value.factAddress, value: value.registeredAddress, small: true },
  ];
});
const credentialCards = computed(() => {
  const value = documents.value;
  if (!value) return [];
  const copy = center.value;
  const { incorporation, msb, ein } = value.documents;
  return [
    { slot: incorporation.slot, title: copy.incorporationTitle, issuer: copy.incorporationIssuer, note: "",
      facts: [{ label: copy.dosIdLabel, value: incorporation.referenceNo ?? value.profile.nyDosId }, { label: copy.filingNumberLabel, value: value.profile.nyFilingNumber }],
      verifyUrl: incorporation.verifyUrl, verifyLabel: copy.incorporationVerify, viewLabel: copy.incorporationView },
    { slot: msb.slot, title: copy.msbTitle, issuer: copy.msbIssuer, note: copy.msbNote,
      facts: msb.referenceNo ? [{ label: copy.msbNumberLabel, value: msb.referenceNo }] : [],
      verifyUrl: msb.verifyUrl, verifyLabel: copy.msbVerify, viewLabel: copy.msbView },
    { slot: ein.slot, title: copy.einTitle, issuer: copy.einIssuer, note: "",
      facts: ein.referenceNo ? [{ label: copy.einLabel, value: ein.referenceNo }] : [],
      verifyUrl: ein.verifyUrl, verifyLabel: copy.einVerify, viewLabel: copy.einView },
  ];
});
const whitepaper = computed(() => documents.value?.documents.whitepaper ?? null);
const whitepaperMeta = computed(() => {
  const value = whitepaper.value;
  if (!value) return "";
  const size = value.sizeBytes >= 1024 * 1024 ? `${(value.sizeBytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value.sizeBytes / 1024))} KB`;
  return ["PDF", value.language, size].filter(Boolean).join(" · ");
});

// Company documents are public and independent of the published sections' view counting.
onShow(() => { void refreshDocuments(); });

let trustPageVisible = false;
let trustVisibleEpoch = 0;
let trustReadRequest = 0;

function invalidateTrustPageRead(): void {
  trustVisibleEpoch += 1;
}

async function loadTrustSections(): Promise<boolean> {
  if (!remoteApiEnabled || !trustPageVisible) return false;
  const visibleEpoch = trustVisibleEpoch;
  const request = ++trustReadRequest;
  const loaded = await refresh(true);
  // The shared Trust reader drops stale runtime generations. The local page
  // fence additionally prevents a hidden/stale visible cycle from counting a
  // late response as a real page view, and records a coalesced read once.
  if (trustPageVisible && visibleEpoch === trustVisibleEpoch && request === trustReadRequest && loaded) {
    recordPublishedTrustViews(sections.value.map((item) => item.sectionKey), language.value);
  }
  return loaded;
}

const unsubscribeTrustRuntime = subscribeRuntimeRevision(() => {
  if (trustPageVisible && remoteApiEnabled) void loadTrustSections();
});

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
}

function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (/^\/pages\/[A-Za-z0-9/_-]+$/.test(value)) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch { return null; }
}


function openHref(raw: string) {
  const href = safeHref(raw);
  if (!href) { toast.error(t.value.trust.linkUnavailable); return; }
  if (href.startsWith("/")) { navTo(href); return; }
  let opened = false;
  // #ifdef H5
  opened = !!window.open(href, "_blank");
  // #endif
  // #ifndef H5
  const runtime = (globalThis as { plus?: { runtime?: { openURL: (url: string) => void } } }).plus?.runtime;
  if (runtime) { runtime.openURL(href); opened = true; }
  // #endif
  if (!opened) toast.error(t.value.trust.openFailed);
}

onShow(() => {
  trustPageVisible = true;
  invalidateTrustPageRead();
  void loadTrustSections();
});
onHide(() => {
  trustPageVisible = false;
  invalidateTrustPageRead();
});
onUnmounted(() => {
  trustPageVisible = false;
  invalidateTrustPageRead();
  unsubscribeTrustRuntime();
});

const heroStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)", borderRadius: "var(--nx-glass-radius)", padding: "16px", background: "var(--nx-glass-fill)" };
const heroIconStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "12px", background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)" };
const heroLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-brand-2)" };
const heroHeadlineStyle: CSSProperties = { marginTop: "3px", fontSize: "20px", fontWeight: 600, lineHeight: 1.3, color: "var(--v5-ink)" };
const heroBodyStyle: CSSProperties = { marginTop: "6px", fontSize: "12px", lineHeight: 1.5, color: "var(--v5-ink-3)" };
const heroStatsStyle: CSSProperties = { marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--v5-border)", gap: "8px" };
const stateCardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)", padding: "16px", borderRadius: "var(--nx-glass-radius)", background: "var(--nx-glass-fill)" };
const gridCardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)", borderRadius: "var(--nx-glass-radius)", overflow: "hidden", background: "var(--nx-glass-fill)" };
const metricStyle: CSSProperties = { padding: "14px", borderRight: "1px solid var(--v5-border)", borderBottom: "1px solid var(--v5-border)" };
const labelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const metricValueStyle: CSSProperties = { fontSize: "20px", fontWeight: 600, color: "var(--v5-ink)" };
const deltaStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-success)" };
const tileStyle: CSSProperties = { padding: "12px", borderRadius: "12px", background: "var(--v5-surface)" };
const listCardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)", borderRadius: "var(--nx-glass-radius)", overflow: "hidden", background: "var(--nx-glass-fill)" };
function listRowStyle(last: boolean): CSSProperties { return { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderBottom: last ? "none" : "1px solid var(--v5-border)" }; }
const titleStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const bodyStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", lineHeight: 1.5, color: "var(--v5-ink-3)" };
const roleStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-brand)" };
const linkStyle: CSSProperties = { fontSize: "15px", color: "var(--v5-brand)" };
const avatarStyle: CSSProperties = { width: "38px", height: "38px", borderRadius: "999px", background: "var(--v5-brand-soft)" };
const avatarTextStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-brand)" };
const retryStyle: CSSProperties = { marginTop: "12px", fontSize: "13px", fontWeight: 600, color: "var(--v5-brand)" };


</script>

<style scoped>
.trust-eyebrow { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.trust-hero { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.trust-hero__identity { display: flex; align-items: center; gap: 12px; }
.trust-hero__mark { width: 48px; height: 48px; flex-shrink: 0; display: grid; place-items: center; border-radius: var(--v5-radius-s); background: var(--v5-brand); color: var(--v5-on-brand); }
.trust-hero__name { font: 700 20px/28px var(--font-v5); color: var(--v5-ink); }
.trust-hero__headline { font: 700 24px/32px var(--font-v5); color: var(--v5-ink); }
.trust-hero__body { margin-top: 6px; font: 400 15px/22px var(--font-v5); color: var(--v5-ink-2); }
.trust-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.trust-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: var(--v5-radius-full); background: var(--v5-brand-soft); color: var(--v5-brand-deep); font: 600 12px/16px var(--font-v5); }
.trust-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; border-radius: var(--v5-radius-m); background: var(--v5-border); }
.trust-fact { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 12px; background: var(--v5-surface-2); }
.trust-fact__label { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.trust-fact__value { font: 600 15px/20px var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.trust-fact__value--small { font-size: 13px; line-height: 18px; }
.trust-credential { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
.trust-credential__title { font: 600 15px/20px var(--font-v5); color: var(--v5-ink); }
.trust-credential__issuer, .trust-credential__note { font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.trust-credential__facts { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: var(--v5-radius-s); background: var(--v5-surface-2); }
.trust-credential__fact { display: flex; justify-content: space-between; gap: 12px; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.trust-credential__value { font-weight: 600; color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.trust-credential__actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
.trust-link { font: 600 13px/18px var(--font-v5); color: var(--v5-brand); cursor: pointer; }
.trust-view { position: relative; display: inline-flex; align-items: center; height: 32px; padding: 0 14px; border-radius: var(--v5-radius-full); background: color-mix(in srgb, var(--v5-brand) 14%, transparent); color: var(--v5-brand-deep); font: 600 13px/18px var(--font-v5); cursor: pointer; }
/* The pill stays 32px tall as drawn; the hit area grows to 44px. */
.trust-view::after { content: ""; position: absolute; inset: -6px 0; }
.trust-whitepaper { display: flex; flex-direction: column; gap: 14px; padding: 20px; border-radius: var(--v5-radius-xl); background: var(--v5-brand); color: var(--v5-on-brand); cursor: pointer; }
.trust-whitepaper__eyebrow { font: 600 12px/16px var(--font-v5); letter-spacing: .6px; opacity: .9; }
.trust-whitepaper__copy { display: flex; flex-direction: column; gap: 6px; }
.trust-whitepaper__title { font: 700 20px/28px var(--font-v5); }
.trust-whitepaper__body { font: 400 13px/18px var(--font-v5); opacity: .92; }
.trust-whitepaper__bottom { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.trust-whitepaper__meta { font: 400 12px/16px var(--font-v5); opacity: .85; }
.trust-whitepaper__cta { display: inline-flex; align-items: center; min-height: 32px; padding: 0 14px; border-radius: var(--v5-radius-full); background: var(--v5-on-brand); color: var(--v5-brand); font: 700 13px/18px var(--font-v5); }
.trust-link:focus-visible, .trust-view:focus-visible, .trust-whitepaper:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
/* The design sets the header title at 15px on this page. */
.trust-root :deep(.spv-title) { font-size: 15px; line-height: 20px; }
</style>
