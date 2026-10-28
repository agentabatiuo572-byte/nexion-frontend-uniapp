import { defineStore } from "pinia";
import { ref } from "vue";
import { remoteApiEnabled, vRankApi } from "@/api/runtime";
import type { CanonicalVRankLadder, CanonicalVRankState } from "@/api/v-rank-api";
import { asApiError } from "@/api/errors";
import { createRemoteAccountEpoch, type RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { normalizeAccountKey } from "@/store/account-cloud";
import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";
import { captureRuntimeRevision, isCurrentRuntimeRevision, type RuntimeRevisionScope } from "@/api/order-api";

/**
 * Ported from Nexion-prototype/lib/v3/v-rank.ts (zustand persist → Pinia + uni storage).
 * ⚠️ MOCK-ONLY V_RANKS table (13-tier ladder, conditions + bonuses + prizes).
 * Production: GET /api/config/v-ranks returns server-authoritative ladder.
 * Promotion judging (nextRankProgress / nextRankGap) is preview-only; server is
 * the sole canonical authority for V-rank promotion (PRD §13.2).
 *
 * V0→V12 13 阶,每升一阶解锁 unilevel 深度 +1 / 平级奖(V3+) / 领导池权重 / 培育奖 NEX。
 * 心理设计:V0→V3 易("上钩"),V3→V6 拼命,V7+ 画大饼,V12 永远没人到。
 * 奖励为可配 NEX(cultivationBonus);实物奖品已删(与运营后台 F1 同步,2026-06)。
 */

export type VRank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface VRankConditions {
  selfComputePoints?: number;        // 自买设备累计
  directRefs?: number;        // 直推数
  teamComputePoints?: number;     // 团队总业绩
  vDownlines?: Partial<Record<VRank, number>>; // 下面需要 N 个 V 级
}

export interface VRankDef {
  v: VRank;
  title: string;              // 英文头衔
  cnTitle: string;            // 中文头衔
  conditions: VRankConditions;
  directBonus: number;        // L1 直推奖比例
  unilevelDepth: number;      // unilevel 覆盖深度 (1=只有L1, 7=L1-L7)
  peerBonus: number;          // 平级奖比例
  leadershipVotes: number;    // 领导池票数(单源,与 leadership-pool.ts V_VOTES 一致)
  cultivationBonus: number;   // 培育至此 V,上线拿 NEX
  rewards: VRankReward[];     // F1 权威奖励投影；只展示，不触发派发
}

export interface MonetaryVRankReward {
  type: "USDT" | "NEX";
  amount: number;
  voucherId?: string;
  skuId?: string;
  customLabel?: string;
}

export interface EntitlementVRankReward {
  type: "VOUCHER" | "SKU" | "CUSTOM";
  amount?: number;
  voucherId?: string;
  skuId?: string;
  customLabel?: string;
  displayName?: string;
}

export type VRankReward = MonetaryVRankReward | EntitlementVRankReward;

export const V_RANKS: VRankDef[] = [
  {
    v: 0, title: "Cadet", cnTitle: "学员",
    conditions: {}, directBonus: 0.05, unilevelDepth: 1,
    peerBonus: 0, leadershipVotes: 0,
    cultivationBonus: 0, rewards: [],
  },
  {
    v: 1, title: "Pilot", cnTitle: "飞行员",
    conditions: { selfComputePoints: 2990, directRefs: 3 },
    directBonus: 0.10, unilevelDepth: 2,
    peerBonus: 0, leadershipVotes: 0,
    cultivationBonus: 500, rewards: [],
  },
  {
    v: 2, title: "Operator", cnTitle: "操作员",
    conditions: { teamComputePoints: 50_000 },
    directBonus: 0.10, unilevelDepth: 3,
    peerBonus: 0, leadershipVotes: 0,
    cultivationBonus: 2000, rewards: [],
  },
  {
    v: 3, title: "Captain", cnTitle: "舰长",
    conditions: { teamComputePoints: 200_000, vDownlines: { 1: 2 } },
    directBonus: 0.10, unilevelDepth: 4,
    peerBonus: 0.05, leadershipVotes: 1,
    cultivationBonus: 10_000, rewards: [],
  },
  {
    v: 4, title: "Commander", cnTitle: "指挥官",
    conditions: { teamComputePoints: 500_000, vDownlines: { 2: 3 } },
    directBonus: 0.10, unilevelDepth: 5,
    peerBonus: 0.05, leadershipVotes: 2,
    cultivationBonus: 50_000, rewards: [],
  },
  {
    v: 5, title: "Wing Leader", cnTitle: "翼领",
    conditions: { teamComputePoints: 1_500_000, vDownlines: { 3: 4 } },
    directBonus: 0.10, unilevelDepth: 6,
    peerBonus: 0.05, leadershipVotes: 4,
    cultivationBonus: 200_000, rewards: [],
  },
  {
    v: 6, title: "Squadron", cnTitle: "中队长",
    conditions: { teamComputePoints: 5_000_000, vDownlines: { 4: 5 } },
    directBonus: 0.10, unilevelDepth: 7,
    peerBonus: 0.05, leadershipVotes: 8,
    cultivationBonus: 800_000, rewards: [],
  },
  {
    v: 7, title: "Fleet Cmdr", cnTitle: "舰队司令",
    conditions: { teamComputePoints: 10_000_000, vDownlines: { 5: 6 } },
    directBonus: 0.10, unilevelDepth: 8,
    peerBonus: 0.05, leadershipVotes: 16,
    cultivationBonus: 3_200_000, rewards: [],
  },
  {
    v: 8, title: "Star Admiral", cnTitle: "星上将",
    conditions: { teamComputePoints: 30_000_000, vDownlines: { 6: 7 } },
    directBonus: 0.10, unilevelDepth: 9,
    peerBonus: 0.05, leadershipVotes: 32,
    cultivationBonus: 10_000_000, rewards: [],
  },
];

/**
 * Data fields the pure progress functions read. The Pinia store is structurally
 * compatible (exposes these as unwrapped properties), so `nextRankProgress(store)`
 * / `nextRankGap(store)` work directly.
 */
export interface VRankData {
  myRank: VRank;
  selfComputePoints: number;
  directRefs: number;
  teamComputePoints: number;
  vDownlineCounts: Partial<Record<VRank, number>>;
}

export type VRankProgressPatch = Partial<Omit<VRankData, "myRank">>;

const EMPTY_V_RANK: VRankDef = {
  v: 0, title: "", cnTitle: "", conditions: {}, directBonus: 0,
  unilevelDepth: 0, peerBonus: 0, leadershipVotes: 0, cultivationBonus: 0, rewards: [],
};

function canonicalRank(row: Awaited<ReturnType<typeof vRankApi.ladder>>["ranks"][number]): VRankDef {
  const conditions: VRankConditions = {};
  if (row.selfComputePoints !== undefined) conditions.selfComputePoints = row.selfComputePoints;
  if (row.directRefs !== undefined) conditions.directRefs = row.directRefs;
  if (row.teamComputePoints !== undefined) conditions.teamComputePoints = row.teamComputePoints;
  if (row.requiredDownlineRank !== undefined && row.requiredDownlineCount !== undefined) {
    conditions.vDownlines = { [row.requiredDownlineRank as VRank]: row.requiredDownlineCount };
  }
  return {
    v: row.v as VRank, title: row.title, cnTitle: row.cnTitle, conditions,
    directBonus: row.directBonus, unilevelDepth: row.unilevelDepth, peerBonus: row.peerBonus,
    leadershipVotes: row.leadershipVotes, cultivationBonus: row.cultivationBonus, rewards: row.rewards,
  };
}

// 等级是账号资产:per-account 行表(P2-8 设备级泄漏修复)。旧设备级单键
// "nexgrid-v-rank-v1" 不迁移 —— 存量无账号归属,迁给任何账号都是臆断,就地废弃。
const ACCOUNTS_KEY = "nexgrid-v-rank-accounts-v1"; // { [accountKey]: VRankData }

const DEFAULT_V_RANK: VRankData = {
  // 新账号 seed 人设:V2 Operator(刚到,正冲 V3)—— 与 account-cloud
  // createSeedSnapshot 的统一 seed 口径一致。
  myRank: 2,
  selfComputePoints: 11_980,      // S1 + Pro 已买
  directRefs: 5,
  teamComputePoints: 52_400,    // 刚过 V2 门槛
  vDownlineCounts: { 1: 3 }, // 下面有 3 个 V1
};

type VRankRemoteRequest = RemoteAccountRequest;

function captureVRankRequest(epoch: ReturnType<typeof createRemoteAccountEpoch>): VRankRemoteRequest {
  return epoch.snapshot();
}

function hydrate(accountKey: string): VRankData {
  const row = readAccountRow<Partial<VRankData>>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.myRank === "number") {
    return { ...DEFAULT_V_RANK, ...row };
  }
  return { ...DEFAULT_V_RANK };
}

export const useVRank = defineStore("vRank", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 的
  // rebindAccountScopedStores 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const init = remoteApiEnabled ? { myRank: 0 as VRank, selfComputePoints: 0, directRefs: 0, teamComputePoints: 0, vDownlineCounts: {} } : hydrate(boundKey);
  const myRank = ref<VRank>(init.myRank);
  const selfComputePoints = ref(init.selfComputePoints);
  const directRefs = ref(init.directRefs);
  const teamComputePoints = ref(init.teamComputePoints);
  const vDownlineCounts = ref<Partial<Record<VRank, number>>>(init.vDownlineCounts);
  const ladder = ref<VRankDef[]>(remoteApiEnabled ? [] : V_RANKS);
  // 服务端能力位:某类收益今天是否真的会派发(与佣金指南同源)。等级阶梯里的
  // peerBonus 是「配置比例」,不是「已生效权益」—— 渲染时必须靠这个位区分(#79)。
  // 本地(mock)模式没有服务端能力位,按「会派发」处理,与 V_RANKS 的展示一致。
  const capabilities = ref<{ peer: boolean; genesis: boolean }>({ peer: true, genesis: true });
  const prizeName = ref(remoteApiEnabled ? "" : "UVEL V-Rank");
  const remoteReady = ref(!remoteApiEnabled);
  const remoteError = ref<string | null>(null);
  const remoteAccountEpoch = createRemoteAccountEpoch(boundKey);

  function clearRemoteFacts(): void {
    myRank.value = 0;
    selfComputePoints.value = 0;
    directRefs.value = 0;
    teamComputePoints.value = 0;
    vDownlineCounts.value = {};
    ladder.value = [];
    capabilities.value = { peer: false, genesis: false };
    prizeName.value = "";
    remoteReady.value = false;
  }

  function persist() {
    if (remoteApiEnabled) return;
    writeAccountRow<VRankData>(ACCOUNTS_KEY, boundKey, {
      myRank: myRank.value,
      selfComputePoints: selfComputePoints.value,
      directRefs: directRefs.value,
      teamComputePoints: teamComputePoints.value,
      vDownlineCounts: vDownlineCounts.value,
    });
  }

  /** 账号切换重绑:装载该账号的等级行(变更处处即时 persist,旧账号无需先落盘)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    if (remoteApiEnabled) {
      remoteAccountEpoch.bind(boundKey);
      clearRemoteFacts();
      void refreshCanonicalVRank(captureVRankRequest(remoteAccountEpoch));
      return;
    }
    const next = hydrate(boundKey);
    myRank.value = next.myRank;
    selfComputePoints.value = next.selfComputePoints;
    directRefs.value = next.directRefs;
    teamComputePoints.value = next.teamComputePoints;
    vDownlineCounts.value = next.vDownlineCounts;
  }

  let refreshGeneration = 0;
  // H5 cold restore enters the page before the bearer is bound to this account.
  // That local precondition must not surface as a server-unavailable error the
  // user has to clear by hand: wait (bounded) for the session to match, then
  // read, and retry once when the first attempt fails transiently.
  const SESSION_BIND_RETRY_MILLISECONDS = 500;
  async function refreshCanonicalVRank(
    request: VRankRemoteRequest = captureVRankRequest(remoteAccountEpoch),
    runScope: RuntimeRevisionScope = captureRuntimeRevision(),
  ) {
    if (!remoteApiEnabled) return;
    const generation = ++refreshGeneration;
    const isCurrent = () => generation === refreshGeneration
      && remoteAccountEpoch.isCurrent(request)
      && isCurrentRuntimeRevision(runScope);
    if (isCurrent()) {
      remoteReady.value = false;
      remoteError.value = null;
    }
    const apply = (remoteLadder: CanonicalVRankLadder, remoteCurrent: CanonicalVRankState) => {
      ladder.value = remoteLadder.ranks.map(canonicalRank);
      prizeName.value = remoteLadder.prizeName;
      capabilities.value = remoteLadder.capabilities;
      myRank.value = Number(remoteCurrent.rankCode.slice(1)) as VRank;
      selfComputePoints.value = remoteCurrent.progress.selfComputePoints;
      directRefs.value = remoteCurrent.progress.directRefs;
      teamComputePoints.value = remoteCurrent.progress.teamComputePoints;
      vDownlineCounts.value = Object.fromEntries(
        Object.entries(remoteCurrent.progress.vDownlineCounts).map(([rank, count]) => [Number(rank) as VRank, count]),
      ) as Partial<Record<VRank, number>>;
      remoteReady.value = true;
      remoteError.value = null;
    };
    try {
      const [remoteLadder, remoteCurrent] = await Promise.all([vRankApi.ladder(), vRankApi.current()]);
      if (!isCurrent()) return;
      apply(remoteLadder, remoteCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      // H5 cold restore enters this page before the bearer is bound to the
      // account; the request layer reports that local precondition as an auth
      // failure. One bounded retry keeps a recoverable first-request failure
      // from being shown as a server error the user must clear by hand.
      if (asApiError(error).kind === "auth") {
        await new Promise<void>((resolve) => setTimeout(resolve, SESSION_BIND_RETRY_MILLISECONDS));
        if (!isCurrent()) return;
        try {
          const [remoteLadder, remoteCurrent] = await Promise.all([vRankApi.ladder(), vRankApi.current()]);
          if (!isCurrent()) return;
          apply(remoteLadder, remoteCurrent);
          return;
        } catch {
          if (!isCurrent()) return;
        }
      }
      clearRemoteFacts();
      remoteError.value = "V_RANK_REMOTE_AUTHORITY_UNAVAILABLE";
    }
  }

  function setMyRank(v: VRank) {
    if (remoteApiEnabled) return;
    myRank.value = v;
    persist();
  }
  function setProgress(p: VRankProgressPatch) {
    if (remoteApiEnabled) return;
    if (p.selfComputePoints !== undefined) selfComputePoints.value = p.selfComputePoints;
    if (p.directRefs !== undefined) directRefs.value = p.directRefs;
    if (p.teamComputePoints !== undefined) teamComputePoints.value = p.teamComputePoints;
    if (p.vDownlineCounts !== undefined) vDownlineCounts.value = p.vDownlineCounts;
    persist();
  }

  return {
    myRank, selfComputePoints, directRefs, teamComputePoints, vDownlineCounts, ladder, prizeName,
    capabilities,
    remoteReady, remoteError,
    setMyRank, setProgress, bindAccount, refreshCanonicalVRank,
  };
});

/**
 * 一条到下一阶的缺口。
 *
 * 🔴 返回**结构**不返回句子:原来这里直接拼英文(`Self-buy $299 more`),两个消费点原样渲染,
 * 于是中文 / 越南语界面直出英文,而 `t.rank.need*` 四条三语文案早写好却是死键(2026-08-17
 * 独立验收抓到)。同文件下面的 `PrimaryGap` 早就是这个形状 —— 措辞归 UI 层
 * (`src/lib/v-rank-copy.ts` 的 `rankGapText`),store 只给事实。
 */
export type RankGap =
  | { kind: "selfComputePoints"; amount: number }
  | { kind: "directRefs"; n: number }
  | { kind: "teamComputePoints"; amount: number }
  // 只给档位号,头衔名由 copy 层按语言解析(`lib/v-rank-copy` 的 rankTitle)——
  // store 存一份英文 title 就等于把「中文界面显示什么」定死在数据层。
  | { kind: "vDownlines"; n: number; vLevel: number };

/** 计算到下一阶的进度(0-1) */
export function nextRankProgress(state: VRankData, ladder: VRankDef[] = []): {
  next: VRankDef | null;
  progressPct: number;
  missing: RankGap[];
} {
  const next = ladder[state.myRank + 1];
  if (!next) return { next: null, progressPct: 1, missing: [] };
  const c = next.conditions;
  const missing: RankGap[] = [];
  const checks: number[] = [];

  if (c.selfComputePoints) {
    checks.push(Math.min(1, state.selfComputePoints / c.selfComputePoints));
    if (state.selfComputePoints < c.selfComputePoints) {
      missing.push({ kind: "selfComputePoints", amount: c.selfComputePoints - state.selfComputePoints });
    }
  }
  if (c.directRefs) {
    checks.push(Math.min(1, state.directRefs / c.directRefs));
    if (state.directRefs < c.directRefs) {
      missing.push({ kind: "directRefs", n: c.directRefs - state.directRefs });
    }
  }
  if (c.teamComputePoints) {
    checks.push(Math.min(1, state.teamComputePoints / c.teamComputePoints));
    if (state.teamComputePoints < c.teamComputePoints) {
      missing.push({ kind: "teamComputePoints", amount: c.teamComputePoints - state.teamComputePoints });
    }
  }
  if (c.vDownlines) {
    for (const [v, n] of Object.entries(c.vDownlines)) {
      const have = state.vDownlineCounts[Number(v) as VRank] ?? 0;
      checks.push(Math.min(1, have / n));
      if (have < n) missing.push({ kind: "vDownlines", n: n - have, vLevel: Number(v) });
    }
  }

  const progressPct = checks.length
    ? checks.reduce((a, b) => a + b, 0) / checks.length
    : 1;
  return { next, progressPct, missing };
}

export type PrimaryGap =
  | { kind: "teamComputePoints"; remaining: number; progress: number }
  | { kind: "selfComputePoints"; remaining: number; progress: number }
  | { kind: "directRefs"; remaining: number; progress: number }
  | { kind: "vDownlines"; remaining: number; progress: number; vLevel: VRank };

export type PerkUnlock =
  | { kind: "peerBonusUnlock"; rate: number }
  | { kind: "leadershipUnlock"; votes: number }
  | { kind: "cultivationJump"; from: number; to: number }
  | { kind: "directBonusUp"; from: number; to: number }
  | { kind: "unilevelDepthUp"; from: number; to: number };

export interface NextRankGapInfo {
  next: VRankDef | null;
  progressPct: number;
  primaryGap: PrimaryGap | null;
  unmetCount: number;
  topUnlocks: PerkUnlock[];
}

// Emotional weight per perk kind. Higher = surfaced sooner in the UI.
const PERK_WEIGHT: Record<PerkUnlock["kind"], number> = {
  peerBonusUnlock: 100,
  leadershipUnlock: 95,
  cultivationJump: 70,
  directBonusUp: 60,
  unilevelDepthUp: 30,
};

const TOP_UNLOCKS_CAP = 2; // UI keeps perk line single-line at 414w mobile

export function nextRankGap(state: VRankData, ladder: VRankDef[] = []): NextRankGapInfo {
  const current = ladder[state.myRank] ?? EMPTY_V_RANK;
  const next = ladder[state.myRank + 1];
  if (!next) {
    return {
      next: null,
      progressPct: 1,
      primaryGap: null,
      unmetCount: 0,
      topUnlocks: [],
    };
  }

  const c = next.conditions;
  const gaps: PrimaryGap[] = [];
  const checks: number[] = [];

  if (c.selfComputePoints) {
    const progress = Math.min(1, state.selfComputePoints / c.selfComputePoints);
    checks.push(progress);
    if (state.selfComputePoints < c.selfComputePoints) {
      gaps.push({ kind: "selfComputePoints", remaining: c.selfComputePoints - state.selfComputePoints, progress });
    }
  }
  if (c.directRefs) {
    const progress = Math.min(1, state.directRefs / c.directRefs);
    checks.push(progress);
    if (state.directRefs < c.directRefs) {
      gaps.push({ kind: "directRefs", remaining: c.directRefs - state.directRefs, progress });
    }
  }
  if (c.teamComputePoints) {
    const progress = Math.min(1, state.teamComputePoints / c.teamComputePoints);
    checks.push(progress);
    if (state.teamComputePoints < c.teamComputePoints) {
      gaps.push({ kind: "teamComputePoints", remaining: c.teamComputePoints - state.teamComputePoints, progress });
    }
  }
  if (c.vDownlines) {
    for (const [v, n] of Object.entries(c.vDownlines)) {
      const vLevel = Number(v) as VRank;
      const have = state.vDownlineCounts[vLevel] ?? 0;
      const progress = Math.min(1, have / n);
      checks.push(progress);
      if (have < n) {
        gaps.push({ kind: "vDownlines", remaining: n - have, progress, vLevel });
      }
    }
  }

  const progressPct = checks.length
    ? checks.reduce((a, b) => a + b, 0) / checks.length
    : 1;

  const primaryGap = gaps.length
    ? gaps.reduce((worst, g) => (g.progress < worst.progress ? g : worst))
    : null;

  const unlocks: PerkUnlock[] = [];
  if (current.peerBonus === 0 && next.peerBonus > 0) {
    unlocks.push({ kind: "peerBonusUnlock", rate: next.peerBonus });
  }
  if (current.leadershipVotes === 0 && next.leadershipVotes > 0) {
    unlocks.push({ kind: "leadershipUnlock", votes: next.leadershipVotes });
  }
  const cultivationNewUnlock = current.cultivationBonus === 0 && next.cultivationBonus > 0;
  const cultivationBigJump =
    current.cultivationBonus > 0 && next.cultivationBonus > current.cultivationBonus * 2;
  if (cultivationNewUnlock || cultivationBigJump) {
    unlocks.push({ kind: "cultivationJump", from: current.cultivationBonus, to: next.cultivationBonus });
  }
  if (next.directBonus > current.directBonus) {
    unlocks.push({ kind: "directBonusUp", from: current.directBonus, to: next.directBonus });
  }
  if (next.unilevelDepth > current.unilevelDepth && next.unilevelDepth < 90) {
    unlocks.push({ kind: "unilevelDepthUp", from: current.unilevelDepth, to: next.unilevelDepth });
  }

  const topUnlocks = [...unlocks]
    .sort((a, b) => PERK_WEIGHT[b.kind] - PERK_WEIGHT[a.kind])
    .slice(0, TOP_UNLOCKS_CAP);

  return { next, progressPct, primaryGap, unmetCount: gaps.length, topUnlocks };
}
