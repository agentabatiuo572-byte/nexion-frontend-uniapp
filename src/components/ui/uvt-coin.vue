<!--
  The UVT token as a coin: the same hexagon mark the wallet card uses for UVT, on a
  UVT-purple face with a metal rim and one soft highlight (01 §1.1.2: UVT purple stays a
  flat identifier colour; the shading is the coin's own material). The parent sets the size.
  Decorative: hidden from screen readers, the amount next to it carries the meaning.
-->
<template>
  <view class="uvt-coin" :class="{ 'uvt-coin--muted': muted }" aria-hidden="true">
    <svg class="uvt-coin__svg" viewBox="0 0 64 64" width="100%" height="100%">
      <defs>
        <linearGradient :id="ids.rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="uvt-coin__rim-hi" />
          <stop offset="1" class="uvt-coin__rim-lo" />
        </linearGradient>
        <radialGradient :id="ids.face" cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" class="uvt-coin__face-hi" />
          <stop offset="0.55" class="uvt-coin__face-mid" />
          <stop offset="1" class="uvt-coin__face-lo" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="31" :fill="'url(#' + ids.rim + ')'" />
      <circle cx="32" cy="32" r="27" :fill="'url(#' + ids.face + ')'" />
      <circle cx="32" cy="32" r="26.5" fill="none" class="uvt-coin__inner-line" stroke-width="1" />
      <ellipse cx="24" cy="19" rx="13" ry="6.5" transform="rotate(-28 24 19)" class="uvt-coin__gloss" />
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM9 8.5v4a3 3 0 0 0 6 0v-4" transform="translate(14.5 14.5) scale(1.46)" fill="none" class="uvt-coin__mark" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </view>
</template>
<script setup lang="ts">
defineProps<{ muted?: boolean }>();
// Gradient ids are per instance so several coins on one page never share a definition.
const n = Math.random().toString(36).slice(2, 10);
const ids = { rim: 'uvt-rim-' + n, face: 'uvt-face-' + n };
</script>
<style scoped>
.uvt-coin { position: relative; display: block; width: 100%; height: 100%; filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--v5-nex) 30%, transparent)); }
.uvt-coin__svg { display: block; }
.uvt-coin__rim-hi { stop-color: color-mix(in srgb, var(--v5-nex) 35%, white); }
.uvt-coin__rim-lo { stop-color: color-mix(in srgb, var(--v5-nex) 62%, black); }
.uvt-coin__face-hi { stop-color: color-mix(in srgb, var(--v5-nex) 70%, white); }
.uvt-coin__face-mid { stop-color: var(--v5-nex); }
.uvt-coin__face-lo { stop-color: color-mix(in srgb, var(--v5-nex) 78%, black); }
.uvt-coin__inner-line { stroke: color-mix(in srgb, white 28%, transparent); }
.uvt-coin__gloss { fill: color-mix(in srgb, white 30%, transparent); }
.uvt-coin__mark { stroke: white; }
.uvt-coin--muted { filter: grayscale(1); opacity: .45; }
</style>
