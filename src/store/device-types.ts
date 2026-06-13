import type { Device, DeviceKind } from "./types";
import { pickRandomTask } from "@/mock/tasks";

// Ported from Nexion-prototype/lib/store/index.ts (device specs + factory).
export const ONE_DAY_MS = 86400000;
export const MAX_DEVICES = 6;

// ───── Device specs (design doc §7.1 base rates) ─────
const DEVICE_SPECS: Record<
  DeviceKind,
  Pick<Device, "gpu" | "vramTotal" | "basePower" | "baseRate" | "baseRateNEX" | "name"> & {
    hashRate?: number;
    location?: string;
  }
> = {
  phone: { name: "Your phone", gpu: "Mobile NPU · ~28 TOPS", vramTotal: 8, basePower: 0, baseRate: 0.06, baseRateNEX: 10 },
  "stellarbox-s1": { name: "NexionBox S1", gpu: "4× RTX 4090", vramTotal: 96, basePower: 1200, baseRate: 38.5, baseRateNEX: 65, hashRate: 1240, location: "Singapore Data Center" },
  "stellarbox-pro": { name: "NexionBox Pro", gpu: "8× RTX 4090", vramTotal: 192, basePower: 2400, baseRate: 76.0, baseRateNEX: 215, hashRate: 2480, location: "Singapore Data Center" },
  "stellarrack-p1": { name: "NexionRack P1", gpu: "8× NVIDIA A100", vramTotal: 640, basePower: 3200, baseRate: 142.6, baseRateNEX: 950, hashRate: 3840, location: "Frankfurt Data Center" },
  "cloud-share": { name: "Cloud Share", gpu: "Distributed", vramTotal: 0, basePower: 0, baseRate: 0.073, baseRateNEX: 30 },
};

// Device retail price (USDT) — used by salvage calc. MOCK-ONLY (prod: GET /api/store/catalog).
export const DEVICE_PRICE_USDT: Record<DeviceKind, number> = {
  phone: 0,
  "stellarbox-s1": 1299,
  "stellarbox-pro": 2399,
  "stellarrack-p1": 8999,
  "cloud-share": 199,
};

// ───── Default device factory ─────
export function createDevice(kind: DeviceKind, id: string): Device {
  const spec = DEVICE_SPECS[kind];
  const isPhone = kind === "phone";
  const isCloud = kind === "cloud-share";
  return {
    id,
    kind,
    name: spec.name,
    gpu: spec.gpu,
    vramTotal: spec.vramTotal,
    basePower: spec.basePower,
    baseRate: spec.baseRate,
    baseRateNEX: spec.baseRateNEX,
    purchasedAt: Date.now(),
    // New devices land in inventory inactive (activatedAt=null); opt-in via /me/devices.
    activatedAt: null,
    generation: 1,
    status: "online",
    gpuUsage: isCloud ? 0 : isPhone ? 78 : 82, // phone re-interprets gpuUsage as npuUtilization%
    gpuTemp: isCloud || isPhone ? 0 : 68,
    gpuPower: isCloud || isPhone ? 0 : spec.basePower * 0.95,
    vramUsed: isCloud ? 0 : Math.round(spec.vramTotal * 0.78 * 10) / 10,
    currentTask: isCloud ? null : isPhone ? null : pickRandomTask(spec.vramTotal),
    recentTasks: [],
    todayEarnings: 0,
    todayEarningsNEX: 0,
    hashRate: spec.hashRate,
    location: spec.location,
    dayCount: 47,
    ...(isPhone && {
      batteryLevel: 78,
      isCharging: true,
      isWifiConnected: true,
      thermalState: "nominal" as const,
    }),
  };
}

// Initial fleet: phone seeded by onboarding, active with tiny seed earnings.
export function makeInitialDevices(): Device[] {
  const devices: Device[] = [createDevice("phone", "phone-1")];
  devices[0].todayEarnings = 0.04; // v3.2: phone tier shows tiny seed earnings
  devices[0].todayEarningsNEX = 6.2;
  // Phone is the onboarding device — purchased on signup (30d ago = user.joinedAt).
  devices[0].purchasedAt = Date.now() - 30 * ONE_DAY_MS;
  devices[0].activatedAt = devices[0].purchasedAt; // onboarding-seeded phone enters active fleet
  return devices;
}

// Re-export specs so derivePromoUpgrade (below) + future pages can read base rates.
export { DEVICE_SPECS };

/**
 * Promo upgrade target — drives "642× phone" / "3× S1" style copy across Home
 * upsell banners. Rule: pick the next tier above the user's HIGHEST-yield
 * active device (recommend the obvious next upgrade, not a tier they own).
 *
 *   baseActive (highest)   target          example multiplier
 *   phone (only)           stellarbox-s1   $38.50 / $0.06 ≈ 642×
 *   stellarbox-s1          stellarbox-pro  $76.00 / $38.50 ≈ 2×
 *   stellarbox-pro         stellarrack-p1  $142.60 / $76.00 ≈ 2×
 *   stellarrack-p1 (top)   —               multiplier=0 → "anchor pricing"
 *   (none active)          stellarbox-s1   fallback (multiplier=0)
 *
 * Ported from Nexion-prototype/lib/store/index.ts derivePromoUpgrade.
 */
const UPGRADE_LADDER: DeviceKind[] = ["phone", "stellarbox-s1", "stellarbox-pro", "stellarrack-p1"];

/** The user's phone device (kind === "phone"), or undefined if deactivated/removed.
 *  Ported from Nexion-prototype/lib/store/index.ts selectPhoneDevice (zustand
 *  selector → plain fn over the devices array). */
export const selectPhoneDevice = (devices: Device[]): Device | undefined =>
  devices.find((d) => d.kind === "phone");

export function derivePromoUpgrade(devices: Device[]): {
  baseKind: DeviceKind | null;
  baseName: string;
  baseDaily: number;
  targetKind: DeviceKind;
  targetName: string;
  targetDaily: number;
  multiplier: number;
  targetPayback: number;
} {
  const actives = devices.filter((d) => d.activatedAt !== null);
  if (actives.length === 0) {
    const fallback = DEVICE_SPECS["stellarbox-s1"];
    return {
      baseKind: null,
      baseName: "(no active device)",
      baseDaily: 0,
      targetKind: "stellarbox-s1",
      targetName: fallback.name,
      targetDaily: fallback.baseRate,
      multiplier: 0,
      targetPayback: Math.round(DEVICE_PRICE_USDT["stellarbox-s1"] / fallback.baseRate),
    };
  }
  // BASE = highest-yield active device.
  const base = actives.reduce((m, d) => (d.baseRate > m.baseRate ? d : m), actives[0]);
  const idx = UPGRADE_LADDER.indexOf(base.kind);
  const atTop = idx === UPGRADE_LADDER.length - 1;
  const targetKind: DeviceKind = atTop
    ? base.kind
    : idx >= 0
      ? UPGRADE_LADDER[idx + 1]
      : "stellarbox-s1"; // off-ladder (cloud-share) → promote to entry box S1
  const targetSpec = DEVICE_SPECS[targetKind];
  const multiplier = atTop ? 0 : Math.round(targetSpec.baseRate / base.baseRate);
  return {
    baseKind: base.kind,
    baseName: base.name,
    baseDaily: base.baseRate,
    targetKind,
    targetName: targetSpec.name,
    targetDaily: targetSpec.baseRate,
    multiplier,
    targetPayback: targetSpec.baseRate > 0 ? Math.round(DEVICE_PRICE_USDT[targetKind] / targetSpec.baseRate) : 0,
  };
}
