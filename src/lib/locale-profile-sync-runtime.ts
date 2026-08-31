import { profileApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useApp } from "@/store/app";
import { useLocaleStore } from "@/store/locale";
import { ref } from "vue";
import { canHydrateProfileLocale } from "./locale-profile-hydration";
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

export const profileLocaleSyncState = ref<"idle" | "syncing" | "failed">("idle");
let pendingAnonymousSelection: string | null = null;
let hydrationFailed = false;

const sync = createLocaleProfileSync({
  currentScope,
  write: (language) => profileApi.updateLanguage(language),
  onState: (state) => { profileLocaleSyncState.value = state; },
});

/** The server subject is derived by the bearer transport; account ids are never sent. */
export function syncExplicitProfileLocale(language: string): void {
  if (!currentScope()) {
    pendingAnonymousSelection = language;
    hydrationFailed = false;
    profileLocaleSyncState.value = "idle";
    return;
  }
  pendingAnonymousSelection = null;
  hydrationFailed = false;
  sync.request(language);
}

/**
 * A completed sign-in reads the account-owned language before changing the UI.
 * An explicit picker action made during that read wins and is queued instead.
 */
export function hydrateCurrentProfileLocale(): void {
  const scope = currentScope();
  if (!scope) {
    profileLocaleSyncState.value = "idle";
    return;
  }
  // A previous account's failed retry is never shown to the new account and
  // cannot be revived by a later explicit retry.
  sync.discardInactive();
  hydrationFailed = false;
  profileLocaleSyncState.value = "idle";
  const locale = useLocaleStore();
  const explicitRevision = locale.explicitRevision;
  const chosenBeforeSignIn = pendingAnonymousSelection;
  pendingAnonymousSelection = null;
  if (chosenBeforeSignIn) {
    sync.request(chosenBeforeSignIn);
    return;
  }
  void profileApi.profile().then((profile) => {
    if (!canHydrateProfileLocale(scope, currentScope(), explicitRevision, locale.explicitRevision)) return;
    locale.applyServerLocale(profile.language);
    hydrationFailed = false;
  }).catch(() => {
    if (currentScope()?.accountId === scope.accountId && currentScope()?.revision === scope.revision) {
      hydrationFailed = true;
      profileLocaleSyncState.value = "failed";
    }
  });
}

export function retryCurrentProfileLocale(): void {
  if (hydrationFailed) {
    hydrateCurrentProfileLocale();
    return;
  }
  const locale = useLocaleStore();
  syncExplicitProfileLocale(locale.code);
}
