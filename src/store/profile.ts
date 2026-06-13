import { defineStore } from "pinia";
import { ref } from "vue";

// Ported from Nexion-prototype/lib/store/profile.ts (zustand → Pinia).
const STORAGE_KEY = "nexion-profile-v1";

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

function hydrate(): Persisted {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Persisted | "";
    if (s && typeof s === "object" && s.displayName) return s;
  } catch {
    // first run
  }
  return {
    displayName: "Alex T.",
    bio: "Running an AI-friendly node from my phone. Always up for swapping notes on yield strategies.",
    region: "Singapore",
    timezone: "Asia/Singapore (UTC+8)",
    avatarSeed: "alex-seed",
  };
}

export const useProfile = defineStore("profile", () => {
  const init = hydrate();
  const displayName = ref(init.displayName);
  const bio = ref(init.bio);
  const region = ref(init.region);
  const timezone = ref(init.timezone);
  const avatarSeed = ref(init.avatarSeed);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        displayName: displayName.value,
        bio: bio.value,
        region: region.value,
        timezone: timezone.value,
        avatarSeed: avatarSeed.value,
      });
    } catch {
      // storage unavailable
    }
  }

  function setDisplayName(v: string) { displayName.value = v; persist(); }
  function setBio(v: string) { bio.value = v; persist(); }
  function setRegion(v: string) { region.value = v; persist(); }
  function setTimezone(v: string) { timezone.value = v; persist(); }
  function regenerateAvatar() { avatarSeed.value = defaultSeed(); persist(); }

  return { displayName, bio, region, timezone, avatarSeed, setDisplayName, setBio, setRegion, setTimezone, regenerateAvatar };
});
