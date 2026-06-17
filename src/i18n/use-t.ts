import { computed } from "vue";
import { en, type Messages } from "./messages/en";
import { zh } from "./messages/zh";
import type { LocaleCode } from "./index";
import { useLocaleStore } from "@/store/locale";

// Ported from Nexion-prototype/lib/i18n/use-t.ts (zustand → Pinia).
// Only locales with real dictionaries are listed; everything else falls back
// to English (the source-of-truth).
const DICTS: Partial<Record<LocaleCode, Messages>> = {
  en,
  zh,
};

// Reactive translation tree for the active locale.
//   Template:  const t = useT()  →  {{ t.tabs.home }}   (Vue unwraps the ref)
//   Script:    t.value.tabs.home
export function useT() {
  const locale = useLocaleStore();
  return computed<Messages>(() => DICTS[locale.code] ?? en);
}

// Non-reactive accessor for store actions / callbacks (pinia must be active).
export function getT(): Messages {
  const locale = useLocaleStore();
  return DICTS[locale.code] ?? en;
}

// True when the active locale has a real translation (for "in progress" badges).
export function useHasTranslation() {
  const locale = useLocaleStore();
  return computed<boolean>(() => locale.code in DICTS);
}
