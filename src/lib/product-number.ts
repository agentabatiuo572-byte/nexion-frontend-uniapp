export function parseProductNo(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9-]+$/.test(value) ? value : undefined;
}
