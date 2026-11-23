import { sha256 } from "js-sha256";
import { iosPhoneRecoveryKey } from "@/lib/ios-phone-recovery-key";
import { nativePhonePlatform, type NativePhonePlatform } from "@/lib/native-phone-runtime";

export interface PhoneRecoveryCredential {
  platform: NativePhonePlatform;
  key: string;
}

export function phoneRecoveryCredential(origin: string, accountKey: string): PhoneRecoveryCredential | null {
  // #ifdef APP-PLUS
  const platform = nativePhonePlatform();
  if (platform === "ios") {
    const key = iosPhoneRecoveryKey(origin, accountKey);
    return key ? { platform, key } : null;
  }
  if (platform === "android") {
    try {
      const { android } = plus;
      const version = android.importClass("android.os.Build$VERSION") as PlusAndroidClassObject & { SDK_INT?: number };
      if ((version?.SDK_INT ?? 0) < 26) return null;
      const activity = android.runtimeMainActivity();
      if (!activity) return null;
      const resolver = android.invoke(activity, "getContentResolver");
      // Native.js accepts variadic Java arguments; the ambient types declare only one.
      const id = (android.invoke as (target: string, method: string, ...args: unknown[]) => unknown)(
        "android.provider.Settings$Secure", "getString", resolver, "android_id");
      if (typeof id !== "string" || !/^[a-f0-9]{1,16}$/i.test(id) || /^0+$/.test(id)) return null;
      return { platform, key: sha256(JSON.stringify(["android-phone-binding-recovery-v1", origin.replace(/\/+$/, ""), accountKey,
        id.toLowerCase().padStart(16, "0")])) };
    } catch {
      return null;
    }
  }
  // #endif
  return null;
}
