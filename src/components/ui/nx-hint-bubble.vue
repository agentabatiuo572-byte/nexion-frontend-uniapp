<!--
  NxHintBubble — the hint bubble of design system 03 §3.5.1 (提示气泡): an info icon beside the item it explains; a tap opens
  a short explanation pointing at the icon. The icon's box is its 16px glyph so it sits in a text line; the 44px target is a
  layer that takes no layout. The bubble uses the toast's dark translucent face in both themes, at most 280px wide, 13/18,
  one sentence per paragraph (at most three), no buttons. A tap on the icon toggles it; a tap outside it, a scroll anywhere
  or Esc closes it; opening one closes any other. Screen readers read the full text as the icon's name, so the bubble
  itself is hidden from them.
  The parent owns `open` (v-model:open): inside a dialog, Esc and back reach the dialog first, so the dialog's close
  closes an open bubble before anything else (see tradein-sheets.vue).
-->
<template>
  <view :id="rootId" class="nx-hint" :class="`nx-hint--${tone}`">
    <view class="nx-hint__trigger" role="button" tabindex="0" :aria-label="label" :aria-expanded="open ? 'true' : 'false'"
      @click="toggle" @keydown.enter.prevent="onKey" @keydown.space.prevent="onKey">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>
    </view>
    <view v-if="open" :id="bubbleId" class="nx-hint__bubble" :class="{ 'nx-hint__bubble--placed': placed }" :style="bubbleStyle" aria-hidden="true">
      <text v-for="(line, index) in lines" :key="index" class="nx-hint__line">{{ line }}</text>
      <view class="nx-hint__arrow" :style="arrowStyle" />
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue';
const props = withDefaults(defineProps<{ open: boolean; text: string | readonly string[]; tone?: 'neutral' | 'warning' }>(), { tone: 'neutral' });
const emit = defineEmits<{ (event: 'update:open', open: boolean): void }>();
const uid = getCurrentInstance()?.uid;
const rootId = `nx-hint-${uid}`;
const bubbleId = `nx-hint-bubble-${uid}`;
const lines = computed(() => (typeof props.text === 'string' ? [props.text] : props.text).slice(0, 3));
const label = computed(() => lines.value.join(' '));
const placed = ref(false);
const left = ref(0);
const arrowX = ref(0);
const bubbleStyle = computed(() => ({ left: `${left.value}px` }));
const arrowStyle = computed(() => ({ left: `${arrowX.value}px` }));
const OPEN_EVENT = 'nx-hint-open';
const EDGE = 16;

function toggle() { emit('update:open', !props.open); }
function onKey(event: KeyboardEvent) { if (!event.repeat) toggle(); }
function close() { if (props.open) emit('update:open', false); }
function root() { return document.getElementById(rootId); }
function onPointerDown(event: Event) {
  const el = root();
  if (el && event.target instanceof Node && !el.contains(event.target)) close();
}
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  close();
}
function onOtherOpen(event: Event) { if ((event as CustomEvent<string>).detail !== rootId) close(); }
// Pointing at the icon: centred on it, then kept 16px inside the sheet or page it sits in.
function place() {
  const el = root();
  const bubble = document.getElementById(bubbleId);
  if (!el || !bubble) return;
  const anchor = el.getBoundingClientRect();
  const bounds = (el.closest('.nx-glass-sheet, .nx-chassis') ?? document.documentElement).getBoundingClientRect();
  const width = bubble.getBoundingClientRect().width;
  const centre = anchor.left + anchor.width / 2;
  const start = Math.min(Math.max(centre - width / 2, bounds.left + EDGE), bounds.right - EDGE - width);
  left.value = start - anchor.left;
  arrowX.value = centre - start;
  placed.value = true;
}
function listen(on: boolean) {
  const method = on ? 'addEventListener' : 'removeEventListener';
  document[method]('pointerdown', onPointerDown, true);
  document[method]('scroll', close, true);
  document[method]('keydown', onEscape as EventListener);
  window[method](OPEN_EVENT, onOtherOpen);
}
watch(() => props.open, (open, wasOpen) => {
  if (typeof document === 'undefined') return;
  listen(false);
  placed.value = false;
  if (open) {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: rootId }));
    listen(true);
    void nextTick(place);
    return;
  }
  // Closed by Esc, back, a second tap or a tap elsewhere: focus comes back to the icon, unless that tap moved it to another
  // control. Checked after the tap's own focus change, which lands on the layer root when the tap hit no control.
  const el = root();
  if (!wasOpen || !el) return;
  setTimeout(() => {
    const trigger = el.querySelector<HTMLElement>('.nx-hint__trigger');
    const active = document.activeElement as HTMLElement | null;
    if (trigger && el.isConnected && (!active || active === document.body || el.contains(active) || active.tabIndex < 0)) trigger.focus();
  }, 0);
}, { immediate: true });
onBeforeUnmount(() => { if (typeof document !== 'undefined') listen(false); });
</script>
<style scoped>
.nx-hint { position: relative; display: inline-flex; flex: none; width: 16px; height: 16px; vertical-align: middle; }
.nx-hint__trigger { position: relative; display: grid; place-items: center; width: 16px; height: 16px; color: var(--v5-ink-3); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.nx-hint--warning .nx-hint__trigger { color: var(--v5-warning-ink); }
.nx-hint__trigger::after { content: ""; position: absolute; top: calc(50% - 22px); bottom: calc(50% - 22px); left: calc(50% - 22px); right: calc(50% - 22px); }
.nx-hint__trigger:active { opacity: .6; }
.nx-hint__trigger:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 4px; border-radius: 50%; }
/* The toast's face (03 §3.5.1): dark translucent in both themes, light text, blur, the shared top highlight. It sits 16px
   above the icon, so the 6px arrow's tip stays about 10px clear of the line it explains. */
.nx-hint__bubble { position: absolute; z-index: 3; bottom: calc(100% + 16px); box-sizing: border-box; width: max-content; max-width: min(280px, calc(100vw - 32px));
  display: flex; flex-direction: column; gap: var(--v5-space-1); padding: var(--v5-space-3) 14px; border-radius: var(--v5-radius-m);
  background: var(--v5-toast-bg); box-shadow: var(--v5-toast-shadow); -webkit-backdrop-filter: blur(12px) saturate(125%); backdrop-filter: blur(12px) saturate(125%);
  opacity: 0; pointer-events: none; }
.nx-hint__bubble--placed { opacity: 1; pointer-events: auto; transition: opacity 160ms ease; }
.nx-hint__line { display: block; font: 400 13px/18px var(--font-v5); color: var(--v5-toast-ink); white-space: normal; overflow-wrap: break-word; }
.nx-hint__arrow { position: absolute; top: 100%; width: 12px; height: 6px; margin-left: -6px; background: var(--v5-toast-bg); clip-path: polygon(0 0, 100% 0, 50% 100%); }
@media (prefers-reduced-motion: reduce) { .nx-hint__bubble--placed { transition: none; } }
/* Reduced transparency or more contrast: the shared surfaces' fallback (glass-surfaces.css), an opaque face and no blur.
   The theme's toast colour is laid over black, so the face stays the toast's dark in both themes. */
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .nx-hint__bubble, .nx-hint__arrow { background: linear-gradient(var(--v5-toast-bg), var(--v5-toast-bg)), #000; }
  .nx-hint__bubble { -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media (forced-colors: active) {
  .nx-hint__bubble { border: 1px solid CanvasText; background: Canvas; forced-color-adjust: auto; }
  .nx-hint__line { color: CanvasText; }
  .nx-hint__arrow { background: CanvasText; }
}
</style>
