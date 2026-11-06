<template>
  <!-- Toast host: one centred toast, above every sheet and confirm; taps pass through it. -->
  <view class="nx-toast-host" role="status" aria-live="polite" aria-atomic="true">
    <view
      v-if="shown && ui.activeToast"
      :key="ui.activeToast.id"
      class="nx-toast nx-dialog-pop-in"
      :class="`nx-toast--${ui.activeToast.kind}`"
    >
      <view v-if="ui.activeToast.kind !== 'info'" class="nx-toast__icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="ui.activeToast.kind === 'success'"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></template>
          <template v-else-if="ui.activeToast.kind === 'warn'"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></template>
          <template v-else><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></template>
        </svg>
      </view>
      <text class="nx-toast__title">{{ ui.activeToast.title }}</text>
      <text v-if="ui.activeToast.description" class="nx-toast__desc">{{ ui.activeToast.description }}</text>
    </view>
  </view>

</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { useUI } from "@/store/ui";

const ui = useUI();
const shown = ref(true);
onShow(() => { shown.value = true; });
onHide(() => { shown.value = false; });
</script>

<style scoped>
/* ───── Toasts ───── */
.nx-toast-host {
  position: fixed;
  inset: 0;
  z-index: 9300;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 32px;
  pointer-events: none;
}
.nx-toast {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 136px;
  max-width: min(280px, 100%);
  padding: 18px 20px 16px;
  border-radius: 20px;
  background: var(--v5-toast-bg);
  -webkit-backdrop-filter: blur(12px) saturate(125%);
  backdrop-filter: blur(12px) saturate(125%);
  box-shadow: var(--v5-toast-shadow);
  text-align: center;
}
/* Info is text only. */
.nx-toast--info { padding: 12px 18px; border-radius: 16px; }
.nx-toast__icon { display: block; flex: none; width: 32px; height: 32px; }
.nx-toast--success .nx-toast__icon { color: var(--v5-toast-success); }
.nx-toast--warn .nx-toast__icon { color: var(--v5-toast-warning); }
.nx-toast--error .nx-toast__icon { color: var(--v5-toast-danger); }
.nx-toast__title {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
  font: 500 15px/22px var(--font-v5);
  color: var(--v5-toast-ink);
}
.nx-toast__desc {
  display: block;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  font: 400 13px/18px var(--font-v5);
  color: var(--v5-toast-ink-2);
}

</style>
