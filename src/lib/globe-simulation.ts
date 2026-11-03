/** Geographic metadata only; totals come from the home figures and the split, latency and drift from H9. */
export const GLOBE_CENTERS = [
  { id: "sg", nameKey: "centerSingapore", lat: 1.35, lon: 103.82 },
  { id: "jp", nameKey: "centerTokyo", lat: 35.68, lon: 139.69 },
  { id: "vn", nameKey: "centerHoChiMinh", lat: 10.82, lon: 106.63 },
  { id: "uk", nameKey: "centerLondon", lat: 51.51, lon: -0.13 },
  { id: "fr", nameKey: "centerParis", lat: 48.86, lon: 2.35 },
  { id: "de", nameKey: "centerFrankfurt", lat: 50.11, lon: 8.68 },
  { id: "us-ny", nameKey: "centerNewYork", lat: 40.71, lon: -74.01 },
  { id: "us-sj", nameKey: "centerSanJose", lat: 37.34, lon: -121.89 },
] as const;
export type GlobeDisplayConfig = {
  intervalMs: number; throughputMin: number; throughputMax: number; latencyJitterMs: number;
  /** Relative share of the totals: `sharePct` (B22) when sent, otherwise the old per-center `nodes`. */
  centers: { id: string; weight: number; latencyMs: number }[];
};

/**
 * One boundary for the optional H9 projection. Invalid input leaves this module unavailable.
 * Two shapes: B22 sends `sharePct` on every center (0–100, summing to 100) and may omit `nodes` and the
 * retired nodeJitterPct / activeJobsMinPct / activeJobsMaxPct; the old shape has no `sharePct` and uses `nodes` as weights.
 */
export function parseGlobeDisplay(value: unknown): GlobeDisplayConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const limits = { intervalMs: [1000, 86400000], throughputMin: [0, 10000], throughputMax: [0, 10000], latencyJitterMs: [0, 60000] };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const number = raw[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < min || number > max) return undefined;
    const [mantissa, exponent = '0'] = String(number).split('e');
    if ((mantissa.split('.')[1]?.length ?? 0) - Number(exponent) > 6) return undefined;
  }
  if (!Number.isInteger(raw.intervalMs) || !Number.isInteger(raw.latencyJitterMs)
      || (raw.throughputMin as number) > (raw.throughputMax as number)
      || !Array.isArray(raw.centers) || raw.centers.length !== GLOBE_CENTERS.length) return undefined;
  const rows: Record<string, unknown>[] = [];
  for (const row of raw.centers) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
    const center = row as Record<string, unknown>;
    if (typeof center.id !== "string" || !GLOBE_CENTERS.some(meta => meta.id === center.id) || rows.some(seen => seen.id === center.id)
        || typeof center.latencyMs !== "number" || !Number.isInteger(center.latencyMs) || center.latencyMs < 0 || center.latencyMs > 60000) return undefined;
    rows.push(center);
  }
  let weights: number[];
  if (rows.every(center => center.sharePct === undefined)) {
    weights = rows.map(center => center.nodes as number);
    if (weights.some(nodes => typeof nodes !== "number" || !Number.isInteger(nodes) || nodes < 0 || nodes > 100000000)
        || weights.every(nodes => nodes === 0)) return undefined;
  } else {
    weights = rows.map(center => center.sharePct as number);
    if (weights.some(share => typeof share !== "number" || !Number.isFinite(share) || share < 0 || share > 100)
        || Math.abs(weights.reduce((sum, share) => sum + share, 0) - 100) > 1e-6) return undefined;
  }
  return {
    intervalMs: raw.intervalMs as number, throughputMin: raw.throughputMin as number,
    throughputMax: raw.throughputMax as number, latencyJitterMs: raw.latencyJitterMs as number,
    centers: rows.map((center, i) => ({ id: center.id as string, weight: weights[i], latencyMs: center.latencyMs as number })),
  };
}
function noise(seed: number, slot: number): number {
  let value = Math.imul((slot | 0) ^ seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
// Interpolate independent random anchors: no rerender randomness or abrupt jumps.
function drift(seed: number, step: number): number {
  const slot = Math.floor(step / 12), fraction = (step % 12) / 12;
  const weight = fraction * fraction * (3 - 2 * fraction);
  return noise(seed, slot) * (1 - weight) + noise(seed, slot + 1) * weight;
}
// Largest-remainder rounding: the integer parts always add up exactly to `total`.
function splitByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const exact = weights.map(weight => total * weight / sum);
  const parts = exact.map(Math.floor);
  const order = exact.map((_, i) => i).sort((a, b) => (exact[b] - parts[b]) - (exact[a] - parts[a]) || a - b);
  for (let k = 0, left = total - parts.reduce((acc, part) => acc + part, 0); k < left; k += 1) parts[order[k]] += 1;
  return parts;
}
/** `onlineTotal` is the home online-devices figure and `jobsTotal` the Earn task centre's job count; null shows placeholders. */
export function globeSimulation(step: number, config: GlobeDisplayConfig | undefined, onlineTotal: number | null, jobsTotal: number | null) {
  if (!config || onlineTotal === null || jobsTotal === null) return null;
  const tick = Number.isFinite(step) ? Math.max(0, Math.floor(step)) : 0;
  const configured = GLOBE_CENTERS.map(center => config.centers.find(row => row.id === center.id)!);
  const weights = configured.map(row => row.weight);
  const online = splitByWeights(onlineTotal, weights), jobs = splitByWeights(jobsTotal, weights);
  const regions = GLOBE_CENTERS.map((center, i) => {
    const seed = (i + 1) * 101;
    const onlineNodes = online[i], activeJobs = jobs[i];
    return { ...center, onlineNodes, activeJobs,
      jobsPerHour: Math.round(activeJobs * (config.throughputMin + (config.throughputMax - config.throughputMin) * drift(seed + 29, tick))),
      avgLatencyMs: Math.round(configured[i].latencyMs + config.latencyJitterMs * drift(seed + 43, tick)),
    };
  });
  return { regions, nodes: onlineTotal, jobs: jobsTotal };
}
