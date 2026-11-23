export interface EstimateRange {
  low: number;
  high: number;
}

function endpoint(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseEstimateRange(rawLow: unknown, rawHigh: unknown): EstimateRange | null {
  const low = endpoint(rawLow), high = endpoint(rawHigh);
  return low !== null && high !== null && low <= high ? { low, high } : null;
}
