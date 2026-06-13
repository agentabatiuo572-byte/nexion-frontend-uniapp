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
  unlocks?: string;            // e.g. "LLM 70B inference pool", "AI Premium pool"
  bestForCategory?: ("IG" | "VG" | "LL" | "FT" | "EM" | "SP")[];
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
  shareYieldMin?: number;
  shareYieldMax?: number;
  // v3.1 AI workload throughput specs (§5.3.1)
  ai?: AIPerformance;
  // Sprint 2 second phase: generation cohort + lifecycle status
  generation?: number;      // 1 = original; 2 = Pro v2 / Rack P2 era
  status?: "active" | "legacy"; // legacy = superseded by a newer generation
  supersededBy?: string;    // product id of the next-gen replacement
  tradeinDiscount?: number; // USD off when trading in a legacy device for this product
  // Sprint 2 final phase: platform-lifecycle release gate. Pro v2 ships when the
  // platform reaches P3 (~month 5); Rack P2 ships at P5 (~month 10). Listings
  // and direct-URL hits before that surface a "coming soon" lock card.
  unlocksAtPhase?: PhaseId;
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
    dailyEarn: 38.5,
    dailyEarnNEX: 65,
    price: 1299,
    monthlyPrice: 119,
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
    generation: 1,
    status: "legacy",
    supersededBy: "stellarbox-pro-v2",
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
    dailyEarn: 76.0,
    dailyEarnNEX: 215,
    price: 2399,
    monthlyPrice: 219,
    installMonths: 12,
    sold: 1842,
    stock: 23,
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
      unlocks: "AI Premium pool (Fine-tune + 405B inference)",
      bestForCategory: ["LL", "FT", "VG"],
    },
    generation: 1,
    status: "legacy",
    supersededBy: "stellarrack-p2",
  },
  {
    id: "stellarbox-pro-v2",
    name: "NexionBox Pro v2",
    tier: "Pro",
    tagline: "2.5× S1 throughput — new generation silicon.",
    badge: "New Gen",
    gpu: "8× RTX 5090",
    vram: "256GB VRAM",
    hashRate: "5,120 MH/s",
    power: "2,200W TDP",
    dailyEarn: 96.0,
    dailyEarnNEX: 280,
    price: 2639,
    monthlyPrice: 239,
    installMonths: 12,
    sold: 412,
    stock: 38,
    rating: 4.9,
    reviews: 187,
    features: [
      "8× RTX 5090 — new silicon generation",
      "2.5× S1 throughput on AI workloads",
      "Trade-in: $300 off when retiring a legacy NexionBox",
      "Hardware insurance + 5-year warranty",
    ],
    ai: {
      imageGenPerMin: 1080,
      llmTokensPerSec: 56000,
      videoMinPerHour: 24,
      fineTuneMins: 12,
      unlocks: "AI Premium + multi-tenant 405B",
      bestForCategory: ["LL", "FT", "VG"],
    },
    generation: 2,
    status: "active",
    tradeinDiscount: 300,
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
    dailyEarn: 142.6,
    dailyEarnNEX: 950,
    price: 8999,
    monthlyPrice: 799,
    installMonths: 12,
    sold: 287,
    stock: 8,
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
    generation: 1,
    status: "legacy",
    supersededBy: "stellarrack-p2",
  },
  {
    id: "stellarrack-p2",
    name: "NexionRack P2",
    tier: "Flagship",
    tagline: "Datacenter H100 rack — final-tier upgrade window.",
    badge: "New Gen",
    gpu: "8× NVIDIA H100",
    vram: "1,024GB VRAM",
    hashRate: "9,600 MH/s",
    power: "4,000W TDP",
    dailyEarn: 248.0,
    dailyEarnNEX: 1820,
    price: 14999,
    monthlyPrice: 1349,
    installMonths: 12,
    sold: 64,
    stock: 4,
    rating: 5.0,
    reviews: 41,
    features: [
      "8× H100 SXM5 — datacenter-grade Hopper",
      "Trade-in: $800 off when retiring a legacy Rack",
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
    generation: 2,
    status: "active",
    tradeinDiscount: 800,
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
    dailyEarn: 0.073,
    dailyEarnNEX: 30,
    price: 199,
    sold: 12483,
    rating: 4.6,
    reviews: 3812,
    shareYieldMin: 8,
    shareYieldMax: 15,
    features: [
      "Instant activation",
      "Buy as little as $199",
      "Fixed-income style returns",
      "Distributed across global data centers",
    ],
    ai: {
      unlocks: "Fractional access to network's IG + EM + SP pools",
      bestForCategory: ["IG", "EM", "SP"],
    },
    generation: 1,
    status: "active",
  },
];

// Map a legacy product id to the next-gen replacement it upgrades into.
export const TRADEIN_UPGRADE_MAP: Record<string, string> = {
  "stellarbox-s1":   "stellarbox-pro-v2",
  "stellarbox-pro":  "stellarbox-pro-v2",
  "stellarrack-p1":  "stellarrack-p2",
};

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
