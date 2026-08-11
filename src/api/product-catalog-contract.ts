import type { Product, PurchaseGate } from "@/mock/products";
import type { PhaseId } from "@/store/product-phase";

export interface ProductCatalogSnapshot {
  source: string;
  revision: string | null;
  products: Product[];
}

export class ProductCatalogContractError extends Error {
  constructor() {
    super("PRODUCT_CATALOG_RESPONSE_INVALID");
    this.name = "ProductCatalogContractError";
  }
}

const TIERS = new Set<Product["tier"]>(["Entry", "Pro", "Flagship", "Share"]);
const PHASES = new Set<PhaseId>(["P1", "P2", "P3", "P4", "P5", "P6"]);
const LIFECYCLES = new Set<NonNullable<Product["status"]>>(["active", "legacy"]);
const GATE_MODES = new Set<PurchaseGate["mode"]>(["all", "either"]);
const GATE_PERIODS = new Set<NonNullable<PurchaseGate["quotaPeriod"]>>(["month", "lifetime"]);

function invalid(): never {
  throw new ProductCatalogContractError();
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") return invalid();
  return value;
}

function nonEmptyString(value: unknown): string {
  const normalized = requiredString(value).trim();
  if (!normalized) return invalid();
  return normalized;
}

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") return invalid();
  return value;
}

function finiteNumber(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) return invalid();
  return value;
}

function optionalNumber(value: unknown, minimum = 0): number | undefined {
  if (value === null || value === undefined) return undefined;
  return finiteNumber(value, minimum);
}

function integer(value: unknown, minimum = 0): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < minimum) return invalid();
  return parsed;
}

function optionalInteger(value: unknown, minimum = 0): number | undefined {
  if (value === null || value === undefined) return undefined;
  return integer(value, minimum);
}

function purchaseGate(value: unknown): PurchaseGate | undefined {
  if (value === null || value === undefined) return undefined;
  const gate = record(value);
  if (!GATE_MODES.has(gate.mode as PurchaseGate["mode"]) || typeof gate.enforce !== "boolean") return invalid();
  const quotaPeriod = optionalString(gate.quotaPeriod);
  if (quotaPeriod && !GATE_PERIODS.has(quotaPeriod as NonNullable<PurchaseGate["quotaPeriod"]>)) return invalid();
  return {
    rankMin: optionalInteger(gate.rankMin),
    activeDirectMin: optionalInteger(gate.activeDirectMin),
    teamVolumeMin: optionalNumber(gate.teamVolumeMin),
    mode: gate.mode as PurchaseGate["mode"],
    quotaCap: optionalInteger(gate.quotaCap),
    quotaSold: optionalInteger(gate.quotaSold),
    quotaPeriod: quotaPeriod as PurchaseGate["quotaPeriod"],
    enforce: gate.enforce,
  };
}

function ai(value: unknown): Product["ai"] {
  if (value === null || value === undefined) return undefined;
  const source = record(value);
  return {
    imageGenPerMin: optionalNumber(source.imageGenPerMin),
    llmTokensPerSec: optionalNumber(source.llmTokensPerSec),
    videoMinPerHour: optionalNumber(source.videoMinPerHour),
    fineTuneMins: optionalNumber(source.fineTuneMins),
    unlocks: optionalString(source.unlocks),
  };
}

function phase(value: unknown): PhaseId | undefined {
  const raw = optionalString(value);
  if (!raw) return undefined;
  // nx_admin_device_sku historically stores phases as 1..6; map exactly those
  // server enum values to the App's P1..P6 model. Unknown values stay invalid.
  const canonical = /^[1-6]$/.test(raw) ? `P${raw}` : raw;
  if (!PHASES.has(canonical as PhaseId)) return invalid();
  return canonical as PhaseId;
}

function product(value: unknown): Product {
  const source = record(value);
  const tier = nonEmptyString(source.tier);
  if (!TIERS.has(tier as Product["tier"])) return invalid();
  const lifecycle = optionalString(source.status);
  if (lifecycle && !LIFECYCLES.has(lifecycle as NonNullable<Product["status"]>)) return invalid();
  const unlocksAtPhase = phase(source.unlocksAtPhase);
  if (!Array.isArray(source.features) || !source.features.every((entry) => typeof entry === "string")) return invalid();

  return {
    id: nonEmptyString(source.id),
    name: nonEmptyString(source.name),
    tier: tier as Product["tier"],
    tagline: requiredString(source.tagline),
    badge: optionalString(source.badge),
    gpu: requiredString(source.gpu),
    vram: requiredString(source.vram),
    hashRate: optionalString(source.hashRate),
    power: optionalString(source.power),
    dailyEarn: finiteNumber(source.dailyEarn),
    dailyEarnNEX: finiteNumber(source.dailyEarnNEX),
    price: finiteNumber(source.price, Number.EPSILON),
    sold: integer(source.sold),
    stock: optionalInteger(source.stock),
    features: [...source.features],
    ai: ai(source.ai),
    status: lifecycle as Product["status"],
    unlocksAtPhase,
    purchaseGate: purchaseGate(source.purchaseGate),
  };
}

export function parseProductCatalogPayload(payload: unknown): ProductCatalogSnapshot {
  const source = record(payload);
  const catalogSource = nonEmptyString(source.source);
  if (source.revision !== null && typeof source.revision !== "string") return invalid();
  if (!Array.isArray(source.products)) return invalid();
  return {
    source: catalogSource,
    revision: source.revision as string | null,
    products: source.products.map(product),
  };
}
