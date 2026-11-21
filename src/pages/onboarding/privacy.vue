<template>
  <StandalonePageShell>
    <SubPageHeader :back="returnTo" :back-action="goBack" :title="t.privacy.title" plain design />
    <view class="privacy-page">
      <text v-if="loading" class="privacy-copy">{{ t.terms.loading }}</text>
      <EmptyState v-else-if="failed" kind="recoverable-error" page :title="t.privacy.unavailable" :cta-label="t.ui.reload" @cta="load" />
      <view v-else-if="policy">
        <text class="privacy-copy">{{ t.privacy.version }} {{ policy.version }} · {{ policy.locale }}</text>
        <text class="privacy-copy">{{ platformDisplayText(policy.hero) }}</text>
        <view v-for="section in policy.sections" :key="section.id" class="privacy-section">
          <text class="privacy-section-title">{{ platformDisplayText(section.title) }}</text>
          <text class="privacy-copy">{{ platformDisplayText(section.body) }}</text>
        </view>
      </view>
      <view v-if="jpush" class="jpush-privacy">
        <text class="privacy-copy">{{ jpushCopy.details }}</text>
        <button @click="openJPushPolicy">{{ jpushCopy.sdkPolicy }}</button>
        <button v-if="policy" @click="decideJPush(true)">{{ jpushCopy.accept }}</button>
        <button @click="decideJPush(false)">{{ jpushCopy.decline }}</button>
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
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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
import { jpushPrivacyCopy } from "@/i18n/native-push";
import { chooseJPushPrivacy } from "@/services/native-push";
const t = useT();
const locale = useLocaleStore();
const jpush = ref(false);
const jpushCopy = computed(() => locale.code === "zh" || locale.code === "vi"
  ? jpushPrivacyCopy[locale.code] : jpushPrivacyCopy.en);
function openJPushPolicy() {
  // #ifdef APP-PLUS
  plus.runtime.openURL("https://www.jiguang.cn/license/privacy");
  // #endif
}
function decideJPush(accepted: boolean) {
  chooseJPushPrivacy(accepted);
  goBack();
}
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
onLoad((options) => {
  returnTo.value = resolvePrivacyReturn(options?.return);
  // #ifdef APP-PLUS
  jpush.value = options?.source === "jpush" && import.meta.env.VITE_UVEL_JPUSH_ENABLED === "true"
    && plus.os.name === "iOS";
  // #endif
});
onMounted(() => { void load(); });
watch(() => locale.code, () => { void load(); });
onUnmounted(() => { generation += 1; });
</script>

<style scoped>
.privacy-page { padding: 0 20px 48px; color: var(--v5-ink); }
.privacy-back { color: var(--v5-brand); padding: 8px 0; cursor: pointer; }
.privacy-section { margin-top: 24px; }
.jpush-privacy { display: grid; gap: 12px; margin-top: 24px; }
.jpush-privacy button { width: 100%; }
.privacy-section-title { display: block; font-size: var(--ui-type-section); font-weight: 600; }
.privacy-copy { display: block; font-size: var(--ui-type-long-form); line-height: var(--ui-type-long-form-lh); white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 10px; color: var(--v5-ink-2); }
</style>
