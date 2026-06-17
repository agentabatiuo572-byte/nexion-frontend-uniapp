import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Ported from Nexion-prototype/lib/v3/genesis.ts (zustand persist → Pinia + uni storage).
 * v3 玩法 — Genesis Node 创世节点(预售 FOMO):1000 张限量 / $9,999 一张。
 * 持有人特权:全网每日交易 0.1% 池子均分 / V5 直通 / 闭门 AMA / 二级地板价"$25,000"。
 * 销售进度条 ticker 每 30 秒涨 1-3 张。ownedTokenIds 记录真实购买的 token 序号。
 */

const TOTAL_SLOTS = 1000;

/** Secondary-market royalty taken to the network treasury on every resale
 *  (Q13). Seller nets askPrice × (1 − GENESIS_ROYALTY_RATE). */
export const GENESIS_ROYALTY_RATE = 0.025;

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
  unitPriceUSDT: number;
}

const STORAGE_KEY = "nexion-genesis";

function defaults(): GenesisData {
  return {
    soldSlots: 847,                  // 启动状态
    myOwned: 0,
    ownedTokenIds: [],
    myListings: [],
    unitPriceUSDT: 9999,
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
  const unitPriceUSDT = ref(init.unitPriceUSDT);
  const lastTickTs = ref(0);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        soldSlots: soldSlots.value,
        myOwned: myOwned.value,
        ownedTokenIds: ownedTokenIds.value,
        myListings: myListings.value,
        unitPriceUSDT: unitPriceUSDT.value,
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

  /** 单张日分红估算(基于平台日交易) */
  function dailyDividendPerNodeUSDT(platformDailyVolumeUSD: number) {
    return (platformDailyVolumeUSD * 0.001) / TOTAL_SLOTS;
  }
  // Q14: single mock platform-volume model + per-node dividend, shared by
  // /genesis, the purchase sheet, and the holder dashboard so the figure can
  // never diverge. Volume base tuned so a node yields the credible ~$24/node/day
  // headline (≈14-month payback on $9,999) — a believable platform return that
  // lures buyers, NOT a self-exposing number. (Reverse-education is delivered
  // outside the product, not by the UI.)
  function currentDailyVolumeUSD() {
    return 24_000_000 + soldSlots.value * 100;
  }
  function currentDailyDividendPerNodeUSDT() {
    return dailyDividendPerNodeUSDT(currentDailyVolumeUSD());
  }

  function purchase(n: number, tokenIds?: number[]): { ok: boolean; cost: number } {
    const rem = remaining();
    if (n > rem) return { ok: false, cost: 0 };
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
    remaining, soldPct, dailyDividendPerNodeUSDT, currentDailyVolumeUSD,
    currentDailyDividendPerNodeUSDT, purchase, listNode, cancelListing, fulfillSale, tickSales,
  };
});
