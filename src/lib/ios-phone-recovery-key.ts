import { sha256 } from "js-sha256";
import { requireCryptoUuid } from "@/lib/secure-command-id";
// #ifdef APP-PLUS
import { readIOSSessionKeychain, supportsIOSSessionKeychain, writeIOSSessionKeychain } from "@/uni_modules/uvel-native-push";
// #endif

export function iosPhoneRecoveryKey(origin: string, accountKey: string): string | null {
  // #ifdef APP-PLUS
  try {
    const scopeHash = sha256(JSON.stringify(["ios-phone-binding-recovery", origin, accountKey]));
    // The TEST host already supports opaque, device-only Keychain scopes.
    const scope = supportsIOSSessionKeychain() ? scopeHash : "phone-recovery:" + scopeHash;
    const stored = readIOSSessionKeychain(scope);
    if (stored === null) return null;
    if (stored !== "") return /^[a-f0-9]{64}$/.test(stored) ? stored : null;
    const key = (requireCryptoUuid() + requireCryptoUuid()).replace(/-/g, "").toLowerCase();
    return writeIOSSessionKeychain(scope, key) ? key : null;
  } catch {
    // Older hosts and an unavailable Keychain keep the existing binding flow.
    return null;
  }
  // #endif
  // #ifndef APP-PLUS
  return null;
  // #endif
}
