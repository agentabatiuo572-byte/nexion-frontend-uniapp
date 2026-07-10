import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

// Ported from Nexion-prototype/lib/store/profile.ts (zustand → Pinia).
// 旧设备级单键 "nexion-profile-v1" 废弃(存量无账号归属,mock 可重建);资料按账号分行。
const ACCOUNTS_KEY = "nexion-profile-accounts-v1"; // { [accountKey]: Persisted }

interface Persisted {
  displayName: string;
  bio: string;
  region: string;
  timezone: string;
  avatarSeed: string;
}

function defaultSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function hydrate(accountKey: string): Persisted {
  const row = readAccountRow<Persisted>(ACCOUNTS_KEY, accountKey);
  if (row && row.displayName) return row;
  return {
    displayName: "Alex T.",
    bio: "Running an AI-friendly node from my phone. Always up for swapping notes on yield strategies.",
    region: "Singapore",
    timezone: "Asia/Singapore (UTC+8)",
    avatarSeed: "alex-seed",
  };
}

export const useProfile = defineStore("profile", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const displayName = ref(init.displayName);
  const bio = ref(init.bio);
  const region = ref(init.region);
  const timezone = ref(init.timezone);
  const avatarSeed = ref(init.avatarSeed);

  function persist() {
    writeAccountRow<Persisted>(ACCOUNTS_KEY, boundKey, {
      displayName: displayName.value,
      bio: bio.value,
      region: region.value,
      timezone: timezone.value,
      avatarSeed: avatarSeed.value,
    });
  }

  /** 账号切换重绑:装载该账号的资料(P2-8 设备级泄漏修复)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    displayName.value = next.displayName;
    bio.value = next.bio;
    region.value = next.region;
    timezone.value = next.timezone;
    avatarSeed.value = next.avatarSeed;
  }

  function setDisplayName(v: string) { displayName.value = v; persist(); }
  function setBio(v: string) { bio.value = v; persist(); }
  function setRegion(v: string) { region.value = v; persist(); }
  function setTimezone(v: string) { timezone.value = v; persist(); }
  function regenerateAvatar() { avatarSeed.value = defaultSeed(); persist(); }

  return { displayName, bio, region, timezone, avatarSeed, setDisplayName, setBio, setRegion, setTimezone, regenerateAvatar, bindAccount };
});
