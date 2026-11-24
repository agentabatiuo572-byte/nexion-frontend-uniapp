import { computed, ref, shallowRef, watch } from "vue";
import { bundleDiscountApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { ApiError } from "@/api/errors";
import type { BundleDiscountSnapshot } from "@/api/bundle-discount-api";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
import { useApp } from "@/store/app";
import { onHide, onShow } from "@/composables/use-tab-page-lifecycle";
import { useAutoRecovery } from "@/composables/use-auto-recovery";

export function useBundleDiscountPolicy(enabled: () => boolean = () => true) {
  const app = useApp();
  const shown = ref(false);
  const policy = shallowRef<BundleDiscountSnapshot | null>(null);
  const failed = ref(false);
  const active = computed(() => {
    void app.accountBindingEpoch;
    return shown.value && enabled() && remoteApiEnabled
      && app.accountKey !== "default" && !!sessionVault.read();
  });
  let pending: Promise<void> | null = null;

  function refresh(): Promise<void> {
    if (!active.value) return Promise.resolve();
    if (pending) return pending;
    const scope = captureAccountScope();
    const current = () => active.value && isCurrentAccountScope(scope);
    const read = bundleDiscountApi.current().then(snapshot => {
      if (!current()) return;
      policy.value = snapshot.serverCanonical === true ? snapshot : null;
      failed.value = !policy.value;
    }).catch((cause: unknown) => {
      if (!current()) return;
      // An invalid response cannot supply a rate. A transport failure leaves the last valid rate available.
      if (cause instanceof ApiError && cause.kind === "protocol") policy.value = null;
      failed.value = true;
    }).finally(() => {
      if (pending === read) pending = null;
    });
    pending = read;
    return read;
  }

  onShow(() => { shown.value = true; });
  onHide(() => { shown.value = false; });
  watch([() => app.accountKey, () => app.accountBindingEpoch], () => {
    policy.value = null;
    failed.value = false;
    pending = null;
    void refresh();
  });
  watch(active, ready => { if (ready) void refresh(); });
  useAutoRecovery({
    active: () => active.value,
    failed: () => failed.value,
    retry: refresh,
    repeatMs: 30_000,
    repeatWhile: () => !hasVisiblePullRefresh(),
  });

  return { policy, failed, refresh };
}
