const STATIC_REVIEW_PREFIXES = [
  "pages/entry-surfaces/",
];

export function isStaticReviewRoute(route?: string | null): boolean {
  if (!route) return false;
  const normalized = route.replace(/^\/?#?\/?/, "");
  return STATIC_REVIEW_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
