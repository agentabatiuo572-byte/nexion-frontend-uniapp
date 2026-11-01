<!-- Pauses the continuous loops inside it (nx-loops-paused) while this element is off-screen, clipped by a scroller, or its page is hidden. -->
<template>
  <view ref="loopRef" class="loop-scope" :class="{ 'nx-loops-paused': !loops.running.value }"><slot /></view>
</template>

<script setup lang="ts">
import { useLoopsInView } from "@/composables/use-loops-in-view";

const loops = useLoopsInView(".loop-scope");
const loopRef = loops.elRef;
</script>
