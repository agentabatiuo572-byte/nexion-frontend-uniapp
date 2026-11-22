<template>
  <!-- The async page boundary has no header: the shared whole-page rule centres the result in the screen (03 §3.4, §3.5.2). -->
  <view class="nx-standalone-page" role="alert">
    <EmptyState kind="recoverable-error" page :title="t.pageLoad.unknown"
      :cta-label="t.ui.reload" :cta-busy="reloading" @cta="retry" />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import EmptyState from "@/components/empty-state.vue";
import { useT } from "@/i18n/use-t";
import { createPageReload } from "@/lib/page-load-recovery";

defineProps<{ error?: unknown }>();
const t = useT();
const reloading = ref(false);
// Re-enter normal app startup and its authentication/legal guards at the exact
// current URL. No automatic reload loop, redirect, cache purge or stored payload.
const reload = createPageReload(() => window.location.reload());
function retry() {
  if (reloading.value) return;
  reloading.value = reload();
}
</script>
