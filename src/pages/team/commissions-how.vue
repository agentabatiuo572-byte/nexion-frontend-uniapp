<template>
  <AppChassis active="team">
    <RewardPageSurface>
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader :title="t.headerTitles.teamCommissions + t.headerTitles.howItWorksSuffix" back="/pages/team/commissions" />

      <HowHero v-if="hero" kind="ledger" :title="hero.title" :sub="hero.body" :sections="directory.length <= 6 ? directory : undefined" :nav-label="guideCopy.contents" />

      <view v-if="state.loading && !state.snapshot" class="commission-guide-state" role="status" aria-busy="true"><text>{{ content.copy.loading }}</text></view>
      <EmptyState v-else-if="state.error || !content.blocks.length" kind="recoverable-error" page :title="content.copy.unavailable" :cta-label="t.ui.reload" @cta="reload" />

      <template v-if="content.blocks.length">
        <HowSection v-if="overview" anchor="overview" :title="overview.title" :body="overview.body" />

        <!-- F1 (DESIGN F1, 11.2-15): friend purchase reward, per-rank purchase rates and friend device earnings, between 概览 and 奖励渠道. -->
        <template v-if="state.snapshot">
          <TeamRuleDocument v-if="publishedPurchase.length" :blocks="publishedPurchase" />
          <HowSection v-else-if="policy" anchor="friend-purchase" :title="rankCopy.f1Sec" :lead="rankBasedPurchase ? rankCopy.f1Lead : undefined" list>
            <HowItem v-if="rankBasedPurchase" :n="1" :title="rankCopy.f1I1T" :body="rankCopy.f1I1D" />
            <HowItem :n="rankBasedPurchase ? 2 : 1" :title="rankCopy.f1I2T" :body="rankCopy.f1I2D" />
            <HowItem :n="rankBasedPurchase ? 3 : 2" :title="creditsAtOnce(purchaseDays) ? rankCopy.f1NowT : rankCopy.f1I3T" :body="creditsAtOnce(purchaseDays) ? rankCopy.f1NowD : fmt(rankCopy.f1I3D, { d: purchaseDays ?? '—' })" />
          </HowSection>

          <TeamRuleDocument v-if="publishedRates && !showRateTable" :blocks="[publishedRates]" />
          <HowSection v-else-if="showRateTable" anchor="purchase-rates" :title="ratesTitle" :lead="ratesLead">
            <HowItem v-for="(item, index) in publishedRates?.items" :key="index" :n="index + 1" :body="item" />
            <view class="commission-rates" role="table" :aria-label="ratesTitle">
              <view class="commission-rates__row commission-rates__row--head" role="row"><text role="columnheader">{{ rankCopy.f1Rank }}</text><text role="columnheader">{{ rankCopy.l1 }}</text><text role="columnheader">{{ rankCopy.l2 }}</text></view>
              <view v-for="row in rateRows" :key="row.v" class="commission-rates__row" :class="{ 'commission-rates__row--me': row.mine }" role="row"><text class="commission-rates__rank" role="cell">V{{ row.v }}</text><text role="cell">{{ row.l1 }}</text><text role="cell">{{ row.l2 }}</text></view>
            </view>
          </HowSection>

          <TeamRuleDocument v-if="publishedDevice && !showDevicePolicy" :blocks="[publishedDevice]" />
          <HowSection v-else-if="showDevicePolicy" anchor="device-earnings" :title="deviceTitle" :lead="deviceLead" :body="devicePaused ? publishedDevice?.body : undefined" list>
            <HowItem v-for="(item, index) in publishedDevice?.items" :key="index" :n="index + 1" :body="item" />
            <template v-if="!devicePaused">
              <HowItem :n="deviceItemOffset + 1" :title="deviceRateTitle" :body="rankCopy.f1DevI1D" />
              <HowItem :n="deviceItemOffset + 2" :title="rankCopy.f1DevI2T" :body="fmt(rankCopy.f1DevI2D, { u: deviceSplit.u, n: deviceSplit.n })" />
              <HowItem :n="deviceItemOffset + 3" :title="creditsAtOnce(deviceCoolingDays) ? rankCopy.f1NowT : rankCopy.f1DevI3T" :body="creditsAtOnce(deviceCoolingDays) ? rankCopy.f1NowD : fmt(rankCopy.f1DevI3D, { d: deviceCoolingDays ?? '—' })" />
            </template>
          </HowSection>
        </template>

        <HowSection v-if="channelIntro || channels.length" anchor="channels" :title="channelIntro?.title" :lead="channels.length ? channelIntro?.body : undefined" :body="channels.length ? undefined : channelIntro?.body" :list="!!channels.length">
          <HowItem v-for="(item, index) in channels" :key="item.id" :n="index + 1" :title="item.title" :body="item.body" />
        </HowSection>

        <TeamRuleDocument v-if="additionalBlocks.length" :blocks="additionalBlocks" />

        <HowSection v-if="lifecycle || statuses.length || coolingNote" anchor="lifecycle" :title="lifecycle?.title" :lead="hasStatuses ? lifecycle?.body : undefined" :body="hasStatuses ? undefined : lifecycle?.body" :list="hasStatuses">
          <view v-if="statuses.length" class="commission-guide-statuses">
            <template v-for="(status, index) in statuses" :key="status.id">
              <view class="commission-guide-status__tag" :class="{ 'commission-guide-status--next': index > 0 }"><NxTag :tone="status.tone">{{ status.title }}</NxTag></view>
              <text class="commission-guide-status__body" :class="{ 'commission-guide-status--next': index > 0 }">{{ status.body }}</text>
            </template>
          </view>
          <HowNote v-if="coolingNote" tone="note" :title="coolingNote.title" :body="coolingNote.body" />
        </HowSection>

        <HowSection v-if="example || exampleBase || exampleRows.length || exampleTotal || exampleNote" anchor="example" :title="example?.title" :lead="example?.body">
          <view class="commission-guide-example">
            <view v-if="exampleBase" class="commission-guide-example__base">
              <view class="commission-guide-example__row"><text class="commission-guide-example__label">{{ exampleBase.title }}</text><text v-if="exampleBase.amount" class="commission-guide-example__base-value">{{ exampleBase.amount }}</text></view>
              <text v-if="exampleBase.note" class="commission-guide-example__detail">{{ exampleBase.note }}</text>
            </view>
            <view v-for="row in exampleRows" :key="row.id" class="commission-guide-example__row">
              <view class="commission-guide-example__name"><text class="commission-guide-example__label">{{ row.label }}</text><text v-if="row.detail" class="commission-guide-example__detail">{{ row.detail }}</text></view>
              <text v-if="row.amount" class="commission-guide-example__value" :style="{ color: row.color }">{{ row.amount }}</text>
            </view>
            <view v-if="exampleTotal" class="commission-guide-example__row commission-guide-example__total">
              <text class="commission-guide-example__label">{{ exampleTotal.title }}</text>
              <text class="commission-guide-example__total-value">{{ exampleTotal.body }}</text>
            </view>
            <text v-if="exampleNote" class="commission-guide-example__note">{{ exampleNote.body }}</text>
          </view>
        </HowSection>

        <HowSection v-if="faq || faqs.length" anchor="faq" :title="faq?.title" :body="faqs.length ? undefined : faq?.body" :list="!!faqs.length">
          <HowFaqRow v-for="item in faqs" :key="item.id" :q="item.title" :a="item.body" :initial-open="item.id === 'faq-order'" />
        </HowSection>

        <TeamRuleSection :title="guideCopy.fullText" fold>
          <view v-if="publicationFallback" class="commission-guide-publication-note" role="status"><text>{{ t.howPublished.languageFallback }}</text></view>
          <TeamRuleDocument :blocks="content.blocks" compact />
        </TeamRuleSection>

        <text v-if="footer" class="commission-guide-footer">{{ footer.body }}</text>
      </template>

      <view class="mx-4 mt-4">
        <view class="reward-cta reward-cta--wide" role="button" tabindex="0" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack"><text>{{ auditCopy.backCommissions }}</text></view>
      </view>
    </view>
    </RewardPageSurface>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, onUnmounted, ref, watch } from "vue";
import { onShow, onHide } from "@dcloudio/uni-app";
import EmptyState from "@/components/empty-state.vue";
import AppChassis from "@/components/app-chassis.vue";
import RewardPageSurface from "@/components/team/reward-page-surface.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import HowHero from "@/components/team/team-rule-hero.vue";
import HowSection from "@/components/team/team-rule-section.vue";
import HowItem from "@/components/team/team-rule-section.vue";
import HowNote from "@/components/team/team-rule-section.vue";
import HowFaqRow from "@/components/team/team-rule-section.vue";
import TeamRuleSection from "@/components/team/team-rule-section.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import TeamRuleDocument from "@/components/team/team-rule-document.vue";
import { teamRuleGuideCopy } from "@/components/team/team-rule-guide-copy";
import { useT } from "@/i18n/use-t";
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';
import { captureAccountScope, isCurrentAccountScope } from '@/lib/account-scope';
import { useLocaleStore } from "@/store/locale";
import { networkReauditCopy } from "@/i18n/network-reaudit";
import { apiClient, apiRuntimeConfig, expectedApiEnvironment, howContentApi, vRankApi } from "@/api/runtime";
import { createCommissionGuideApi } from "@/api/commission-guide-api";
import { createDirectReferralApi } from "@/api/direct-referral-api";
import { buildCommissionsHowContent, createCommissionsHowResource, type CommissionsHowState } from "@/lib/commissions-how-content";
import { navBack } from "@/lib/route";
import { useVRank } from "@/store/v-rank";
import { useDataVisibility } from "@/store/data-visibility";
import { deviceLevel2On, deviceLevel2RatePct } from "@/lib/device-earning-level2";
import { creditsAtOnce, purchaseCoolingDays } from "@/lib/reward-cooling";
import { fmt, dateLocale } from "@/i18n/format";
import { formatHowNumber, formatRankPurchaseRate } from "@/lib/rank-how-content";
import { serverLanguage } from "@/i18n";
import type { HowContentBlock } from "@/api/how-content-api";

const t = useT();
const locale = useLocaleStore();
const app = useApp();
const auth = useAuth();
const readEnvironment = [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const;
let environmentInvalidated = false;
watch(() => [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const, () => { environmentInvalidated = true; }, { flush: 'sync' });
const environmentCurrent = () => !environmentInvalidated && readEnvironment[0] === apiRuntimeConfig.environment && readEnvironment[1] === apiRuntimeConfig.baseUrl;
const auditCopy = computed(() => networkReauditCopy(locale.code));
const guideCopy = computed(() => teamRuleGuideCopy(locale.code));
const state = ref<CommissionsHowState>({ loading: true, error: false, snapshot: null });
const publicationFallback = computed(() => !!state.value.snapshot && state.value.snapshot.document.locale.split(/[-_]/)[0].toLowerCase() !== locale.code.split(/[-_]/)[0].toLowerCase());
const commissionGuideApi = createCommissionGuideApi(apiClient, expectedApiEnvironment);
const directReferralApi = createDirectReferralApi(apiClient, expectedApiEnvironment);
let resourceOwner = captureAccountScope();
function makeResource() {
  const owner = captureAccountScope(), language = locale.code;
  resourceOwner = owner;
  return createCommissionsHowResource({
  async read(language) {
    const [document, directPolicy, guide, ladder] = await Promise.all([
      howContentApi.published("team-commissions-how", serverLanguage(language)),
      directReferralApi.policy().catch(() => null), commissionGuideApi.read().catch(() => null), vRankApi.ladder().catch(() => null),
    ]);
    const needsRates = ladder && (directPolicy?.sevenLayerReference?.purchaseBaseRateSource !== "BENEFICIARY_RANK"
      || ladder.ranks.some(rank => rank.purchaseL1Rate === undefined || rank.purchaseL2Rate === undefined));
    const rates = needsRates ? await commissionGuideApi.rates().catch(() => undefined) : undefined;
    return { document, directPolicy, guide, ranks: ladder?.ranks ?? null, rates, ratesFailed: !!needsRates && !rates };
  },
  apply: next => {
    if (!isCurrentAccountScope(owner) || language !== locale.code || !environmentCurrent()) return;
    if (next.loading && state.value.snapshot) { state.value = { ...state.value, loading: true, error: false }; return; }
    // 同一账户和环境里已读到的比例，重读失败时保留，同时按失败继续恢复。
    const kept = next.snapshot?.ratesFailed ? state.value.snapshot?.rates : undefined;
    state.value = next.snapshot && kept ? { ...next, snapshot: { ...next.snapshot, rates: kept } } : next;
  },
});
}
let resource = makeResource();
const rankCopy = computed(() => t.value.myRank);
const content = computed(() => buildCommissionsHowContent(state.value.snapshot, locale.code, rankCopy.value.f1DevI1T));
const s = (id: string) => content.value.sections.get(id);
const channelIds = ["network", "binary", "peer", "cultivation", "leadership", "genesis"];
const faqIds = ["faq-order", "faq-withdraw", "faq-reversal", "faq-cultivation"];
const exampleKinds = ["network", "cultivation", "peer", "leadership"] as const;
const dedicatedIds = new Set([
  "hero", "overview", "friend-purchase", "purchase-rates", "device-earnings",
  "channels", ...channelIds, "lifecycle", "cooling", "unlocked", "withdrawn", "cooling-note",
  "example", "example-day", ...exampleKinds.map(key => `example-${key}`), "example-total", "example-note",
  "faq", ...faqIds, "footer",
]);
const additionalBlocks = computed(() => content.value.blocks.filter(block => !dedicatedIds.has(block.id)));
const publishedPurchase = computed(() => ["friend-purchase"].flatMap(id => s(id) ?? []));
const publishedRates = computed(() => s("purchase-rates"));
const publishedDevice = computed(() => s("device-earnings"));
const hero = computed(() => s("hero"));
const overview = computed(() => s("overview"));
const channelIntro = computed(() => s("channels"));
const lifecycle = computed(() => s("lifecycle"));
const coolingNote = computed(() => s("cooling-note"));
const example = computed(() => s("example"));
const exampleTotal = computed(() => s("example-total"));
const exampleNote = computed(() => s("example-note"));
const faq = computed(() => s("faq"));
const footer = computed(() => s("footer"));
const channels = computed(() => channelIds.flatMap(id => s(id) ?? []));
const faqs = computed(() => faqIds.flatMap(id => s(id) ?? []));
const vrank = useVRank();
const visibility = useDataVisibility();
const policy = computed(() => state.value.snapshot?.directPolicy ?? null);
const rankBasedPurchase = computed(() => policy.value?.sevenLayerReference?.purchaseBaseRateSource === "BENEFICIARY_RANK");
const ratesTitle = computed(() => publishedRates.value?.title
  ?? (rankBasedPurchase.value ? rankCopy.value.f1RatesT : content.value.copy.purchaseBudget));
const ratesLead = computed(() => publishedRates.value?.body
  ?? (rankBasedPurchase.value && myRankCode.value ? fmt(rankCopy.value.f1RatesLead, { r: myRankCode.value }) : undefined));
const pct = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : `${formatHowNumber(value, dateLocale())}%`;
const myRankCode = computed(() => vrank.remoteReady ? visibility.mask(`V${vrank.myRank}`) : "");
const purchaseDays = computed(() => purchaseCoolingDays(policy.value));
const deviceL2On = computed(() => deviceLevel2On(policy.value));
const devicePaused = computed(() => policy.value?.deviceEarning.enabled === false);
const rateRows = computed(() => {
  const snapshot = state.value.snapshot;
  const shared = policy.value ? snapshot?.rates?.unilevelUsdt : undefined;
  return (snapshot?.ranks ?? []).filter(rank => rank.visible).sort((a, b) => a.v - b.v).map(rank => ({
    v: rank.v,
    // 政策没读到时，已读到的按等级比例（只在新制生效后才有这两个字段）照常显示，不当成未知。
    l1: formatRankPurchaseRate((rankBasedPurchase.value || !policy.value ? rank.purchaseL1Rate : undefined) ?? shared?.[1], dateLocale()),
    l2: formatRankPurchaseRate((rankBasedPurchase.value || !policy.value ? rank.purchaseL2Rate : undefined) ?? shared?.[2], dateLocale()),
    mine: rankBasedPurchase.value && !visibility.hidden && vrank.remoteReady && rank.v === vrank.myRank,
  }));
});
const showRateTable = computed(() => !publishedRates.value ? rateRows.value.length > 0
  : publishedRates.value.kind !== "callout" && rateRows.value.some(row => row.l1 !== "—" || row.l2 !== "—"));
const showDevicePolicy = computed(() => !!policy.value && publishedDevice.value?.kind !== "callout");
const deviceTitle = computed(() => publishedDevice.value?.title ?? rankCopy.value.f1DevSec);
const deviceLead = computed(() => devicePaused.value ? t.value.directReferral.disabled
  : publishedDevice.value?.body ?? (deviceL2On.value ? rankCopy.value.f1DevLead : guideCopy.value.deviceBody));
const deviceItemOffset = computed(() => publishedDevice.value?.items?.length ?? 0);

function directoryEntry(block: HowContentBlock | undefined, id?: string, title?: string) {
  if (block) return block.kind === "callout" ? [] : [{ id: block.id, title: block.title }];
  return id && title ? [{ id, title }] : [];
}
// The directory follows the rendered anchors, with at most six entries (design system 04.7).
const directory = computed(() => [
  ...directoryEntry(overview.value),
  ...directoryEntry(publishedPurchase.value[0], "friend-purchase", policy.value ? rankCopy.value.f1Sec : undefined),
  ...directoryEntry(publishedRates.value, "purchase-rates", showRateTable.value ? ratesTitle.value : undefined),
  ...directoryEntry(publishedDevice.value, "device-earnings", showDevicePolicy.value ? deviceTitle.value : undefined),
  ...directoryEntry(channelIntro.value),
  ...additionalBlocks.value.flatMap(block => directoryEntry(block)),
  ...[lifecycle.value, example.value, faq.value].flatMap(block => directoryEntry(block)),
]);
const deviceRateTitle = computed(() => {
  const rule = policy.value?.deviceEarning;
  const a = pct(rule ? rule.totalRatePct : null);
  return deviceL2On.value ? fmt(rankCopy.value.f1DevI1T, { a, b: pct(deviceLevel2RatePct(policy.value)) }) : `${rankCopy.value.l1} ${a}`;
});
const deviceSplit = computed(() => {
  const share = policy.value?.deviceEarning.usdtSharePct;
  return share === undefined ? { u: "—", n: "—" } : { u: formatHowNumber(share, dateLocale()), n: formatHowNumber(100 - share, dateLocale()) };
});
const deviceCoolingDays = computed(() => policy.value?.deviceEarning.coolingDays ?? null);
const statuses = computed(() => ([["cooling", "warning"], ["unlocked", "success"], ["withdrawn", "neutral"]] as const).flatMap(([id, tone]) => {
  const section = s(id);
  return section ? [{ ...section, tone }] : [];
}));
const hasStatuses = computed(() => !!(statuses.value.length || coolingNote.value));
const exampleBase = computed(() => {
  const section = s("example-day");
  if (!section) return null;
  return section.body === content.value.exampleBase
    ? { title: section.title, amount: section.body, note: "" }
    : { title: section.title, amount: "", note: section.body };
});
const exampleRows = computed(() => {
  const copy = content.value.copy;
  const statusAmounts = new Set([copy.pendingAmount, copy.notOpen, copy.notConfigured, copy.unknownAmount]);
  const hasContext = !!(example.value && exampleBase.value && exampleNote.value);
  return exampleKinds.flatMap(key => {
    const section = s(`example-${key}`);
    if (!section) return [];
    const amount = hasContext ? content.value.amounts[key] : "";
    const color = amount === copy.pendingAmount ? "var(--v5-warning-ink)" : statusAmounts.has(amount) ? "var(--v5-ink-3)" : amount.includes("UVT") ? "var(--v5-nex-ink)" : "var(--v5-ink)";
    return [{ id: section.id, label: section.title, detail: section.body === amount ? "" : section.body, amount, color }];
  });
});
function reload() {
  if (!isCurrentAccountScope(resourceOwner)) { resource.dispose(); resource = makeResource(); }
  return environmentCurrent() && auth.isAuthenticated ? resource.load(locale.code) : Promise.resolve();
}
onShow(reload);
onHide(() => { resource.dispose(); resource = makeResource(); });
const resourceInputs = () => [app.accountKey, app.accountBindingEpoch, auth.isAuthenticated, locale.code, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const;
watch(resourceInputs, () => {
  resource.dispose(); state.value = { loading: true, error: false, snapshot: null }; resource = makeResource();
}, { flush: 'sync' });
// Revoke the old body immediately; reload captures the owner after account binding settles.
watch(resourceInputs, reload);
onUnmounted(() => resource.dispose());

function goBack() {
  navBack("/pages/team/commissions");
}
useAutoRecovery({ failed: () => {
  const { loading, error, snapshot } = state.value;
  return !loading && (error || (snapshot !== null && (!snapshot.directPolicy || !snapshot.guide || !snapshot.ranks || snapshot.ratesFailed)));
}, retry: reload });
</script>
<style scoped>
.commission-guide-state { margin: 16px 16px 0; padding: 18px 0; border-block: 1px solid var(--v5-border); color: var(--v5-ink-2); font: var(--ui-type-guide-body-weight) var(--ui-type-guide-body)/var(--ui-type-guide-body-lh) var(--font-v5); }
/* One grid for all rows so the tag column shares the widest label in every language (04.7). */
.commission-guide-statuses { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; }
.commission-guide-status__tag, .commission-guide-status__body { align-self: stretch; padding: 12px 0; }
.commission-guide-status__tag { padding-right: 12px; }
.commission-guide-status--next { border-top: 1px solid var(--v5-border); }
.commission-guide-status__body { color: var(--v5-ink-2); font: var(--ui-type-guide-body-weight) var(--ui-type-guide-body)/var(--ui-type-guide-body-lh) var(--font-v5); overflow-wrap: break-word; }
.commission-guide-example { display: flex; flex-direction: column; gap: 12px; white-space: normal; }
.commission-guide-example__base { display: flex; flex-direction: column; gap: 4px; padding-bottom: 12px; border-bottom: 1px solid var(--v5-border); }
.commission-guide-example__base-value { color: var(--v5-ink); font: var(--ui-type-metric-value-weight) var(--ui-type-metric-value)/var(--ui-type-metric-value-lh) var(--font-metric); font-variant-numeric: tabular-nums; overflow-wrap: break-word; }
.commission-guide-example__row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.commission-guide-example__name { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.commission-guide-example__label { color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); overflow-wrap: break-word; }
.commission-guide-example__detail { color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); overflow-wrap: break-word; }
.commission-guide-example__value { flex: none; max-width: 52%; font: 500 var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: break-word; }
.commission-guide-example__total { padding-top: 12px; border-top: 1px solid var(--v5-border); }
.commission-guide-example__total-value { flex: none; max-width: 60%; color: var(--v5-ink); font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); text-align: right; overflow-wrap: break-word; }
.commission-guide-example__note { color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.commission-guide-publication-note { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding-top: 12px; color: var(--v5-ink-3); font: var(--ui-type-guide-body-weight) var(--ui-type-guide-body)/var(--ui-type-guide-body-lh) var(--font-v5); }
/* F1 rate table (DESIGN 4 比例表): rank column in the metric face, rates right-aligned, the reader's row on a brand 8% floor. */
.commission-rates { display: flex; flex-direction: column; }
.commission-rates__row { display: grid; grid-template-columns: minmax(56px, 1fr) 1fr 1.4fr; align-items: center; min-height: 36px; padding: 0 8px; border-top: 1px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); color: var(--v5-ink); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); font-variant-numeric: tabular-nums; }
.commission-rates__row > text { text-align: right; }
.commission-rates__row > text:first-child { text-align: left; }
.commission-rates__row--head { min-height: 32px; border-top: 0; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.commission-rates__rank { font-family: var(--font-metric); font-weight: 500; }
.commission-rates__row--me { border-radius: 10px; background: color-mix(in srgb, var(--v5-brand) 8%, transparent); }
.commission-rates__row--me + .commission-rates__row { border-top-color: transparent; }
.commission-guide-footer { display: block; margin: 16px 20px 0; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); overflow-wrap: break-word; }
</style>
