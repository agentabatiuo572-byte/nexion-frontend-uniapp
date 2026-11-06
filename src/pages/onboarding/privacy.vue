<template>
  <StandalonePageShell>
    <SubPageHeader :back="returnTo" :back-action="goBack" :title="t.privacy.title" plain design />
    <view class="privacy-page">
      <text v-if="loading" class="privacy-copy">{{ t.terms.loading }}</text>
      <EmptyState v-else-if="failed" kind="recoverable-error" :title="t.privacy.unavailable" :cta-label="t.ui.retry" @cta="load" />
      <view v-else-if="policy">
        <text class="privacy-copy">{{ t.privacy.version }} {{ policy.version }} · {{ policy.locale }}</text>
        <text class="privacy-copy">{{ platformDisplayText(policy.hero) }}</text>
        <view v-for="section in policy.sections" :key="section.id" class="privacy-section">
          <text class="privacy-section-title">{{ platformDisplayText(section.title) }}</text>
          <text class="privacy-copy">{{ platformDisplayText(section.body) }}</text>
        </view>
      </view>
    </view>
    <ToastHost />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import EmptyState from "@/components/empty-state.vue";
import ToastHost from "@/components/toast-host.vue";
import { onLoad } from "@dcloudio/uni-app";
import { onMounted, onUnmounted, ref, watch } from "vue";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { privacyPolicyApi } from "@/api/runtime";
import type { PrivacyPolicy } from "@/api/privacy-policy-api";
import { navBack } from "@/lib/route";
import { resolvePrivacyReturn } from "@/lib/privacy-return";
import { platformDisplayText } from "@/lib/brand-copy";
import { serverLanguage } from "@/i18n";
const t = useT();
const locale = useLocaleStore();
const policy = ref<PrivacyPolicy | null>(null);
const loading = ref(false);
const failed = ref(false);
let generation = 0;
const returnTo = ref("/pages/onboarding/intro");
async function load() {
  const request = ++generation;
  loading.value = true;
  failed.value = false;
  policy.value = null;
  try { const value = await privacyPolicyApi.current(serverLanguage(locale.code)); if (request === generation) policy.value = value; }
  catch { if (request === generation) failed.value = true; }
  finally { if (request === generation) loading.value = false; }
}
useAutoRecovery({ failed: () => failed.value && !loading.value, retry: load });
function goBack() { navBack(returnTo.value); }
onLoad((options) => { returnTo.value = resolvePrivacyReturn(options?.return); });
onMounted(() => { void load(); });
watch(() => locale.code, () => { void load(); });
onUnmounted(() => { generation += 1; });
</script>

<style scoped>
.privacy-page { padding: 0 20px 48px; color: var(--v5-ink); }
.privacy-back { color: var(--v5-brand); padding: 8px 0; cursor: pointer; }
.privacy-section { margin-top: 24px; }
.privacy-section-title { display: block; font-size: var(--ui-type-section); font-weight: 600; }
.privacy-copy { display: block; font-size: var(--ui-type-long-form); line-height: var(--ui-type-long-form-lh); white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 10px; color: var(--v5-ink-2); }
</style>
