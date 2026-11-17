import { profileApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import { useLocaleStore } from "@/store/locale";
import type { LocaleCode } from "@/i18n";
import { ref } from "vue";
import { canHydrateProfileLocale, trackProfileLocaleHydration } from "./locale-profile-hydration";
import { createLocaleProfileSync, type LocaleProfileScope } from "./locale-profile-sync";

function currentScope(): LocaleProfileScope | null {
  if (!remoteApiEnabled) return null;
  const session = sessionVault.read();
  if (!session) return null;
  const accountId = `user:${session.user.userId}`;
  const app = useApp();
  if (String(app.accountKey) !== accountId) return null;
  return { accountId, revision: sessionVault.revision() };
}

function isEnabled(language: string): boolean {
  return useConfig().offeredLocales.some((entry) => entry.code === language);
}

export const profileLocaleSyncState = ref<"idle" | "syncing" | "failed">("idle");
let pendingAnonymousSelection: string | null = null;
let hydrationFailed = false;

const sync = createLocaleProfileSync({
  currentScope,
  isEnabled,
  write: (language) => profileApi.updateLanguage(language),
  onSaved: (language, scope) => useLocaleStore().applyAccountLocale(language, scope.accountId),
  onState: (state) => { profileLocaleSyncState.value = state; },
});

function requestProfileLocale(language: string, scope: LocaleProfileScope): void {
  sync.request(language);
  trackProfileLocaleHydration(scope, sync.flush().then(() => {
    const pending = sync.pending();
    if (pending?.scope.accountId === scope.accountId) {
      throw new Error("PROFILE_LANGUAGE_SYNC_FAILED");
    }
  }));
}

/** The server subject is derived by the bearer transport; account ids are never sent. */
export function syncExplicitProfileLocale(language: string): void {
  if (!isEnabled(language)) return;
  const scope = currentScope();
  if (!scope) {
    pendingAnonymousSelection = language;
    hydrationFailed = false;
    profileLocaleSyncState.value = "idle";
    return;
  }
  pendingAnonymousSelection = null;
  hydrationFailed = false;
  requestProfileLocale(language, scope);
}

export function resetProfileLocaleSyncScope(): void {
  sync.discardInactive();
  hydrationFailed = false;
  profileLocaleSyncState.value = "idle";
}

/** Retire only disabled pending writes; a real profile read replaces their failed barrier. */
export function reconcileProfileLocaleAvailability(): void {
  if (sync.discardDisabled()) hydrateCurrentProfileLocale();
}

/** A completed sign-in reads the account language unless it has an eligible choice to save. */
export function hydrateCurrentProfileLocale(initialOAuthLocale?: LocaleCode): void {
  const scope = currentScope();
  if (!scope) {
    profileLocaleSyncState.value = "idle";
    return;
  }
  resetProfileLocaleSyncScope();
  const locale = useLocaleStore();
  const explicitRevision = locale.explicitRevision;
  const languageToSave = initialOAuthLocale ?? pendingAnonymousSelection;
  pendingAnonymousSelection = null;
  if (languageToSave && isEnabled(languageToSave)) {
    requestProfileLocale(languageToSave, scope);
    return;
  }
  // A disabled anonymous preference is still stored locally, but never skips the account GET.
  const hydration = profileApi.profile().then((profile) => {
    if (!canHydrateProfileLocale(scope, currentScope(), explicitRevision, locale.explicitRevision)) return;
    locale.applyAccountLocale(profile.language, scope.accountId);
    hydrationFailed = false;
  }).catch(() => {
    if (canHydrateProfileLocale(scope, currentScope(), explicitRevision, locale.explicitRevision)) {
      hydrationFailed = true;
      profileLocaleSyncState.value = "failed";
      throw new Error("PROFILE_LANGUAGE_LOAD_FAILED");
    }
  });
  trackProfileLocaleHydration(scope, hydration);
}

export function retryCurrentProfileLocale(): void {
  sync.discardInactive();
  const pending = sync.pending();
  if (pending && !isEnabled(pending.language)) {
    sync.discardDisabled();
    hydrateCurrentProfileLocale();
    return;
  }
  if (hydrationFailed) {
    hydrateCurrentProfileLocale();
    return;
  }
  const scope = currentScope();
  if (pending && scope && pending.scope.accountId === scope.accountId) {
    requestProfileLocale(pending.language, scope);
  }
}
