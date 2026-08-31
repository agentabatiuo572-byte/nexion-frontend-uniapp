import { defineStore } from "pinia";
import { ref } from "vue";
import { notificationPreferencesApi, remoteApiEnabled } from "@/api/runtime";
import { createRemoteAccountEpoch, type RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { accountErrorMessageKey, type AccountErrorMessageKey } from "@/lib/account-error-message";

/**
 * User preferences. Ported from Nexion-prototype/lib/store/preferences.ts
 * (zustand persist → Pinia + uni storage). Lightweight toggles persisted
 * across sessions: sound, haptics, and per-kind notification mute flags.
 *
 * NotifKind mirrors lib/v3/notifications NotifKind (kept local to avoid a
 * store→store import; backend-replaceable shape).
 */

export type NotifKind = "commission" | "team" | "staking" | "market" | "genesis" | "system";

const ALL_NOTIF_KINDS: NotifKind[] = ["commission", "team", "staking", "market", "genesis", "system"];

type NotifPrefs = Record<NotifKind, boolean>;

const STORAGE_KEY = "nexgrid-preferences-v1";

function defaultNotifPrefs(): NotifPrefs {
  return ALL_NOTIF_KINDS.reduce((acc, k) => {
    acc[k] = true;
    return acc;
  }, {} as NotifPrefs);
}

interface PrefsData {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  notifPrefs: NotifPrefs;
}

function hydrate(): PrefsData {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<PrefsData> | "";
    if (s && typeof s === "object") {
      const np = s.notifPrefs && typeof s.notifPrefs === "object" ? s.notifPrefs : {};
      const merged = defaultNotifPrefs();
      for (const k of ALL_NOTIF_KINDS) {
        if (typeof (np as Record<string, unknown>)[k] === "boolean") {
          merged[k] = (np as NotifPrefs)[k];
        }
      }
      return {
        soundEnabled: typeof s.soundEnabled === "boolean" ? s.soundEnabled : false,
        hapticsEnabled: typeof s.hapticsEnabled === "boolean" ? s.hapticsEnabled : true,
        notifPrefs: merged,
      };
    }
  } catch {
    // first run
  }
  return { soundEnabled: false, hapticsEnabled: true, notifPrefs: defaultNotifPrefs() };
}

export const usePreferences = defineStore("preferences", () => {
  const init = hydrate();
  const soundEnabled = ref<boolean>(init.soundEnabled);
  const hapticsEnabled = ref<boolean>(init.hapticsEnabled);
  const notifPrefs = ref<NotifPrefs>(init.notifPrefs);
  const loading = ref(false);
  const error = ref<AccountErrorMessageKey | null>(null);
  const remoteAccountEpoch = createRemoteAccountEpoch("default");
  let generation = 0;

  function isCurrent(request: RemoteAccountRequest, expectedGeneration: number): boolean {
    return generation === expectedGeneration && remoteAccountEpoch.isCurrent(request);
  }

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        soundEnabled: soundEnabled.value,
        hapticsEnabled: hapticsEnabled.value,
        ...(remoteApiEnabled ? {} : { notifPrefs: notifPrefs.value }),
      });
    } catch {
      // storage unavailable
    }
  }

  function toggleSound() {
    soundEnabled.value = !soundEnabled.value;
    persist();
  }

  function toggleHaptics() {
    hapticsEnabled.value = !hapticsEnabled.value;
    persist();
  }

  async function toggleNotifKind(k: NotifKind) {
    const mutationGeneration = ++generation;
    const request = remoteAccountEpoch.snapshot();
    const previous = notifPrefs.value[k];
    notifPrefs.value = { ...notifPrefs.value, [k]: !notifPrefs.value[k] };
    if (remoteApiEnabled) {
      // A mutation supersedes any in-flight read for this account. Do not leave
      // the settings screen in a perpetual read-loading state when that old
      // response is intentionally discarded by the generation guard.
      loading.value = false;
      try {
        const canonical = await notificationPreferencesApi.patch({ [k]: notifPrefs.value[k] });
        if (!isCurrent(request, mutationGeneration)) return;
        notifPrefs.value = canonical;
        error.value = null;
      } catch (cause) {
        if (!isCurrent(request, mutationGeneration)) return;
        notifPrefs.value = { ...notifPrefs.value, [k]: previous };
        error.value = accountErrorMessageKey(cause instanceof Error ? cause : "NOTIFICATION_PREFERENCES_UPDATE_FAILED");
      }
      return;
    }
    persist();
  }

  async function refreshRemote(request: RemoteAccountRequest = remoteAccountEpoch.snapshot()) {
    const expectedGeneration = generation;
    if (!remoteApiEnabled || !isCurrent(request, expectedGeneration)) return;
    loading.value = true;
    error.value = null;
    try {
      const canonical = await notificationPreferencesApi.get();
      if (!isCurrent(request, expectedGeneration)) return;
      notifPrefs.value = canonical;
    } catch (cause) {
      if (isCurrent(request, expectedGeneration)) {
        error.value = accountErrorMessageKey(cause);
      }
    } finally {
      if (isCurrent(request, expectedGeneration)) loading.value = false;
    }
  }

  function bindAccount(accountKey: string) {
    generation += 1;
    remoteAccountEpoch.bind(accountKey);
    if (remoteApiEnabled) {
      notifPrefs.value = defaultNotifPrefs();
      loading.value = false;
      error.value = null;
      void refreshRemote();
      return;
    }
    const local = hydrate();
    soundEnabled.value = local.soundEnabled;
    hapticsEnabled.value = local.hapticsEnabled;
    notifPrefs.value = local.notifPrefs;
  }

  return { soundEnabled, hapticsEnabled, notifPrefs, loading, error, toggleSound, toggleHaptics, toggleNotifKind, bindAccount, refreshRemote };
});
