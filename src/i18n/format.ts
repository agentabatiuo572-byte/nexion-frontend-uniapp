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
