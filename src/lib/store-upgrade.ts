const HARDWARE = ["phone", "stellarbox-s1", "stellarbox-pro", "stellarbox-pro-v2", "stellarrack-p1", "stellarrack-p2"];
interface OwnedDevice { kind: string; name: string; activatedAt: number | null; baseRate: number; baseRateNEX: number }
interface OfferedProduct { id: string; name: string; dailyEarn: number; dailyEarnNEX: number }
export function highestOwnedHardware(devices: readonly OwnedDevice[]): OwnedDevice | null {
  return devices.filter((d) => d.activatedAt !== null && HARDWARE.includes(d.kind))
    .reduce<OwnedDevice | null>((best, d) => !best || HARDWARE.indexOf(d.kind) > HARDWARE.indexOf(best.kind) ? d : best, null);
}
export function storeUpgrade<T extends OfferedProduct>(products: readonly T[], devices: readonly OwnedDevice[]) {
  const base = highestOwnedHardware(devices);
  if (!base || !Number.isFinite(base.baseRate) || base.baseRate <= 0 || !Number.isFinite(base.baseRateNEX)) return null;
  const target = HARDWARE.slice(HARDWARE.indexOf(base.kind) + 1)
    .map((id) => products.find((p) => p.id === id)).find((p) => p && Number.isFinite(p.dailyEarn)
      && p.dailyEarn > base.baseRate && Number.isFinite(p.dailyEarnNEX) && p.dailyEarnNEX >= 0);
  if (!target) return null;
  return { base, target, multiplier: Math.floor(target.dailyEarn / base.baseRate * 10) / 10 };
}
export type StoreUpgrade = NonNullable<ReturnType<typeof storeUpgrade>>;
