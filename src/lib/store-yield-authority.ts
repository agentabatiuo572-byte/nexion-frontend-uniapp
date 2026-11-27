import type { EarnPhoneTier } from "@/api/earn-config-api";
import type { Product, ProductSeriesCode } from "@/mock/products";
import { formatEstimate, formatEstimateRange } from "./estimate-display";
import { productDailyEstimateRange, productDailyUvtRange } from "./product-estimates";

export interface YieldAmount {
  usd: number;
  nex: number;
  /** Catalog daily ranges (null when the catalog sends none); the phone tier carries one figure and no range keys. */
  usdRange?: { low: number; high: number } | null;
  nexRange?: { low: number; high: number } | null;
}

export interface StoreYieldLadderRow {
  id: "phone" | "entry" | "pro" | "proV2" | "rack" | "rackP2";
  amount: YieldAmount | null;
  widthPct: number;
}

export interface StoreYieldAuthority {
  phone: YieldAmount | null;
  entry: YieldAmount | null;
  pro: YieldAmount | null;
  rack: YieldAmount | null;
  multiplier: number | null;
  complete: boolean;
  ladder: StoreYieldLadderRow[];
}

export interface StoreYieldCatalogProof {
  source: string;
  sourceEnvironment: string;
  runId: string;
  serverCanonical: boolean;
}

const LADDER_SERIES = {
  entry: "S1",
  pro: "PRO",
  proV2: "PRO_V2",
  rack: "RACK_P1",
  rackP2: "RACK_P2",
} as const;

function productAmount(products: readonly Product[], seriesCode: ProductSeriesCode): YieldAmount | null {
  const candidates = products.filter((product) => product.seriesCode === seriesCode && product.seriesRepresentative
    && Number.isFinite(product.dailyEarn) && product.dailyEarn >= 0
    && Number.isFinite(product.dailyEarnNEX) && product.dailyEarnNEX >= 0);
  if (candidates.length !== 1) return null;
  const [product] = candidates;
  return { usd: product.dailyEarn, nex: product.dailyEarnNEX,
    usdRange: productDailyEstimateRange(product), nexRange: productDailyUvtRange(product) };
}

export function buildStoreYieldAuthority(
  products: readonly Product[],
  phoneTiers: readonly EarnPhoneTier[],
  proof: StoreYieldCatalogProof,
): StoreYieldAuthority {
  const canonicalProducts = proof.source === "nx_product" && proof.sourceEnvironment === "PRODUCTION"
    && proof.runId === "" && proof.serverCanonical ? products : [];
  const typicalPhone = phoneTiers.find((row) => row.tier === 3);
  const phone = typicalPhone ? { usd: typicalPhone.baseRateUsdt, nex: typicalPhone.baseRateNex } : null;
  const entry = productAmount(canonicalProducts, LADDER_SERIES.entry);
  const pro = productAmount(canonicalProducts, LADDER_SERIES.pro);
  const proV2 = productAmount(canonicalProducts, LADDER_SERIES.proV2);
  const rack = productAmount(canonicalProducts, LADDER_SERIES.rack);
  const rackP2 = productAmount(canonicalProducts, LADDER_SERIES.rackP2);
  const complete = [phone, entry, pro, rack].every((amount) => amount !== null);
  const multiplier = phone && entry && phone.usd > 0 ? Math.round(entry.usd / phone.usd) : null;
  const rows: Array<[StoreYieldLadderRow["id"], YieldAmount | null]> = [
    ["phone", phone], ["entry", entry], ["pro", pro], ["proV2", proV2], ["rack", rack], ["rackP2", rackP2],
  ];
  const maximum = Math.max(0, ...rows.map(([, amount]) => amount?.usd ?? 0));
  return {
    phone, entry, pro, rack, multiplier, complete,
    ladder: rows.map(([id, amount]) => ({
      id,
      amount,
      widthPct: amount && amount.usd > 0 && maximum > 0 ? Math.max(1, Math.round((amount.usd / maximum) * 100)) : 0,
    })),
  };
}

// Per-device daily estimates use the shared estimate format (estimate-display.ts): the catalog range when sent,
// two significant figures, never K/M.
export function storefrontUsd(amount: YieldAmount | null): string {
  if (!amount) return "—";
  return `$${amount.usdRange ? formatEstimateRange(amount.usdRange.low, amount.usdRange.high) : formatEstimate(amount.usd)}`;
}

export function storefrontNex(amount: YieldAmount | null): string {
  if (!amount) return "—";
  return amount.nexRange ? formatEstimateRange(amount.nexRange.low, amount.nexRange.high) : formatEstimate(amount.nex);
}

// The store's phone-vs-S1 card quotes a multiple, so it shows single estimates (same format, no range).
export function storefrontUsdPoint(amount: YieldAmount | null): string {
  return amount ? `$${formatEstimate(amount.usd)}` : "—";
}

export function storefrontNexPoint(amount: YieldAmount | null): string {
  return amount ? formatEstimate(amount.nex) : "—";
}

export function storefrontNexFull(amount: YieldAmount | null): string {
  return amount ? `${storefrontNexPoint(amount)}\u00A0UVT` : "— UVT";
}
