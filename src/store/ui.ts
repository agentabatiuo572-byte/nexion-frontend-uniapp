import { defineStore } from "pinia";
import { ref } from "vue";

// Ported from Nexion-prototype/lib/store/ui.ts (zustand → Pinia).
// Global toast / confirm / netError primitives. The convenience helpers
// (toast.* / confirm() / netError.*) are importable anywhere and call the
// store imperatively — pinia must be active (app.use(createPinia) in main.ts).

// ───── Toast ─────
export type ToastKind = "success" | "info" | "warn" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  durationMs: number;
}

// ───── Confirm Dialog ─────
// NOTE: original had `content?: ReactNode` for a structured body. In Vue that
// becomes a named slot — deferred. MVP uses `message` text only.
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  hideCancel?: boolean;
  icon?: "danger" | "warn" | "info" | "success" | null;
}

interface ConfirmInternal extends ConfirmOptions {
  id: string;
  resolve: (ok: boolean) => void;
}

// ───── Network-error Overlay ─────
export interface NetErrorState {
  visible: boolean;
  title: string;
  message: string;
  retryAfterMs: number | null;
  onRetry?: () => void;
}

let toastSeq = 0;
let confirmSeq = 0;

export const useUI = defineStore("ui", () => {
  const toasts = ref<Toast[]>([]);
  const confirmQueue = ref<ConfirmInternal[]>([]);
  const netError = ref<NetErrorState>({
    visible: false,
    title: "",
    message: "",
    retryAfterMs: null,
  });
  const messageDrawerOpen = ref(false);

  function pushToast(t: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) {
    const id = `tst-${++toastSeq}`;
    const durationMs = t.durationMs ?? 3200;
    toasts.value = [...toasts.value, { ...t, id, durationMs }];
    if (durationMs > 0) {
      setTimeout(() => dismissToast(id), durationMs);
    }
    return id;
  }

  function dismissToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function confirm(opts: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      const id = `cnf-${++confirmSeq}`;
      confirmQueue.value = [...confirmQueue.value, { ...opts, id, resolve }];
    });
  }

  function resolveConfirm(id: string, ok: boolean) {
    const item = confirmQueue.value.find((c) => c.id === id);
    // Settle queue state first, then notify the awaiter.
    confirmQueue.value = confirmQueue.value.filter((c) => c.id !== id);
    if (item) item.resolve(ok);
  }

  function clearAllConfirms() {
    const pending = confirmQueue.value;
    if (pending.length === 0) return;
    confirmQueue.value = [];
    for (const item of pending) item.resolve(false);
  }

  function showNetError(s: Omit<NetErrorState, "visible">) {
    netError.value = { visible: true, ...s };
  }

  function hideNetError() {
    netError.value = { visible: false, title: "", message: "", retryAfterMs: null };
  }

  function openMessageDrawer() {
    messageDrawerOpen.value = true;
  }
  function closeMessageDrawer() {
    messageDrawerOpen.value = false;
  }

  return {
    toasts,
    confirmQueue,
    netError,
    messageDrawerOpen,
    pushToast,
    dismissToast,
    confirm,
    resolveConfirm,
    clearAllConfirms,
    showNetError,
    hideNetError,
    openMessageDrawer,
    closeMessageDrawer,
  };
});

// ───── Convenience helpers (importable anywhere, no hook needed) ─────
export const toast = {
  success: (title: string, description?: string) =>
    useUI().pushToast({ kind: "success", title, description }),
  info: (title: string, description?: string) =>
    useUI().pushToast({ kind: "info", title, description }),
  warn: (title: string, description?: string) =>
    useUI().pushToast({ kind: "warn", title, description }),
  error: (title: string, description?: string) =>
    useUI().pushToast({ kind: "error", title, description, durationMs: 4500 }),
};

export const confirm = (opts: ConfirmOptions): Promise<boolean> => useUI().confirm(opts);

export const netError = {
  show: (s: Omit<NetErrorState, "visible">) => useUI().showNetError(s),
  hide: () => useUI().hideNetError(),
};
