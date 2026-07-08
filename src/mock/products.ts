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
  // Sprint 2 second phase: generation cohort + lifecycle status
  generation?: number;      // 1 = original; 2 = Pro v2 / Rack P2 era
  status?: "active" | "legacy"; // legacy = superseded by a newer generation
  supersededBy?: string;    // product id of the next-gen replacement
  tradeinDiscount?: number; // USD off when trading in a legacy device for this product
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
    tagline: "个人 AI 推理盒 · 全托管",
    badge: "热销",
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
      "Nexion 全托管",
      "99.9% 在线 SLA",
      "实时远程监控",
      "免费配送与安装",
    ],
    ai: {
      imageGenPerMin: 320,
      llmTokensPerSec: 12400,
      videoMinPerHour: 18,
      fineTuneMins: 6,
      unlocks: "LLM 70B 推理任务池",
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
    tagline: "双倍 GPU,双倍收益能力。",
    badge: "热门",
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
      "8× RTX 4090 GPU",
      "优先任务分配",
      "99.9% 在线 SLA",
      "含硬件保险",
    ],
    ai: {
      imageGenPerMin: 720,           // SDXL or 480 Flux/min
      llmTokensPerSec: 38000,        // at 70B; ~4,200 at 405B
      videoMinPerHour: 12,           // 4K
      fineTuneMins: 20,              // LoRA-70B
      unlocks: "旗舰算力池(微调 + 405B 推理)",
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
    tagline: "S1 2.5 倍吞吐 · 新一代芯片。",
    badge: "新一代",
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
      "8× RTX 5090 · 新一代芯片",
      "AI 工作负载吞吐为 S1 的 2.5 倍",
      "置换旧 NexionBox 可抵扣 $300",
      "硬件保险 + 5 年质保",
    ],
    ai: {
      imageGenPerMin: 1080,
      llmTokensPerSec: 56000,
      videoMinPerHour: 24,
      fineTuneMins: 12,
      unlocks: "旗舰 AI + 多租户 405B",
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
    tagline: "面向专业运营者的数据中心级 A100 机架。",
    badge: "旗舰",
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
      "企业级 A100 GPU",
      "专属 Tier-3 数据中心机位",
      "VIP 支持 · 24/7 热线",
      "5 年延保",
    ],
    ai: {
      imageGenPerMin: 1800,
      llmTokensPerSec: 128000,       // 405B full precision
      videoMinPerHour: 60,           // Sora-class long-form ready
      fineTuneMins: 8,               // full fine-tune capable
      unlocks: "训练任务池(RLHF / 8B 从零训练)",
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
    tagline: "数据中心 H100 机架 · 终极升级窗口。",
    badge: "新一代",
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
      "8× H100 SXM5 · 数据中心级 Hopper",
      "置换旧 Rack 可抵扣 $800",
      "专属 Tier-3 数据中心机位 · 24/7 VIP 支持",
      "10 年延保 + 保险",
    ],
    ai: {
      imageGenPerMin: 3600,
      llmTokensPerSec: 256000,       // 405B mixed-batch + Llama-3 8B from-scratch
      videoMinPerHour: 120,          // Sora long-form + native 8K
      fineTuneMins: 4,               // full fine-tune 70B in minutes
      unlocks: "训练任务池(RLHF / 70B 从零训练)",
      bestForCategory: ["LL", "FT", "VG"],
    },
    generation: 2,
    status: "active",
    tradeinDiscount: 800,
    unlocksAtPhase: "P5",
  },
  {
    id: "cloud-share",
    name: "云算力份额",
    tier: "Share",
    tagline: "无需硬件 · 购买网络的一小份算力。",
    badge: "低门槛",
    gpu: "分布式",
    vram: "—",
    dailyEarn: 0.19,
    dailyEarnNEX: 3,
    price: 19.9,
    sold: 12483,
    rating: 4.6,
    reviews: 3812,
    features: [
      "即时激活",
      "$19.9 起购",
      "固定收益风格回报",
      "分布在全球数据中心",
    ],
    ai: {
      unlocks: "分摊接入网络的图像、嵌入与语音任务池",
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
