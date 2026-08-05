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

// ── 购买可用性:唯一派生出口(规格 FEAT-GEN10 ④)──────────────────────────────
/** 阻断原因;`null` = 可购买。顺序即优先级,`genesisPurchaseBlock` 按此链取**最高**一条。 */
export type GenesisPurchaseBlock =
  | "configUnavailable" // 配置未知 → 保守锁购(异常3:禁在配置未知时放行)
  | "marketClosed"      // 运营把市场设为暂未开放
  | "halted"            // 熔断(J 域既有闸;见下方注释:前端尚无生产者)
  | "soldOut"           // 售罄 → 引导二级市场
  | "preSale"           // 预售未到 → 倒计时锁
  | null;

export interface GenesisPurchaseInput {
  /** 配置是否已成功拉到。false = 未知,走保守锁购。 */
  configLoaded: boolean;
  marketStatus: "open" | "closed";
  /** 熔断是否生效。
   *
   *  🔴 **今天恒为 false,因为前端还没有这个信号的生产者** —— 后台 J1 有 `genesis` 熔断闸,
   *  但它与 uniapp 之间没有接线(实测:前端全仓无任何消费熔断闸的代码)。这是**既有缺口**,
   *  不是 FEAT-GEN10 引入的;而规格 §⑦ 明写「熔断闸沿用 J 域既有键,本规格不新增 kill 闸、
   *  不改闸数」,所以这里**只留槽位不造闸**:类型齐全、优先级已排好,接线落地当天把它接上即可。
   *  🔴 别把它删掉「简化」—— 删了之后接线的人会重新在别处判一套,正是本函数要防的事。 */
  halted: boolean;
  /** 剩余可售名额。 */
  remaining: number;
  saleStartAt: number | null;
  now: number;
}

/**
 * 购买可用性的**唯一**判定出口(纯函数,server 与 mock 同构)。
 *
 * 🔴 为什么必须收成一处:改造前「能不能买」在 `dockCtaText`(按钮文案)与 `openSheet`
 * (点击处理)**各判一套**,两处顺序恰好一致纯属巧合 —— 任一处加条件而另一处忘了,
 * 就会出现「按钮写着可买、点了没反应」或反过来「按钮灰着却能点进结算」。
 * 规格 FEAT-GEN10 ④ 因此要求单一派生,**禁多处各判一套**。
 *
 * 优先级(规格 ④,不可换序):配置未知 > 市场关闭 > 熔断 > 售罄 > 预售倒计时。
 * 取**最高一条**,不叠加、不闪烁互换(异常2)。
 */
export function genesisPurchaseBlock(input: GenesisPurchaseInput): GenesisPurchaseBlock {
  if (!input.configLoaded) return "configUnavailable";
  if (input.marketStatus === "closed") return "marketClosed";
  if (input.halted) return "halted";
  if (input.remaining <= 0) return "soldOut";
  if (isPreSale(input.saleStartAt, input.now)) return "preSale";
  return null;
}

/** 关闭态**不得**展示倒计时与名额紧迫文案(规格 ④:不对不可购买的东西制造紧迫感)。
 *  售罄同理(已经没了,催也没用)。判据集中在此,页面不各自 if。 */
export function genesisShowsUrgency(block: GenesisPurchaseBlock): boolean {
  return block === null || block === "preSale";
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

/** 关闭态文案变体键 —— **白名单常量**,后台只能在其中选,不能自由输入正文。
 *  规格 FEAT-GEN10 ③:「禁后台自由输入正文,防绕过文案纪律」。
 *  每个键在 i18n `genesis.marketClosed.*` 下三语镜像。 */
export const GENESIS_CLOSED_NOTICE_KEYS = ["default", "maintenance", "restock"] as const;
export type GenesisClosedNoticeKey = (typeof GENESIS_CLOSED_NOTICE_KEYS)[number];

export interface GenesisConfig {
  // 阶梯定价
  tiers: GenesisTier[];
  /** 市场状态(规格 FEAT-GEN10):`closed` = 页面照常可看、但一律不可购买。
   *  单源 = 后台 G4,server-canonical,client 仅缓存展示。
   *  🔴 与 `showcaseEnabled` **相互独立**:关闭市场 ≠ 下架(规格 ③)。
   *  🔴 与 `saleStartAt` 也独立,且优先级**高于**它(规格 ④)。 */
  marketStatus: "open" | "closed";
  /** 关闭态文案变体;仅取 GENESIS_CLOSED_NOTICE_KEYS 内的值,非法值回退 "default"。 */
  closedNoticeKey: GenesisClosedNoticeKey;
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
  marketStatus: "open", // 默认开放(不阻断现状)
  closedNoticeKey: "default",
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
      // 🔴 fail-safe 方向要选对:非法 marketStatus 回退 **open**,不是 closed。
      //   这里是「盘上存了脏值」,不是「配置拉不到」——后者由 genesisPurchaseBlock 的
      //   configUnavailable 走保守锁购。把脏值也当成关闭,会让一个坏字节永久停售。
      if (merged.marketStatus !== "open" && merged.marketStatus !== "closed") merged.marketStatus = "open";
      if (!GENESIS_CLOSED_NOTICE_KEYS.includes(merged.closedNoticeKey)) merged.closedNoticeKey = "default";
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
  /** 配置是否可用。
   *
   *  🔴 mock 期恒 true —— 配置是同步从本地读的,没有会失败的网络请求;
   *  `hydrate()` 读不到时返回的是**默认值**(首次运行的正常情形),不是「拉取失败」。
   *  真后台接上后,这里改由 `GET /api/config/genesis` 的结果驱动:请求失败 → false,
   *  `genesisPurchaseBlock` 随即返回 `configUnavailable` 走保守锁购(规格 FEAT-GEN10 异常3)。
   *  🔴 别为了「让异常3 现在就能演」把它硬编码成 false —— 那会让所有人都买不了。 */
  const loaded = ref(true);

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

  return { config, loaded, update, reset };
});
