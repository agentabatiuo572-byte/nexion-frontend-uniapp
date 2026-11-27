<template>
  <!-- Numbered rules (04 §4.7 条目): 24px brand-soft index, 小标题 title, 长篇规则 body; figures in ink 500 and never split. -->
  <view class="nx-rules" role="list">
    <view v-for="(item, index) in items" :key="index" class="nx-rule" role="listitem">
      <text class="nx-rule__n" aria-hidden="true">{{ index + 1 }}</text>
      <view class="nx-rule__copy">
        <text class="nx-rule__t">{{ item.title }}</text>
        <text class="nx-rule__d"><text v-for="(part, i) in parts(item)" :key="i" :class="{ 'nx-rule__fig': part.figure }">{{ part.text }}</text></text>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import type { RuleItem } from "@/store/ui";
defineProps<{ items: RuleItem[] }>();
// A translated sentence split around its placeholders, so each figure takes its own weight in any word order.
function parts(item: RuleItem): { text: string; figure: boolean }[] {
  return item.body.split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    if (key && item.figures && key in item.figures) return { text: item.figures[key], figure: true };
    if (key && item.values && key in item.values) return { text: item.values[key], figure: false };
    return { text: part, figure: false };
  });
}
</script>
<style scoped>
.nx-rules { display: flex; flex-direction: column; gap: 16px; text-align: left; }
.nx-rule { display: flex; gap: 12px; align-items: flex-start; }
.nx-rule__n { display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 999px; background: var(--v5-brand-soft); color: var(--v5-brand); font: 500 var(--ui-type-description)/1 var(--font-v5); font-variant-numeric: tabular-nums; }
.nx-rule__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.nx-rule__t { color: var(--v5-ink); font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); overflow-wrap: break-word; }
.nx-rule__d { color: var(--v5-ink-2); font: var(--ui-type-long-form-weight) var(--ui-type-long-form)/var(--ui-type-long-form-lh) var(--font-v5); overflow-wrap: break-word; }
.nx-rule__fig { color: var(--v5-ink); font-weight: 500; white-space: nowrap; }
</style>
