<!--
  NxIconTile — the raised icon tile, the same family as the UVT/USDT coins (uvt-coin.vue): a soft
  face in the business hue lit from the top left, a faint lighter top edge and darker bottom edge,
  one light gloss and a small contact shadow. The face is the hue softened (dark: 55% hue over a light
  grey; light: 45% hue over white) so a grid of tiles reads quiet; the glyph (slot,
  stroke=currentColor) is a deep, saturated tone of the same hue (set per tone below), 3:1 or more
  over the whole tile in both themes.
  Sizes: s 32 (list rows, no contact shadow), m 40 (entry grids, category icons), l 48 (method cards).
  CSS only, no filter and no per-instance SVG defs, so long lists stay cheap.
  Decorative: hidden from screen readers; the label next to it carries the meaning.
-->
<template>
  <view class="nx-icon-tile" :class="['nx-icon-tile--' + size, 'nx-icon-tile--' + tone]" aria-hidden="true"><slot /></view>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'brand' | 'device' | 'purple' | 'amber' | 'success' | 'danger' | 'coral' | 'teal' | 'sky' | 'muted'; size?: 's' | 'm' | 'l' }>(), { tone: 'muted', size: 'm' });
</script>
<style scoped>
.nx-icon-tile { --tile: #9CA1AB; --tile-sat: 45%; --tile-base: #FFFFFF; --tile-gloss: .25;
  --tile-face: color-mix(in srgb, var(--tile) var(--tile-sat), var(--tile-base));
  --tile-drop: 0 2px 5px -3px rgba(20,16,8,.16);
  position: relative; display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: var(--ui-radius-icon); color: var(--tile-ink);
  background: radial-gradient(58% 36% at 30% 20%, rgba(255,255,255,var(--tile-gloss)), rgba(255,255,255,0) 72%),
    radial-gradient(120% 95% at 28% 14%, color-mix(in srgb, var(--tile-face) 88%, white) 0%, var(--tile-face) 50%, color-mix(in srgb, var(--tile-face) 88%, black) 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 2px rgba(0,0,0,.10), var(--tile-drop); }
.nx-icon-tile--s { width: 32px; height: 32px; border-radius: 10px; --tile-drop: 0 0 0 transparent; }
.nx-icon-tile--l { width: 48px; height: 48px; border-radius: 14px; }
.nx-icon-tile--brand { --tile: var(--v5-brand); }
.nx-icon-tile--device { --tile: var(--ui-device-ink); }
.nx-icon-tile--purple { --tile: var(--v5-nex); }
.nx-icon-tile--amber { --tile: var(--v5-warning); }
.nx-icon-tile--success { --tile: var(--v5-success); }
.nx-icon-tile--danger { --tile: var(--v5-danger); }
.nx-icon-tile--coral { --tile: var(--v5-brand-2); }
.nx-icon-tile--teal { --tile: var(--v5-tech-cyan); }
.nx-icon-tile--sky { --tile: var(--v5-aura-sky); }
:root:not([data-theme="light"]) .nx-icon-tile { --tile-sat: 55%; --tile-base: #C3C8D2; --tile-gloss: .18; --tile-drop: 0 2px 6px -3px rgba(0,0,0,.40); }
:root:not([data-theme="light"]) .nx-icon-tile--s { --tile-drop: 0 0 0 transparent; }
:root:not([data-theme="light"]) .nx-icon-tile--muted { --tile: #8D95A6; }
/* Glyph: a deep, saturated tone of the tile's own hue (OKLCH lightness .42–.53, chroma up to .22), 3.3:1 or more over the shaded face. */
.nx-icon-tile--brand { --tile-ink: #0a3dc9; }
.nx-icon-tile--device { --tile-ink: #0a5e7b; }
.nx-icon-tile--purple { --tile-ink: #5f39d4; }
.nx-icon-tile--amber { --tile-ink: #885806; }
.nx-icon-tile--success { --tile-ink: #066734; }
.nx-icon-tile--danger { --tile-ink: #a7060b; }
.nx-icon-tile--coral { --tile-ink: #aa3608; }
.nx-icon-tile--teal { --tile-ink: #0b737e; }
.nx-icon-tile--sky { --tile-ink: #0158b2; }
.nx-icon-tile--muted { --tile-ink: #646A70; }
:root:not([data-theme="light"]) .nx-icon-tile--brand { --tile-ink: #476605; }
:root:not([data-theme="light"]) .nx-icon-tile--device { --tile-ink: #016180; }
:root:not([data-theme="light"]) .nx-icon-tile--purple { --tile-ink: #6d1ab8; }
:root:not([data-theme="light"]) .nx-icon-tile--amber { --tile-ink: #7d5e07; }
:root:not([data-theme="light"]) .nx-icon-tile--danger { --tile-ink: #92081a; }
:root:not([data-theme="light"]) .nx-icon-tile--coral { --tile-ink: #853203; }
:root:not([data-theme="light"]) .nx-icon-tile--teal { --tile-ink: #026358; }
:root:not([data-theme="light"]) .nx-icon-tile--sky { --tile-ink: #05518e; }
:root:not([data-theme="light"]) .nx-icon-tile--success { --tile-ink: #476605; }
:root:not([data-theme="light"]) .nx-icon-tile--muted { --tile-ink: #484E54; }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .nx-icon-tile { --tile-gloss: 0; } }
@media (forced-colors: active) { .nx-icon-tile { background: Canvas; color: CanvasText; box-shadow: none; outline: 1px solid CanvasText; } }
</style>
