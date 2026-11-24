<!-- 「继续添加」 on the bundle page (board B): a section title over one solid list card (01 §1.1.2 纯色); each row has the
     machine thumbnail, name, price · estimate, and one trailing control: brand glass S 「添加」 (03 §3.1, card
     secondary action, 32 visible / 44 hit), a lock entry when the account cannot buy the model yet, or nothing when it
     is out of stock (the neutral tag says so). A row whose body opens the product page sets `openable`. -->
<template>
  <view :id="anchor" class="bundle-more" tabindex="-1">
    <text class="bundle-more__title" role="heading" aria-level="2">{{ title }}</text>
    <view class="bundle-more__card">
      <view v-for="item in items" :key="item.id" class="bundle-more__row" :class="{ 'bundle-more__row--open': item.openable }"
        :role="item.openable ? 'link' : undefined" :tabindex="item.openable ? 0 : undefined" :aria-label="item.openable ? item.name : undefined"
        @click="item.openable && emit('open', item.id)" @keydown.enter.self.prevent="item.openable && emit('open', item.id)">
        <view class="bundle-more__thumb"><CatalogMachineImage class="bundle-more__image" :sku="item.id" :image-url="item.imageUrl" scope-key="bundle-more" /></view>
        <view class="bundle-more__copy">
          <text class="bundle-more__name">{{ item.name }}</text>
          <text class="bundle-more__meta"><text class="bundle-more__price">{{ priceText(item.price) }}</text> · {{ t.bundle.estimateShort }} <text class="bundle-more__estimate">{{ item.estimate }}</text></text>
          <text v-for="(line, index) in item.notes ?? []" :key="index" class="bundle-more__meta bundle-more__note">{{ line }}</text>
          <NxTag v-if="item.tag" class="bundle-more__tag" tone="unavailable" :label="item.tag" />
        </view>
        <view v-if="item.action !== 'none'" class="bundle-more__action" @click.stop @keydown.stop>
        <NxButton v-if="item.action === 'add'" variant="brand" size="small" :label="item.actionLabel" :disabled="item.disabled" @click="emit('add', item.id)">
          <NxIcon name="plus" :size="16" /><text>{{ t.bundle.add }}</text>
        </NxButton>
        <NxButton v-else variant="secondary" size="small" :label="item.actionLabel" @click="emit('add', item.id)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><NxIcon name="chevron-right" :size="16" />
        </NxButton>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import { formatGroupedAmount } from "@/lib/amount-display";
import { useT } from "@/i18n/use-t";

export interface BundleSuggestion {
  id: string; name: string; imageUrl?: string | null; price: number | null; estimate: string;
  /** Extra caption lines (task levels, an eligibility sentence). */
  notes?: string[];
  /** Neutral status tag, e.g. 暂时缺货. */
  tag?: string;
  action: "add" | "locked" | "none";
  /** Screen-reader name of the trailing control (「添加 UVELBox S1」, or why it is locked). */
  actionLabel: string;
  disabled?: boolean;
  /** The row body opens the product page. */
  openable?: boolean;
}
defineProps<{ title: string; items: ReadonlyArray<BundleSuggestion>; anchor: string }>();
const emit = defineEmits<{ (event: "add", id: string): void; (event: "open", id: string): void }>();
const t = useT();
function priceText(price: number | null): string {
  const text = formatGroupedAmount(price);
  return text === "-" ? "—" : `$${text}`;
}
</script>

<style scoped>
.bundle-more { outline: none; }
.bundle-more__title { display: block; margin: 0 16px 12px; color: var(--v5-ink); font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.bundle-more__card { margin: 0 16px; overflow: hidden; border-radius: var(--ui-radius-surface); background: var(--v5-surface); border: 1px solid var(--v5-border); }
[data-theme="light"] .bundle-more__card { box-shadow: var(--v5-glass-shadow); }
.bundle-more__row { display: flex; align-items: center; gap: 12px; min-height: 72px; padding: 12px 16px; box-sizing: border-box; }
.bundle-more__row + .bundle-more__row { border-top: 1px solid var(--v5-border); }
.bundle-more__row--open { cursor: pointer; -webkit-tap-highlight-color: transparent; }
.bundle-more__row--open:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; }
.bundle-more__thumb { position: relative; flex: none; width: 48px; height: 48px; overflow: hidden; border-radius: 12px; background: var(--v5-surface-2); }
.bundle-more__image { position: absolute; left: -6px; top: -8px; width: 60px; height: 60px; }
.bundle-more__copy { flex: 1; min-width: 0; }
.bundle-more__name { display: block; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.bundle-more__meta { display: block; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); font-variant-numeric: tabular-nums; overflow-wrap: break-word; }
.bundle-more__price { color: var(--v5-ink); font-weight: 500; white-space: nowrap; }
.bundle-more__estimate { color: var(--v5-brand); white-space: nowrap; }
.bundle-more__tag { margin-top: 6px; }
.bundle-more__action { flex: none; }
</style>
