export function requireCryptoUuid(): string {
  const crypto = globalThis.crypto;
  const uuid = crypto?.randomUUID?.();
  if (typeof uuid === "string" && uuid.trim()) return uuid;
  if (crypto?.getRandomValues) {
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6]! & 0x0f) | 0x40;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch { /* Native WebViews can expose a nonfunctional crypto stub. */ }
  }
  throw new Error("CRYPTO_RANDOM_UUID_UNAVAILABLE");
}
