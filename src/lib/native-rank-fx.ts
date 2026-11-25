// #ifdef APP-PLUS
import { setRankFxNativeFlags } from "@/composables/use-rank-fx-guard";
import { nativePhonePlatform } from "@/lib/native-phone-runtime";

export function refreshNativeRankFxFlags(): void {
  const platform = nativePhonePlatform();
  if (!platform) return;

  const flags: { powerSave?: boolean; lowRam?: true } = {};
  const keys = platform === "android" ? ["powerSave", "lowRam"] as const : ["powerSave"] as const;
  for (const key of keys) {
    let value: unknown;
    try {
      if (platform === "android") {
        const { android } = plus;
        const activity = android?.runtimeMainActivity();
        if (!activity) continue;
        const power = key === "powerSave";
        const manager = android.invoke(activity, "getSystemService", power ? "power" : "activity");
        if (!manager) continue;
        value = android.invoke(manager, power ? "isPowerSaveMode" : "isLowRamDevice");
      } else {
        const { ios } = plus;
        const processInfo = ios?.invoke("NSProcessInfo", "processInfo");
        if (!processInfo) continue;
        try {
          value = ios.invoke(processInfo, "isLowPowerModeEnabled");
        } finally {
          ios.deleteObject(processInfo);
        }
      }
    } catch {
      // An unavailable native signal must not overwrite state or skip the other signal.
      continue;
    }

    if (key === "powerSave" && typeof value === "boolean") flags.powerSave = value;
    if (key === "lowRam" && value === true) flags.lowRam = true;
  }

  if (flags.powerSave !== undefined || flags.lowRam) setRankFxNativeFlags(flags);
}
// #endif
