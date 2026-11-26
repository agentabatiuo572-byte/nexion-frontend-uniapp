import { remoteApiEnabled } from "@/api/runtime";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useAutoRecovery } from "./use-auto-recovery";

export function useTrialAuthorityRead(visible: () => boolean, options: {
  eligibilityFallback?: boolean;
  pullManagedByPage?: boolean;
} = {}) {
  const trial = useFreeTrial(), sheet = useTrialClaimSheet();
  const active = () => visible() && !sheet.open;
  const failed = () => remoteApiEnabled && trial.lastReadFailed && !trial.authorityResultUnknown;
  const fallback = options.eligibilityFallback ? active : undefined;
  const recovery = useAutoRecovery({
    active, failed,
    retry: () => trial.recoverVisible(fallback),
    pullManagedByPage: options.pullManagedByPage,
    repeatMs: 30_000,
    repeatWhile: () => !hasVisiblePullRefresh(),
  });
  function refresh(): Promise<boolean> {
    if (!active()) return Promise.resolve(false);
    return failed() ? recovery.retry() : trial.refreshVisible(fallback ?? false);
  }
  return { failed, refresh };
}
