<template>
  <view>
    <SubPageHeader :back="back" />
    <view v-if="loading" class="mx-4" style="padding: 28px 0; color: var(--v5-ink-3);" role="status">正在读取说明…</view>
    <view v-else-if="error" class="mx-4" style="padding: 28px 0;" role="alert">
      <view style="padding: 14px; border-radius: 12px; background: var(--v5-surface-2); color: var(--v5-ink-2);">
        <text class="block" style="font-size: 14px; font-weight: 600;">说明暂不可用</text>
        <text class="block" style="margin-top: 6px; font-size: 12px; color: var(--v5-ink-3);">服务端内容缺失、未发布或环境校验未通过。请重试。</text>
        <view class="flex items-center justify-center" style="margin-top: 12px; height: 40px; border-radius: 999px; background: var(--v5-brand); color: var(--v5-on-brand);" role="button" @click="load">
          <text>重试</text>
        </view>
      </view>
    </view>
    <view v-else-if="content" class="pb-8">
      <HowHero :label="content.contentKey" :title="content.blocks[0]?.title ?? content.contentKey" :sub="content.blocks[0]?.body ?? ''" accent="purple" />
      <HowSection v-for="(block, index) in content.blocks.slice(1)" :key="block.id" :title="block.title" :accent="index % 2 ? 'purple' : 'lemon'">
        <text class="block" :style="bodyStyle">{{ renderBody(block) }}</text>
        <view v-if="block.items?.length" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px">
          <view v-for="item in block.items" :key="item" style="display: flex; gap: 8px">
            <text style="color: var(--v5-brand);">•</text><text :style="bodyStyle">{{ item }}</text>
          </view>
        </view>
        <HowCalloutBox v-if="block.kind === 'callout'" :title="block.title" :body="renderBody(block)" tone="purple" />
      </HowSection>
      <view class="mx-4" style="margin-top: 24px; padding: 10px 12px; border-radius: 10px; background: var(--v5-surface-2); color: var(--v5-ink-3); font-size: 11px;">
        <text>服务端发布版本 {{ content.version }} · {{ content.locale }} · canonical 同源</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import HowHero from "@/components/how/how-hero.vue";
import HowSection from "@/components/how/how-section.vue";
import HowCalloutBox from "@/components/how/how-callout-box.vue";
import { howContentApi, remoteApiEnabled } from "@/api/runtime";
import type { HowContentDocument, HowContentKey, HowContentBlock } from "@/api/how-content-api";
import { useLocaleStore } from "@/store/locale";

const props = defineProps<{ contentKey: HowContentKey; back: string }>();
const locale = useLocaleStore();
const content = ref<HowContentDocument | null>(null);
const loading = ref(true);
const error = ref(false);
const bodyStyle = { fontSize: "13px", color: "var(--v5-ink-2)", lineHeight: 1.65 };

function renderBody(block: HowContentBlock): string {
  if (block.kind !== "ruleRef" || !block.ref) return block.body;
  return block.body.replaceAll("{value}", `${block.ref.key} · ${block.ref.version}`);
}
async function load() {
  loading.value = true; error.value = false;
  try { content.value = await howContentApi.published(props.contentKey, locale.code); }
  catch { content.value = null; error.value = true; }
  finally { loading.value = false; }
}
onMounted(() => { if (remoteApiEnabled) void load(); else loading.value = false; });
</script>
