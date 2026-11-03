import type { RegistrationReceipt } from "@/api/contracts";
import { sessionVault } from "@/api/runtime";

let staged: { identity: string | null; revision: number; receipt: RegistrationReceipt } | null = null;

export function stageRemoteRegistrationReceipt(
  receipt: RegistrationReceipt | null | undefined,
  identity: string | null = null,
): void {
  staged = receipt ? { identity, revision: sessionVault.revision(), receipt } : null;
}

export function consumeRemoteRegistrationReceipt(expectedIdentity?: string | null): RegistrationReceipt | null {
  const candidate = staged;
  if (!candidate) return null;
  if (candidate.identity === null) {
    staged = null;
    return candidate.receipt;
  }
  // Terms confirmation can remount the success page within the original registration session.
  const session = sessionVault.read();
  if (candidate.identity !== expectedIdentity || !session || candidate.identity !== `user:${session.user.userId}`
      || (candidate.revision !== sessionVault.revision() && !sessionVault.isRefreshContinuation(candidate.revision))) {
    staged = null;
    return null;
  }
  return candidate.receipt;
}

export function clearRemoteRegistrationReceipt(): void {
  staged = null;
}
