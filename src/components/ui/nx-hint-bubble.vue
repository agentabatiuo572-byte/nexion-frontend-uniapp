<!--
  NxHintBubble — the hint bubble of design system 03 §3.5.1 (提示气泡): an info icon beside the item it explains; a tap opens
  a short explanation pointing at the icon. The icon's box is its glyph (16 or 20) so it sits in a text line; the 44px target is a
  layer that takes no layout. The bubble uses the toast's dark translucent face in both themes, at most 280px wide, 13/18,
  one sentence per paragraph (at most three), no buttons. A tap on the icon toggles it; a tap outside it, a scroll anywhere
  or Esc closes it; opening one closes any other. Screen readers read the full text as the icon's name, so the bubble
  itself is hidden from them.
  The parent may own `open` (v-model:open): inside a dialog, Esc and back reach the dialog first, so the dialog's close
  closes an open bubble before anything else (see tradein-sheets.vue). Without it the component keeps its own state.
-->
<template>
  <view :id="rootId" class="nx-hint" :class="`nx-hint--${tone}`" :style="{ width: size + 'px', height: size + 'px' }">
    <view class="nx-hint__trigger" role="button" tabindex="0" :aria-label="label" :aria-expanded="isOpen ? 'true' : 'false'"
      :style="{ width: size + 'px', height: size + 'px' }" @click.stop="toggle" @keydown.enter.prevent="onKey" @keydown.space.prevent="onKey">
      <NxIcon :name="tone === 'warning' ? 'hint-warn' : 'hint-info'" :size="size" />
    </view>
    <view v-if="isOpen" :id="bubbleId" class="nx-hint__bubble" :class="{ 'nx-hint__bubble--placed': placed }" :style="bubbleStyle" aria-hidden="true">
      <text v-for="(line, index) in lines" :key="index" class="nx-hint__line">{{ line }}</text>
      <view class="nx-hint__arrow" :style="arrowStyle" />
    </view>
    <!-- #ifndef H5 -->
    <!-- No document in the App's logic layer: a clear layer under the bubble takes the tap or drag outside it. -->
    <view v-if="isOpen" class="nx-hint__catcher" @touchstart="close" @tap="close" />
    <!-- #endif -->
  </view>
</template>
<script lang="ts">
import { ref as sharedRef } from 'vue';
/** Only one bubble is open in the whole app: opening a new one closes the last. */
const openHint = sharedRef<string | null>(null);
</script>
<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import NxIcon from '@/components/ui/nx-icon.vue';
const props = withDefaults(defineProps<{ open?: boolean; text: string | readonly string[]; tone?: 'neutral' | 'warning'; size?: 16 | 20 }>(), { open: undefined, tone: 'neutral', size: 16 });
const emit = defineEmits<{ (event: 'update:open', open: boolean): void }>();
const instance = getCurrentInstance();
const uid = instance?.uid;
const rootId = `nx-hint-${uid}`;
const bubbleId = `nx-hint-bubble-${uid}`;
const lines = computed(() => (typeof props.text === 'string' ? [props.text] : props.text).slice(0, 3));
const label = computed(() => lines.value.join(' '));
const ownOpen = ref(false);
const isOpen = computed(() => props.open ?? ownOpen.value);
const placed = ref(false);
const left = ref(0);
const arrowX = ref(0);
const bubbleStyle = computed(() => ({ left: `${left.value}px` }));
const arrowStyle = computed(() => ({ left: `${arrowX.value}px` }));
const EDGE = 16;

function setOpen(value: boolean) {
  ownOpen.value = value;
  emit('update:open', value);
}
function toggle() { setOpen(!isOpen.value); }
function onKey(event: KeyboardEvent) { if (!event.repeat) toggle(); }
function close() { if (isOpen.value) setOpen(false); }
function root() { return typeof document === 'undefined' ? null : document.getElementById(rootId); }
function onPointerDown(event: Event) {
  const el = root();
  if (el && event.target instanceof Node && !el.contains(event.target)) close();
}
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  close();
}
type Box = { left: number; width: number };
// Pointing at the icon: centred on it, then kept 16px inside the sheet or page it sits in.
function setPlace(anchor: Box, bubbleWidth: number, boundsLeft: number, boundsRight: number) {
  const centre = anchor.left + anchor.width / 2;
  const start = Math.min(Math.max(centre - bubbleWidth / 2, boundsLeft + EDGE), boundsRight - EDGE - bubbleWidth);
  left.value = start - anchor.left;
  arrowX.value = centre - start;
  placed.value = true;
}
function placeInDom() {
  const el = root();
  const bubble = document.getElementById(bubbleId);
  if (!el || !bubble) return;
  const bounds = (el.closest('.nx-glass-sheet, .nx-chassis') ?? document.documentElement).getBoundingClientRect();
  setPlace(el.getBoundingClientRect(), bubble.getBoundingClientRect().width, bounds.left, bounds.right);
}
// The App's logic layer has no DOM: the same measure through the selector query.
function placeNative() {
  if (!instance?.proxy) return;
  const query = uni.createSelectorQuery().in(instance.proxy);
  query.select(`#${rootId}`).boundingClientRect();
  query.select(`#${bubbleId}`).boundingClientRect();
  query.exec((boxes: (UniApp.NodeInfo | null)[]) => {
    const [anchor, bubble] = boxes;
    if (!isOpen.value || !anchor || !bubble || anchor.left === undefined || anchor.width === undefined || bubble.width === undefined) return;
    setPlace({ left: anchor.left, width: anchor.width }, bubble.width, 0, uni.getSystemInfoSync().windowWidth);
  });
}
function listen(on: boolean) {
  if (typeof document === 'undefined') return;
  const method = on ? 'addEventListener' : 'removeEventListener';
  document[method]('pointerdown', onPointerDown, true);
  document[method]('scroll', close, true);
  document[method]('keydown', onEscape as EventListener);
}
watch(openHint, id => { if (id !== null && id !== rootId) close(); });
watch(isOpen, (open, wasOpen) => {
  listen(false);
  placed.value = false;
  if (open) {
    openHint.value = rootId;
    listen(true);
    void nextTick(typeof document === 'undefined' ? placeNative : placeInDom);
    return;
  }
  if (openHint.value === rootId) openHint.value = null;
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
onBeforeUnmount(() => {
  listen(false);
  if (openHint.value === rootId) openHint.value = null;
});
</script>
<style scoped>
.nx-hint { position: relative; display: inline-flex; flex: none; vertical-align: middle; }
.nx-hint__trigger { position: relative; display: grid; place-items: center; color: var(--v5-ink-3); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.nx-hint--warning .nx-hint__trigger { color: var(--v5-warning-ink); }
.nx-hint__trigger::after { content: ""; position: absolute; top: calc(50% - 22px); bottom: calc(50% - 22px); left: calc(50% - 22px); right: calc(50% - 22px); }
.nx-hint__trigger:active { opacity: .6; }
.nx-hint__trigger:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 4px; border-radius: 50%; }
/* The toast's face (03 §3.5.1): dark translucent in both themes, light text, blur, the shared top highlight. It sits 16px
   above the icon, so the 6px arrow's tip stays about 10px clear of the line it explains. */
.nx-hint__bubble { position: absolute; z-index: 3; text-align: left; bottom: calc(100% + 16px); box-sizing: border-box; width: max-content; max-width: min(280px, calc(100vw - 32px));
  display: flex; flex-direction: column; gap: var(--v5-space-1); padding: var(--v5-space-3) 14px; border-radius: var(--v5-radius-m);
  background: var(--v5-toast-bg); box-shadow: var(--v5-toast-shadow); -webkit-backdrop-filter: blur(12px) saturate(125%); backdrop-filter: blur(12px) saturate(125%);
  opacity: 0; pointer-events: none; }
.nx-hint__bubble--placed { opacity: 1; pointer-events: auto; transition: opacity 160ms ease; }
.nx-hint__line { display: block; font: 400 13px/18px var(--font-v5); color: var(--v5-toast-ink); white-space: normal; overflow-wrap: break-word; }
.nx-hint__arrow { position: absolute; top: 100%; width: 12px; height: 6px; margin-left: -6px; background: var(--v5-toast-bg); clip-path: polygon(0 0, 100% 0, 50% 100%); }
/* Layer order: captcha-slider.vue 秩序表 (785 catcher, 786 bubble, both below the business half sheets). */
.nx-hint__catcher { position: fixed; inset: 0; z-index: 785; }
/* #ifndef H5 */
/* The App's catcher is above the page; the bubble sits one layer over it so a tap on the bubble stays on the bubble. */
.nx-hint__bubble { z-index: 786; }
/* #endif */
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
