import { computed, onScopeDispose, watch } from "vue";
import { sessionVault } from "@/api/runtime";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { appReadForeground, documentReadVisible } from "@/lib/foreground-read";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import type { MeEntry } from "@/store/me-entry-seen";

export function useMeEntryRead(pageVisible: () => boolean) {
  const app = useApp();
  const auth = useAuth();
  const sessionReady = () => binarySessionReady({
    remote: true,
    authenticated: auth.isAuthenticated,
    accountId: auth.accountId,
    appAccountKey: app.accountKey,
    sessionUserId: sessionVault.read()?.user.userId ?? null,
  });
  const ready = computed(sessionReady);
  const visible = computed(() => pageVisible() && appReadForeground.value && documentReadVisible.value);
  const requests = new Map<MeEntry, object>();
  watch([visible, ready, () => app.accountBindingEpoch], () => requests.clear(), { flush: "sync" });
  onScopeDispose(() => requests.clear());

  function capture(entry: MeEntry) {
    const scope = remoteAccountScope.snapshot();
    const token = {};
    requests.set(entry, token);
    const wasVisible = visible.value && sessionReady() && scope.accountKey === app.accountKey;
    const current = () => wasVisible && visible.value && requests.get(entry) === token
      && scope.accountKey === app.accountKey && sessionReady() && remoteAccountScope.isCurrent(scope);
    return { scope, current };
  }

  return { ready, visible, capture };
}
