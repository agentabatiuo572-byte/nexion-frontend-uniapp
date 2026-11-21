import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { DEFAULT_LOCALE, LOCALES, type LocaleCode } from "@/i18n";
import { useConfig } from "@/store/config";

const STORAGE_KEY = "nexgrid-locale-v1";

function restoreExplicitChoice(): LocaleCode | null {
  try {
    const saved: unknown = uni.getStorageSync(STORAGE_KEY);
    if (!saved || typeof saved !== "object") return null;
    const row = saved as Record<string, unknown>;
    // Legacy automatic/server values are not deliberate device preferences.
    const choice = "explicitChoice" in row ? row.explicitChoice : row.userSet === true ? row.code : null;
    return LOCALES.find((locale) => locale.code === choice)?.code ?? null;
  } catch {
    return null;
  }
}

export const useLocaleStore = defineStore("locale", () => {
  const platformConfig = useConfig();
  const explicitChoice = ref<LocaleCode | null>(restoreExplicitChoice());
  const accountLanguage = ref<LocaleCode | null>(null);
  const accountKey = ref("default");
  const systemLanguages = ref<LocaleCode[]>([]);
  const userSet = computed(() => explicitChoice.value !== null);
  // Automatic resolution never increments this or persists the effective language.
  const explicitRevision = ref(0);
  const code = computed<LocaleCode>(() => {
    for (const candidate of [explicitChoice.value, accountLanguage.value, ...systemLanguages.value]) {
      if (candidate && platformConfig.offeredLocales.some((entry) => entry.code === candidate)) return candidate;
    }
    return DEFAULT_LOCALE;
  });

  function setLocale(next: LocaleCode) {
    if (!platformConfig.offeredLocales.some((entry) => entry.code === next)) return;
    explicitChoice.value = next;
    try {
      uni.setStorageSync(STORAGE_KEY, { explicitChoice: next });
    } catch {
      // The deliberate selection remains usable for this process without storage.
    }
    explicitRevision.value += 1;
  }

  function setAccountScope(next: string) {
    if (accountKey.value === next) return;
    accountKey.value = next;
    accountLanguage.value = null;
  }

  function applyAccountLocale(next: LocaleCode, owner: string) {
    if (owner === accountKey.value) accountLanguage.value = next;
  }

  function ensureSystemDetected() {
    const languages = typeof navigator === "undefined" ? [] : [...navigator.languages, navigator.language];
    const detected: LocaleCode[] = [];
    for (const language of languages) {
      const base = language.trim().toLowerCase().split(/[-_]/)[0];
      const normalized = base === "in" ? "id" : base === "tl" ? "fil" : base;
      const candidate = LOCALES.find((locale) => locale.code === normalized)?.code;
      if (candidate) detected.push(candidate);
    }
    systemLanguages.value = detected;
  }

  ensureSystemDetected();
  // #ifdef H5
  const root = typeof document === "undefined" ? undefined : document.documentElement;
  if (root) watch(code, (value) => {
    root.lang = value;
    // Inter's Vietnamese subset otherwise loads only once Vietnamese letters are laid out, so the first screen briefly
    // mixes in the system font (BUG-551). Only a Vietnamese interface requests it early.
    if (value === "vi") void document.fonts?.load('400 16px "Inter"', "ệ").catch(() => undefined);
  }, { immediate: true, flush: "sync" });
  if (typeof window !== "undefined") window.addEventListener("languagechange", ensureSystemDetected);
  // #endif
  return { code, explicitChoice, accountLanguage, systemLanguages, userSet, explicitRevision,
    setLocale, setAccountScope, applyAccountLocale, ensureSystemDetected };
});
