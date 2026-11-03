<template>
  <view class="checkout-legal-group">
    <text class="checkout-legal-group__intro">{{ copy.legalLead }}</text>
    <view class="checkout-legal-group__links" role="navigation" :aria-label="copy.legalLead">
      <view v-for="link in links" :key="link.kind" class="checkout-legal-group__link" role="link" tabindex="0" @click="emit('navigate', link.kind)" @keydown.enter.prevent="!$event.repeat && emit('navigate', link.kind)"><text>{{ link.label }}</text></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useLocaleStore } from '@/store/locale';
import { checkoutFlowCopy } from '@/lib/checkout-flow-copy';
const emit = defineEmits<{ (event: 'navigate', kind: 'aftersales' | 'terms'): void }>();
const locale = useLocaleStore();
const copy = computed(() => checkoutFlowCopy(locale.code));
// The parent opens its existing purchase-policy sheet for aftersales; terms
// opens the published /pages/onboarding/terms route.
const links = computed(() => [
  { kind: 'aftersales' as const, label: copy.value.afterSalesShort },
  { kind: 'terms' as const, label: copy.value.termsShort },
]);
</script>
<style scoped>
.checkout-legal-group { margin-top: var(--v5-space-6); text-align: center; }
.checkout-legal-group__intro { display: block; margin-bottom: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-note-weight, 400) var(--ui-type-note, 12px)/var(--ui-type-note-lh, 18px) var(--font-v5); }
.checkout-legal-group__links { display: flex; justify-content: center; }
.checkout-legal-group__link { position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 44px; padding: var(--v5-space-2) var(--v5-space-4); color: var(--v5-brand); font: var(--ui-type-text-link-weight, 500) var(--ui-type-text-link, 13px)/var(--ui-type-text-link-lh, 18px) var(--font-v5); cursor: pointer; transition: filter 160ms ease-out; }
.checkout-legal-group__link + .checkout-legal-group__link::before { content: ''; position: absolute; left: 0; top: 50%; width: 1px; height: 16px; transform: translateY(-50%); background: color-mix(in srgb, var(--v5-ink) 5%, transparent); pointer-events: none; }
.checkout-legal-group__link:active { filter: brightness(.85); }
.checkout-legal-group__link:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .checkout-legal-group__link { transition: none; } }
</style>
