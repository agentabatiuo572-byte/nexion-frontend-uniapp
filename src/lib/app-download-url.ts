export type AppDownloadPlatform = "auto" | "ios" | "android";

/**
 * The website owns package URLs and browser/device guidance.
 * Published officialUrl values must be fragment-free HTTPS website URLs;
 * the existing configuration API rejects fragments. Hash removal below is
 * defensive normalization for direct callers, not a wider API contract.
 */
export function appDownloadUrl(officialUrl: string | undefined, platform: AppDownloadPlatform = "auto"): string {
  const raw = officialUrl?.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    url.pathname = "/download/";
    url.hash = "";
    url.searchParams.set("platform", platform);
    url.searchParams.set("source", "button");
    return url.href;
  } catch {
    return "";
  }
}
