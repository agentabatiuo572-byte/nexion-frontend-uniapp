export function requireCryptoUuid(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid !== "string" || !uuid.trim()) throw new Error("CRYPTO_RANDOM_UUID_UNAVAILABLE");
  return uuid;
}
