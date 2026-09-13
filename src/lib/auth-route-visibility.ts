import { isStaticReviewRoute, normalizeRoute } from "@/lib/static-review-routes";

const PUBLIC_ROUTES = new Set([
  "pages/onboarding/intro",
  "pages/onboarding/terms",
  "pages/onboarding/privacy",
  "pages/register/register",
  "pages/login/login",
  "pages/ref/code",
  "pages/tx/hash",
  "pages/session/kicked",
]);

/** Only routes that can safely render without an authenticated account. */
export function isPublicAuthRoute(route?: string | null): boolean {
  const normalized = normalizeRoute(route);
  return isStaticReviewRoute(normalized)
    || PUBLIC_ROUTES.has(normalized);
}
