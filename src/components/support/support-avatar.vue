<!--
  SupportAvatar — the cartoon advisor portrait, shared by the floating support
  shortcut and the chat header. Dark and light themes use their own asset.
  The unread heartbeat lives on the shortcut button, not on the portrait.
-->
<template>
  <image
    class="nx-support-portrait"
    :class="{ 'nx-support-portrait--light': appearance === 'light' }"
    :src="appearance === 'light' ? '/static/img/marketing/support-advisor-light-20261102.webp' : '/static/img/marketing/support-advisor-dark-20261102.webp'"
    mode="aspectFill"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number; appearance?: 'light' | 'dark' }>(), {
  size: 36,
  appearance: 'dark',
});
</script>

<style scoped>
.nx-support-portrait {
  display: block;
  flex-shrink: 0;
  border-radius: 999px;
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, .12), 0 4px 10px rgba(0, 0, 0, .35);
}
.nx-support-portrait--light { box-shadow: 0 0 0 1.5px rgba(19, 20, 26, .08), 0 4px 10px rgba(0, 0, 0, .12); }
</style>
