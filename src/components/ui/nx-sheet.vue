<template>
  <view v-if="open" class="nx-sheet-mask nx-sheet-fade-in">
    <!-- The tap-to-close layer is a sibling under the sheet, not the sheet's parent: uni H5 hands handlers plain-object
         targets, so @click.self never matched and a mask tap closed nothing. Taps on the sheet never reach this layer. -->
    <view class="nx-sheet-scrim" aria-hidden="true" @click="$emit('close')" />
    <view :id="id" class="nx-glass-sheet nx-sheet nx-sheet-slide-up" role="dialog" aria-modal="true" :aria-label="title">
      <view class="nx-sheet__header"><text class="nx-sheet__title">{{ title }}</text><NxButton :label="copy.close" size="medium" @click="$emit('close')"><NxIcon name="close" :size="18" /></NxButton></view>
      <view class="nx-sheet__body"><slot /></view>
      <view v-if="$slots.footer" class="nx-sheet__footer"><slot name="footer" /></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';
import NxButton from './nx-button.vue';
import NxIcon from './nx-icon.vue';
import { useDialogA11y } from '@/composables/use-dialog-a11y';
import { useAuditUiCopy } from '@/i18n/audit-ui';
const props = defineProps<{ open: boolean; title: string; nativeBack?: boolean }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const copy = useAuditUiCopy();
const id = `nx-sheet-${getCurrentInstance()?.uid}`;
useDialogA11y(computed(() => props.open), `#${id}`, () => emit('close'), props.nativeBack);
</script>
<style scoped>
.nx-sheet-mask { position: fixed; inset: 0; z-index: 900; display: flex; align-items: flex-end; justify-content: center; background: #0008; }
.nx-sheet-scrim { position: absolute; inset: 0; }
.nx-sheet { position: relative; display: flex; flex-direction: column; width: 100%; max-width: 480px; max-height: min(88%, calc(100% - var(--nx-overlay-top))); box-sizing: border-box; background: var(--nx-glass-fill); border-radius: var(--nx-glass-radius) var(--nx-glass-radius) 0 0; box-shadow: var(--nx-glass-edge); color: var(--v5-ink); }
.nx-sheet__header { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--v5-border); }
.nx-sheet__title { font: var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); }
.nx-sheet__body { min-height: 0; overflow-y: auto; padding: 20px; }
/* The bottom inset lives in the last band: a scrolling body carries it inside its scroll, so content runs to the screen
   edge instead of stopping above an opaque band; a footer carries it under its actions. */
.nx-sheet__body:last-child::after { content: ""; display: block; height: var(--nx-overlay-safe-bottom); }
.nx-sheet__footer { flex: none; padding: 16px 20px calc(16px + var(--nx-overlay-safe-bottom)); border-top: 1px solid var(--v5-border); }
</style>
