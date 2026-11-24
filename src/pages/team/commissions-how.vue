<template>
  <AppChassis active="team">
    <RewardPageSurface>
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader :title="t.headerTitles.teamCommissions + t.headerTitles.howItWorksSuffix" back="/pages/team/commissions" />

      <HowHero v-if="!state.error && !content.incomplete" kind="ledger" :title="s(sectionId.hero).title" :sub="s(sectionId.hero).body" :sections="directory.length <= 6 ? directory : undefined" :nav-label="guideCopy.contents" />

      <view v-if="state.loading && !state.snapshot" class="commission-guide-state" role="status" aria-busy="true"><text>{{ content.copy.loading }}</text></view>
      <EmptyState v-else-if="state.error || content.incomplete" kind="recoverable-error" page :title="content.copy.unavailable" :cta-label="t.ui.reload" @cta="reload" />

      <template v-if="!state.error && !content.incomplete">
        <HowSection anchor="overview" :title="s(sectionId.overview).title" :body="s(sectionId.overview).body" />

        <!-- F1 (DESIGN F1, 11.2-15): friend purchase reward, per-rank purchase rates and friend device earnings, between 概览 and 奖励渠道. -->
        <template v-if="state.snapshot">
          <HowSection anchor="friend-purchase" :title="rankCopy.f1Sec" :lead="rankCopy.f1Lead" list>
            <HowItem :n="1" :title="rankCopy.f1I1T" :body="rankCopy.f1I1D" />
            <HowItem :n="2" :title="rankCopy.f1I2T" :body="rankCopy.f1I2D" />
            <HowItem :n="3" :title="rankCopy.f1I3T" :body="fmt(rankCopy.f1I3D, { d: purchaseCoolingDays })" />
          </HowSection>

          <HowSection anchor="purchase-rates" :title="rankCopy.f1RatesT" :lead="myRankCode ? fmt(rankCopy.f1RatesLead, { r: myRankCode }) : undefined">
            <view class="commission-rates" role="table" :aria-label="rankCopy.f1RatesT">
              <view class="commission-rates__row commission-rates__row--head" role="row"><text role="columnheader">{{ rankCopy.f1Rank }}</text><text role="columnheader">{{ rankCopy.l1 }}</text><text role="columnheader">{{ rankCopy.l2 }}</text></view>
              <view v-for="row in rateRows" :key="row.v" class="commission-rates__row" :class="{ 'commission-rates__row--me': row.mine }" role="row"><text class="commission-rates__rank" role="cell">V{{ row.v }}</text><text role="cell">{{ row.l1 }}</text><text role="cell">{{ row.l2 }}</text></view>
            </view>
          </HowSection>

          <HowSection anchor="device-earnings" :title="rankCopy.f1DevSec" :lead="deviceL2On ? rankCopy.f1DevLead : guideCopy.deviceBody" list>
            <HowItem :n="1" :title="deviceRateTitle" :body="rankCopy.f1DevI1D" />
            <HowItem :n="2" :title="rankCopy.f1DevI2T" :body="fmt(rankCopy.f1DevI2D, { u: deviceSplit.u, n: deviceSplit.n })" />
            <HowItem :n="3" :title="rankCopy.f1DevI3T" :body="fmt(rankCopy.f1DevI3D, { d: deviceCoolingDays })" />
          </HowSection>
        </template>

        <HowSection anchor="channels" :title="s(sectionId.channels).title" :lead="s(sectionId.channels).body" list>
          <HowItem v-for="(item, index) in channels" :key="item.id" :n="index + 1" :title="item.title" :body="item.body" />
        </HowSection>

        <HowSection anchor="lifecycle" :title="s(sectionId.lifecycle).title" :lead="s(sectionId.lifecycle).body" list>
          <view class="commission-guide-statuses">
            <template v-for="(status, index) in statuses" :key="status.id">
              <view class="commission-guide-status__tag" :class="{ 'commission-guide-status--next': index > 0 }"><NxTag :tone="status.tone">{{ status.title }}</NxTag></view>
              <text class="commission-guide-status__body" :class="{ 'commission-guide-status--next': index > 0 }">{{ status.body }}</text>
            </template>
          </view>
          <HowNote tone="note" :title="s(sectionId.coolingNote).title" :body="s(sectionId.coolingNote).body" />
        </HowSection>

        <HowSection anchor="example" :title="s(sectionId.example).title" :lead="s(sectionId.example).body">
          <view class="commission-guide-example">
            <view class="commission-guide-example__base">
              <view class="commission-guide-example__row"><text class="commission-guide-example__label">{{ s(sectionId.exampleDay).title }}</text><text v-if="exampleBase.amount" class="commission-guide-example__base-value">{{ exampleBase.amount }}</text></view>
              <text v-if="exampleBase.note" class="commission-guide-example__detail">{{ exampleBase.note }}</text>
            </view>
            <view v-for="row in exampleRows" :key="row.id" class="commission-guide-example__row">
              <view class="commission-guide-example__name"><text class="commission-guide-example__label">{{ row.label }}</text><text v-if="row.detail" class="commission-guide-example__detail">{{ row.detail }}</text></view>
              <text class="commission-guide-example__value" :style="{ color: row.color }">{{ row.amount }}</text>
            </view>
            <view class="commission-guide-example__row commission-guide-example__total">
              <text class="commission-guide-example__label">{{ s(sectionId.exampleTotal).title }}</text>
              <text class="commission-guide-example__total-value">{{ content.exampleTotal }}</text>
            </view>
            <text class="commission-guide-example__note">{{ s(sectionId.exampleNote).body }}</text>
          </view>
        </HowSection>

        <HowSection anchor="faq" :title="s(sectionId.faq).title" list>
          <HowFaqRow :q="s(sectionId.faqOrder).title" :a="s(sectionId.faqOrder).body" initial-open />
          <HowFaqRow :q="s(sectionId.faqWithdraw).title" :a="s(sectionId.faqWithdraw).body" />
          <HowFaqRow :q="s(sectionId.faqReversal).title" :a="s(sectionId.faqReversal).body" />
          <HowFaqRow :q="s(sectionId.faqCultivation).title" :a="s(sectionId.faqCultivation).body" />
        </HowSection>

        <TeamRuleSection :title="guideCopy.fullText" fold>
          <view v-if="publicationFallback" class="commission-guide-publication-note" role="status"><text>{{ t.howPublished.languageFallback }}</text></view>
          <TeamRuleDocument v-if="publishedBlocks" :blocks="publishedBlocks" compact />
          <view v-else class="commission-guide-publication-note"><text>—</text></view>
        </TeamRuleSection>

        <text class="commission-guide-footer">{{ s(sectionId.footer).body }}</text>
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
import { commissionPublishedBlocks } from "@/components/team/team-rule-commission-copy";
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
import { deviceLevel2On, deviceLevel2RatePct } from "@/lib/device-earning-level2";
import { fmt, dateLocale } from "@/i18n/format";
import { formatHowNumber } from "@/lib/rank-how-content";
import { serverLanguage } from "@/i18n";

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
const publishedBlocks = computed(() => state.value.snapshot ? commissionPublishedBlocks(state.value.snapshot, locale.code) : null);
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
      directReferralApi.policy(), commissionGuideApi.read(), vRankApi.ladder(),
    ]);
    return { document, directPolicy, guide, ranks: ladder.ranks };
  },
  apply: next => {
    if (!isCurrentAccountScope(owner) || language !== locale.code || !environmentCurrent()) return;
    state.value = next.loading && state.value.snapshot ? { ...state.value, loading: true, error: false } : next;
  },
});
}
let resource = makeResource();
const content = computed(() => buildCommissionsHowContent(state.value.snapshot, locale.code));
const s = (id: string, fallback?: string) => content.value.section(id, fallback);
const sectionId = {
  hero: "hero", overview: "overview", channels: "channels", lifecycle: "lifecycle",
  cooling: "cooling", unlocked: "unlocked", withdrawn: "withdrawn", coolingNote: "cooling-note",
  example: "example", exampleDay: "example-day", exampleNetwork: "example-network",
  exampleCultivation: "example-cultivation", examplePeer: "example-peer",
  exampleLeadership: "example-leadership", exampleTotal: "example-total", exampleNote: "example-note",
  faq: "faq", faqOrder: "faq-order", faqWithdraw: "faq-withdraw", faqReversal: "faq-reversal",
  faqCultivation: "faq-cultivation", footer: "footer",
} as const;
const channels = computed(() => ["network", "binary", "peer", "cultivation", "leadership", "genesis"].map(id => ({
  ...s(id),
})));
// Design system 04.7: a directory of the expanded sections, statuses as semantic chips, and
// example rows named by their published title. A status amount needs no qualifier line.
// 04.7: a directory with more than six sections is too long and is not shown; the F1 sections take this page to eight.
const directory = computed(() => [
  { id: "overview", title: s("overview").title },
  ...(state.value.snapshot ? [{ id: "friend-purchase", title: rankCopy.value.f1Sec }, { id: "purchase-rates", title: rankCopy.value.f1RatesT }, { id: "device-earnings", title: rankCopy.value.f1DevSec }] : []),
  ...["channels", "lifecycle", "example", "faq"].map(id => ({ id, title: s(id).title })),
]);
const rankCopy = computed(() => t.value.myRank);
const vrank = useVRank();
const policy = computed(() => state.value.snapshot?.directPolicy ?? null);
const pct = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : `${formatHowNumber(value, dateLocale())}%`;
const myRankCode = computed(() => vrank.remoteReady ? `V${vrank.myRank}` : "");
const purchaseCoolingDays = computed(() => {
  const p = policy.value;
  const days = !p ? null : p.settlementMode === "SEVEN_V2" ? p.sevenLayerReference?.coolingDays ?? null : p.purchase.coolingDays;
  return days === null ? "—" : days;
});
// LOGIC SEAMS (DESIGN 5): v-ranks purchaseL1Rate / purchaseL2Rate and direct-referral deviceEarning.level2RatePct are
// not parsed yet. L1 uses directBonus (equal to purchaseL1Rate by contract); L2 shows "—". The device lead and
// first item follow the level-2 switch in lib/device-earning-level2.ts.
const rankPurchaseL2Pct = (_v: number): number | null => null;
const deviceL2On = computed(() => deviceLevel2On(policy.value));
const rateRows = computed(() => (state.value.snapshot?.ranks ?? []).filter(rank => rank.visible).sort((a, b) => a.v - b.v)
  .map(rank => ({ v: rank.v, l1: pct(Math.round(rank.directBonus * 1000) / 10), l2: pct(rankPurchaseL2Pct(rank.v)), mine: vrank.remoteReady && rank.v === vrank.myRank })));
const deviceRateTitle = computed(() => {
  const rule = policy.value?.deviceEarning;
  const a = pct(rule ? rule.totalRatePct : null);
  return deviceL2On.value ? fmt(rankCopy.value.f1DevI1T, { a, b: pct(deviceLevel2RatePct(policy.value)) }) : `${rankCopy.value.l1} ${a}`;
});
const deviceSplit = computed(() => {
  const share = policy.value?.deviceEarning.usdtSharePct;
  return share === undefined ? { u: "—", n: "—" } : { u: formatHowNumber(share, dateLocale()), n: formatHowNumber(100 - share, dateLocale()) };
});
const deviceCoolingDays = computed(() => policy.value?.deviceEarning.coolingDays ?? "—");
const statuses = computed(() => ([["cooling", "warning"], ["unlocked", "success"], ["withdrawn", "neutral"]] as const).map(([id, tone]) => ({ ...s(id), tone })));
// The demo template folds its scope sentence and the order base into one body; split them so
// only the amount takes figure styling. A plain published sentence stays a note.
const exampleBase = computed(() => {
  const body = s(sectionId.exampleDay).body, scope = content.value.copy.exampleScope;
  // The scope ends by introducing the amount ("…基数："); that lead-in moves with the amount.
  return body.startsWith(scope) ? { amount: body.slice(scope.length).trim(), note: scope.replace(/[^。.!?！？]*[:：]\s*$/, "").trim() } : { amount: "", note: body };
});
const exampleRows = computed(() => {
  const copy = content.value.copy;
  const statusAmounts = new Set([copy.pendingAmount, copy.notOpen, copy.notConfigured, copy.unknownAmount]);
  return ([["network", sectionId.exampleNetwork], ["cultivation", sectionId.exampleCultivation], ["peer", sectionId.examplePeer], ["leadership", sectionId.exampleLeadership]] as const).map(([key, id]) => {
    const section = s(id), amount = content.value.amounts[key];
    const color = amount === copy.pendingAmount ? "var(--v5-warning-ink)" : statusAmounts.has(amount) ? "var(--v5-ink-3)" : amount.includes("UVT") ? "var(--v5-nex-ink)" : "var(--v5-ink)";
    return { id, label: section.title, detail: statusAmounts.has(amount) || section.body === amount ? "" : section.body, amount, color };
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
useAutoRecovery({ failed: () => state.value.error && !state.value.loading, retry: reload });
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
