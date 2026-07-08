import type { GpuTier } from "./config-types";
import type { Device, DeviceKind } from "./types";
import { pickRandomTask } from "@/mock/tasks";
import { getCachedCapability, fallbackCapability } from "@/lib/device-capability";
import { getDeviceId } from "@/lib/device-id";
import { gpuTierDailyNex, gpuTierDailyRate, gpuTierVram, matchGpuTier } from "@/lib/gpu-tiers";

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
  phone: { name: "Your phone", gpu: "Mobile NPU · ~28.3 TOPS", vramTotal: 8, basePower: 0, baseRate: 0.06, baseRateNEX: 10 },
  "pc-gpu": { name: "电脑 GPU", gpu: "电脑 GPU · 共享", vramTotal: 12, basePower: 320, baseRate: 0.34, baseRateNEX: 56.7, hashRate: 620, location: "已连接电脑" },
  "stellarbox-s1": { name: "NexionBox S1", gpu: "4× RTX 4090", vramTotal: 96, basePower: 1200, baseRate: 7, baseRateNEX: 40, hashRate: 1240, location: "新加坡数据中心" },
  "stellarbox-pro": { name: "NexionBox Pro", gpu: "8× RTX 4090", vramTotal: 192, basePower: 2400, baseRate: 13, baseRateNEX: 80, hashRate: 2480, location: "新加坡数据中心" },
  "stellarbox-pro-v2": { name: "NexionBox Pro v2", gpu: "8× RTX 5090", vramTotal: 256, basePower: 2200, baseRate: 14, baseRateNEX: 90, hashRate: 5120, location: "新加坡数据中心" },
  "stellarrack-p1": { name: "NexionRack P1", gpu: "8× NVIDIA A100", vramTotal: 640, basePower: 3200, baseRate: 45, baseRateNEX: 300, hashRate: 3840, location: "法兰克福数据中心" },
  "stellarrack-p2": { name: "NexionRack P2", gpu: "8× NVIDIA H100", vramTotal: 1024, basePower: 4000, baseRate: 75, baseRateNEX: 500, hashRate: 9600, location: "法兰克福数据中心" },
  "cloud-share": { name: "云算力份额", gpu: "分布式", vramTotal: 0, basePower: 0, baseRate: 0.19, baseRateNEX: 3 },
};

// Device retail price (USDT) — used by salvage calc. MOCK-ONLY (prod: GET /api/store/catalog).
export const DEVICE_PRICE_USDT: Record<DeviceKind, number> = {
  phone: 0,
  "pc-gpu": 0,
  "stellarbox-s1": 649,
  "stellarbox-pro": 1199,
  "stellarbox-pro-v2": 1319,
  "stellarrack-p1": 4499,
  "stellarrack-p2": 7499,
  "cloud-share": 19.9,
};

export interface CreateDeviceOptions {
  gpuModel?: string;
  gpuTier?: GpuTier;
  gpuTiers?: GpuTier[];
}

// ───── Default device factory ─────
export function createDevice(kind: DeviceKind, id: string, options: CreateDeviceOptions = {}): Device {
  const pcGpuModel = options.gpuModel?.trim() || "NVIDIA GeForce RTX 4070";
  const pcGpuTier = kind === "pc-gpu"
    ? options.gpuTier ?? matchGpuTier(pcGpuModel, options.gpuTiers)
    : null;
  const baseSpec = DEVICE_SPECS[kind];
  const spec = pcGpuTier
    ? {
        ...baseSpec,
        name: "共享电脑",
        gpu: `${pcGpuModel} · ${pcGpuTier.tops} TOPS`,
        vramTotal: gpuTierVram(pcGpuTier),
        basePower: Math.round(pcGpuTier.tops * 1.25),
        baseRate: gpuTierDailyRate(pcGpuTier),
        baseRateNEX: gpuTierDailyNex(pcGpuTier),
        hashRate: Math.round(pcGpuTier.tops * 5.6),
        location: "已连接电脑",
      }
    : baseSpec;
  const isPhone = kind === "phone";
  const isCloud = kind === "cloud-share";
  // Phone yield + displayed NPU spec come from this device's calibrated
  // capability baseline (deterministic per login device). Uncalibrated demo
  // phone → fallbackCapability() = legacy Tier-3 / 28.3 TOPS / $0.06.
  const cap = isPhone ? (getCachedCapability(getDeviceId()) ?? fallbackCapability()) : null;
  return {
    id,
    kind,
    name: spec.name,
    ...(pcGpuTier && { gpuTier: pcGpuTier.id, gpuModel: pcGpuModel }),
    gpu: cap ? `Mobile NPU · ~${cap.tops} TOPS` : spec.gpu,
    vramTotal: spec.vramTotal,
    basePower: spec.basePower,
    baseRate: cap ? cap.baseRateUsdt : spec.baseRate,
    baseRateNEX: cap ? cap.baseRateNex : spec.baseRateNEX,
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
      capabilityScore: cap?.score,
      capabilityTops: cap?.tops,
      capabilityTier: cap?.tier,
      // Fresh page load = a fresh continuous mining run → continuity ramps up.
      miningSince: Date.now(),
    }),
  };
}

// Initial fleet (demo): purchased hardware/cloud devices are pre-activated so
// the hashpower slots render an active fleet. pc-gpu is intentionally not seeded:
// with compute-share default OFF it would be hidden yet still reserve a slot, and
// after enabling the flag it would bypass the download/connection flow.
export function makeInitialDevices(): Device[] {
  const now = Date.now();
  const phone = createDevice("phone", "phone-1");
  phone.todayEarnings = 0.04; // v3.2: phone tier shows tiny seed earnings
  phone.todayEarningsNEX = 6.2;
  // Phone is the onboarding device — purchased on signup (30d ago = user.joinedAt).
  phone.purchasedAt = now - 30 * ONE_DAY_MS;
  phone.activatedAt = phone.purchasedAt; // onboarding-seeded phone enters active fleet

  return [phone];
}

// Re-export specs so derivePromoUpgrade (below) + future pages can read base rates.
export { DEVICE_SPECS };

/**
 * Promo upgrade target — drives "117× phone" / "3× S1" style copy across Home
 * upsell banners. Rule: pick the next tier above the user's HIGHEST-yield
 * active device (recommend the obvious next upgrade, not a tier they own).
 *
 *   baseActive (highest)   target          example multiplier
 *   phone (only)           stellarbox-s1   $7.00 / $0.06 ≈ 117×
 *   stellarbox-s1          stellarbox-pro  $13.00 / $7.00 ≈ 2×
 *   stellarbox-pro         stellarrack-p1  $45.00 / $13.00 ≈ 3×
 *   stellarrack-p1 (top)   —               multiplier=0 → "anchor pricing"
 *   (none active)          stellarbox-s1   fallback (multiplier=0)
 *
 * Ported from Nexion-prototype/lib/store/index.ts derivePromoUpgrade.
 */
const UPGRADE_LADDER: DeviceKind[] = ["phone", "stellarbox-s1", "stellarbox-pro", "stellarbox-pro-v2", "stellarrack-p1", "stellarrack-p2"];

export const PURCHASED_HARDWARE_KINDS: DeviceKind[] = [
  "stellarbox-s1",
  "stellarbox-pro",
  "stellarbox-pro-v2",
  "stellarrack-p1",
  "stellarrack-p2",
];

export function isPurchasedHardwareKind(kind: DeviceKind): boolean {
  return PURCHASED_HARDWARE_KINDS.includes(kind);
}

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
