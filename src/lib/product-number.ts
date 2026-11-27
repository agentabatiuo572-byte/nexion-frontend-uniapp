export function parseProductNo(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{1,96}$/.test(value) ? value : undefined;
}
