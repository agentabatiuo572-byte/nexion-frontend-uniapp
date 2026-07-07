// Product definitions per design doc §5.3 + v3.1 §5.3.1 AI workload throughput.
// Ported from Nexion-prototype/lib/mock/products.ts (zero React deps — plain data
// + 2 pure helpers; copied faithfully so the store page renders the same 6 tiers).

import type { PhaseId } from "@/store/product-phase";

// AI workload throughput per device — replaces "MH/s" hash rate in the
// hero spec card, drives the v3.1 "you can power LLM 70B inference" narrative.
export interface AIPerformance {
  imageGenPerMin?: number;     // SDXL or Flux throughput, images/min
  llmTokensPerSec?: number;    // LLM inference, tokens/sec (at advertised model size)
  videoMinPerHour?: number;    // Video gen, output minutes per render hour
  fineTuneMins?: number;       // LoRA fine-tune turnaround, minutes
  unlocks?: string;            // e.g. "LLM 70B inference pool", "Flagship compute pool"
  bestForCategory?: ("IG" | "VG" | "LL" | "FT" | "EM" | "SP")[];
}

// Per-user purchase gate (rank/condition + quota lock). Backend-configurable:
// operator picks a gate shape at SKU 上架 (单活跃直推 / 单 V 级 / 组合) and the
// thresholds; server-canonical (mirrors GET /api/store/catalog). All fields
// optional — undefined gate = freely purchasable. rankMin is a plain VRank
// ordinal (0-12) to avoid a circular import on the v-rank store.
export interface PurchaseGate {
  rankMin?: number;           // 最低 V 级 (0-12);eligible 需 myRank >= rankMin
  activeDirectMin?: number;   // 最少活跃直推数
  teamVolumeMin?: number;     // 最低团队业绩 USD
  mode: "all" | "either";     // 多条件 AND / OR
  quotaCap?: number;          // 锁额:本期可售上限
  quotaSold?: number;         // 已售 (server 维护;remaining = cap - sold)
  quotaPeriod?: "month" | "lifetime";
  enforce: boolean;           // true=硬拦截售罄 / false=仅 FOMO 展示
}

export interface Product {
  id: string;
  name: string;
  tier: "Entry" | "Pro" | "Flagship" | "Share";
  tagline: string;
  badge?: string;
  gpu: string;
  vram: string;
  hashRate?: string;
  power?: string;
  dailyEarn: number;        // USDT/day
  dailyEarnNEX: number;     // NEX/day (spec §3.1)
  // Q9: annual ROI is DERIVED, not stored — see annualRoiPct() below. A stored
  // value drifted out of sync with dailyEarn/price; deriving from one source
  // keeps ROI and payback mathematically consistent and impossible to drift.
  price: number;
  monthlyPrice?: number;
  installMonths?: number;
  sold: number;
  stock?: number;
  rating: number;
  reviews: number;
  features: string[];
  // v3.1 AI workload throughput specs (§5.3.1)
  ai?: AIPerformance;
  // Sprint 2 second phase: catalog lifecycle status
  status?: "active" | "legacy"; // legacy = older catalog listing (still owned & serviced)
  // Sprint 2 final phase: platform-lifecycle release gate. Pro v2 ships when the
  // platform reaches P3 (~month 5); Rack P2 ships at P5 (~month 10). Listings
  // and direct-URL hits before that surface a "coming soon" lock card.
  unlocksAtPhase?: PhaseId;
  // Per-user purchase gate (等级门 + 锁额). Operator-configured at 上架,
  // server-canonical. undefined = 无门,自由购买. See evaluatePurchaseGate().
  purchaseGate?: PurchaseGate;
}

export const PRODUCTS: Product[] = [
  {
    id: "stellarbox-s1",
    name: "NexionBox S1",
    tier: "Entry",
    tagline: "Personal AI inference box · fully managed",
    badge: "Best Seller",
    gpu: "4× RTX 4090",
    vram: "96GB VRAM",
    hashRate: "1,240 MH/s",
    power: "1,200W TDP",
    dailyEarn: 7,
    dailyEarnNEX: 40,
    price: 649,
    monthlyPrice: 60,
    installMonths: 12,
    sold: 4821,
    stock: 47,
    rating: 4.8,
    reviews: 2847,
    features: [
      "Fully managed by Nexion",
      "99.9% uptime SLA",
      "Real-time remote monitoring",
      "Free shipping & installation",
    ],
    ai: {
      imageGenPerMin: 320,
      llmTokensPerSec: 12400,
      videoMinPerHour: 18,
      fineTuneMins: 6,
      unlocks: "LLM 70B inference pool",
      bestForCategory: ["IG", "LL"],
    },
    status: "legacy",
  },
  {
    id: "stellarbox-pro",
    name: "NexionBox Pro",
    tier: "Pro",
    tagline: "Double the GPUs, double the earning power.",
    badge: "Trending",
    gpu: "8× RTX 4090",
    vram: "192GB VRAM",
    hashRate: "2,480 MH/s",
    power: "2,400W TDP",
    dailyEarn: 13,
    dailyEarnNEX: 80,
    price: 1199,
    monthlyPrice: 110,
    installMonths: 12,
    sold: 1842,
    stock: 23,
    // 购买门(后台可改):单活跃直推 ≥5 + 硬锁额(remaining = cap−sold = 23,对齐 stock)。
    purchaseGate: { activeDirectMin: 5, mode: "all", quotaCap: 1000, quotaSold: 977, quotaPeriod: "month", enforce: true },
    rating: 4.9,
    reviews: 1124,
    features: [
      "8× RTX 4090 GPUs",
      "Priority task allocation",
      "99.9% uptime SLA",
      "Hardware insurance included",
    ],
    ai: {
      imageGenPerMin: 720,           // SDXL or 480 Flux/min
      llmTokensPerSec: 38000,        // at 70B; ~4,200 at 405B
      videoMinPerHour: 12,           // 4K
      fineTuneMins: 20,              // LoRA-70B
      unlocks: "Flagship compute pool (Fine-tune + 405B inference)",
      bestForCategory: ["LL", "FT", "VG"],
    },
    status: "legacy",
  },
  {
    id: "stellarbox-pro-v2",
    name: "NexionBox Pro v2",
    tier: "Pro",
    tagline: "2.5× S1 throughput — built for higher-tier task pools.",
    badge: "Upgrade Pick",
    gpu: "8× RTX 5090",
    vram: "256GB VRAM",
    hashRate: "5,120 MH/s",
    power: "2,200W TDP",
    dailyEarn: 14,
    dailyEarnNEX: 90,
    price: 1319,
    monthlyPrice: 120,
    installMonths: 12,
    sold: 412,
    stock: 38,
    rating: 4.9,
    reviews: 187,
    features: [
      "8× RTX 5090 — top-bin silicon",
      "2.5× S1 throughput on AI workloads",
      "Upgrade trade-in: retire an owned device for checkout credit",
      "Hardware insurance + 5-year warranty",
    ],
    ai: {
      imageGenPerMin: 1080,
      llmTokensPerSec: 56000,
      videoMinPerHour: 24,
      fineTuneMins: 12,
      unlocks: "Flagship AI + multi-tenant 405B",
      bestForCategory: ["LL", "FT", "VG"],
    },
    status: "active",
    unlocksAtPhase: "P3",
  },
  {
    id: "stellarrack-p1",
    name: "NexionRack P1",
    tier: "Flagship",
    tagline: "Datacenter-grade A100 rack for serious operators.",
    badge: "Flagship",
    gpu: "8× NVIDIA A100",
    vram: "640GB VRAM",
    hashRate: "3,840 MH/s",
    power: "3,200W TDP",
    dailyEarn: 45,
    dailyEarnNEX: 300,
    price: 4499,
    monthlyPrice: 400,
    installMonths: 12,
    sold: 287,
    stock: 8,
    // 购买门(后台可改):组合 either —— V≥3 或 ≥15 活跃直推 或 ≥$20K 团队业绩 + 硬锁额(remaining=8)。
    purchaseGate: { rankMin: 3, activeDirectMin: 15, teamVolumeMin: 20000, mode: "either", quotaCap: 100, quotaSold: 92, quotaPeriod: "month", enforce: true },
    rating: 4.9,
    reviews: 154,
    features: [
      "Enterprise A100 GPUs",
      "Dedicated tier-3 datacenter slot",
      "VIP support · 24/7 hotline",
      "5-year extended warranty",
    ],
    ai: {
      imageGenPerMin: 1800,
      llmTokensPerSec: 128000,       // 405B full precision
      videoMinPerHour: 60,           // Sora-class long-form ready
      fineTuneMins: 8,               // full fine-tune capable
      unlocks: "Training pool (RLHF / from-scratch 8B)",
      bestForCategory: ["LL", "FT", "VG"],
    },
    status: "legacy",
  },
  {
    id: "stellarrack-p2",
    name: "NexionRack P2",
    tier: "Flagship",
    tagline: "Datacenter H100 rack — the top compute tier.",
    badge: "Flagship",
    gpu: "8× NVIDIA H100",
    vram: "1,024GB VRAM",
    hashRate: "9,600 MH/s",
    power: "4,000W TDP",
    dailyEarn: 75,
    dailyEarnNEX: 500,
    price: 7499,
    monthlyPrice: 675,
    installMonths: 12,
    sold: 64,
    stock: 4,
    rating: 5.0,
    reviews: 41,
    features: [
      "8× H100 SXM5 — datacenter-grade Hopper",
      "Upgrade trade-in: retire an owned device for checkout credit",
      "Dedicated tier-3 DC slot · 24/7 VIP support",
      "10-year extended warranty + insurance",
    ],
    ai: {
      imageGenPerMin: 3600,
      llmTokensPerSec: 256000,       // 405B mixed-batch + Llama-3 8B from-scratch
      videoMinPerHour: 120,          // Sora long-form + native 8K
      fineTuneMins: 4,               // full fine-tune 70B in minutes
      unlocks: "Training pool (RLHF / 70B from-scratch)",
      bestForCategory: ["LL", "FT", "VG"],
    },
    status: "active",
    unlocksAtPhase: "P5",
  },
  {
    id: "cloud-share",
    name: "Cloud Share",
    tier: "Share",
    tagline: "No hardware needed — buy a slice of the network.",
    badge: "Low Barrier",
    gpu: "Distributed",
    vram: "—",
    dailyEarn: 0.19,
    dailyEarnNEX: 3,
    price: 19.9,
    sold: 12483,
    rating: 4.6,
    reviews: 3812,
    features: [
      "Instant activation",
      "Buy as little as $19.9",
      "Fixed-income style returns",
      "Distributed across global data centers",
    ],
    ai: {
      unlocks: "Fractional access to network's IG + EM + SP pools",
      bestForCategory: ["IG", "EM", "SP"],
    },
    status: "active",
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/**
 * Q9 single source of truth: annual gross ROI %, derived from the same basis
 * as the payback estimate (price / dailyEarn). Deriving guarantees ROI and
 * payback can never disagree. Share-tier (no hardware) lands at ~13%.
 */
export function annualRoiPct(p: Pick<Product, "dailyEarn" | "price">): number {
  return Math.round(((p.dailyEarn * 365) / p.price) * 100);
}

// ───── Purchase gate evaluation (单源 · store/detail/checkout/quota 共用) ─────
// Pure helper: given a product's gate config + the user's eligibility context,
// returns whether checkout must be blocked + the unmet conditions for display.
// server-canonical in prod (server re-checks on POST /api/orders); client uses
// this only for UI gating + progress copy.
export interface GateContext {
  rank: number; // myRank 0-12
  activeDirect: number; // active direct-invite count
  teamVolumeUSD: number;
}
export interface GateCondition {
  kind: "rank" | "activeDirect" | "teamVolume";
  need: number;
  have: number;
  met: boolean;
}
export interface GateResult {
  gated: boolean; // product carries a purchaseGate
  eligible: boolean; // rank/condition satisfied
  soldOut: boolean; // enforce && remaining <= 0
  blocked: boolean; // !eligible || soldOut → checkout must refuse
  remaining: number | null; // cap - sold (null if no quota)
  conditions: GateCondition[];
  unmet: GateCondition[];
  progressPct: number; // 0..1 average condition progress
}

export function evaluatePurchaseGate(
  p: Pick<Product, "purchaseGate">,
  ctx: GateContext,
): GateResult {
  const g = p.purchaseGate;
  if (!g) {
    return { gated: false, eligible: true, soldOut: false, blocked: false, remaining: null, conditions: [], unmet: [], progressPct: 1 };
  }
  const conditions: GateCondition[] = [];
  if (g.rankMin != null) conditions.push({ kind: "rank", need: g.rankMin, have: ctx.rank, met: ctx.rank >= g.rankMin });
  if (g.activeDirectMin != null) conditions.push({ kind: "activeDirect", need: g.activeDirectMin, have: ctx.activeDirect, met: ctx.activeDirect >= g.activeDirectMin });
  if (g.teamVolumeMin != null) conditions.push({ kind: "teamVolume", need: g.teamVolumeMin, have: ctx.teamVolumeUSD, met: ctx.teamVolumeUSD >= g.teamVolumeMin });

  const eligible =
    conditions.length === 0 ? true : g.mode === "all" ? conditions.every((c) => c.met) : conditions.some((c) => c.met);
  const remaining = g.quotaCap != null ? Math.max(0, g.quotaCap - (g.quotaSold ?? 0)) : null;
  const soldOut = !!g.enforce && remaining != null && remaining <= 0;
  const blocked = !eligible || soldOut;
  const unmet = conditions.filter((c) => !c.met);
  const progressPct =
    conditions.length === 0 ? 1 : conditions.reduce((s, c) => s + Math.min(1, c.need > 0 ? c.have / c.need : 1), 0) / conditions.length;

  return { gated: true, eligible, soldOut, blocked, remaining, conditions, unmet, progressPct };
}
