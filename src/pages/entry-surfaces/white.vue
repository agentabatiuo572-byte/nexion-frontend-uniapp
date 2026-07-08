<template>
  <EntrySurfaceHome surface="white" />
</template>

<script setup lang="ts">
import EntrySurfaceHome from "@/components/entry-surfaces/entry-surface-home.vue";
import { useSetPageHeader } from "@/composables/use-page-header";

useSetPageHeader({
  title: "白 APP 接管首页",
  subtitle: "体检融合",
  backHref: "/pages/entry-surfaces/index",
});
</script>
