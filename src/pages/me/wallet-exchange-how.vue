<!--
  Exchange · How it works — explainer (ported from
  Nexion-prototype/app/(main)/me/wallet/exchange/how-it-works/page.tsx). The published
  document renders through ExchangeGuide (approved fund board ExchangeHow); loading,
  fallback and failure stay in HowPublishedContent. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <HowPublishedContent v-if="remoteApiEnabled && exchangeAvailable === true" content-key="wallet-exchange-how" back="/pages/me/wallet-exchange">
      <template #default="{ blocks }">
        <ExchangeGuide v-bind="publishedGuide(blocks)" :back-label="w.ctaBack" :directory-label="t.howPublished.contents" @back="goBack" />
      </template>
    </HowPublishedContent>
    <view v-else-if="remoteApiEnabled" style="padding-bottom: 32px">
      <SubPageHeader back="/pages/me/wallet-exchange" />
      <view class="mx-4" role="status" aria-live="polite" style="padding: 24px 2px; color: var(--v5-ink-2)">
        <text class="block" style="font-size: var(--ui-type-card-title); font-weight: var(--ui-type-card-title-weight)">{{ exchangeAvailable === false ? w.pausedTitle : exchangeLoading ? t.howPublished.loading : t.howPublished.unavailableTitle }}</text>
        <text class="block" style="margin-top: 8px; font-size: var(--ui-type-list-subtitle); line-height: 1.6">{{ exchangeAvailable === false ? w.pausedBody : exchangeLoading ? '' : t.exchange.remoteUnavailableClosed }}</text>
        <view v-if="!exchangeLoading && exchangeAvailable === null" role="button" tabindex="0" style="margin-top: 16px; color: var(--v5-brand)" @click="loadExchangeCaps"  @keydown.enter.prevent="loadExchangeCaps" @keydown.space.prevent="loadExchangeCaps"><text>{{ t.ui.retry }}</text></view>
        <view v-if="exchangeAvailable === false" role="button" tabindex="0" style="margin-top: 16px; color: var(--v5-brand)" @click="goBack"  @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack"><text>{{ w.ctaBack }}</text></view>
      </view>
    </view>
    <view v-if="!remoteApiEnabled" style="padding-bottom: 32px">
      <SubPageHeader back="/pages/me/wallet-exchange" />
      <ExchangeGuide v-bind="localGuide" :back-label="w.ctaBack" :directory-label="t.howPublished.contents" @back="goBack" />
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { onShow } from "@dcloudio/uni-app";
import { navBack } from "@/lib/route";
import { computed, onUnmounted, ref } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import HowPublishedContent from "@/components/how/how-published-content.vue";
import { exchangeApi, remoteApiEnabled } from "@/api/runtime";
import type { HowContentBlock } from "@/api/how-content-api";
import SubPageHeader from "@/components/sub-page-header.vue";
import ExchangeGuide from "@/components/me/exchange-guide.vue";
import { useT } from "@/i18n/use-t";

const t = useT();
const w = computed(() => t.value.exchangeHowItWorks);
const exchangeAvailable = ref<boolean | null>(null);
const exchangeLoading = ref(remoteApiEnabled);
let capsRequest = 0;

async function loadExchangeCaps() {
  if (!remoteApiEnabled) return;
  const request = ++capsRequest;
  exchangeAvailable.value = null;
  exchangeLoading.value = true;
  try {
    const caps = await exchangeApi.fetchCaps();
    if (request === capsRequest) exchangeAvailable.value = caps.swapEnabled;
  } catch {
    // Unknown is not open: the guide must not claim swaps can be submitted.
  } finally {
    if (request === capsRequest) exchangeLoading.value = false;
  }
}
useAutoRecovery({ failed: () => remoteApiEnabled && !exchangeLoading.value && exchangeAvailable.value === null, retry: loadExchangeCaps });
onShow(() => { void loadExchangeCaps(); });
onUnmounted(() => { capsRequest += 1; });

function goBack() {
  navBack("/pages/me/wallet-exchange");
}

// A plain-text section reads as one numbered point: its first sentence leads, the rest explains.
function splitLead(text: string): { title: string; body?: string } {
  const m = /^(.+?(?:[。！？]|[.!?](?=\s)))\s*(\S[\s\S]*)$/.exec(text.trim());
  return m ? { title: m[1], body: m[2] } : { title: text.trim() };
}

// Published document → guide: the first block is the overview, callouts stay callouts, list
// items become numbered rows (the block body leads them in), plain text becomes one row.
function publishedGuide(blocks: HowContentBlock[]) {
  const [intro, ...rest] = blocks;
  return {
    intro: { title: intro?.title ?? w.value.heroLabel, lines: intro ? [intro.body, ...(intro.items ?? [])].filter(Boolean) : [] },
    parts: rest.map(block => block.kind === "callout"
      ? { kind: "callout" as const, id: block.id, title: block.title, body: block.body }
      : block.items?.length
        ? { kind: "section" as const, id: block.id, title: block.title, lead: block.body || undefined, rows: block.items.map(title => ({ title })) }
        : { kind: "section" as const, id: block.id, title: block.title, rows: block.body ? [splitLead(block.body)] : [] }),
  };
}

const localGuide = computed(() => ({
  intro: { title: w.value.heroLabel, lines: [w.value.heroTitle, w.value.heroSub] },
  parts: [
    { kind: "section" as const, id: "steps", title: w.value.s2Title, rows: [
      { title: w.value.s2Step1Title, body: w.value.s2Step1Body },
      { title: w.value.s2Step2Title, body: w.value.s2Step2Body },
      { title: w.value.s2Step3Title, body: w.value.s2Step3Body },
    ] },
    { kind: "section" as const, id: "daily-limit", title: w.value.s3Title, rows: [splitLead(w.value.s3Intro)] },
    { kind: "callout" as const, id: "note", title: w.value.s3HintTitle, body: w.value.s3HintBody },
  ],
}));
</script>
