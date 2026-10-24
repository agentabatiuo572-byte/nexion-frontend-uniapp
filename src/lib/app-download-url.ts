/** Open the configured official link without changing its destination or parameters. */
export function appDownloadUrl(officialUrl: string | undefined): string {
  const raw = officialUrl?.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return raw;
  } catch {
    return "";
  }
}
