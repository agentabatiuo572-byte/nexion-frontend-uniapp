import { useLocaleStore } from "@/store/locale";

/**
 * Tiny string interpolator for i18n keys with placeholders.
 *
 *   fmt(t.staking.sheet.cta, { amount: "500.00", n: 90 })
 *     → "Lock $500.00 for 90d"
 *
 * Unknown placeholders are left as-is (e.g. "{foo}") so they surface in dev.
 */

export function fmt(
  s: string,
  params: Record<string, string | number>,
): string {
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : `{${k}}`,
  );
}

/**
 * BCP-47 tag for Date#toLocale{Date,Time}String / toLocaleString — must follow
 * the language the UI actually renders, never the device locale (`undefined`
 * showed "Member since 2026年7月" on an English page under a zh browser).
 * Real dictionaries exist for en/vi/zh; every other pick falls back to English
 * copy in use-t, so dates fall back to en-US with it. Reads the locale store,
 * so calls inside a computed re-run on language switch.
 */
const DATE_LOCALE_TAGS: Record<string, string> = { en: "en-US", vi: "vi-VN", zh: "zh-CN" };

export function dateLocale(): string {
  return DATE_LOCALE_TAGS[useLocaleStore().code] ?? "en-US";
}
