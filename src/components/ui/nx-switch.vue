<!--
  NxSwitch — the one binary switch face (design system 03 §3.3): track and white knob, the same in both themes. It is
  decoration only: the row that owns it carries role="switch", aria-checked, the 44px target and the keyboard.
  `checked: null` is an unknown read and shows 「—」 instead of a state.
-->
<template>
  <view v-if="checked === null" class="nx-switch nx-switch--unknown" aria-hidden="true"><text>—</text></view>
  <view v-else class="nx-switch" :class="{ 'nx-switch--on': checked }" aria-hidden="true"><view class="nx-switch__knob" /></view>
</template>

<script setup lang="ts">
defineProps<{ checked: boolean | null }>();
</script>

<style scoped>
.nx-switch { position: relative; flex: none; width: 36px; height: 20px; padding: 2px; border-radius: 999px; background: var(--v5-surface-3); }
.nx-switch--on { background: var(--v5-brand); }
.nx-switch__knob { display: block; width: 16px; height: 16px; border-radius: 999px; background: #FFFFFF; transition: transform 150ms ease; }
.nx-switch--on .nx-switch__knob { transform: translateX(16px); }
.nx-switch--unknown { display: grid; place-items: center; padding: 0; background: none; color: var(--v5-ink-3); }
@media (prefers-reduced-motion: reduce) { .nx-switch__knob { transition: none; } }
</style>
