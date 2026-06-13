import { defineStore } from "pinia";
import { ref } from "vue";

// Ported from Nexion-prototype/lib/store/security.ts (zustand+persist → Pinia).
// MOCK-ONLY: password hash never lives client-side; 2FA + sessions are local
// mock state. Production reads/writes via /api/me/* (see action JSDocs at the
// source). Persisted to uni storage so toggles/revocations survive a refresh.
const STORAGE_KEY = "nexion-security-v1";

export interface Session {
  id: string;
  device: string; // e.g. "iPhone 15 Pro · Safari"
  location: string; // e.g. "Singapore, SG"
  ip: string; // e.g. "203.116.x.x"
  lastActiveMs: number; // epoch ms
  current: boolean;
}

interface Persisted {
  passwordChangedAt: number;
  twoFactorEnabled: boolean;
  sessions: Session[];
}

function mockSessions(): Session[] {
  const now = Date.now();
  return [
    {
      id: "sess-cur",
      device: "iPhone 15 Pro · Safari",
      location: "Singapore, SG",
      ip: "203.116.42.18",
      lastActiveMs: now,
      current: true,
    },
    {
      id: "sess-mbp",
      device: "MacBook Pro · Chrome",
      location: "Singapore, SG",
      ip: "203.116.42.18",
      lastActiveMs: now - 3 * 3600 * 1000,
      current: false,
    },
    {
      id: "sess-ipad",
      device: "iPad Air · Safari",
      location: "Bangkok, TH",
      ip: "171.96.x.x",
      lastActiveMs: now - 28 * 3600 * 1000,
      current: false,
    },
  ];
}

function hydrate(): Persisted {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Persisted | "";
    if (s && typeof s === "object" && typeof s.twoFactorEnabled === "boolean") {
      return {
        passwordChangedAt: s.passwordChangedAt,
        twoFactorEnabled: s.twoFactorEnabled,
        sessions: Array.isArray(s.sessions) ? s.sessions : mockSessions(),
      };
    }
  } catch {
    // first run
  }
  return {
    passwordChangedAt: Date.now() - 21 * 24 * 3600 * 1000,
    twoFactorEnabled: false,
    sessions: mockSessions(),
  };
}

export const useSecurity = defineStore("security", () => {
  const init = hydrate();
  const passwordChangedAt = ref(init.passwordChangedAt);
  const twoFactorEnabled = ref(init.twoFactorEnabled);
  const sessions = ref<Session[]>(init.sessions);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        passwordChangedAt: passwordChangedAt.value,
        twoFactorEnabled: twoFactorEnabled.value,
        sessions: sessions.value,
      });
    } catch {
      // storage unavailable
    }
  }

  // ⚠️ MOCK-ONLY: production POST /api/me/password { oldPassword, newPassword }
  // — server validates old, hashes new, invalidates other sessions. Client
  // never stores the hash; the param keeps the signature stable for cutover.
  function changePassword(newHash: string) {
    void newHash; // server is sole authority for hash storage
    passwordChangedAt.value = Date.now();
    persist();
  }

  function setTwoFactor(on: boolean) {
    twoFactorEnabled.value = on;
    persist();
  }

  function revokeSession(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id);
    persist();
  }

  function revokeAllOthers() {
    sessions.value = sessions.value.filter((s) => s.current);
    persist();
  }

  return {
    passwordChangedAt,
    twoFactorEnabled,
    sessions,
    changePassword,
    setTwoFactor,
    revokeSession,
    revokeAllOthers,
  };
});
