import type { LocaleProfileScope } from "./locale-profile-sync";

function sameScope(left: LocaleProfileScope | null, right: LocaleProfileScope): boolean {
  return left !== null && left.accountId === right.accountId && left.revision === right.revision;
}

/**
 * Accept a server preference only when the same authenticated session still
 * owns the UI and no explicit picker action superseded the read.
 */
export function canHydrateProfileLocale(
  requestScope: LocaleProfileScope,
  currentScope: LocaleProfileScope | null,
  explicitRevisionAtRequest: number,
  currentExplicitRevision: number,
): boolean {
  return sameScope(currentScope, requestScope) && explicitRevisionAtRequest === currentExplicitRevision;
}
