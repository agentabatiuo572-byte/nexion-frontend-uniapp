<!--
  Terms of Service — onboarding legal page reached from intro's "Terms" link.
  Chassis-less top-level page (like intro / login / register): fixed full-screen
  scrollable dark surface, own sticky back header (no tab chrome). Content is a
  10-section numbered agreement, fully i18n-driven (terms namespace, en/zh
  mirror), believable real-platform tone (no meta / reverse-education copy).
  Opened via navigateTo from intro, Me, or the post-login terms gate; back is
  stack-aware and preserves a validated internal return destination.
-->
<template>
  <StandalonePageShell class="tos-root" :reserve-bottom="false">
    <!-- Sticky back header + brand -->
    <view class="tos-top">
      <view class="tos-back active:opacity-60" :class="{ 'tos-back--blocked': exitBlocked }" role="button" tabindex="0" :aria-disabled="exitBlocked ? 'true' : 'false'" :aria-label="t.login.back" @click="goBack" @keydown.enter.prevent="goBack($event)" @keydown.space.prevent="goBack($event)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </view>
      <view class="tos-brand">
        <BrandLockup variant="mark" :height="32" />
        <text class="tos-brand__name">{{ t.terms.navTitle }}</text>
      </view>
      <view class="tos-top__spacer" />
    </view>

    <view class="tos-wrap">
      <!-- Hero -->
      <view class="tos-hero">
        <text class="tos-eyebrow">{{ serverTerms ? `${serverTerms.effectiveAt} · ${serverTerms.version}` : t.terms.effectiveLabel }}</text>
        <text class="tos-title">{{ serverTerms?.title ?? t.terms.heroTitle }}</text>
        <text class="tos-sub">{{ serverTerms?.summary ?? t.terms.heroSubtitle }}</text>
      </view>

      <!-- Numbered sections -->
      <view v-if="loadError" class="tos-fail" role="alert">
        <text class="tos-fail__message">{{ loadError }}</text>
        <view class="tos-fail__retry active:opacity-70" role="button" tabindex="0" :aria-disabled="loadingTerms ? 'true' : 'false'" @click="retryTerms" @keydown.enter.prevent="retryTerms($event)" @keydown.space.prevent="retryTerms($event)">
          <text>{{ loadingTerms ? "…" : t.ui.retry }}</text>
        </view>
      </view>
      <view v-else-if="loaded" class="tos-sections">
        <view v-for="b in blocks" :key="b.n" class="tos-block">
          <view class="tos-block__head">
            <text class="tos-block__num">{{ pad(b.n) }}</text>
            <text class="tos-block__title">{{ b.title }}</text>
          </view>
          <text class="tos-block__body">{{ b.body }}</text>
        </view>
      </view>
      <view v-else class="tos-fail"><text>{{ t.terms.loading }}</text></view>

      <!-- Risk disclosure cross-link -->
      <view class="tos-risk active:opacity-80" role="link" tabindex="0" @click="goRisk" @keydown.enter.prevent="goRisk($event)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
        <text class="tos-risk__t">{{ t.terms.riskLink }}</text>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </view>

      <!-- Acknowledge & return -->
      <view v-if="!loadError && loaded" class="tos-cta active:opacity-90 active:scale-[0.98]" role="button" tabindex="0" data-system-chrome-primary @click="confirmTerms" @keydown.enter.prevent="confirmTerms($event)" @keydown.space.prevent="confirmTerms($event)">
        <text class="tos-cta__t">{{ confirming ? "…" : (serverTerms?.acknowledged ? t.terms.gotIt : t.terms.confirmContinue) }}</text>
      </view>
    </view>
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onBackPress, onLoad } from "@dcloudio/uni-app";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import BrandLockup from "@/components/brand-lockup.vue";
import { useT } from "@/i18n/use-t";
import { navBack, navTo } from "@/lib/route";
import { legalTermsApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useLocaleStore } from "@/store/locale";
import type { LegalTermsCurrent } from "@/api/legal-terms-api";
import {
  buildLegalTermsLoginRoute,
  buildLegalTermsRoute,
  sameLegalTermsSession,
  sameLegalTermsRun,
  canonicalLegalTermsReturnTo,
  shouldBlockLegalTermsExit,
  type LegalTermsSessionFence,
} from "@/lib/legal-terms-gate";
import { recordLegalTermsAcknowledged } from "@/lib/legal-terms-gate-runtime";
import { captureRuntimeRevision } from "@/api/order-api";

const t = useT();
const locale = useLocaleStore();
const serverTerms = ref<LegalTermsCurrent | null>(null);
type TermsErrorKey = "loadFailed" | "sessionChanged" | "runChanged" | "loginRequired" | "ackFailed";
const loadErrorKey = ref<TermsErrorKey | null>(null);
const loadError = computed(() => loadErrorKey.value ? t.value.terms[loadErrorKey.value] : null);
const confirming = ref(false);
const loadingTerms = ref(false);
const loaded = ref(!remoteApiEnabled);
const returnTo = ref("/pages/onboarding/intro");
const explicitReturn = ref(false);
const exitBlocked = computed(() => shouldBlockLegalTermsExit(remoteApiEnabled, !!currentSessionFence(), serverTerms.value));

const blocks = computed(() => {
  if (serverTerms.value) return [...serverTerms.value.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section, index) => ({ n: index + 1, title: section.title, body: section.body }));
  if (remoteApiEnabled) return [];
  const w = t.value.terms;
  return [
    { n: 1, title: w.s1Title, body: w.s1Body },
    { n: 2, title: w.s2Title, body: w.s2Body },
    { n: 3, title: w.s3Title, body: w.s3Body },
    { n: 4, title: w.s4Title, body: w.s4Body },
    { n: 5, title: w.s5Title, body: w.s5Body },
    { n: 6, title: w.s6Title, body: w.s6Body },
    { n: 7, title: w.s7Title, body: w.s7Body },
    { n: 8, title: w.s8Title, body: w.s8Body },
    { n: 9, title: w.s9Title, body: w.s9Body },
    { n: 10, title: w.s10Title, body: w.s10Body },
  ];
});

onLoad((options) => {
  explicitReturn.value = typeof options?.return === "string" && options.return.length > 0;
  returnTo.value = canonicalLegalTermsReturnTo(options?.return, "/pages/onboarding/intro");
});
onMounted(() => { void loadTerms(); });
onBackPress(() => {
  if (blockRequiredExit()) return true;
  return false;
});

function currentSessionFence(): LegalTermsSessionFence | null {
  const session = sessionVault.read();
  if (!session?.accessToken) return null;
  const revision = captureRuntimeRevision();
  return { accessToken: session.accessToken, userId: session.user.userId, runEpoch: revision.epoch };
}

async function loadTerms() {
  if (!remoteApiEnabled || loadingTerms.value) return;
  loadingTerms.value = true;
  loaded.value = false;
  loadErrorKey.value = null;
  const requestFence = currentSessionFence();
  try {
    const authenticated = !!requestFence;
    const snapshot = await legalTermsApi.current(locale.code, "GLOBAL", authenticated);
    if (requestFence && !sameLegalTermsSession(requestFence, currentSessionFence())) {
      serverTerms.value = null;
      loadErrorKey.value = "sessionChanged";
      return;
    }
    if (!sameLegalTermsRun(snapshot, captureRuntimeRevision().runId)) {
      serverTerms.value = null;
      loadErrorKey.value = "runChanged";
      return;
    }
    serverTerms.value = snapshot;
    if (snapshot.acknowledged) recordLegalTermsAcknowledged(snapshot);
  } catch {
    if (requestFence && !sameLegalTermsSession(requestFence, currentSessionFence())) {
      serverTerms.value = null;
      loadErrorKey.value = "sessionChanged";
      return;
    }
    serverTerms.value = null;
    loadErrorKey.value = "loadFailed";
  } finally {
    loaded.value = true;
    loadingTerms.value = false;
  }
}

function repeatedKeyboardActivation(event?: Event): boolean {
  return Boolean((event as KeyboardEvent | undefined)?.repeat);
}

function retryTerms(event?: Event) {
  if (repeatedKeyboardActivation(event) || loadingTerms.value) return;
  void loadTerms();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

let lastRequiredExitNotice = Number.NEGATIVE_INFINITY;
function blockRequiredExit(): boolean {
  if (!shouldBlockLegalTermsExit(remoteApiEnabled, !!currentSessionFence(), serverTerms.value)) return false;
  const now = Date.now();
  if (now - lastRequiredExitNotice >= 3_000) {
    lastRequiredExitNotice = now;
    uni.showToast({ title: t.value.terms.confirmRequired, icon: "none" });
  }
  return true;
}

function goBack(event?: Event) {
  if (repeatedKeyboardActivation(event)) return;
  if (blockRequiredExit()) return;
  // The post-login gate reaches this page through reLaunch. H5 can still expose
  // a stale stack depth during the acknowledgement transition, making a generic
  // navigateBack pop to an empty hash. An explicit, validated return target is
  // authoritative and must be re-launched deterministically.
  if (explicitReturn.value) { navTo(returnTo.value); return; }
  navBack(returnTo.value);
}
function goRisk(event?: Event) {
  if (repeatedKeyboardActivation(event)) return;
  navTo(`/pages/me/risk-disclosure?return=${encodeURIComponent(returnTo.value)}`);
}
async function confirmTerms(event?: Event) {
  if (repeatedKeyboardActivation(event) || confirming.value) return;
  if (!remoteApiEnabled || !serverTerms.value || serverTerms.value.acknowledged) { goBack(); return; }
  if (!currentSessionFence()) {
    loadErrorKey.value = "loginRequired";
    navTo(buildLegalTermsLoginRoute(buildLegalTermsRoute(returnTo.value)));
    return;
  }
    const requestFence = currentSessionFence();
    const snapshot = serverTerms.value;
    if (!sameLegalTermsRun(snapshot, captureRuntimeRevision().runId)) {
      loadErrorKey.value = "runChanged";
      return;
    }
  confirming.value = true;
  try {
    const acknowledged = await legalTermsApi.acknowledge(snapshot);
    if (!sameLegalTermsSession(requestFence, currentSessionFence())
      || acknowledged.version !== snapshot.version
      || acknowledged.runId !== snapshot.runId
      || !sameLegalTermsRun(acknowledged, captureRuntimeRevision().runId)) {
      loadErrorKey.value = "sessionChanged";
      return;
    }
    serverTerms.value = acknowledged;
    if (acknowledged.acknowledged) {
      recordLegalTermsAcknowledged(acknowledged);
      goBack();
    }
  } catch {
    loadErrorKey.value = "ackFailed";
  }
  finally { confirming.value = false; }
}
</script>

<style scoped>
.tos-root {
  position: fixed;
  inset: 0;
  background: var(--v5-bg);
  overflow-y: auto;
}

/* Top bar */
.tos-top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 10px 16px;
  background: color-mix(in srgb, var(--v5-bg) 86%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--v5-border);
}
.tos-back {
  width: 44px;
  height: 44px;
  margin-left: -8px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: start;
}
.tos-back--blocked {
  opacity: 0.35;
}
.tos-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: center;
}
.tos-brand__name {
  color: var(--v5-ink);
  font-weight: 600;
  font-family: var(--font-v5);
  font-size: 15px;
  letter-spacing: -0.02em;
}
.tos-top__spacer {
  justify-self: end;
}

/* Body */
.tos-wrap {
  padding: 16px 20px calc(env(safe-area-inset-bottom, 0px) + 40px);
}
.tos-hero {
  margin-bottom: 18px;
}
.tos-eyebrow {
  display: block;
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--v5-brand);
}
.tos-title {
  display: block;
  margin-top: 8px;
  font-family: var(--font-v5);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--v5-ink);
}
.tos-sub {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--v5-ink-3);
}

/* Numbered sections */
.tos-sections {
  border-radius: 16px;
  background: var(--v5-surface);
  padding: 2px 18px;
  display: flex;
  flex-direction: column;
}
.tos-fail {
  margin-top: 18px;
  padding: 16px;
  border-radius: 14px;
  color: var(--v5-danger);
  background: color-mix(in srgb, var(--v5-danger) 10%, transparent);
}
.tos-fail__message {
  display: block;
  line-height: 1.55;
}
.tos-fail__retry {
  width: fit-content;
  margin-top: 12px;
  padding: 8px 14px;
  border-radius: 9999px;
  color: var(--v5-on-brand);
  background: var(--v5-brand);
  font-size: 13px;
  font-weight: 600;
}
.tos-block {
  padding: 14px 0;
}
.tos-block:not(:last-child) {
  border-bottom: 1px solid var(--v5-border);
}
.tos-block__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 5px;
}
.tos-block__num {
  font-family: var(--font-jet-mono), ui-monospace, monospace;
  font-size: 12px;
  color: var(--v5-brand);
}
.tos-block__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
  letter-spacing: -0.01em;
}
.tos-block__body {
  display: block;
  font-size: 13px;
  color: var(--v5-ink-2);
  line-height: 1.65;
}

/* Risk cross-link */
.tos-risk {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--v5-brand-2) 10%, transparent);
}
.tos-risk__t {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--v5-brand-2);
}

/* Footer + CTA */
.tos-footer {
  display: block;
  margin-top: 18px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--v5-ink-4);
  text-align: center;
}
.tos-cta {
  margin-top: 20px;
  height: 52px;
  border-radius: 9999px;
  background: var(--v5-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}
.tos-cta__t {
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-on-brand);
}
</style>
