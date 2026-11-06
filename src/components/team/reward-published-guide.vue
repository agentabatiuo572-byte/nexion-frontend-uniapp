<template>
  <view>
    <SubPageHeader :back="back" />
    <view v-if="loading && !content" class="mx-4" style="padding: 28px 0; color: var(--v5-ink-3);" role="status"><text>{{ t.howPublished.loading }}</text></view>
    <view v-if="content" class="pb-8">
      <HowHero :kind="kind" :label="heroLabel(content.contentKey)" :title="content.blocks[0]?.title ?? heroLabel(content.contentKey)" :sub="content.blocks[0]?.body ?? ''" accent="purple" />
      <view v-if="content.blocks[0]?.items?.length" class="mx-4" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px">
        <view v-for="(item, itemIndex) in content.blocks[0].items" :key="itemIndex" style="display: flex; gap: 8px">
          <text class="reward-rule-marker" style="color: var(--v5-brand);">•</text><text :style="bodyStyle">{{ item }}</text>
        </view>
      </view>
      <template v-for="(block, index) in content.blocks.slice(1)" :key="block.id">
        <HowSection :title="block.title">
          <text class="block" :style="bodyStyle">{{ block.body }}</text>
          <view v-if="block.items?.length" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px">
            <view v-for="(item, itemIndex) in block.items" :key="itemIndex" style="display: flex; gap: 8px">
              <text class="reward-rule-marker" style="color: var(--v5-ink-3)">{{ itemIndex + 1 }}.</text><text :style="bodyStyle">{{ item }}</text>
            </view>
          </view>
        </HowSection>
      </template>
    </view>
    <EmptyState v-if="error && !content && !loading" kind="recoverable-error" :title="t.howPublished.unavailableTitle" :desc="t.howPublished.unavailableBody" :cta-label="t.ui.retry" @cta="load" />
    <view class="mx-4 mt-6"><view class="reward-cta reward-cta--wide" role="button" tabindex="0" @click="navBack(back)" @keydown.enter.prevent="navBack(back)" @keydown.space.prevent="navBack(back)"><text>{{ backLabel }}</text></view></view>
  </view>
</template>

<script setup lang="ts">
import EmptyState from "@/components/empty-state.vue";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { onShow } from "@/composables/use-tab-page-lifecycle";
import { onUnmounted, ref, watch } from "vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import HowHero from "@/components/team/reward-compact-hero.vue";
import HowSection from "@/components/team/reward-rule-block.vue";
import { ApiError } from "@/api/errors";
import { howContentApi, remoteApiEnabled } from "@/api/runtime";
import type { HowContentDocument, HowContentKey } from "@/api/how-content-api";
import { useLocaleStore } from "@/store/locale";
import { navBack } from "@/lib/route";
import { useT } from "@/i18n/use-t";
import { PublishedContentRequestFence } from "@/components/how/p3-14-published-request-fence";
import { serverLanguage } from "@/i18n";

const props = defineProps<{ contentKey: HowContentKey; back: string; kind: "members" | "balance"; backLabel: string }>();
const emit = defineEmits<{ unavailable: [] }>();
const locale = useLocaleStore();
const t = useT();
const content = ref<HowContentDocument | null>(null);
const loading = ref(true);
const error = ref(false);
const bodyStyle = { fontSize: "var(--ui-type-long-form)", color: "var(--v5-ink-2)", lineHeight: "var(--ui-type-long-form-lh)", minWidth: 0 };
const requestFence = new PublishedContentRequestFence();

function heroLabel(contentKey: HowContentKey): string {
  switch (contentKey) {
    case "wallet-exchange-how": return t.value.exchangeHowItWorks.heroLabel;
    case "genesis-how": return t.value.genesisHowItWorks.heroLabel;
    case "team-binary-how": return t.value.binaryHowItWorks.heroLabel;
    case "team-commissions-how": return t.value.commissionsHowItWorks.heroLabel;
    case "team-unilevel-how": return t.value.unilevelHowItWorks.heroLabel;
  }
}

async function load() {
  const requestKey = `${props.contentKey}:${locale.code}`;
  const generation = requestFence.begin(requestKey);
  if (generation === null) return;

  loading.value = true;
  error.value = false;
  try {
    const next = await howContentApi.published(props.contentKey, serverLanguage(locale.code));
    if (!requestFence.isCurrent(generation)) return;
    // An unresolved rule is unavailable; an internal reference is never its public value.
    if (next.blocks.some(block => [block.title, block.body, ...(block.items ?? [])].some(text => text.includes("{value}")))) {
      throw new Error("HOW_CONTENT_RULE_VALUE_UNRESOLVED");
    }
    if (props.contentKey === "team-unilevel-how" && (!next.blocks.some(block => block.id === "direct-referral-scope")
      || (next.schemaVersion === 2 && (next.templateId !== "unilevel-v2" || !next.blocks.some(block => block.id === "seven-layer-scope"))))) throw new Error("TEAM_PUBLICATION_REQUIRED");
    content.value = next;
  } catch (failure) {
    if (!requestFence.isCurrent(generation)) return;
    if (!(failure instanceof ApiError && failure.kind === "network")) content.value = null;
    error.value = true;
    emit("unavailable");
  } finally {
    if (!requestFence.isCurrent(generation)) return;
    loading.value = false;
    requestFence.settle(generation);
  }
}
watch(
  () => [props.contentKey, locale.code] as const,
  () => {
    requestFence.invalidate();
    content.value = null;
    error.value = false;
    if (remoteApiEnabled) {
      void load();
      return;
    }
    requestFence.invalidate();
    content.value = null;
    error.value = false;
    loading.value = false;
  },
  { immediate: true, flush: "sync" },
);
onShow(() => { if (remoteApiEnabled && !loading.value) void load(); });
useAutoRecovery({ failed: () => remoteApiEnabled && error.value && !loading.value, retry: load });
onUnmounted(() => requestFence.invalidate());
</script>
<style scoped>
.reward-rule-marker { flex-shrink:0; min-width:18px; white-space:nowrap; font:400 var(--ui-type-list-subtitle)/1.65 var(--font-v5); }
</style>
