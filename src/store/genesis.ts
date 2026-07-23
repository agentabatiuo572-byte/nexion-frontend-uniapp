import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { normalizeAccountKey } from "@/store/account-cloud";
import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";
import {
  useGenesisConfig,
  tierForSold,
  GENESIS_TIERS_DEFAULT as GENESIS_TIERS,
  type GenesisTier,
} from "@/store/genesis-config";

// 阶梯档位类型 + 默认值现定义在 genesis-config.ts(叶子,避免 TDZ 循环);
// re-export 兼容既有 import 方(canon-sentinel 改读 genesis-config,见 Step 5)。
export { GENESIS_TIERS, type GenesisTier };

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

// 阶梯档位(GENESIS_TIERS)+ tierForSold 现在是运营可配的,单源在 genesis-config
// store(admin G4 `G.genesis.tiers`)。累计售出决定当前档,售罄硬跳价——派生逻辑
// 见下方 currentTier/unitPriceUSDT/tierRemaining,全部读 live config。

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

/** 认购资格门(稀缺性核心,规格 FEAT-GEN08)。四通道 any-of:累计入金 / 旗舰设备 /
 *  V 等级 / 创世邀请码。server-canonical:真后台由 GET /api/config/genesis 下发,
 *  运营可配 → admin G4 `G.genesis.eligibility.*`;此处为可序列化 mock 镜像,
 *  client 禁止本地改松。 */
export interface GenesisEligibilityConfig {
  enabled: boolean;
  mode: "any-of" | "all-of";
  /** 通道1:累计入金 USD(仅 recordDeposit 口径,earnings/兑换不计)。 */
  minDepositUsdt: number;
  /** 通道2:旗舰设备(Flagship tier)持有台数,active+inventory 都计。 */
  flagshipMin: number;
  /** 通道3:V 等级(V0-V12 序数)。 */
  vRankMin: number;
  /** 通道4:创世邀请码通道开关。 */
  inviteEnabled: boolean;
  /** 单人累计持有上限(一级认购+二级承接合计)。 */
  perUserCap: number;
  /** 资格门适用范围:primary=仅一级认购;both=二级承接同门。 */
  appliesTo: "primary" | "both";
}
export const GENESIS_ELIGIBILITY: GenesisEligibilityConfig = Object.freeze({
  enabled: true,
  mode: "any-of",
  minDepositUsdt: 5000,
  flagshipMin: 1,
  vRankMin: 4,
  inviteEnabled: true,
  perUserCap: 5,
  appliesTo: "both",
});

/** 创世邀请码格式(mock 端格式校验;真后台 = server 核销接口,格式仅兜底)。 */
export const GENESIS_INVITE_PATTERN = /^NEXGRID-OG-[A-Z0-9]{4}$/;

/** 资格求值输入。composable 层从 app / v-rank / genesis 组合(store 不互 import)。 */
export interface GenesisEligibilityCtx {
  cumulativeDepositUsdt: number;
  vRank: number;
  flagshipCount: number;
  hasInvite: boolean;
  myOwned: number;
}

export interface GenesisGateCondition {
  key: "deposit" | "flagship" | "vrank" | "invite";
  met: boolean;
  current: number;
  target: number;
  progressPct: number; // 0-100
}

export interface GenesisGateResult {
  /** 资格门总判定(enabled=false 时恒 true)。 */
  eligible: boolean;
  conditions: GenesisGateCondition[];
  unmetCount: number;
  /** 已达单人持有上限(独立于 eligible 的维度)。 */
  capReached: boolean;
  /** 还可增持的张数(perUserCap − myOwned,下限 0)。 */
  capRemaining: number;
}

/** 资格门单源求值 — 商城尊享卡 / 预售 dock / 购买 sheet / 二级承接四处共用。
 *  fail-closed:enabled 脏值按「门开启」处理(`!== false`),宁可多拦不误放。 */
export function evaluateGenesisEligibility(
  config: GenesisEligibilityConfig,
  ctx: GenesisEligibilityCtx,
): GenesisGateResult {
  const pct = (cur: number, target: number) => {
    if (!Number.isFinite(cur)) return 0; // 脏值(老 persist 注入)按零进度,不渲 NaN
    // floor 而非 round:$4,999/$5,000 显示 99% 而非「100% 但未达成」的自相矛盾。
    return target <= 0 ? 100 : Math.min(100, Math.floor((cur / target) * 100));
  };
  const conditions: GenesisGateCondition[] = [
    {
      key: "deposit",
      met: ctx.cumulativeDepositUsdt >= config.minDepositUsdt,
      current: ctx.cumulativeDepositUsdt,
      target: config.minDepositUsdt,
      progressPct: pct(ctx.cumulativeDepositUsdt, config.minDepositUsdt),
    },
    {
      key: "flagship",
      met: ctx.flagshipCount >= config.flagshipMin,
      current: ctx.flagshipCount,
      target: config.flagshipMin,
      progressPct: pct(ctx.flagshipCount, config.flagshipMin),
    },
    {
      key: "vrank",
      met: ctx.vRank >= config.vRankMin,
      current: ctx.vRank,
      target: config.vRankMin,
      progressPct: pct(ctx.vRank, config.vRankMin),
    },
  ];
  if (config.inviteEnabled) {
    conditions.push({
      key: "invite",
      met: ctx.hasInvite,
      current: ctx.hasInvite ? 1 : 0,
      target: 1,
      progressPct: ctx.hasInvite ? 100 : 0,
    });
  }
  const metCount = conditions.filter((c) => c.met).length;
  const passed = config.mode === "all-of" ? metCount === conditions.length : metCount > 0;
  const gateOn = config.enabled !== false; // fail-closed
  const capRemaining = Math.max(0, config.perUserCap - ctx.myOwned);
  return {
    eligible: gateOn ? passed : true,
    conditions,
    unmetCount: conditions.length - metCount,
    capReached: capRemaining <= 0,
    capRemaining,
  };
}

/** A user's active secondary-market listing */
export interface MyListing {
  tokenId: number;
  askPriceUSDT: number;
  listedAt: number;
}

/** 全平台市场态(账号无关,设备共享):售出进度 + 上所信号。 */
interface GenesisGlobalData {
  soldSlots: number;
  /** 全平台一次性上所信号（server-canonical mock）。fail-closed：默认 false = 上所前。 */
  nexListed: boolean;
  nexListedAt: number | null;
}

/** 用户持仓片(per-account 行,随账号走;P2-8 设备级泄漏修复)。 */
interface GenesisUserData {
  myOwned: number;
  ownedTokenIds: number[];
  myListings: MyListing[];
}

const STORAGE_KEY = "nexgrid-genesis"; // 仅全平台片
const ACCOUNTS_KEY = "nexgrid-genesis-accounts-v1"; // { [accountKey]: GenesisUserData }

function globalDefaults(): GenesisGlobalData {
  return {
    soldSlots: 847, // 启动状态 → 当前处 T2 尾盘档
    nexListed: false, // fail-closed：未上所，排放未开阀
    nexListedAt: null,
  };
}

function userDefaults(): GenesisUserData {
  return { myOwned: 0, ownedTokenIds: [], myListings: [] };
}

// 旧全局键里的存量 myOwned/ownedTokenIds/myListings 不迁移:设备级数据无账号
// 归属,迁给任何账号都是臆断(mock 可重建);下次 persist 全局片时自然清除。
function hydrateGlobal(): GenesisGlobalData {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<GenesisGlobalData> | "";
    if (s && typeof s === "object" && typeof s.soldSlots === "number") {
      return {
        soldSlots: s.soldSlots,
        // fail-closed：老 schema 无 nexListed → 视为未上所。
        nexListed: s.nexListed === true,
        nexListedAt: typeof s.nexListedAt === "number" ? s.nexListedAt : null,
      };
    }
  } catch {
    // first run
  }
  return globalDefaults();
}

function hydrateUser(accountKey: string, soldSlots: number): GenesisUserData {
  const row = readAccountRow<Partial<GenesisUserData>>(ACCOUNTS_KEY, accountKey);
  if (!row || typeof row.myOwned !== "number") return userDefaults();
  const owned = row.myOwned;
  const ids = Array.isArray(row.ownedTokenIds) ? [...row.ownedTokenIds] : [];
  // Backfill missing token IDs (partial/seeded rows) so owned nodes still
  // render in Mine — sequential IDs from the soldSlots range.
  for (let i = ids.length; i < owned; i++) {
    ids.push(soldSlots - (owned - i - 1));
  }
  return {
    myOwned: owned,
    ownedTokenIds: ids,
    myListings: Array.isArray(row.myListings) ? row.myListings : [],
  };
}

export const useGenesis = defineStore("genesis", () => {
  const cfg = useGenesisConfig(); // 单向读配置(档位定价);同 free-trial→trial-config 先例
  const initGlobal = hydrateGlobal();
  // 账号维度。boot 期与 app store 同款落 "default";账号确定后由
  // lib/account-scope 的 rebindAccountScopedStores 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const initUser = hydrateUser(boundKey, initGlobal.soldSlots);
  const totalSlots = ref(TOTAL_SLOTS);
  const soldSlots = ref(initGlobal.soldSlots);
  const myOwned = ref(initUser.myOwned);
  const ownedTokenIds = ref<number[]>(initUser.ownedTokenIds);
  const myListings = ref<MyListing[]>(initUser.myListings);
  const nexListed = ref(initGlobal.nexListed);
  const nexListedAt = ref<number | null>(initGlobal.nexListedAt);
  const lastTickTs = ref(0);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        soldSlots: soldSlots.value,
        nexListed: nexListed.value,
        nexListedAt: nexListedAt.value,
      });
    } catch {
      // storage unavailable
    }
    writeAccountRow<GenesisUserData>(ACCOUNTS_KEY, boundKey, {
      myOwned: myOwned.value,
      ownedTokenIds: ownedTokenIds.value,
      myListings: myListings.value,
    });
  }

  /** 账号切换重绑:装载该账号的持仓行,全平台片顺带刷新(多端可能已推进)。
   *  业务变更处处即时 persist,旧账号无需先落盘。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const g = hydrateGlobal();
    soldSlots.value = g.soldSlots;
    nexListed.value = g.nexListed;
    nexListedAt.value = g.nexListedAt;
    const u = hydrateUser(boundKey, g.soldSlots);
    myOwned.value = u.myOwned;
    ownedTokenIds.value = u.ownedTokenIds;
    myListings.value = u.myListings;
  }

  function remaining() {
    return TOTAL_SLOTS - soldSlots.value;
  }
  function soldPct() {
    return soldSlots.value / TOTAL_SLOTS;
  }

  // ── 阶梯定价（单源派生，售罄硬跳价；档位读 live config，运营 G4 可配）──
  const currentTier = computed(() => tierForSold(cfg.config.tiers, soldSlots.value));
  /** 当前档单价。兼容旧读法 `genesis.unitPriceUSDT`（原为固定 $9,999，现随档位）。 */
  const unitPriceUSDT = computed(() => currentTier.value.priceUSDT);
  /** 某档剩余席位（售罄档 = 0）。 */
  function tierRemaining(id: GenesisTier["id"]): number {
    const tier = cfg.config.tiers.find((t) => t.id === id);
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

  // 邀请码核销为 per-user 凭证 → 落 app.setGenesisInviteCode(随 account-cloud
  // 快照按账号走);genesis store 只保留全平台市场态(soldSlots/nexListed),
  // 设备级存 per-user 凭证会跨账号继承 → 资格门旁路(审计 P1)。

  function purchase(
    n: number,
    tokenIds?: number[],
  ): { ok: boolean; cost: number; reason?: "sold-out" | "cap" } {
    const rem = remaining();
    if (n > rem) return { ok: false, cost: 0, reason: "sold-out" };
    // 单人限购守卫（单源 L4：任何调用方自动继承；运营可配 G4 perUserCap）。
    if (myOwned.value + n > GENESIS_ELIGIBILITY.perUserCap) return { ok: false, cost: 0, reason: "cap" };
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

  /**
   * 二级市场承接:买入一个**已存在**的 token（转让,非铸造）。
   * 🔴 不动 soldSlots（该 token 早已计入一级「已铸」+ 派生档价）、不走售罄门 —— 二级承接
   * 与一级供应无关。已持有该 token 则 no-op 返 false（调用方须退款）。
   * 🔴 资格门契约（FEAT-GEN08 appliesTo=both）:资格判定需跨 store ctx,由**调用组合层**
   * 过 useGenesisEligibility 后才可调本 action（现唯一调用方 marketplace.handleBuy 已拦,
   * verify gen_gate 哨兵护）;新增调用方必须复刻该门。本层只守 perUserCap。
   * 真后台 = POST /api/genesis/secondary/fulfill（原子:校验挂单+资格→扣买家→贷卖家扣版税→转 token）。
   */
  function acquireSecondary(tokenId: number): boolean {
    if (ownedTokenIds.value.includes(tokenId)) return false;
    // 单人限购同样约束二级承接（持有增长的另一唯一入口）。
    if (myOwned.value + 1 > GENESIS_ELIGIBILITY.perUserCap) return false;
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
    purchase, listNode, cancelListing, acquireSecondary, tickSales, bindAccount,
  };
});
