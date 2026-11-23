<!--
  NxObjectIcon — reward and payment objects drawn in the coin build (uvt-coin.vue): soft (hue
  mixed with grey) gradient body lit from the top left, a light gloss and a faint contact shadow.
  gift: amber box with a coral ribbon (rewards: amber + coral, 01 §1.1.2).
  bank-card: the physical bank card face of 04.4 (#2B2E35 → #0F1013) with a gold chip.
  medal: a coin-built disc in the badge hue with ribbon tails; the glyph goes in the slot.
  muted: grey and faded, the same as a muted coin. The parent sets the size.
  Decorative: hidden from screen readers, the label next to it carries the meaning.
-->
<template>
  <view class="nx-object-icon" :class="['nx-object-icon--' + kind, { 'nx-object-icon--muted': muted }]" :style="{ '--obj': hue }" aria-hidden="true">
    <svg class="nx-object-icon__svg" viewBox="0 0 64 64" width="100%" height="100%">
      <defs>
        <linearGradient :id="ids.a" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="o-hi" /><stop offset="0.55" class="o-mid" /><stop offset="1" class="o-lo" /></linearGradient>
        <linearGradient :id="ids.b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="o2-hi" /><stop offset="1" class="o2-lo" /></linearGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="20" ry="3.2" class="o-floor" />
      <template v-if="kind === 'gift'">
        <rect x="12" y="27" width="40" height="28" rx="5" :fill="url(ids.a)" />
        <rect x="9" y="19" width="46" height="11" rx="4" :fill="url(ids.a)" class="o-lid" />
        <rect x="28.5" y="19" width="7" height="36" :fill="url(ids.b)" />
        <path d="M32 19c-3-7-12-9-13-3.5S27 19 32 19zM32 19c3-7 12-9 13-3.5S37 19 32 19z" :fill="url(ids.b)" />
        <rect x="9" y="29.5" width="46" height="2.5" class="o-shade" />
        <ellipse cx="20" cy="22.5" rx="8" ry="2.2" class="o-gloss" />
      </template>
      <template v-else-if="kind === 'bank-card'">
        <g transform="rotate(-8 32 34)">
          <rect x="7" y="16" width="50" height="34" rx="6" class="o-card" :fill="url(ids.a)" />
          <rect x="7.5" y="16.5" width="49" height="33" rx="5.5" fill="none" class="o-card-edge" />
          <rect x="13" y="25" width="10" height="8" rx="2" :fill="url(ids.b)" />
          <rect x="13" y="40" width="22" height="2.4" rx="1.2" class="o-card-line" />
          <circle cx="45" cy="41" r="3.6" class="o-card-dot1" /><circle cx="49.5" cy="41" r="3.6" class="o-card-dot2" />
          <path d="M9 19c10-2 26-2 46 4v-2c0-2.2-1.8-4-4-4H13c-2.2 0-4 1.8-4 2z" class="o-gloss" />
        </g>
      </template>
      <template v-else>
        <path d="M22 38 16 58l8-4 4 7 4-14zM42 38l6 20-8-4-4 7-4-14z" :fill="url(ids.b)" />
        <circle cx="32" cy="29" r="22" :fill="url(ids.b)" />
        <circle cx="32" cy="29" r="18.5" :fill="url(ids.a)" />
        <circle cx="32" cy="29" r="18" fill="none" class="o-inner" />
        <ellipse cx="25" cy="18" rx="10" ry="5" transform="rotate(-28 25 18)" class="o-gloss" />
      </template>
    </svg>
    <view v-if="kind === 'medal'" class="nx-object-icon__glyph"><slot /></view>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = withDefaults(defineProps<{ kind: 'gift' | 'bank-card' | 'medal'; tone?: string; muted?: boolean }>(), { tone: 'var(--v5-brand)', muted: false });
// Gradient ids are per instance so several objects on one page never share a definition.
const n = Math.random().toString(36).slice(2, 10);
const ids = { a: 'obj-a-' + n, b: 'obj-b-' + n };
const url = (id: string) => 'url(#' + id + ')';
const hue = computed(() => props.kind === 'gift' ? 'var(--v5-warning)' : props.tone);
</script>
<style scoped>
.nx-object-icon { --obj-soft: color-mix(in srgb, var(--obj) 72%, #9AA0AB); --obj2-soft: color-mix(in srgb, var(--v5-brand-2) 72%, #9AA0AB); position: relative; display: block; width: 100%; height: 100%; }
.nx-object-icon :deep(.nx-object-icon__svg) { display: block; overflow: visible; }
.nx-object-icon :deep(.o-floor) { fill: rgba(0,0,0,.16); }
.nx-object-icon :deep(.o-gloss) { fill: rgba(255,255,255,.22); }
.nx-object-icon :deep(.o-shade) { fill: rgba(0,0,0,.10); }
.nx-object-icon :deep(.o-inner) { stroke: rgba(255,255,255,.28); stroke-width: 1; }
.nx-object-icon--gift :deep(.o-hi) { stop-color: color-mix(in srgb, var(--obj-soft) 80%, white); }
.nx-object-icon--gift :deep(.o-mid) { stop-color: var(--obj-soft); }
.nx-object-icon--gift :deep(.o-lo) { stop-color: color-mix(in srgb, var(--obj-soft) 84%, black); }
.nx-object-icon--gift :deep(.o2-hi) { stop-color: color-mix(in srgb, var(--obj2-soft) 85%, white); }
.nx-object-icon--gift :deep(.o2-lo) { stop-color: color-mix(in srgb, var(--obj2-soft) 84%, black); }
.nx-object-icon--bank-card :deep(.o-hi) { stop-color: #3A3E47; }
.nx-object-icon--bank-card :deep(.o-mid) { stop-color: #1E2026; }
.nx-object-icon--bank-card :deep(.o-lo) { stop-color: #0F1013; }
.nx-object-icon--bank-card :deep(.o2-hi) { stop-color: #F4D58A; }
.nx-object-icon--bank-card :deep(.o2-lo) { stop-color: #B98A2E; }
.nx-object-icon :deep(.o-card-edge) { stroke: rgba(255,255,255,.16); stroke-width: 1; }
.nx-object-icon :deep(.o-card-line) { fill: rgba(255,255,255,.34); }
.nx-object-icon :deep(.o-card-dot1) { fill: rgba(255,255,255,.30); } .nx-object-icon :deep(.o-card-dot2) { fill: rgba(255,255,255,.18); }
.nx-object-icon--medal :deep(.o-hi) { stop-color: color-mix(in srgb, var(--obj-soft) 80%, white); }
.nx-object-icon--medal :deep(.o-mid) { stop-color: var(--obj-soft); }
.nx-object-icon--medal :deep(.o-lo) { stop-color: color-mix(in srgb, var(--obj-soft) 84%, black); }
.nx-object-icon--medal :deep(.o2-hi) { stop-color: color-mix(in srgb, var(--obj-soft) 55%, white); }
.nx-object-icon--medal :deep(.o2-lo) { stop-color: color-mix(in srgb, var(--obj-soft) 70%, black); }
.nx-object-icon__glyph { position: absolute; left: 0; right: 0; top: 0; height: 90.6%; display: grid; place-items: center; color: #4E3104; }
:root:not([data-theme="light"]) .nx-object-icon__glyph { color: #735603; }
.nx-object-icon__glyph > :deep(*) { display: grid; place-items: center; }
.nx-object-icon--muted { filter: grayscale(1); opacity: .5; }
[data-theme="light"] .nx-object-icon :deep(.o-floor) { fill: rgba(20,16,8,.10); }
/* On the dark page the near-black card face needs a brighter top light and edge to read as an object. */
:root:not([data-theme="light"]) .nx-object-icon--bank-card :deep(.o-hi) { stop-color: #5C626E; }
:root:not([data-theme="light"]) .nx-object-icon--bank-card :deep(.o-mid) { stop-color: #2B2E35; }
:root:not([data-theme="light"]) .nx-object-icon :deep(.o-card-edge) { stroke: rgba(255,255,255,.34); }
:root:not([data-theme="light"]) .nx-object-icon :deep(.o-floor) { fill: rgba(0,0,0,.32); }
</style>
