import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { DEFAULT_LOCALE, LOCALES, serverLanguage, type LocaleCode } from "@/i18n";
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
  const systemLanguage = ref<LocaleCode | null>(null);
  const userSet = computed(() => explicitChoice.value !== null);
  // Automatic resolution never increments this or persists the effective language.
  const explicitRevision = ref(0);
  const code = computed<LocaleCode>(() => {
    const offered = platformConfig.offeredLocales;
    const explicit = explicitChoice.value;
    if (explicit && offered.some((entry) => entry.code === explicit)) return explicit;
    const system = systemLanguage.value;
    const availableSystem = system && offered.some((entry) => entry.code === system) ? system : null;
    const account = accountLanguage.value;
    if (account && offered.some((entry) => entry.code === account)) {
      return availableSystem && serverLanguage(availableSystem) === account ? availableSystem : account;
    }
    return availableSystem ?? DEFAULT_LOCALE;
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
    systemLanguage.value = null;
    for (const language of languages) {
      const base = language.trim().toLowerCase().split(/[-_]/)[0];
      const normalized = base === "in" ? "id" : base === "tl" ? "fil" : base;
      const candidate = LOCALES.find((locale) => locale.code === normalized)?.code;
      if (candidate) {
        systemLanguage.value = candidate;
        break;
      }
    }
  }

  ensureSystemDetected();
  // #ifdef H5
  const root = typeof document === "undefined" ? undefined : document.documentElement;
  if (root) watch(code, (value) => { root.lang = value; }, { immediate: true, flush: "sync" });
  if (typeof window !== "undefined") window.addEventListener("languagechange", ensureSystemDetected);
  // #endif
  return { code, explicitChoice, accountLanguage, systemLanguage, userSet, explicitRevision,
    setLocale, setAccountScope, applyAccountLocale, ensureSystemDetected };
});
