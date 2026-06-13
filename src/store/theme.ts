import { defineStore } from "pinia";
import { ref } from "vue";

// Theme store — light / dark mode toggle. Ported from
// Nexion-prototype/lib/store/theme.ts (zustand persist → Pinia + uni storage).
//
// Nexion is a dark-default design system. The H5 root (<html data-theme>) is
// driven from here; App.vue applies the persisted mode on launch. Toggling on
// the /me page calls setMode(), which re-applies data-theme on H5.

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "nexion-theme-v1";

function hydrate(): ThemeMode {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { mode?: ThemeMode } | "";
    if (s && (s.mode === "light" || s.mode === "dark")) return s.mode;
  } catch {
    // first run
  }
  return "dark";
}

// Apply the theme attribute on H5 (no-op on App, where theming is at packaging).
function applyTheme(mode: ThemeMode) {
  // #ifdef H5
  try {
    document.documentElement.setAttribute("data-theme", mode);
  } catch {
    // document unavailable
  }
  // #endif
}

export const useTheme = defineStore("theme", () => {
  const mode = ref<ThemeMode>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { mode: mode.value });
    } catch {
      // storage unavailable
    }
  }

  function setMode(next: ThemeMode) {
    mode.value = next;
    applyTheme(next);
    persist();
  }

  function toggle() {
    setMode(mode.value === "light" ? "dark" : "light");
  }

  return { mode, setMode, toggle };
});
