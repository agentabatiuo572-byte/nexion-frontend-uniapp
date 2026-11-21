<template>
  <image v-if="src && !failed" :key="src" mode="aspectFit" v-bind="$attrs" :src="src" @error="failed = true" />
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ src?: string | null }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>
