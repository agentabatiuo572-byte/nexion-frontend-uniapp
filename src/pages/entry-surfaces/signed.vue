<template>
  <EntrySurfaceHome surface="signed" />
</template>

<script setup lang="ts">
import EntrySurfaceHome from "@/components/entry-surfaces/entry-surface-home.vue";
import { useSetPageHeader } from "@/composables/use-page-header";

useSetPageHeader({
  title: "签名版 APP 首页",
  subtitle: "在线增强",
  backHref: "/pages/entry-surfaces/index",
});
</script>
