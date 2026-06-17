import { defineStore } from "pinia";
import { ref } from "vue";

// Risk disclosure acceptance. Ported from
// Nexion-prototype/lib/store/risk-disclosure.ts (zustand persist → Pinia + uni storage).
//
// Tracks whether the user has read & accepted the platform risk disclosure.
// Required before first withdrawal / first staking lock. Once accepted, no
// re-prompt (persisted across sessions).

const STORAGE_KEY = "nexion-risk-disclosure-v1";

function hydrate(): { accepted: boolean; acceptedAt: number | null } {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { accepted?: boolean; acceptedAt?: number | null } | "";
    if (s && typeof s === "object" && typeof s.accepted === "boolean") {
      return { accepted: s.accepted, acceptedAt: s.acceptedAt ?? null };
    }
  } catch {
    // first run
  }
  return { accepted: false, acceptedAt: null };
}

export const useRiskDisclosure = defineStore("riskDisclosure", () => {
  const init = hydrate();
  const accepted = ref(init.accepted);
  const acceptedAt = ref<number | null>(init.acceptedAt);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { accepted: accepted.value, acceptedAt: acceptedAt.value });
    } catch {
      // storage unavailable
    }
  }

  function accept() {
    accepted.value = true;
    acceptedAt.value = Date.now();
    persist();
  }

  function reset() {
    accepted.value = false;
    acceptedAt.value = null;
    persist();
  }

  return { accepted, acceptedAt, accept, reset };
});
