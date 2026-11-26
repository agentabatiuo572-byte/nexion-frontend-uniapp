import { inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { TAB_LIFECYCLE, onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { ApiError } from "@/api/errors";
import { appReadOnline, foregroundReadAllowed } from "@/lib/foreground-read";
import { registerPageRecovery } from "@/lib/active-page-refresh";
import { READ_RECOVERY_DELAYS_MS as delays } from "@/lib/remote-read-failure";
import { useApp } from "@/store/app";

/** READS only. retry must use the store's account/generation guards and read window. */
export function useAutoRecovery(options: {
  failed: () => boolean;
  retry: () => Promise<unknown>;
  retryOnPullOrReconnect?: () => Promise<unknown>;
  pullManagedByPage?: boolean;
  active?: () => boolean;
  repeatMs?: number;
  repeatWhile?: () => boolean;
  retryNotBefore?: () => number;
  quiet?: boolean | (() => boolean);
}) {
  const app = useApp();
  const shown = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<boolean> | null = null;
  let attempts = 0;
  let retryAt = 0;
  let disposed = false;
  let release = () => {};
  const isActive = () => shown.value && (options.active?.() ?? true);

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  const retryWait = () => Math.max(retryAt, options.retryNotBefore?.() ?? 0) - Date.now();

  function schedule(
    delay: number | undefined = delays[attempts] ?? (options.repeatWhile?.() === false ? undefined : options.repeatMs),
    read?: () => Promise<unknown>,
  ) {
    if (disposed || timer !== undefined || inFlight || !isActive() || !foregroundReadAllowed()
      || !options.failed() || delay === undefined) return;
    const epoch = app.accountBindingEpoch;
    const account = app.accountKey;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed || !isActive() || !foregroundReadAllowed()
        || epoch !== app.accountBindingEpoch || account !== app.accountKey) return;
      const wait = retryWait();
      if (wait > 0) { schedule(wait); return; }
      attempts += 1;
      void attempt(read);
    }, Math.max(delay === options.repeatMs ? delay : delay * (0.85 + Math.random() * 0.3), retryWait()));
  }

  function attempt(read = options.retry): Promise<boolean> {
    if (inFlight) return inFlight;
    if (disposed || !isActive() || !foregroundReadAllowed()) return Promise.resolve(false);
    if (!options.failed()) return Promise.resolve(true);
    const wait = retryWait();
    if (wait > 0) { schedule(wait); return Promise.resolve(false); }
    const epoch = app.accountBindingEpoch;
    const account = app.accountKey;
    const current = () => !disposed && epoch === app.accountBindingEpoch && account === app.accountKey;
    // Defer dispatch so the shared promise exists before reactive store updates can reenter.
    inFlight = Promise.resolve().then(async () => {
      if (!current() || !isActive() || !foregroundReadAllowed()) return false;
      try {
        await read();
        return current() && !options.failed();
      } catch (cause) {
        // This boundary owns read recovery; commands must never be passed here.
        if (current() && cause instanceof ApiError && cause.kind === "http" && cause.status === 429)
          retryAt = Date.now() + (cause.retryAfterMs ?? 30_000);
        return false;
      }
    }).finally(() => {
      inFlight = null;
      if (!current()) { schedule(); return; }
      if (!options.failed()) { attempts = 0; retryAt = 0; }
      schedule();
    });
    return inFlight;
  }

  /** Pull-to-refresh joins a running attempt; a new trigger renews the three-retry budget. */
  function retry(): Promise<boolean> {
    clearTimer();
    attempts = 0;
    return attempt(options.retryOnPullOrReconnect);
  }

  /** A newly confirmed command can require a readback after a previous read exhausted its budget. */
  function restartBackoff() {
    clearTimer();
    clearTimeout(settleTimer);
    attempts = 0;
    schedule();
  }

  function updateActive(delay?: number) {
    release();
    if (!isActive()) {
      clearTimer();
      clearTimeout(settleTimer);
      return;
    }
    release = registerPageRecovery({
      failed: options.failed, pending: () => inFlight !== null, retry: options.pullManagedByPage ? undefined : retry,
      // Conditional repeats also serve ordinary failed reads when pull is available.
      quiet: () => typeof options.quiet === "function" ? options.quiet()
        : options.quiet ?? (options.repeatMs !== undefined && options.repeatWhile === undefined),
    });
    attempts = 0;
    schedule(delay);
  }
  function show() {
    shown.value = true;
    // Foreground/reconnect reads are jittered separately from normal backoff.
    updateActive(300 + Math.random() * 700);
  }
  onShow(show);
  // On an ordinary page a component mounted after the page showed gets no show hook.
  if (!inject(TAB_LIFECYCLE, null)) onMounted(show);
  onHide(() => { shown.value = false; updateActive(); });
  if (options.active) watch(options.active, () => updateActive());
  watch(options.failed, failed => {
    if (inFlight || !isActive()) return; // loading during our own attempt must not renew the budget.
    clearTimeout(settleTimer);
    if (failed) schedule();
    // A read from elsewhere also turns failed() off, so only a recovery that holds renews the budget.
    else settleTimer = setTimeout(() => { clearTimer(); attempts = 0; retryAt = 0; }, 5_000);
  });
  if (options.repeatWhile) watch(options.repeatWhile, () => {
    if (attempts < delays.length) return;
    clearTimer();
    schedule();
  });
  watch([foregroundReadAllowed, appReadOnline], ([allowed, online], [wasAllowed, wasOnline]) => {
    if (allowed === wasAllowed) return;
    clearTimer();
    if (allowed) {
      attempts = 0;
      schedule(300 + Math.random() * 700, online && !wasOnline ? options.retryOnPullOrReconnect : undefined);
    }
  });
  watch(() => app.accountBindingEpoch, () => {
    clearTimer(); attempts = 0; retryAt = 0;
    schedule();
  });
  onBeforeUnmount(() => { disposed = true; clearTimer(); clearTimeout(settleTimer); release(); });

  return { retry, restartBackoff };
}
