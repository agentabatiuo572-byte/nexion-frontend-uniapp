<template>
  <!-- Toast host -->
  <view class="nx-toast-host">
    <view
      v-for="t in ui.toasts"
      :key="t.id"
      class="nx-toast"
      :class="`nx-toast--${t.kind}`"
      @click="ui.dismissToast(t.id)"
    >
      <view class="nx-toast__bar" />
      <view class="nx-toast__body">
        <text class="nx-toast__title">{{ t.title }}</text>
        <text v-if="t.description" class="nx-toast__desc">{{ t.description }}</text>
      </view>
    </view>
  </view>

  <!-- Confirm dialog (renders top of queue) -->
  <view
    v-if="topConfirm"
    class="nx-mask"
    @click="ui.resolveConfirm(topConfirm.id, false)"
  >
    <view class="nx-modal" @click.stop>
      <text class="nx-modal__title">{{ topConfirm.title }}</text>
      <text v-if="topConfirm.message" class="nx-modal__msg">{{ topConfirm.message }}</text>
      <view class="nx-modal__actions">
        <view
          v-if="!topConfirm.hideCancel"
          class="nx-btn nx-btn--ghost"
          @click="ui.resolveConfirm(topConfirm.id, false)"
        >
          <text class="nx-btn__label nx-btn__label--ghost">{{ topConfirm.cancelLabel || "取消" }}</text>
        </view>
        <view
          class="nx-btn"
          :class="topConfirm.danger ? 'nx-btn--danger' : 'nx-btn--primary'"
          @click="ui.resolveConfirm(topConfirm.id, true)"
        >
          <text class="nx-btn__label">{{ topConfirm.confirmLabel || "确认" }}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- Network-error overlay -->
  <view v-if="ui.netError.visible" class="nx-mask">
    <view class="nx-modal">
      <text class="nx-modal__title">{{ ui.netError.title }}</text>
      <text class="nx-modal__msg">{{ ui.netError.message }}</text>
      <view class="nx-modal__actions">
        <view class="nx-btn nx-btn--primary" @click="onRetry">
          <text class="nx-btn__label">重试</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useUI } from "@/store/ui";

const ui = useUI();
// Last enqueued confirm renders on top (LIFO), matching the original.
const topConfirm = computed(() => ui.confirmQueue[ui.confirmQueue.length - 1] || null);

function onRetry() {
  const cb = ui.netError.onRetry;
  ui.hideNetError();
  cb?.();
}
</script>

<style scoped>
/* ───── Toasts ───── */
.nx-toast-host {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.nx-toast {
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  width: 86%;
  max-width: 360px;
  background: var(--v5-toast-bg);
  border: 1px solid var(--v5-toast-border);
  border-radius: 14px;
  box-shadow: var(--v5-toast-shadow);
  overflow: hidden;
}
.nx-toast__bar {
  width: 4px;
  flex-shrink: 0;
}
.nx-toast--success .nx-toast__bar { background: var(--v5-success); }
.nx-toast--info .nx-toast__bar { background: var(--v5-brand); }
.nx-toast--warn .nx-toast__bar { background: var(--v5-warning); }
.nx-toast--error .nx-toast__bar { background: var(--v5-danger); }
.nx-toast__body {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  gap: 2px;
}
.nx-toast__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--v5-ink);
}
.nx-toast__desc {
  font-size: 12px;
  color: var(--v5-ink-3);
}

/* ───── Modal (confirm + netError) ───── */
.nx-mask {
  position: fixed;
  inset: 0;
  z-index: 9100;
  background: var(--v5-bg-color-mask, rgba(0, 0, 0, 0.45));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.nx-modal {
  width: 100%;
  max-width: 320px;
  background: var(--v5-surface);
  border: 1px solid var(--v5-border);
  border-radius: 18px;
  box-shadow: var(--v5-card-shadow-lift-strong);
  padding: 22px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nx-modal__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--v5-ink);
}
.nx-modal__msg {
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--v5-ink-3);
}
.nx-modal__actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.nx-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  border-radius: 12px;
}
.nx-btn--primary { background: var(--v5-brand); }
.nx-btn--danger { background: var(--v5-danger); }
.nx-btn--ghost { background: var(--v5-surface-2); }
.nx-btn__label {
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-on-brand);
}
/* Cancel is visually subordinate to the primary CTA (Nexion conversion rule). */
.nx-btn__label--ghost {
  font-weight: 400;
  color: var(--v5-ink-3);
}
</style>
