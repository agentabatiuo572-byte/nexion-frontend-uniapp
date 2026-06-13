import { defineStore } from "pinia";
import { ref } from "vue";

// Ported from Nexion-prototype/lib/store/auth.ts (zustand → Pinia).
// Gates main-app access: new sign-ups must finish onboarding
// (intro → estimator → connect) before onboardingComplete flips true.
const STORAGE_KEY = "nexion-auth-v1";

interface Persisted {
  isAuthenticated: boolean;
  email: string;
  onboardingComplete: boolean;
}

function hydrate(): Persisted {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Persisted | "";
    if (s && typeof s === "object") {
      return {
        isAuthenticated: !!s.isAuthenticated,
        email: s.email || "",
        // v1 persisted users predate the onboarding gate — treat as onboarded.
        onboardingComplete: s.onboardingComplete === undefined ? true : !!s.onboardingComplete,
      };
    }
  } catch {
    // first run
  }
  return { isAuthenticated: false, email: "", onboardingComplete: false };
}

export const useAuth = defineStore("auth", () => {
  const init = hydrate();
  const isAuthenticated = ref(init.isAuthenticated);
  const email = ref(init.email);
  const onboardingComplete = ref(init.onboardingComplete);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        isAuthenticated: isAuthenticated.value,
        email: email.value,
        onboardingComplete: onboardingComplete.value,
      });
    } catch {
      // storage unavailable
    }
  }

  // Returning users have already onboarded — don't re-run onboarding for them.
  function signIn(e: string) {
    isAuthenticated.value = true;
    email.value = e;
    onboardingComplete.value = true;
    persist();
  }
  // New sign-ups must complete onboarding before the main app unlocks.
  function signUp(e: string) {
    isAuthenticated.value = true;
    email.value = e;
    onboardingComplete.value = false;
    persist();
  }
  // Final onboarding step (connect "Activate phone compute") calls this.
  function completeOnboarding() {
    onboardingComplete.value = true;
    persist();
  }
  function signOut() {
    isAuthenticated.value = false;
    email.value = "";
    onboardingComplete.value = false;
    persist();
  }

  return { isAuthenticated, email, onboardingComplete, signIn, signUp, completeOnboarding, signOut };
});
