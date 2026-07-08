import { defineStore } from "pinia";
import { ref, computed } from "vue";

/**
 * Genesis Node 创世节点 — 高价稀缺 OG 席位（1000 限量）。
 *
 * 改造（分红延期 → 上所排放权益化，规格 FEAT-GEN-dividend-defer-emission）：
 *  - 定价：单一 $9,999 → 3 档阶梯，累计售出决定当前档，售罄硬跳价。
 *  - 收益：每日分红（挂平台交易量）→ NEX 协议排放，**上所后才开阀**（nexListed，
 *    fail-closed）；上所前只有「预留额度 + 排放优先权」，无 live 排放/无可领余额。
 *  - 排放：一次性空投 → vesting 曲线（TGE 解锁 + 线性 + 每 N 月减半）。
 *  所有值 backend-replaceable：nexListed/tier 价/排放曲线在真后台是 server-canonical，
 *  这里用可序列化 mock；运营可配对应 admin G4（G.genesis.*）。
 */

const TOTAL_SLOTS = 1000;

/** Secondary-market royalty taken to the network treasury on every resale
 *  (Q13). Seller nets askPrice × (1 − GENESIS_ROYALTY_RATE). */
export const GENESIS_ROYALTY_RATE = 0.025;

/** 阶梯预售档：累计售出落在 [from, to) 决定当前档，售罄硬跳价（真跳，不重置）。
 *  运营可配 → admin G4 `G.genesis.tierPrices`。 */
export interface GenesisTier {
  id: "wl" | "t1" | "t2";
  from: number; // inclusive cumulative-sold lower bound
  to: number; // exclusive upper bound
  priceUSDT: number;
}
export const GENESIS_TIERS: readonly GenesisTier[] = [
  { id: "wl", from: 0, to: 100, priceUSDT: 7999 },
  { id: "t1", from: 100, to: 550, priceUSDT: 9999 },
  { id: "t2", from: 550, to: TOTAL_SLOTS, priceUSDT: 11999 },
];
function tierForSold(sold: number): GenesisTier {
  for (const tier of GENESIS_TIERS) {
    if (sold >= tier.from && sold < tier.to) return tier;
  }
  return GENESIS_TIERS[GENESIS_TIERS.length - 1];
}

/** 上所后排放曲线。运营可配 → admin G4 `G.genesis.emissionCurve` / `airdropPct`。
 *  nominalPerNodeNEX = 每节点名义预留额度（NEX），展示为「预留额度」非保证死数。
 *  🔴 前低后高（back-loaded）:TGE 解锁一小部分,其余在 vesting 窗口内**早慢后快**释放——
 *  刻意延后负债 + 不在上所(M7-8)当口放大卖压（圆桌操盘手设计意图）。 */
export const GENESIS_EMISSION = {
  tgeUnlockPct: 0.1, // TGE 先释放 10%
  vestMonths: 18, // 上所后 vesting 窗口(月)
  backloadExp: 1.6, // 前低后高指数(>1 = 早期慢、后期快)
  nominalPerNodeNEX: 80_000,
} as const;

const MONTH_MS = 30 * 86400_000;

/** 上所后 vesting 累计释放比例（0..1，单调增）。t=0 → TGE 10%；其余 90% 在 vestMonths 内
 *  按 `t^backloadExp` 前低后高释放（早期慢、后期快），t=vestMonths 时释放完。 */
export function emissionReleasedFraction(monthsSinceListing: number): number {
  if (monthsSinceListing <= 0) return GENESIS_EMISSION.tgeUnlockPct;
  const t = Math.min(1, monthsSinceListing / GENESIS_EMISSION.vestMonths);
  return Math.min(1, GENESIS_EMISSION.tgeUnlockPct + (1 - GENESIS_EMISSION.tgeUnlockPct) * Math.pow(t, GENESIS_EMISSION.backloadExp));
}

/** 排放快照（server-canonical mock）。页面据此渲染上所后 NEX 计价收益。 */
export interface EmissionSnapshot {
  pctReleased: number; // 0..1
  emittedNEX: number;
  lockedNEX: number;
  nextReleaseAt: number; // ms epoch
  monthsSinceListing: number;
}

/** A user's active secondary-market listing */
export interface MyListing {
  tokenId: number;
  askPriceUSDT: number;
  listedAt: number;
}

interface GenesisData {
  soldSlots: number;
  myOwned: number;
  ownedTokenIds: number[];
  myListings: MyListing[];
  /** 全平台一次性上所信号（server-canonical mock）。fail-closed：默认 false = 上所前。 */
  nexListed: boolean;
  nexListedAt: number | null;
}

const STORAGE_KEY = "nexion-genesis";

function defaults(): GenesisData {
  return {
    soldSlots: 847, // 启动状态 → 当前处 T2 尾盘档
    myOwned: 0,
    ownedTokenIds: [],
    myListings: [],
    nexListed: false, // fail-closed：未上所，排放未开阀
    nexListedAt: null,
  };
}

function hydrate(): GenesisData {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<GenesisData> | "";
    if (s && typeof s === "object" && typeof s.soldSlots === "number") {
      const merged = { ...defaults(), ...s };
      // Backfill missing token IDs (old schema or partial state) so owned nodes
      // still render in Mine — sequential IDs from the soldSlots range.
      const owned = merged.myOwned ?? 0;
      const ids = Array.isArray(merged.ownedTokenIds) ? merged.ownedTokenIds : [];
      if (owned > ids.length) {
        const filled = [...ids];
        for (let i = ids.length; i < owned; i++) {
          filled.push(merged.soldSlots - (owned - i - 1));
        }
        merged.ownedTokenIds = filled;
      }
      merged.myListings = Array.isArray(merged.myListings) ? merged.myListings : [];
      // fail-closed：老 schema 无 nexListed → 视为未上所。
      merged.nexListed = merged.nexListed === true;
      merged.nexListedAt = typeof merged.nexListedAt === "number" ? merged.nexListedAt : null;
      return merged;
    }
  } catch {
    // first run
  }
  return defaults();
}

export const useGenesis = defineStore("genesis", () => {
  const init = hydrate();
  const totalSlots = ref(TOTAL_SLOTS);
  const soldSlots = ref(init.soldSlots);
  const myOwned = ref(init.myOwned);
  const ownedTokenIds = ref<number[]>(init.ownedTokenIds);
  const myListings = ref<MyListing[]>(init.myListings);
  const nexListed = ref(init.nexListed);
  const nexListedAt = ref<number | null>(init.nexListedAt);
  const lastTickTs = ref(0);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        soldSlots: soldSlots.value,
        myOwned: myOwned.value,
        ownedTokenIds: ownedTokenIds.value,
        myListings: myListings.value,
        nexListed: nexListed.value,
        nexListedAt: nexListedAt.value,
      });
    } catch {
      // storage unavailable
    }
  }

  function remaining() {
    return TOTAL_SLOTS - soldSlots.value;
  }
  function soldPct() {
    return soldSlots.value / TOTAL_SLOTS;
  }

  // ── 阶梯定价（单源派生，售罄硬跳价）──
  const currentTier = computed(() => tierForSold(soldSlots.value));
  /** 当前档单价。兼容旧读法 `genesis.unitPriceUSDT`（原为固定 $9,999，现随档位）。 */
  const unitPriceUSDT = computed(() => currentTier.value.priceUSDT);
  /** 某档剩余席位（售罄档 = 0）。 */
  function tierRemaining(id: GenesisTier["id"]): number {
    const tier = GENESIS_TIERS.find((t) => t.id === id);
    if (!tier) return 0;
    return Math.max(0, tier.to - Math.max(tier.from, soldSlots.value));
  }

  // ── 上所开阀门（全平台一次性事件；fail-closed）──
  /** 派生门：仅 nexListed === true 才开；脏/未知数据默认不开（不误显 live 排放）。 */
  const dividendsOpen = computed(() => nexListed.value === true);
  /**
   * 翻转上所信号。真后台为 server-canonical（GET /api/config/genesis），此处 mock。
   * 幂等记录首次上所时间锚，排放 vesting 从此刻起算。
   */
  function setNexListed(v: boolean) {
    nexListed.value = v;
    if (v && nexListedAt.value == null) nexListedAt.value = Date.now();
    if (!v) nexListedAt.value = null;
    persist();
  }

  // ── 排放快照（上所后；backend-replaceable mock）──
  function emissionSnapshot(): EmissionSnapshot {
    const listedAt = nexListedAt.value;
    const months = dividendsOpen.value && listedAt != null ? Math.max(0, (Date.now() - listedAt) / MONTH_MS) : 0;
    const pct = dividendsOpen.value ? emissionReleasedFraction(months) : 0;
    const nominal = myOwned.value * GENESIS_EMISSION.nominalPerNodeNEX;
    const emitted = nominal * pct;
    const nextRelease = listedAt != null ? listedAt + (Math.floor(months) + 1) * MONTH_MS : Date.now() + MONTH_MS;
    return {
      pctReleased: pct,
      emittedNEX: emitted,
      lockedNEX: nominal - emitted,
      nextReleaseAt: nextRelease,
      monthsSinceListing: months,
    };
  }
  /** 每节点名义预留额度（NEX）—— 展示为「预留额度」，非保证。 */
  function reservedAllocationNEX() {
    return myOwned.value * GENESIS_EMISSION.nominalPerNodeNEX;
  }

  function purchase(n: number, tokenIds?: number[]): { ok: boolean; cost: number } {
    const rem = remaining();
    if (n > rem) return { ok: false, cost: 0 };
    // 按下单时当前档价结算（跨档时以起始档价，简化：整单同价）。
    const cost = n * unitPriceUSDT.value;
    const ids =
      tokenIds && tokenIds.length === n
        ? tokenIds
        : Array.from({ length: n }, (_, i) => soldSlots.value + 1 + i);
    soldSlots.value = Math.min(TOTAL_SLOTS, soldSlots.value + n);
    myOwned.value = myOwned.value + n;
    ownedTokenIds.value = [...ownedTokenIds.value, ...ids];
    persist();
    return { ok: true, cost };
  }

  function listNode(tokenId: number, askPriceUSDT: number): boolean {
    if (!ownedTokenIds.value.includes(tokenId)) return false;
    if (myListings.value.some((l) => l.tokenId === tokenId)) return false;
    if (askPriceUSDT <= 0) return false;
    myListings.value = [...myListings.value, { tokenId, askPriceUSDT, listedAt: Date.now() }];
    persist();
    return true;
  }

  function cancelListing(tokenId: number): boolean {
    if (!myListings.value.some((l) => l.tokenId === tokenId)) return false;
    myListings.value = myListings.value.filter((l) => l.tokenId !== tokenId);
    persist();
    return true;
  }

  function fulfillSale(tokenId: number): MyListing | null {
    const listing = myListings.value.find((l) => l.tokenId === tokenId);
    if (!listing) return null;
    ownedTokenIds.value = ownedTokenIds.value.filter((id) => id !== tokenId);
    myListings.value = myListings.value.filter((l) => l.tokenId !== tokenId);
    myOwned.value = Math.max(0, myOwned.value - 1);
    persist();
    return listing;
  }

  /**
   * 二级市场承接:买入一个**已存在**的 token（转让,非铸造）。
   * 🔴 不动 soldSlots（该 token 早已计入一级「已铸」+ 派生档价）、不走售罄门 —— 二级承接
   * 与一级供应无关。已持有该 token 则 no-op 返 false（调用方须退款）。
   * 真后台 = POST /api/genesis/secondary/fulfill（原子:校验挂单→扣买家→贷卖家扣版税→转 token）。
   */
  function acquireSecondary(tokenId: number): boolean {
    if (ownedTokenIds.value.includes(tokenId)) return false;
    ownedTokenIds.value = [...ownedTokenIds.value, tokenId];
    myOwned.value = myOwned.value + 1;
    persist();
    return true;
  }

  function tickSales() {
    const t = Date.now();
    if (t - lastTickTs.value < 30_000) return;
    const inc = 1 + Math.floor(Math.random() * 3); // 1-3
    soldSlots.value = Math.min(TOTAL_SLOTS, soldSlots.value + inc);
    lastTickTs.value = t;
    persist();
  }

  return {
    totalSlots, soldSlots, myOwned, ownedTokenIds, myListings, unitPriceUSDT, lastTickTs,
    nexListed, nexListedAt, dividendsOpen, currentTier,
    remaining, soldPct, tierRemaining, setNexListed, emissionSnapshot, reservedAllocationNEX,
    purchase, listNode, cancelListing, fulfillSale, acquireSecondary, tickSales,
  };
});
