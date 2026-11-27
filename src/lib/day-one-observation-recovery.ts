import { reactive } from "vue";
import { createAuthenticatedPageObservationReporter, type AuthenticatedPageObservation } from "./authenticated-page-observation";
import type { RemoteAccountRequest } from "./remote-account-epoch";

export interface DayOneObservationIdentity {
  scope: RemoteAccountRequest;
  questCode: string;
  instanceKey: string;
}
export interface DayOneObservationRequest extends DayOneObservationIdentity,
  Omit<AuthenticatedPageObservation<{ recorded: boolean }>, "subject" | "accepted" | "rejected"> {
  currentInstance(): string | undefined;
  onRecorded?(): void;
}
export function createDayOneObservationRecovery(reporter = createAuthenticatedPageObservationReporter()) {
  const failures = reactive(new Set<string>());
  const key = (identity: DayOneObservationIdentity) =>
    JSON.stringify([identity.scope.accountKey, identity.scope.epoch, identity.instanceKey, identity.questCode]);
  const subject = (identity: DayOneObservationIdentity) => `day-one:${identity.questCode}:${identity.instanceKey}`;
  function hasNotice(identity: DayOneObservationIdentity): boolean {
    return failures.has(key(identity));
  }
  async function report(input: DayOneObservationRequest): Promise<void> {
    const current = () => input.isCurrent(input.scope) && input.currentInstance() === input.instanceKey;
    if (!input.instanceKey || !current()) return;
    // Prune prior account/instance notices, without touching transport keys.
    for (const existing of failures.keys()) {
      const [account, epoch, instance] = JSON.parse(existing);
      if (account !== input.scope.accountKey || epoch !== input.scope.epoch || instance !== input.instanceKey) failures.delete(existing);
    }
    await reporter.report({
      ...input, subject: subject(input),
      isCurrent: () => current(),
      accepted(result) {
        if (current() && result.recorded) {
          failures.delete(key(input));
          input.onRecorded?.();
        }
        return result.recorded;
      },
      rejected() { if (current()) failures.add(key(input)); },
    });
  }
  function retry(identity: DayOneObservationIdentity): void {
    // Only an explicit current-task action reopens a failed transport slot.
    reporter.retryFailed(identity.scope, subject(identity));
  }
  return { report, hasNotice, retry };
}
export const dayOneObservationRecovery = createDayOneObservationRecovery();
