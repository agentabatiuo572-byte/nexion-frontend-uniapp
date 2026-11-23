<!--
  NxEmptyArt — the EmptyState illustrations, one raised object per kind, built like NxObjectIcon and the coins:
  gradient bodies lit from the top left, a light gloss, a 1px top edge and a faint floor shadow, straight on the
  page with no disc or tile behind (01 §1.3). EmptyState sits on wallet, order, message, team and course pages,
  so the art uses materials only (steel, graphite, white plastic, brass, cardboard) and no business accent hue
  (01 §1.1.2); the warning sign is the status amber (--v5-warning) because it shows a status.
  empty-list: an empty filing tray. no-search-results: a magnifier over nothing. no-filter-results: an empty
  funnel. no-owned-asset: an open, empty box. locked-or-no-permission: a padlock.
  network-offline: a plug pulled out of its socket. recoverable-error: a warning sign.
  Static (07 §7.1: empty states do not loop). Decorative: the title next to it carries the meaning.
  The parent sets the size.
-->
<template>
  <view class="nx-empty-art" :class="'nx-empty-art--' + kind" aria-hidden="true">
    <svg class="nx-empty-art__svg" viewBox="-14 -11 124 124" width="100%" height="100%">
      <defs>
        <template v-if="kind === 'empty-list'">
          <linearGradient :id="ids.steel" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="m-steel-hi" /><stop offset="0.55" class="m-steel-mid" /><stop offset="1" class="m-steel-lo" /></linearGradient>
          <linearGradient :id="ids.graphite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-gr-hi" /><stop offset="1" class="m-gr-lo" /></linearGradient>
          <linearGradient :id="ids.brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-brass-hi" /><stop offset="1" class="m-brass-lo" /></linearGradient>
        </template>
        <template v-else-if="kind === 'no-search-results'">
          <linearGradient :id="ids.steel" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="m-steel-hi" /><stop offset="0.55" class="m-steel-mid" /><stop offset="1" class="m-steel-lo" /></linearGradient>
          <linearGradient :id="ids.graphite" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" class="m-gr-hi" /><stop offset="1" class="m-gr-lo" /></linearGradient>
          <radialGradient :id="ids.lens" cx="0.34" cy="0.3" r="0.8"><stop offset="0" class="m-lens-hi" /><stop offset="1" class="m-lens-lo" /></radialGradient>
        </template>
        <template v-else-if="kind === 'no-filter-results'">
          <linearGradient :id="ids.steel" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" class="m-steel-hi" /><stop offset="0.55" class="m-steel-mid" /><stop offset="1" class="m-steel-lo" /></linearGradient>
          <linearGradient :id="ids.graphite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-gr-hi" /><stop offset="1" class="m-gr-lo" /></linearGradient>
        </template>
        <template v-else-if="kind === 'no-owned-asset'">
          <linearGradient :id="ids.board" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="m-board-hi" /><stop offset="0.55" class="m-board-mid" /><stop offset="1" class="m-board-lo" /></linearGradient>
          <linearGradient :id="ids.inside" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-in-hi" /><stop offset="1" class="m-in-lo" /></linearGradient>
        </template>
        <template v-else-if="kind === 'locked-or-no-permission'">
          <linearGradient :id="ids.steel" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" class="m-steel-hi" /><stop offset="0.55" class="m-steel-mid" /><stop offset="1" class="m-steel-lo" /></linearGradient>
          <linearGradient :id="ids.brass" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="m-brass-hi" /><stop offset="0.55" class="m-brass-mid" /><stop offset="1" class="m-brass-lo" /></linearGradient>
        </template>
        <template v-else-if="kind === 'network-offline'">
          <linearGradient :id="ids.plastic" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" class="m-pl-hi" /><stop offset="0.55" class="m-pl-mid" /><stop offset="1" class="m-pl-lo" /></linearGradient>
          <linearGradient :id="ids.graphite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-gr-hi" /><stop offset="1" class="m-gr-lo" /></linearGradient>
          <linearGradient :id="ids.brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-brass-hi" /><stop offset="1" class="m-brass-lo" /></linearGradient>
        </template>
        <template v-else>
          <linearGradient :id="ids.warn" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="m-warn-hi" /><stop offset="0.55" class="m-warn-mid" /><stop offset="1" class="m-warn-lo" /></linearGradient>
        </template>
      </defs>
      <ellipse cx="48" cy="82" :rx="floor" ry="3.6" class="a-floor" />
      <template v-if="kind === 'empty-list'">
        <path d="M25 36h46a3 3 0 0 1 2.9 2.2L80 60H16l6.1-21.8A3 3 0 0 1 25 36z" :fill="u.steel" />
        <path d="M27.2 39h41.6l7.2 21H20z" :fill="u.graphite" />
        <path d="M16 54a4 4 0 0 1 4-4h14c2.2 0 3.4 1.3 4.2 3.2l.9 2.2c.8 1.9 2.2 2.6 4.4 2.6h9c2.2 0 3.6-.7 4.4-2.6l.9-2.2c.8-1.9 2-3.2 4.2-3.2H76a4 4 0 0 1 4 4v18a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" :fill="u.steel" />
        <path d="M20 50.6h14c2.2 0 3.4 1.3 4.2 3.2l.9 2.2c.8 1.9 2.2 2.6 4.4 2.6h9c2.2 0 3.6-.7 4.4-2.6l.9-2.2c.8-1.9 2-3.2 4.2-3.2H76" fill="none" class="a-edge" />
        <rect x="39" y="64" width="18" height="7" rx="2" :fill="u.brass" />
        <rect x="42" y="66.8" width="12" height="1.4" rx=".7" class="a-ink" />
        <ellipse cx="27" cy="59" rx="7" ry="2.2" class="a-gloss" />
      </template>
      <template v-else-if="kind === 'no-search-results'">
        <g transform="rotate(45 42 40)">
          <rect x="60" y="35.5" width="27" height="9" rx="4.5" :fill="u.graphite" />
          <rect x="58.5" y="37" width="7" height="6" rx="1.5" :fill="u.steel" />
        </g>
        <circle cx="43.4" cy="41.8" r="21" class="a-depth" />
        <circle cx="42" cy="40" r="21" :fill="u.steel" />
        <circle cx="42" cy="40" r="15.5" class="a-lens-bed" />
        <circle cx="42" cy="40" r="15.5" :fill="u.lens" />
        <circle cx="42" cy="40" r="15.5" fill="none" class="a-lens-rim" />
        <path d="M31.6 35.4a11.5 11.5 0 0 1 7.6-7.2" fill="none" class="a-lens-glint" />
        <ellipse cx="29" cy="26" rx="8" ry="3" transform="rotate(-40 29 26)" class="a-gloss" />
      </template>
      <template v-else-if="kind === 'no-filter-results'">
        <ellipse cx="48" cy="28" rx="27" ry="7.5" :fill="u.graphite" />
        <ellipse cx="48" cy="30" rx="3.6" ry="1.2" class="a-hole" />
        <path d="M21 28a27 7.5 0 0 0 54 0L53.5 58v10.5a5.5 3.5 0 0 1-11 0V58z" :fill="u.steel" />
        <path d="M21 28a27 7.5 0 0 0 54 0" fill="none" class="a-edge" />
        <ellipse cx="48" cy="28" rx="27" ry="7.5" fill="none" class="a-rim" />
        <path d="M27 36.5 43 58.5" fill="none" class="a-shine" />
      </template>
      <template v-else-if="kind === 'no-owned-asset'">
        <path d="M30 38h36l-3.2-12H33.2z" class="a-board-back" />
        <path d="M30 38 23 49l-13-6.5 7.4-10.2z" class="a-board-left" />
        <path d="M66 38l7 11 13-6.5-7.4-10.2z" class="a-board-right" />
        <path d="M30 38h36l7 11H23z" :fill="u.inside" />
        <rect x="23" y="49" width="50" height="29" rx="2.5" :fill="u.board" />
        <path d="M23 49h50l2.2 7.6H20.8z" class="a-board-flap" />
        <path d="M23.4 49.6h49.2" fill="none" class="a-edge" />
        <rect x="44" y="56.6" width="8" height="21.4" class="a-tape" />
        <ellipse cx="31" cy="62" rx="6" ry="2" class="a-gloss" />
      </template>
      <template v-else-if="kind === 'locked-or-no-permission'">
        <path d="M37.2 47V34a10.8 10.8 0 0 1 21.6 0v13" fill="none" class="a-shackle-depth" />
        <path d="M36 46V33a12 12 0 0 1 24 0v13" fill="none" :stroke="u.steel" class="a-shackle" />
        <path d="M33.4 44V33a14.6 14.6 0 0 1 9.4-13.6" fill="none" class="a-shackle-glint" />
        <rect x="26" y="45" width="44" height="34" rx="9" class="a-depth" />
        <rect x="26" y="42" width="44" height="34" rx="9" :fill="u.brass" />
        <path d="M33 42.6h30" fill="none" class="a-edge" />
        <circle cx="48" cy="56" r="4.6" class="a-key" />
        <path d="M46 58.4h4l1.3 8.2h-6.6z" class="a-key" />
        <ellipse cx="35.5" cy="48.5" rx="7" ry="2.4" class="a-gloss" />
      </template>
      <template v-else-if="kind === 'network-offline'">
        <path d="M11 50c-5 0-7 4-7 9 0 8 6 14 15 16" fill="none" class="a-cable" />
        <path d="M85 50c5 0 7 4 7 9 0 8-6 14-15 16" fill="none" class="a-cable" />
        <rect x="9" y="45" width="10" height="10" rx="3" :fill="u.graphite" />
        <rect x="77" y="45" width="10" height="10" rx="3" :fill="u.graphite" />
        <rect x="38" y="43.4" width="9" height="3.4" rx="1.4" :fill="u.brass" />
        <rect x="38" y="53.2" width="9" height="3.4" rx="1.4" :fill="u.brass" />
        <rect x="16" y="39" width="23" height="22" rx="6" :fill="u.plastic" />
        <rect x="57" y="39" width="23" height="22" rx="6" :fill="u.plastic" />
        <rect x="57" y="41" width="3.4" height="18" rx="1.7" class="a-face" />
        <circle cx="58.7" cy="45.1" r="1.3" class="a-hole" />
        <circle cx="58.7" cy="54.9" r="1.3" class="a-hole" />
        <path d="M21 39.6h13M62 39.6h13" fill="none" class="a-edge" />
        <ellipse cx="23" cy="44.5" rx="4.6" ry="1.8" class="a-gloss" />
        <ellipse cx="66" cy="44.5" rx="4.6" ry="1.8" class="a-gloss" />
      </template>
      <template v-else>
        <path d="M49.5 22 80.5 74h-61z" class="a-sign-depth" />
        <path d="M48 19 78 70H18z" :fill="u.warn" :stroke="u.warn" class="a-sign" />
        <path d="M48 27.5 70.6 66.2H25.4z" fill="none" class="a-sign-rim" />
        <rect x="45" y="35" width="6" height="18" rx="3" class="a-glyph" />
        <circle cx="48" cy="59.5" r="3.4" class="a-glyph" />
        <path d="M43.6 27.4 34.4 43" fill="none" class="a-shine" />
      </template>
    </svg>
  </view>
</template>
<script setup lang="ts">
import { computed } from "vue";
import type { EmptyKind } from "@/components/empty-state.vue";
const props = defineProps<{ kind: EmptyKind }>();
// Gradient ids are per instance so two pieces of art on one page never share a definition.
const n = Math.random().toString(36).slice(2, 10);
const names = ["steel", "graphite", "brass", "lens", "board", "inside", "plastic", "warn"] as const;
const ids = Object.fromEntries(names.map((name) => [name, "empty-" + name + "-" + n])) as Record<(typeof names)[number], string>;
const u = Object.fromEntries(names.map((name) => [name, "url(#" + ids[name] + ")"])) as Record<(typeof names)[number], string>;
const floor = computed(() => ({ "no-search-results": 28, "no-filter-results": 22, "locked-or-no-permission": 25, "recoverable-error": 31 } as Partial<Record<EmptyKind, number>>)[props.kind] ?? 34);
</script>
<style scoped>
.nx-empty-art { position: relative; display: grid; width: 100%; height: 100%; }
.nx-empty-art :deep(.nx-empty-art__svg) { display: block; overflow: visible; }
/* Shared light: top-left, a white gloss, a 1px top edge and a floor shadow, the same as NxObjectIcon. */
.nx-empty-art :deep(.a-floor) { fill: rgba(20,16,8,.12); }
.nx-empty-art :deep(.a-gloss) { fill: rgba(255,255,255,.34); }
.nx-empty-art :deep(.a-edge) { stroke: rgba(255,255,255,.7); stroke-width: 1; stroke-linecap: round; }
.nx-empty-art :deep(.a-depth) { fill: #7A828E; }
.nx-empty-art :deep(.a-ink) { fill: rgba(78,49,4,.45); }
.nx-empty-art :deep(.a-hole) { fill: #1E2126; }
/* Materials. */
.nx-empty-art :deep(.m-steel-hi) { stop-color: #F4F6F9; }
.nx-empty-art :deep(.m-steel-mid) { stop-color: #C4CAD3; }
.nx-empty-art :deep(.m-steel-lo) { stop-color: #8A929E; }
.nx-empty-art :deep(.m-gr-hi) { stop-color: #7A818C; }
.nx-empty-art :deep(.m-gr-lo) { stop-color: #4A505A; }
.nx-empty-art :deep(.m-brass-hi) { stop-color: #F4D58A; }
.nx-empty-art :deep(.m-brass-mid) { stop-color: #DDB45C; }
.nx-empty-art :deep(.m-brass-lo) { stop-color: #B98A2E; }
.nx-empty-art :deep(.m-board-hi) { stop-color: #EDD3A0; }
.nx-empty-art :deep(.m-board-mid) { stop-color: #CDA567; }
.nx-empty-art :deep(.m-board-lo) { stop-color: #9A7138; }
.nx-empty-art :deep(.m-in-hi) { stop-color: #6E4F25; }
.nx-empty-art :deep(.m-in-lo) { stop-color: #9A7442; }
.nx-empty-art :deep(.m-pl-hi) { stop-color: #FFFFFF; }
.nx-empty-art :deep(.m-pl-mid) { stop-color: #E4E7EC; }
.nx-empty-art :deep(.m-pl-lo) { stop-color: #A9B0BA; }
.nx-empty-art :deep(.m-lens-hi) { stop-color: #FFFFFF; stop-opacity: .82; }
.nx-empty-art :deep(.m-lens-lo) { stop-color: #A9C8E6; stop-opacity: .38; }
/* The sign is the status amber itself (--v5-warning), lit the same way. */
.nx-empty-art :deep(.m-warn-hi) { stop-color: color-mix(in srgb, var(--v5-warning) 50%, white); }
.nx-empty-art :deep(.m-warn-mid) { stop-color: color-mix(in srgb, var(--v5-warning) 86%, white); }
.nx-empty-art :deep(.m-warn-lo) { stop-color: color-mix(in srgb, var(--v5-warning) 80%, black); }
[data-theme="light"] .nx-empty-art :deep(.m-warn-hi) { stop-color: color-mix(in srgb, var(--v5-warning) 38%, white); }
[data-theme="light"] .nx-empty-art :deep(.m-warn-mid) { stop-color: color-mix(in srgb, var(--v5-warning) 76%, white); }
[data-theme="light"] .nx-empty-art :deep(.m-warn-lo) { stop-color: color-mix(in srgb, var(--v5-warning) 92%, black); }
/* Per-object parts. */
.nx-empty-art :deep(.a-lens-bed) { fill: #DCE3EB; }
.nx-empty-art :deep(.a-lens-rim) { stroke: rgba(30,33,38,.22); stroke-width: 1.2; }
.nx-empty-art :deep(.a-lens-glint) { stroke: rgba(255,255,255,.9); stroke-width: 2.4; stroke-linecap: round; }
.nx-empty-art :deep(.a-rim) { stroke: rgba(255,255,255,.55); stroke-width: 1; }
.nx-empty-art :deep(.a-shine) { stroke: rgba(255,255,255,.4); stroke-width: 2.6; stroke-linecap: round; }
.nx-empty-art :deep(.a-board-back) { fill: #B48A4E; }
.nx-empty-art :deep(.a-board-left) { fill: #E2C48C; }
.nx-empty-art :deep(.a-board-right) { fill: #A57C40; }
.nx-empty-art :deep(.a-board-flap) { fill: #E8CC96; }
.nx-empty-art :deep(.a-tape) { fill: rgba(255,255,255,.2); }
.nx-empty-art :deep(.a-shackle) { stroke-width: 7; }
.nx-empty-art :deep(.a-shackle-depth) { stroke: #6E7682; stroke-width: 7; }
.nx-empty-art :deep(.a-shackle-glint) { stroke: rgba(255,255,255,.55); stroke-width: 1.4; stroke-linecap: round; }
.nx-empty-art--locked-or-no-permission :deep(.a-depth) { fill: #8F6A22; }
.nx-empty-art :deep(.a-key) { fill: #4E3104; }
.nx-empty-art :deep(.a-cable) { stroke: #59606B; stroke-width: 3.6; stroke-linecap: round; }
.nx-empty-art :deep(.a-face) { fill: #C9CED6; }
.nx-empty-art :deep(.a-sign) { stroke-width: 8; stroke-linejoin: round; }
.nx-empty-art :deep(.a-sign-depth) { fill: color-mix(in srgb, var(--v5-warning) 58%, black); stroke: color-mix(in srgb, var(--v5-warning) 58%, black); stroke-width: 8; stroke-linejoin: round; }
.nx-empty-art :deep(.a-sign-rim) { stroke: rgba(255,255,255,.45); stroke-width: 1.2; stroke-linejoin: round; }
.nx-empty-art :deep(.a-glyph) { fill: #3D2A06; }
/* Dark page: the same objects, with a brighter top light and a deeper floor so they read on #0A0A0A. */
:root:not([data-theme="light"]) .nx-empty-art :deep(.a-floor) { fill: rgba(0,0,0,.5); }
:root:not([data-theme="light"]) .nx-empty-art :deep(.a-gloss) { fill: rgba(255,255,255,.26); }
:root:not([data-theme="light"]) .nx-empty-art :deep(.a-edge) { stroke: rgba(255,255,255,.55); }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-steel-hi) { stop-color: #E6EAF0; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-steel-mid) { stop-color: #9EA6B2; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-steel-lo) { stop-color: #5B626D; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.a-depth) { fill: #3E444D; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-gr-hi) { stop-color: #3E444E; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-gr-lo) { stop-color: #1B1E23; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-pl-hi) { stop-color: #F2F4F7; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-pl-mid) { stop-color: #C3C8D0; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-pl-lo) { stop-color: #7C8390; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.a-lens-bed) { fill: #2A3038; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-lens-hi) { stop-color: #FFFFFF; stop-opacity: .5; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.m-lens-lo) { stop-color: #7FA9D4; stop-opacity: .22; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.a-shackle-depth) { stroke: #3E444D; }
:root:not([data-theme="light"]) .nx-empty-art :deep(.a-cable) { stroke: #5A616C; }
</style>
