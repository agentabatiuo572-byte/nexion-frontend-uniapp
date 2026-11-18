import type { RiskDisclosureChapter, RiskDisclosureCurrent } from "@/api/risk-disclosure-api";

export type RiskDisclosureDisplayLanguage = "zh" | "vi" | "en";

/**
 * Server disclosures always publish Chinese and Vietnamese. Other interfaces
 * can read the current publication only when its scope includes English.
 */
export function resolveRiskDisclosureDisplayLanguage(
  localeCode: string,
  languageScope: RiskDisclosureCurrent["languageScope"],
): RiskDisclosureDisplayLanguage | null {
  if (localeCode === "zh" || localeCode === "vi") return localeCode;
  return languageScope.split("+").includes("en") ? "en" : null;
}

export function riskDisclosureChapterCopy(
  chapter: Pick<RiskDisclosureChapter, "zh" | "vi" | "en" | "zhBody" | "viBody" | "enBody">,
  language: RiskDisclosureDisplayLanguage,
): { title: string; body: string } {
  if (language === "vi") return { title: chapter.vi, body: chapter.viBody };
  if (language === "en") return { title: chapter.en, body: chapter.enBody };
  return { title: chapter.zh, body: chapter.zhBody };
}
