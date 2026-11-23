<!--
  NxObjectIcon — reward and payment objects drawn in the coin build (uvt-coin.vue): soft (hue
  mixed with grey) gradient body lit from the top left, a light gloss and a faint contact shadow.
  gift: amber box with a coral ribbon (rewards: amber + coral, 01 §1.1.2).
  bank-card: the physical bank card face of 04.4 (#2B2E35 → #0F1013) with a gold chip.
  medal: a coin-built disc in the badge hue with ribbon tails; the glyph goes in the slot.
  wallet: a leather wallet with a teal card tucked in and a gold clasp; dark leather in the dark
  theme, warm tan in the light theme (the 我的钱包 title).
  muted: grey and faded, the same as a muted coin. The parent sets the size.
  Decorative: hidden from screen readers, the label next to it carries the meaning.
-->
<template>
  <view class="nx-object-icon" :class="['nx-object-icon--' + kind, { 'nx-object-icon--muted': muted }]" :style="{ '--obj': hue }" aria-hidden="true">
    <svg class="nx-object-icon__svg" viewBox="0 0 64 64" width="100%" height="100%">
      <defs>
        <linearGradient :id="ids.a" x1="0" y1="0" :x2="kind === 'wallet' ? 0.35 : 0.4" y2="1"><stop offset="0" class="o-hi" /><stop offset="0.55" class="o-mid" /><stop offset="1" class="o-lo" /></linearGradient>
        <linearGradient :id="ids.b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="o2-hi" /><stop offset="1" class="o2-lo" /></linearGradient>
        <template v-if="kind === 'wallet'">
          <linearGradient :id="ids.c" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#8EE3CF" /><stop offset="1" stop-color="#2FA58E" /></linearGradient>
          <linearGradient :id="ids.d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="o3-hi" /><stop offset="1" class="o3-lo" /></linearGradient>
        </template>
      </defs>
      <ellipse cx="32" cy="58" :rx="kind === 'wallet' ? 21 : 20" ry="3.2" class="o-floor" />
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
      <template v-else-if="kind === 'wallet'">
        <rect x="13" y="9" width="34" height="22" rx="3.5" transform="rotate(-9 30 20)" :fill="url(ids.c)" />
        <rect x="15" y="13" width="12" height="2.4" rx="1.2" transform="rotate(-9 30 20)" fill="rgba(255,255,255,.55)" />
        <rect x="7" y="20" width="50" height="35" rx="8" :fill="url(ids.a)" />
        <rect x="7.5" y="20.5" width="49" height="34" rx="7.5" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1" />
        <rect x="11" y="24" width="42" height="27" rx="5" fill="none" class="o-stitch" stroke-width="1" stroke-dasharray="2 2.2" />
        <rect x="36" y="30" width="23" height="15" rx="6" :fill="url(ids.b)" />
        <rect x="36.5" y="30.5" width="22" height="14" rx="5.5" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1" />
        <circle cx="46" cy="37.5" r="3.4" :fill="url(ids.d)" />
        <path d="M10 24c10-3 30-3 44 1v-1c0-2.2-1.8-4-4-4H15c-2.8 0-5 1.8-5 4z" fill="rgba(255,255,255,.24)" />
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
const props = withDefaults(defineProps<{ kind: 'gift' | 'bank-card' | 'medal' | 'wallet'; tone?: string; muted?: boolean }>(), { tone: 'var(--v5-brand)', muted: false });
// Gradient ids are per instance so several objects on one page never share a definition.
const n = Math.random().toString(36).slice(2, 10);
const ids = { a: 'obj-a-' + n, b: 'obj-b-' + n, c: 'obj-c-' + n, d: 'obj-d-' + n };
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
/* Wallet: dark leather (dark theme) or warm tan (light theme), one shape; the floor shadow is the same in both. */
.nx-object-icon--wallet :deep(.o-hi) { stop-color: #EDD3A0; }
.nx-object-icon--wallet :deep(.o-mid) { stop-color: #CDA567; }
.nx-object-icon--wallet :deep(.o-lo) { stop-color: #9A7138; }
.nx-object-icon--wallet :deep(.o2-hi) { stop-color: #E0B877; }
.nx-object-icon--wallet :deep(.o2-lo) { stop-color: #A97C3E; }
.nx-object-icon--wallet :deep(.o3-hi) { stop-color: #FFF1CF; }
.nx-object-icon--wallet :deep(.o3-lo) { stop-color: #D9B36A; }
.nx-object-icon--wallet :deep(.o-stitch) { stroke: rgba(90,56,12,.28); }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o-hi) { stop-color: #4A4F5B; }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o-mid) { stop-color: #23262D; }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o-lo) { stop-color: #111216; }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o2-hi) { stop-color: #565C69; }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o2-lo) { stop-color: #2A2D35; }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o3-hi) { stop-color: #F4D58A; }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o3-lo) { stop-color: #B98A2E; }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o-stitch) { stroke: rgba(255,255,255,.14); }
:root:not([data-theme="light"]) .nx-object-icon--wallet :deep(.o-floor), [data-theme="light"] .nx-object-icon--wallet :deep(.o-floor) { fill: rgba(0,0,0,.22); }
</style>
