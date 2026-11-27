<template>
  <view v-if="open" class="nx-notice-mask nx-sheet-fade-in" @click="maskExit">
    <view :id="id" class="nx-glass-sheet nx-notice nx-dialog-pop-in" role="alertdialog" aria-modal="true" :aria-label="title" :class="[`nx-notice--${tone}`, { 'nx-notice--no-icon': icon === 'none', 'nx-notice--scroll': scrollBody }]" @click="sheetTap = true">
      <view v-if="icon !== 'none'" class="nx-notice__icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="icon === 'clock'"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></template>
          <template v-else-if="icon === 'shield'"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></template>
          <template v-else-if="icon === 'failed'"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></template>
          <template v-else-if="icon === 'info'"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></template>
          <template v-else-if="icon === 'trash'"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></template>
          <template v-else><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></template>
        </svg>
      </view>
      <text :id="id + '-title'" class="nx-notice__title" role="heading" :tabindex="focusTitle ? -1 : undefined">{{ title }}</text>
      <text v-if="body" class="nx-notice__body">{{ body }}</text>
      <view v-if="scrollBody" class="nx-notice__scroll"><slot /></view>
      <slot v-else />
      <view class="nx-notice__actions">
        <NxButton :class="{ 'nx-notice__primary--danger': primaryTone === 'danger' }" :label="primary" variant="primary" :busy="busy" @click="$emit('primary')" />
        <NxButton v-if="secondary" :label="secondary" variant="text" :disabled="busy && !secondaryWhileBusy" @click="$emit('secondary')" />
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';
import NxButton from './nx-button.vue';
import { useDialogA11y } from '@/composables/use-dialog-a11y';
// Centered notice (DS 03 §3.5 居中确认框, the same anatomy as the global confirm()): icon, title, one short explanation,
// a solid primary and an optional secondary exit below it as a brand text button.
const props = withDefaults(defineProps<{ open: boolean; title: string; body?: string; primary: string; secondary?: string;
  icon?: 'alert' | 'clock' | 'shield' | 'failed' | 'info' | 'trash' | 'none'; tone?: 'warning' | 'danger' | 'brand' | 'neutral'; busy?: boolean;
  // A busy primary that only reads (no write in flight) can still be left: the quiet exit, Esc and back stay live (03 §3.5.2).
  secondaryWhileBusy?: boolean;
  // A decision whose primary is the destructive step (03 §3.1: the last step of a confirm may use the error colour).
  primaryTone?: 'danger';
  // Opening focus on the title instead of the first button, so Enter on open does not run the primary (03 §3.5).
  focusTitle?: boolean;
  // A tap on the mask takes the quiet exit, like Esc and back; only flows that allow it opt in (03 §3.5). A tap inside the
  // sheet marks itself on the way up instead (uni H5 normalizes event.target, so a .self check never matches, and stopping
  // propagation would hide the tap from document listeners).
  maskSecondary?: boolean;
  // A long list (a rules explainer): only the content between title and actions scrolls, so both stay on screen.
  scrollBody?: boolean;
  // A notice whose one exit is the primary but that may still be put away unanswered: Esc and Android back emit dismiss
  // (the primary alone records an answer). The mask tap still does nothing.
  dismissible?: boolean }>(), { icon: 'alert', tone: 'warning' });
const emit = defineEmits<{ (event: 'primary'): void; (event: 'secondary'): void; (event: 'dismiss'): void }>();
const id = `nx-notice-${getCurrentInstance()?.uid}`;
let sheetTap = false;
function maskExit() {
  const inside = sheetTap;
  sheetTap = false;
  if (!inside && props.maskSecondary && props.secondary && (!props.busy || props.secondaryWhileBusy)) emit('secondary');
}
// Esc / Android back take the quiet action when there is one; a notice without one must be answered. With focusTitle the
// layer's first focus is the title itself (no control is focused first); Tab still cycles through the buttons (the title
// has tabindex -1 and is no Tab stop).
useDialogA11y(computed(() => props.open), `#${id}`, () => {
  if (props.secondary && (!props.busy || props.secondaryWhileBusy)) emit('secondary');
  else if (!props.secondary && props.dismissible && !props.busy) emit('dismiss');
}, true, 6,
  () => props.focusTitle ? document.getElementById(`${id}-title`) : null);
</script>
<style scoped>
.nx-notice-mask { position: fixed; inset: 0; z-index: 960; display: flex; align-items: center; justify-content: center; padding: 24px 23px; box-sizing: border-box; background: var(--v5-bg-color-mask); }
.nx-notice { width: 100%; max-width: 344px; max-height: 100%; overflow-y: auto; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; padding: 28px 24px 20px; border-radius: var(--v5-radius-2xl); background: var(--nx-glass-fill); box-shadow: var(--nx-glass-edge); color: var(--v5-ink); text-align: center; }
.nx-notice__icon { flex: none; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--nx-notice-fill) var(--nx-notice-fill-amount), transparent); color: var(--nx-notice-tone); }
/* Icon tone: brand = go ahead (pre-payment check), warning = attention, danger = failed, neutral = closed. */
.nx-notice--warning { --nx-notice-tone: var(--v5-warning); --nx-notice-fill: var(--v5-warning); --nx-notice-fill-amount: 14%; }
.nx-notice--brand { --nx-notice-tone: var(--v5-brand); --nx-notice-fill: var(--v5-brand); --nx-notice-fill-amount: 14%; }
.nx-notice--danger { --nx-notice-tone: var(--v5-danger); --nx-notice-fill: var(--v5-danger); --nx-notice-fill-amount: 14%; }
.nx-notice--neutral { --nx-notice-tone: var(--v5-ink-2); --nx-notice-fill: var(--v5-ink-3); --nx-notice-fill-amount: 14%; }
.nx-notice__title { display: block; margin-top: 16px; font: var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); color: var(--v5-ink); text-wrap: balance; }
.nx-notice__body { display: block; margin-top: 8px; font: var(--ui-type-body-weight, 400) var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5); color: var(--v5-ink-2); }
/* The secondary exit is a text button (03 §3.5): 12px below the primary, so its 44px target stays off the primary's. */
.nx-notice__actions { align-self: stretch; display: grid; gap: 12px; margin-top: 24px; }
/* Danger primary: error fill with the on-brand ink, which is the matching pair in both themes (dark #FF5C5C / #0A0A0A,
   light #99443B / white, about 7:1). Disabled, busy and pressed states stay NxButton's. */
.nx-notice__primary--danger :deep(.nx-button__surface) { background: var(--v5-danger); color: var(--v5-on-brand); }
.nx-notice__title:focus { outline: none; }
.nx-notice--no-icon .nx-notice__title { margin-top: 0; }
/* Title and actions stay put; the content between them scrolls when it is taller than the screen allows. */
.nx-notice--scroll { overflow: hidden; }
.nx-notice--scroll .nx-notice__title, .nx-notice--scroll .nx-notice__actions { flex: none; }
.nx-notice__scroll { align-self: stretch; min-height: 0; margin-top: 16px; overflow-y: auto; overscroll-behavior: contain; text-align: left; }
</style>
