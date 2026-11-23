<!--
  The USDT token as a coin, the same build as uvt-coin.vue: a Tether-green face with a metal rim,
  one soft highlight and a faint shadow, the ₮ mark (bar, stem and ring) in white. The parent sets
  the size. Decorative: hidden from screen readers, the amount next to it carries the meaning.
-->
<template>
  <view class="usdt-coin" :class="{ 'usdt-coin--muted': muted }" aria-hidden="true">
    <svg class="usdt-coin__svg" viewBox="0 0 64 64" width="100%" height="100%">
      <defs>
        <linearGradient :id="ids.rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="usdt-coin__rim-hi" />
          <stop offset="1" class="usdt-coin__rim-lo" />
        </linearGradient>
        <radialGradient :id="ids.face" cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" class="usdt-coin__face-hi" />
          <stop offset="0.55" class="usdt-coin__face-mid" />
          <stop offset="1" class="usdt-coin__face-lo" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="31" :fill="'url(#' + ids.rim + ')'" />
      <circle cx="32" cy="32" r="27" :fill="'url(#' + ids.face + ')'" />
      <circle cx="32" cy="32" r="26.5" fill="none" class="usdt-coin__inner-line" stroke-width="1" />
      <ellipse cx="24" cy="19" rx="13" ry="6.5" transform="rotate(-28 24 19)" class="usdt-coin__gloss" />
      <path d="M21 20.5h22M32 20.5v24" fill="none" class="usdt-coin__mark" stroke-width="4" stroke-linecap="round" />
      <ellipse cx="32" cy="29.5" rx="11.5" ry="3.6" fill="none" class="usdt-coin__mark" stroke-width="2.6" />
    </svg>
  </view>
</template>
<script setup lang="ts">
defineProps<{ muted?: boolean }>();
// Gradient ids are per instance so several coins on one page never share a definition.
const n = Math.random().toString(36).slice(2, 10);
const ids = { rim: 'usdt-rim-' + n, face: 'usdt-face-' + n };
</script>
<style scoped>
/* Tether green, the token's own colour; it is an identifier, not a theme accent. */
.usdt-coin { --usdt: #26a17b; position: relative; display: block; width: 100%; height: 100%; filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--usdt) 30%, transparent)); }
.usdt-coin :deep(.usdt-coin__svg) { display: block; }
.usdt-coin :deep(.usdt-coin__rim-hi) { stop-color: color-mix(in srgb, var(--usdt) 35%, white); }
.usdt-coin :deep(.usdt-coin__rim-lo) { stop-color: color-mix(in srgb, var(--usdt) 62%, black); }
.usdt-coin :deep(.usdt-coin__face-hi) { stop-color: color-mix(in srgb, var(--usdt) 70%, white); }
.usdt-coin :deep(.usdt-coin__face-mid) { stop-color: var(--usdt); }
.usdt-coin :deep(.usdt-coin__face-lo) { stop-color: color-mix(in srgb, var(--usdt) 78%, black); }
.usdt-coin :deep(.usdt-coin__inner-line) { stroke: color-mix(in srgb, white 28%, transparent); }
.usdt-coin :deep(.usdt-coin__gloss) { fill: color-mix(in srgb, white 30%, transparent); }
.usdt-coin :deep(.usdt-coin__mark) { stroke: white; }
.usdt-coin--muted { filter: grayscale(1); opacity: .45; }
</style>
