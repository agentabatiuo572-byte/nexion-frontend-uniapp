import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export interface NexMarketSnapshot {
  currentPrice: number;
  costBasis: number;
  sparkline: number[];
  history24h: Array<{ price: number; sampledAt: string }>;
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "NEX_MARKET_RESPONSE_INVALID" });
}

function row(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positive(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sampledAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

export function parseNexMarketSnapshot(value: unknown): NexMarketSnapshot {
  const data = row(value);
  const currentPrice = positive(data?.currentPrice);
  const costBasis = positive(data?.costBasis);
  if (!data || data.asset !== "NEX" || data.currency !== "USDT"
      || data.serverCanonical !== true
      || data.source !== "G3 weekly_curve + nx_price_index 24h history"
      || currentPrice === null || costBasis === null
      || !Array.isArray(data.sparkline) || !Array.isArray(data.history24h)) {
    return invalid();
  }
  const sparkline = data.sparkline.map(positive);
  if (sparkline.some((point) => point === null) || sparkline.length !== 7) return invalid();
  const history24h = data.history24h.map((item) => {
    const point = row(item);
    const price = positive(point?.price);
    const at = sampledAt(point?.sampledAt);
    if (!point || price === null || !at) return invalid();
    return { price, sampledAt: at };
  });
  return {
    currentPrice,
    costBasis,
    sparkline: sparkline as number[],
    history24h,
  };
}

export function createMarketApi(client: ApiClient) {
  return {
    fetch: async () => parseNexMarketSnapshot(await client.request({
      method: "GET",
      path: "/api/config/market/nex",
      authenticated: false,
    })),
  };
}
