import { inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { TAB_LIFECYCLE, onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { ApiError } from "@/api/errors";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { registerPageRecovery } from "@/lib/active-page-refresh";
import { useApp } from "@/store/app";

/** READS only. retry must use the store's account/generation guards and read window. */
export function useAutoRecovery(options: { failed: () => boolean; retry: () => Promise<unknown>; repeatMs?: number }) {
  const app = useApp();
  const shown = ref(false);
  const delays = [3_000, 10_000, 30_000];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<boolean> | null = null;
  let attempts = 0;
  let retryAt = 0;
  let disposed = false;
  let release = () => {};

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function schedule(delay = delays[attempts] ?? options.repeatMs) {
    if (disposed || timer !== undefined || inFlight || !shown.value || !foregroundReadAllowed()
      || !options.failed() || delay === undefined) return;
    const epoch = app.accountBindingEpoch;
    const account = app.accountKey;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed || !shown.value || !foregroundReadAllowed()
        || epoch !== app.accountBindingEpoch || account !== app.accountKey) return;
      attempts += 1;
      void attempt();
    }, Math.max(delay === options.repeatMs ? delay : delay * (0.85 + Math.random() * 0.3), retryAt - Date.now()));
  }

  function attempt(): Promise<boolean> {
    if (inFlight) return inFlight;
    if (disposed || !shown.value || !foregroundReadAllowed()) return Promise.resolve(false);
    if (!options.failed()) return Promise.resolve(true);
    if (Date.now() < retryAt) { schedule(retryAt - Date.now()); return Promise.resolve(false); }
    const epoch = app.accountBindingEpoch;
    const account = app.accountKey;
    const current = () => !disposed && epoch === app.accountBindingEpoch && account === app.accountKey;
    // Defer dispatch so the shared promise exists before reactive store updates can reenter.
    inFlight = Promise.resolve().then(async () => {
      if (!current() || !shown.value || !foregroundReadAllowed()) return false;
      try {
        await options.retry();
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
    return attempt();
  }

  function show() {
    shown.value = true;
    release();
    release = registerPageRecovery({ failed: options.failed, pending: () => inFlight !== null, retry });
    attempts = 0;
    // Foreground/reconnect reads are jittered separately from normal backoff.
    schedule(300 + Math.random() * 700);
  }
  onShow(show);
  // On an ordinary page a component mounted after the page showed gets no show hook.
  if (!inject(TAB_LIFECYCLE, null)) onMounted(show);
  onHide(() => { shown.value = false; clearTimer(); release(); });
  watch(options.failed, failed => {
    if (inFlight) return; // loading during our own attempt must not renew the budget.
    if (!failed) { clearTimer(); attempts = 0; retryAt = 0; }
    else schedule();
  });
  watch(foregroundReadAllowed, (allowed, wasAllowed) => {
    clearTimer();
    if (allowed && !wasAllowed) { attempts = 0; schedule(300 + Math.random() * 700); }
  });
  watch(() => app.accountBindingEpoch, () => {
    clearTimer(); attempts = 0; retryAt = 0;
    schedule();
  });
  onBeforeUnmount(() => { disposed = true; clearTimer(); release(); });

  return { retry };
}
