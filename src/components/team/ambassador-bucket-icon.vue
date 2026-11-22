<template>
  <NxIconTile :tone="tone" :size="size === 'small' ? 's' : 'm'">
    <svg :width="size === 'small' ? 16 : 20" :height="size === 'small' ? 16 : 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path v-for="(path, index) in visual.paths" :key="index" :d="path" /></svg>
  </NxIconTile>
</template>

<script setup lang="ts">
import { computed } from "vue";
import NxIconTile from "@/components/ui/nx-icon-tile.vue";
import { AMBASSADOR_BUCKET_VISUALS, AMBASSADOR_NO_BUCKET_VISUAL, type AmbassadorBucketId } from "@/lib/ambassador-display";

const props = withDefaults(defineProps<{ bucket: AmbassadorBucketId | null; size?: "small" | "regular" }>(), { size: "regular" });
const visual = computed(() => props.bucket ? AMBASSADOR_BUCKET_VISUALS[props.bucket] : AMBASSADOR_NO_BUCKET_VISUAL);
// The shared tile's hue per category; venue takes sky because the lime tile is kept for main actions.
const TONES = { venue: "sky", kol: "coral", print: "amber", dev: "purple" } as const;
const tone = computed(() => props.bucket ? TONES[props.bucket] : "muted");
</script>
