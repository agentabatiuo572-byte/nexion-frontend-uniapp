export type LocaleCode =
  | "en"
  | "vi"
  | "zh"
  | "ja"
  | "ko"
  | "ru"
  | "es"
  | "pt"
  | "ar"
  | "de"
  | "fr"
  | "kk"
  | "uz"
  | "id"
  | "ms"
  | "fil";

export interface LocaleEntry {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  region: string;
  priority: 0 | 1 | 2 | 3;
  isRTL: boolean;
  flag: string;
}

export const LOCALES: LocaleEntry[] = [
  { code: "zh", nativeName: "中文", englishName: "Chinese", region: "China", priority: 0, isRTL: false, flag: "🇨🇳" },
  { code: "en", nativeName: "English",   englishName: "English",              region: "Global",              priority: 0, isRTL: false, flag: "🌐" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese",           region: "Vietnam",             priority: 0, isRTL: false, flag: "🇻🇳" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", region: "Indonesia", priority: 0, isRTL: false, flag: "🇮🇩" },
  { code: "ms", nativeName: "Bahasa Melayu", englishName: "Malay", region: "Malaysia", priority: 0, isRTL: false, flag: "🇲🇾" },
  { code: "fil", nativeName: "Filipino", englishName: "Filipino", region: "Philippines", priority: 0, isRTL: false, flag: "🇵🇭" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", region: "Russia & Central Asia", priority: 0, isRTL: false, flag: "🇷🇺" },
  { code: "kk", nativeName: "Қазақ тілі", englishName: "Kazakh", region: "Kazakhstan", priority: 0, isRTL: false, flag: "🇰🇿" },
  { code: "uz", nativeName: "Oʻzbekcha", englishName: "Uzbek", region: "Uzbekistan", priority: 0, isRTL: false, flag: "🇺🇿" },
];

/** Interface languages with a bundled dictionary. Frontend-owned copy keeps one slot per language. */
export type UiLocale = "zh" | "en" | "vi" | "id" | "ms" | "fil" | "ru" | "kk" | "uz";
const UI_LOCALES: readonly string[] = ["zh", "en", "vi", "id", "ms", "fil", "ru", "kk", "uz"] satisfies readonly UiLocale[];

/** Copy slot for a locale code; a code without a dictionary reads English. */
export function uiLocale(code: string): UiLocale {
  return UI_LOCALES.includes(code) ? code as UiLocale : "en";
}

/** The server accepts and publishes only zh, en and vi. Other interface languages are stored on
 *  the device and use English for every language sent to the server and every server-owned text. */
export type ServerLanguage = "zh" | "en" | "vi";

export function serverLanguage(code: string): ServerLanguage {
  return code === "zh" || code === "vi" ? code : "en";
}

export const DEFAULT_LOCALE: LocaleCode = "zh";

export function getLocale(code: LocaleCode): LocaleEntry {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

export function localesByPriority(): Record<0 | 1 | 2 | 3, LocaleEntry[]> {
  return LOCALES.reduce(
    (acc, l) => {
      acc[l.priority].push(l);
      return acc;
    },
    { 0: [], 1: [], 2: [], 3: [] } as Record<0 | 1 | 2 | 3, LocaleEntry[]>
  );
}

export const PRIORITY_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "Recommended",
  1: "Major markets",
  2: "Growing regions",
  3: "Europe",
};
