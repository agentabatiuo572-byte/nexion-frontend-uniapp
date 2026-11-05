import { safeReturnTo } from "@/routing/safe-return-to";
import { canonicalH5RouteUrl } from "@/lib/static-review-routes";

const FALLBACK = "/pages/onboarding/intro";
const CALLERS = [FALLBACK, "/pages/register/register", "/pages/ref/code", "/pages/index/index"] as const;
type PrivacyCaller = typeof CALLERS[number];

/** Keep public entry targets and the home fallback for pages removed from Lite. */
export function resolvePrivacyReturn(raw: string | null | undefined): string {
  const candidate = canonicalH5RouteUrl(safeReturnTo(raw, FALLBACK));
  return CALLERS.some(caller => caller === candidate.split("?")[0]) ? candidate : FALLBACK;
}

/** Preserve link attribution through a privacy-page refresh without claiming or registering. */
export function privacyPolicyHref(caller: PrivacyCaller, attribution?: string): string {
  const key = caller === "/pages/register/register" ? "ref" : caller === "/pages/ref/code" ? "code" : null;
  const target = caller + (key && attribution ? `?${key}=${encodeURIComponent(attribution)}` : "");
  return `/pages/onboarding/privacy?return=${encodeURIComponent(target)}`;
}
