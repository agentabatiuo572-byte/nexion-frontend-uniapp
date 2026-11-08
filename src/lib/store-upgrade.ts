import type { Device, DeviceKind } from "@/store/types";
import { getLifecycleSummary } from "@/store/device-lifecycle";

const HARDWARE: readonly DeviceKind[] = ["stellarbox-s1", "stellarbox-pro", "stellarbox-pro-v2", "stellarrack-p1", "stellarrack-p2"];
/** `kind` stays the stable DeviceKind (never a stored display string) so callers
 *  can resolve the localized name at render time — see lib/device-copy.ts. */
type OwnedDevice = Device;
interface OfferedProduct { id: string; name: string; dailyEarn: number; dailyEarnNEX: number }
export function activePhoneDailyRate(devices: readonly OwnedDevice[]): number {
  const phone = devices.find((device) => device.kind === "phone" && device.activatedAt !== null);
  return phone && Number.isFinite(phone.baseRate) && phone.baseRate > 0 ? phone.baseRate : 0;
}
export function storeYieldMultiplier(targetDaily: number, baseDaily: number): number {
  return Number.isFinite(targetDaily) && Number.isFinite(baseDaily) && baseDaily > 0
    ? Math.floor(targetDaily / baseDaily * 10) / 10 : 0;
}
export function highestOwnedHardware(devices: readonly OwnedDevice[]): OwnedDevice | null {
  return devices.filter((d) => d.activatedAt !== null && HARDWARE.includes(d.kind))
    .reduce<OwnedDevice | null>((best, d) => !best || HARDWARE.indexOf(d.kind) > HARDWARE.indexOf(best.kind) ? d : best, null);
}
export function storeUpgrade<T extends OfferedProduct>(products: readonly T[], devices: readonly OwnedDevice[]) {
  const base = highestOwnedHardware(devices);
  if (!base) return null;
  const baseDaily = getLifecycleSummary(base).dailyRateNow;
  if (baseDaily <= 0) return null;
  const target = HARDWARE.slice(HARDWARE.indexOf(base.kind) + 1)
    .map((id) => products.find((p) => p.id === id)).find((p) => p && Number.isFinite(p.dailyEarn)
      && p.dailyEarn > baseDaily && Number.isFinite(p.dailyEarnNEX) && p.dailyEarnNEX >= 0);
  if (!target) return null;
  return { base, target, multiplier: storeYieldMultiplier(target.dailyEarn, baseDaily) };
}
export type StoreUpgrade = NonNullable<ReturnType<typeof storeUpgrade>>;
