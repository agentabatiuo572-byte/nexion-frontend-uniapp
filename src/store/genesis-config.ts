import { defineStore } from "pinia";
import { ref } from "vue";
import type { Listing } from "@/components/genesis/listing-card.vue";
import type { ActivityEvent } from "@/components/genesis/activity-row.vue";

/**
 * Genesis config — 创世节点的「后台可控」参数(阶梯定价 / 预售倒计时 / 权益文案 /
 * 商城上架 / 二级市场运营引擎 / 盘面统计),以 store 承载而非 const。照 trial-config.ts
 * 范式(DEFAULT + hydrate merge-over-defaults + update/reset + uni storage)。
 * 真后台由 admin G4 `G.genesis.*` server-canonical 下发,此处可序列化 mock 镜像。
 *
 * 🔴 档位类型 + 默认值定义在**本叶子文件**(不在 genesis.ts),genesis store 单向
 * import 本文件——避免「默认值在 genesis.ts / config import 它」的 TDZ 循环。
 * MOCK-ONLY;规格 FEAT-GEN09/GEN10。
 */

// ── 阶梯档位(累计售出落 [from,to) 决定当前档,售罄硬跳价)──
export interface GenesisTier {
  id: string; // "wl" | "t1" | "t2" | 运营新增档任意 id
  from: number; // inclusive cumulative-sold lower bound
  to: number; // exclusive upper bound
  priceUSDT: number;
}
export const GENESIS_TIERS_DEFAULT: readonly GenesisTier[] = [
  { id: "wl", from: 0, to: 100, priceUSDT: 7999 },
  { id: "t1", from: 100, to: 550, priceUSDT: 9999 },
  { id: "t2", from: 550, to: 1000, priceUSDT: 11999 },
];

/** 纯函数:累计售出 → 当前档(空/非法档位回退占位,fail-safe 末档兜底)。
 *  genesis store 与 genesis.vue 共用单源。 */
export function tierForSold(tiers: readonly GenesisTier[], sold: number): GenesisTier {
  if (!tiers || tiers.length === 0) return { id: "t1", from: 0, to: 1000, priceUSDT: 9999 };
  for (const tier of tiers) {
    if (sold >= tier.from && sold < tier.to) return tier;
  }
  return tiers[tiers.length - 1];
}

/** 预售锁定门:saleStartAt 非空且未到 = 未开售。独立于 nexListed(上所)。 */
export function isPreSale(saleStartAt: number | null, now: number): boolean {
  return saleStartAt != null && now < saleStartAt;
}

// ── 预售页权益(4 项,双语;空字段 = 回退现 i18n)──
export interface GenesisPerk {
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
}
function emptyPerks(): GenesisPerk[] {
  return Array.from({ length: 4 }, () => ({ nameZh: "", nameEn: "", descZh: "", descEn: "" }));
}

// ── 运营挂单(用户可真实承接;结构兼容 Listing + 来源标记)──
export interface OpsListing extends Listing {
  source: "ops"; // UI 永不暴露此字段(0 meta);仅内部区分
  /** listedAt 约定:负值 = 相对 now 偏移(种子,store 顶层无 Date.now());
   *  正值 = 绝对 epoch ms(运营新建时 admin 侧取当刻)。marketplace 合并时解析:
   *  resolved = listedAt < 0 ? now + listedAt : listedAt。 */
}

// ── 盘面展示统计(纯展示可配)──
export interface GenesisMarketStats {
  floor: number;
  vol24h: number;
  listed: number;
  owners: number;
  floorDeltaPct: number;
}

export interface GenesisConfig {
  // 阶梯定价
  tiers: GenesisTier[];
  // 预售倒计时
  saleStartAt: number | null;
  showCountdown: boolean;
  // 商城上架
  showcaseEnabled: boolean;
  // 预售页权益(空 = 回退 i18n)
  perks: GenesisPerk[];
  // 二级市场运营挂单
  opsListings: OpsListing[];
  // FOMO 成交引擎
  fomoEnabled: boolean;
  fomoIntervalMinMs: number;
  fomoIntervalMaxMs: number;
  fomoPriceBandPct: number;
  fomoDailyCap: number;
  /** 手动注单持久池(引擎自动生成的虚拟成交是运行时 ephemeral,不持久)。 */
  fomoActivity: ActivityEvent[];
  // 盘面统计
  marketStats: GenesisMarketStats;
}

const HOUR = 3600_000;
const DAY = 86400_000;

export const DEFAULT_GENESIS_CONFIG: GenesisConfig = {
  tiers: GENESIS_TIERS_DEFAULT.map((t) => ({ ...t })),
  saleStartAt: null, // 默认已开售(不阻断现状)
  showCountdown: true,
  showcaseEnabled: true,
  perks: emptyPerks(),
  // 运营挂单默认用高位 token 段(≥900)避免与用户持仓 token 撞号。
  opsListings: [
    { tokenId: 903, priceUSDT: 14_200, lastSaleUSDT: 11_999, seller: "0x7c1e4a9f3b28", listedAt: 0 - 2 * HOUR, traits: { tier: "Founder #903", boost: "1.5×", mintYear: 2026 }, source: "ops" },
    { tokenId: 917, priceUSDT: 13_700, lastSaleUSDT: 9_999, seller: "0x2fa9c81d740b", listedAt: 0 - 10 * HOUR, traits: { tier: "Founder #917", boost: "1.5×", mintYear: 2026 }, source: "ops" },
    { tokenId: 946, priceUSDT: 13_500, lastSaleUSDT: 11_999, seller: "0xb840e37c1259", listedAt: 0 - 1 * DAY, traits: { tier: "Founder #946", boost: "2.0×", mintYear: 2026 }, source: "ops" },
  ],
  fomoEnabled: true,
  fomoIntervalMinMs: 180_000, // 3 分钟
  fomoIntervalMaxMs: 600_000, // 10 分钟
  fomoPriceBandPct: 0.15, // 地板价 ±15%
  fomoDailyCap: 40,
  fomoActivity: [],
  marketStats: {
    floor: 13_400,
    vol24h: 1_247_300,
    listed: 89,
    owners: 953,
    floorDeltaPct: 18,
  },
};

const STORAGE_KEY = "nexgrid-genesis-config-v1";

/** 档位健全性校验(fail-closed):非空、from 升序连续、末档 to≥minTotal(已售数)、价>0。
 *  任一违反 → 回退默认,避免运营误配导致前端派生越界。 */
function sanitizeTiers(tiers: unknown, minTotal: number): GenesisTier[] {
  if (!Array.isArray(tiers) || tiers.length === 0) return DEFAULT_GENESIS_CONFIG.tiers.map((t) => ({ ...t }));
  let prevTo = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i] as Partial<GenesisTier>;
    if (
      typeof t.from !== "number" ||
      typeof t.to !== "number" ||
      typeof t.priceUSDT !== "number" ||
      t.priceUSDT <= 0 ||
      t.from !== prevTo || // 连续:本档 from = 上档 to
      t.to <= t.from
    ) {
      return DEFAULT_GENESIS_CONFIG.tiers.map((x) => ({ ...x }));
    }
    prevTo = t.to;
  }
  if (prevTo < minTotal) return DEFAULT_GENESIS_CONFIG.tiers.map((x) => ({ ...x })); // 总量须 ≥ 已售
  return (tiers as GenesisTier[]).map((t) => ({ id: String(t.id), from: t.from, to: t.to, priceUSDT: t.priceUSDT }));
}

function hydrate(): GenesisConfig {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { config?: Partial<GenesisConfig> } | "";
    if (s && typeof s === "object" && s.config) {
      // Merge over defaults so newly-added fields exist for old persisted state.
      const merged = { ...DEFAULT_GENESIS_CONFIG, ...s.config };
      merged.tiers = sanitizeTiers(s.config.tiers, 0);
      if (!Array.isArray(merged.perks) || merged.perks.length !== 4) merged.perks = emptyPerks();
      if (!Array.isArray(merged.opsListings)) merged.opsListings = [];
      if (!Array.isArray(merged.fomoActivity)) merged.fomoActivity = [];
      return merged;
    }
  } catch {
    // first run
  }
  return { ...DEFAULT_GENESIS_CONFIG, tiers: DEFAULT_GENESIS_CONFIG.tiers.map((t) => ({ ...t })), perks: emptyPerks() };
}

export const useGenesisConfig = defineStore("genesisConfig", () => {
  const config = ref<GenesisConfig>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { config: config.value });
    } catch {
      // storage unavailable
    }
  }
  function update(patch: Partial<GenesisConfig>) {
    config.value = { ...config.value, ...patch };
    persist();
  }
  function reset() {
    config.value = { ...DEFAULT_GENESIS_CONFIG, tiers: DEFAULT_GENESIS_CONFIG.tiers.map((t) => ({ ...t })), perks: emptyPerks() };
    persist();
  }

  return { config, update, reset };
});
