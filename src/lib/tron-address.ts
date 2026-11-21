import { sha256 } from 'js-sha256';

/** TRON mainnet Base58Check; preserve the address's case. */
export function isTronAddressValid(address: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const char of address) value = value * 58n + BigInt(alphabet.indexOf(char));
  const bytes = new Uint8Array(25);
  for (let i = bytes.length - 1; i >= 0; i--) { bytes[i] = Number(value & 255n); value >>= 8n; }
  if (value !== 0n || bytes[0] !== 0x41) return false;
  const checksum = sha256.array(sha256.array(bytes.slice(0, 21)));
  return bytes.slice(21).every((byte, i) => byte === checksum[i]);
}
