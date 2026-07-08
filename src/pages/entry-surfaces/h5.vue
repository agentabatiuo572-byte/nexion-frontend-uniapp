<template>
  <EntrySurfaceHome surface="h5" />
</template>

<script setup lang="ts">
import EntrySurfaceHome from "@/components/entry-surfaces/entry-surface-home.vue";
import { useSetPageHeader } from "@/composables/use-page-header";

useSetPageHeader({
  title: "H5 网页版首页",
  subtitle: "基础托管",
  backHref: "/pages/entry-surfaces/index",
});
</script>
