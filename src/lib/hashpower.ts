/**
 * Live effective hashpower derivation — single source for the phone card's
 * real-time "算力" number and curve.
 *
 *   effectiveTops = baselineTops × charge × network × thermal × continuity × jitter
 *
 * INVARIANT: every factor ∈ (0, 1], so the live value can never exceed the
 * device's own calibrated baseline ceiling. Combined with device-capability's
 * monotonic, globally-ordered baselines, this guarantees the displayed number
 * is always plausible (a budget phone's peak stays below a flagship's typical).
 *
 * The factors are all things the user can see and act on (charge the phone,
 * stay online, keep it cool, stay connected on ONE device) — so the number
 * feels measured and earned, not arbitrary. ContinuityFactor rewards keeping
 * the app on one device and is reset on new-device recalibration (the positive,
 * non-punitive arm of single-device login).
 *
 * Pure & deterministic given inputs (jitter is a smooth function of nowSeed, not
 * Math.random) so the curve is stable across re-renders.
 */
import type { ThermalState } from "@/store/types";

/** Continuous-online time at which the stability bonus reaches full (2h). */
export const CONTINUITY_FULL_MS = 2 * 60 * 60 * 1000;
const CONTINUITY_FLOOR = 0.85; // fresh session / just-switched device starts here

export type HashFactorKey = "offline" | "battery" | "thermal" | "continuity" | "peak";

export interface HashFactors {
  charge: number;
  network: number;
  thermal: number;
  continuity: number;
  jitter: number;
}

export interface LiveHashpower {
  /** Live effective TOPS (≤ baselineTops). */
  effectiveTops: number;
  /** Current output as a % of the device's own ceiling (≤ 100). */
  effectivePct: number;
  factors: HashFactors;
  /** Which factor currently dominates the reading — drives the positive label. */
  dominant: HashFactorKey;
}

export function thermalFactor(state: ThermalState | undefined): number {
  switch (state) {
    case "fair":
      return 0.92;
    case "serious":
      return 0.8;
    case "critical":
      return 0.6;
    default:
      return 1; // nominal / undefined
  }
}

/** Continuity ramps CONTINUITY_FLOOR → 1.0 over CONTINUITY_FULL_MS. */
export function continuityFactor(continuityMs: number): number {
  const p = Math.max(0, Math.min(1, continuityMs / CONTINUITY_FULL_MS));
  return +(CONTINUITY_FLOOR + (1 - CONTINUITY_FLOOR) * p).toFixed(4);
}

/** Smooth ≤1 jitter from two out-of-phase sines → an "alive" curve that only
 *  ever dips below the ceiling (range ≈ [0.955, 1.0]). */
function smoothJitter(nowSeed: number): number {
  const a = 0.5 + 0.5 * Math.sin(nowSeed / 2100);
  const b = 0.5 + 0.5 * Math.sin(nowSeed / 900 + 1.3);
  return +(1 - 0.03 * a - 0.015 * b).toFixed(4);
}

export interface LiveHashInput {
  baselineTops: number;
  isCharging: boolean;
  isOnline: boolean;
  thermalState?: ThermalState;
  /** ms the phone has been continuously mining (since miningSince); 0 if idle. */
  continuityMs: number;
  /** time seed for jitter (epoch ms). */
  nowSeed: number;
}

export function computeLiveHashpower(input: LiveHashInput): LiveHashpower {
  const charge = input.isCharging ? 1 : 0.6;
  const network = input.isOnline ? 1 : 0;
  const thermal = thermalFactor(input.thermalState);
  const continuity = continuityFactor(input.continuityMs);
  const jitter = smoothJitter(input.nowSeed);

  const factors: HashFactors = { charge, network, thermal, continuity, jitter };
  const effectiveTops = +(input.baselineTops * charge * network * thermal * continuity * jitter).toFixed(1);
  const effectivePct = input.baselineTops > 0 ? Math.round((effectiveTops / input.baselineTops) * 100) : 0;

  let dominant: HashFactorKey;
  if (network === 0) dominant = "offline";
  else if (charge < 1) dominant = "battery";
  else if (thermal < 1) dominant = "thermal";
  else if (continuity < 0.999) dominant = "continuity";
  else dominant = "peak";

  return { effectiveTops, effectivePct, factors, dominant };
}
