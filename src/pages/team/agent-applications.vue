<template>
  <AppChassis active="team">
    <view class="records-page nx-viz-motion">
      <SubPageHeader :back="AMBASSADOR_ROUTES.agent" :title="t.headerTitles.teamAgentApplications" />
      <EmptyState v-if="readState === 'error' && !rows" kind="recoverable-error" :title="c.recordsLoadError" :cta-label="t.agent.retry" @cta="retry" />
      <view v-else-if="!rows" class="records-loading" role="status" aria-busy="true"><text>{{ t.agent.loading }}</text></view>
      <EmptyState v-else-if="rows.length === 0" kind="empty-list" :title="c.recordsEmpty" />
      <CardStagger v-else class="records-content">
        <view v-if="pending" class="records-section">
          <view class="records-section__head"><text class="records-section__title">{{ c.inProgress }}</text></view>
          <!-- The in-progress application is this page's focus: soft glass; history rows stay open. -->
          <AmbassadorApplicationCard :application="pending" glass />
        </view>
        <view v-if="past.length" class="records-section">
          <view class="records-section__head"><text class="records-section__title">{{ c.history }}</text><text class="records-section__sub">{{ fmt(c.recordCount, { n: past.length }) }}</text></view>
          <view class="records-list">
            <AmbassadorApplicationRow v-for="row in past" :key="row.applicationId ?? 0" :application="row" chevron />
          </view>
        </view>
      </CardStagger>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onHide, onShow, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import EmptyState from "@/components/empty-state.vue";
import CardStagger from "@/components/card-stagger.vue";
import AmbassadorApplicationCard from "@/components/team/ambassador-application-card.vue";
import AmbassadorApplicationRow from "@/components/team/ambassador-application-row.vue";
import { ambassadorApplicationApi, apiRuntimeConfig } from "@/api/runtime";
import type { AmbassadorApplication } from "@/api/ambassador-application-api";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import { AMBASSADOR_ROUTES } from "@/lib/ambassador-display";
import { ambassadorCopy } from "@/i18n/ambassador";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";

const t = useT();
const app = useApp();
const auth = useAuth();
const locale = useLocaleStore();
const c = computed(() => ambassadorCopy(locale.code));
const rows = ref<AmbassadorApplication[] | null>(null);
const readState = ref<"loading" | "ready" | "error">("loading");
// Only one application can be pending; it leads the page, the rest stay in server order (newest first).
const pending = computed(() => rows.value?.find(row => row.status === "PENDING") ?? null);
const past = computed(() => (rows.value ?? []).filter(row => row !== pending.value));

let visible = false;
let generation = 0;
function scope() {
  const account = app.accountKey, binding = app.accountBindingEpoch, environment = apiRuntimeConfig.environment, baseUrl = apiRuntimeConfig.baseUrl, current = generation;
  return () => visible && auth.isAuthenticated && account === app.accountKey && binding === app.accountBindingEpoch
    && environment === apiRuntimeConfig.environment && baseUrl === apiRuntimeConfig.baseUrl && current === generation;
}
/** Resolves false only when this read failed; a readable list stays on screen while a reread fails. */
async function load(): Promise<boolean> {
  if (!visible || !auth.isAuthenticated) return true;
  const current = scope();
  readState.value = "loading";
  try {
    const value = await ambassadorApplicationApi.history();
    if (!current()) return true;
    rows.value = value;
    readState.value = "ready";
    return true;
  } catch {
    if (!current()) return true;
    readState.value = "error";
    return false;
  }
}
function retry() { void load(); }
function reset() { generation += 1; rows.value = null; readState.value = "loading"; }

watch([() => app.accountKey, () => app.accountBindingEpoch, () => auth.isAuthenticated, () => apiRuntimeConfig.environment, () => apiRuntimeConfig.baseUrl], () => {
  reset();
  void load();
}, { flush: "sync" });

let releaseActiveRefresh = () => {};
onShow(() => {
  visible = true;
  generation += 1;
  void load();
  releaseActiveRefresh();
  releaseActiveRefresh = registerActivePageRefresh(() => load().then((ok) => { if (!ok) throw new Error("AMBASSADOR_RECORDS_REFRESH_FAILED"); }), "pages/team/agent-applications");
});
onHide(() => { visible = false; generation += 1; releaseActiveRefresh(); });
onUnload(() => { visible = false; releaseActiveRefresh(); reset(); });
useAutoRecovery({ failed: () => readState.value === "error", retry: load });
</script>

<style scoped>
.records-page { color: var(--v5-ink); }
.records-loading { padding: var(--v5-space-8) var(--v5-space-4) 0; text-align: center; color: var(--v5-ink-3); }
.records-content { display: flex; flex-direction: column; padding-bottom: calc(var(--v5-space-8) + env(safe-area-inset-bottom)); }
.records-section { margin-top: var(--ui-space-section-gap); }
.records-section:first-child { margin-top: var(--v5-space-6); }
.records-section__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--ui-space-inline); margin: 0 var(--v5-space-4) var(--ui-space-inline); }
.records-section__title { font: var(--ui-type-section-weight, 600) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.records-section__sub { font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.records-section > :deep(.amb-card) { margin: 0 var(--v5-space-4); }
.records-list { margin: 0 var(--v5-space-4); border-top: 1px solid var(--v5-border); }
.records-list > :deep(.amb-row) { border-bottom: 1px solid var(--v5-border); }
</style>
