import type { WithdrawalRiskRoute } from "./config-types";

// 提现风控路由**纯逻辑**(SPEC-7 K3 + FEAT-WD01a 小额免审)。
// 零依赖(vue / pinia / uni / 其它 store 均不引),与 fx-core / deposits-core /
// wallet-pairing-core 同一分层惯例:core = 判定,store = 取数接线。
//
// 🔴 为什么必须抽出来(2026-07-31 熔断后的结论):
// 「小额免审只免两道冷启动闸、永不越过风控裁决」是一条**行为**约束。
// 早先用源码结构哨兵(检查代码长什么样)去守它,被独立验收连续攻破四种绕法 ——
// 其中「把闸的升级动作搬进免审块」这种改法,所有被 pin 的文本一字未动而风控闸真被免掉。
// 词法检查永远覆盖不了控制流可达性;唯一守得住的是**直接测行为**。
// 抽成纯函数后,scripts/selfcheck-fastlane.mjs 可以真跑各种组合断言路由结果,
// 任何绕法只要改变了行为就会被抓到 —— 而不改变行为的"绕法"本就不是漏洞。

const ROUTE_SEVERITY: Record<WithdrawalRiskRoute, number> = {
  pass: 0,
  delay: 1,
  manual: 2,
  freeze: 3,
  reject: 4,
};

/**
 * 🔴 未知路由值一律按 **manual** 计,不能当「不存在」。
 *
 * 原写法 `ROUTE_SEVERITY[b] > ROUTE_SEVERITY[a]` 在 b 取不到时是 `undefined > n` = false,
 * 于是整道闸静默放行(fail-open)。而 withdrawRules 在 PROD 来自 `GET /api/config/platform`,
 * 是不可信边界 —— 后台下发个大小写不同 / 带空格 / 改名的枚举,共用地址闸就没了,
 * 钱按 pass 建单自动出账,而 riskReasons 里还记着 shared-address(信号命中却什么都没发生)。
 * 坏配置的正确方向是**转人工**,不是放行。
 */
/**
 * 🔴 归一化**值本身**,不是只改比较权重。
 * 上一版只在比大小时兜底,worseRoute 仍把脏值原样返回 —— 而下游全是
 * `=== "reject"` / `=== "freeze"` 这类等值判断,一个都不命中:
 * 钱照扣、单据落进 pass 车道、到账推进又因路由不是 pass 而永不推进 = 钱卡死。
 * 对抗证伪实测:修前是静默放行,那一版更糟。坏配置的正确落点是**真的变成 manual**。
 */
function normalizeRoute(r: WithdrawalRiskRoute): WithdrawalRiskRoute {
  return r in ROUTE_SEVERITY ? r : "manual";
}

export function worseRoute(a: WithdrawalRiskRoute, b: WithdrawalRiskRoute): WithdrawalRiskRoute {
  const x = normalizeRoute(a);
  const y = normalizeRoute(b);
  return ROUTE_SEVERITY[y] > ROUTE_SEVERITY[x] ? y : x;
}

/**
 * 数值型风控参数的边界兜底:非法值回落到**保守**默认,不是回落到「关闸」。
 * 与网络费三件套的 feeConfigValid 同一原则(在信任边界校验外部数据)。
 */
export function safeNumber(v: number, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 判定所需的全部外部事实。调用方(store)负责从各 store 取齐后传入。 */
export interface WithdrawalRiskInput {
  /** 换绑后 24h 冻结窗内 */
  rebindFrozen: boolean;
  /** 账户所在风险簇状态 */
  clusterStatus: "clear" | "watch" | "flagged" | "frozen" | "released";
  /** 风险分(0–1) */
  clusterScore: number;
  /** 风险分达此线即人工 */
  freezeSuggestThreshold: number;
  /** 提现地址是否被别的账户用过 */
  addressReusedByOther: boolean;
  /** 地址为空/未填时为 true —— 地址相关两道闸整体跳过 */
  addressBlank: boolean;
  /** 提现地址首见未满 hold 时长(含"从未见过") */
  newAddressWithinHold: boolean;
  /** 该账户此前是否提现过 */
  hasWithdrawn: boolean;
  /** 绑定账龄未满 7 天 且 金额达大额线 */
  youngBindingLargeAmount: boolean;
  /** 用户请求金额;undefined = 还没输 */
  requestedUsdt: number | undefined;
  /** 当前可提余额 */
  withdrawableUsdt: number;
  // ── 配置(后台 D5 可配)──
  smallAmountThresholdUsd: number;
  minWithdrawableUsdt: number;
  sameAddressRoute: WithdrawalRiskRoute;
  firstWithdrawalManual: boolean;
  /** FEAT-WD01b:今日已提笔数 */
  todayWithdrawCount: number;
  /** FEAT-WD01b:每日笔数上限 */
  dailyWithdrawLimitCount: number;
}

export interface WithdrawalRiskDecision {
  route: WithdrawalRiskRoute;
  riskReasons: string[];
  fastLaneApplied: boolean;
  waivedGates: string[];
  canSubmit: boolean;
  /** FEAT-WD01b:是否因今日笔数用完而被拦(用于文案与下次可提时间) */
  dailyLimitReached: boolean;
}

/**
 * 外壳从各 store 拿到的**原始事实**。与 WithdrawalRiskInput 的区别:
 * 这里是"没加工过的",入参是"加工后的判定事实"。
 *
 * 🔴 为什么连取数也要抽出来(2026-07-31 第 3 轮复验结论):
 * 只把判定抽成纯函数时,缝隙**搬到了入参边界** —— 外壳可以对纯函数撒谎
 * (恒传 addressReusedByOther:false / rebindFrozen:false,或只在小额时隐瞒共用地址),
 * 判定逻辑再对也没用,而只测判定的哨兵完全看不见。独立验收实测 5 种撒谎注入全绿,
 * 其中 4 种端到端证明是真免闸(含换绑冻结期直接可提)。
 * 把"原始事实 → 判定事实"这一步也变成纯函数后,外壳只剩「调 store 拿值」这一件事,
 * 没有可藏逻辑的地方,行为哨兵也能覆盖到这一层。
 */
export interface WithdrawalRawFacts {
  now: number;
  freezeUntil: number | undefined;
  clusterStatus: WithdrawalRiskInput["clusterStatus"];
  clusterScore: number;
  freezeSuggestThreshold: number;
  /** 地址原文(未 trim) */
  address: string;
  /** 该地址是否被别的账户登记过 */
  addressSeenByOtherAccount: boolean;
  /** 本账户该地址的首见时间;undefined = 从未见过 */
  ownAddressFirstSeenAt: number | undefined;
  newAddressHoldHours: number;
  hasWithdrawn: boolean;
  /** 当前绑定的生效时间 */
  bindingVerifiedAt: number | undefined;
  newAddressAgeDays: number;
  largeAmountUsdt: number;
  requestedUsdt: number | undefined;
  withdrawableUsdt: number;
  smallAmountThresholdUsd: number;
  minWithdrawableUsdt: number;
  sameAddressRoute: WithdrawalRiskRoute;
  firstWithdrawalManual: boolean;
  todayWithdrawCount: number;
  dailyWithdrawLimitCount: number;
}

/** 原始事实 → 判定事实。纯函数,外壳不得在此之外自行加工。 */
export function toRiskInput(f: WithdrawalRawFacts): WithdrawalRiskInput {
  const addressBlank = f.address.trim().length === 0;
  return {
    rebindFrozen: f.freezeUntil !== undefined && f.now < f.freezeUntil,
    clusterStatus: f.clusterStatus,
    clusterScore: f.clusterScore,
    freezeSuggestThreshold: f.freezeSuggestThreshold,
    addressBlank,
    // 地址为空时两个地址维度一律置 false —— 判定层也有 addressBlank 兜底,双保险。
    addressReusedByOther: addressBlank ? false : f.addressSeenByOtherAccount,
    newAddressWithinHold: addressBlank
      ? false
      : f.ownAddressFirstSeenAt === undefined ||
        f.now - f.ownAddressFirstSeenAt < f.newAddressHoldHours * 3600 * 1000,
    hasWithdrawn: f.hasWithdrawn,
    youngBindingLargeAmount:
      f.requestedUsdt !== undefined &&
      f.bindingVerifiedAt !== undefined &&
      f.now - f.bindingVerifiedAt < f.newAddressAgeDays * 24 * 3600 * 1000 &&
      f.requestedUsdt >= f.largeAmountUsdt,
    requestedUsdt: f.requestedUsdt,
    withdrawableUsdt: f.withdrawableUsdt,
    smallAmountThresholdUsd: f.smallAmountThresholdUsd,
    minWithdrawableUsdt: f.minWithdrawableUsdt,
    sameAddressRoute: f.sameAddressRoute,
    firstWithdrawalManual: f.firstWithdrawalManual,
    todayWithdrawCount: f.todayWithdrawCount,
    dailyWithdrawLimitCount: f.dailyWithdrawLimitCount,
  };
}

/** 端到端:原始事实 → 路由决策。 */
export function decideFromRawFacts(f: WithdrawalRawFacts): WithdrawalRiskDecision {
  return decideWithdrawalRoute(toRiskInput(f));
}

// ── 外壳直传层 ────────────────────────────────────────────────
// 🔴 第 4 轮复验结论:每把逻辑往 core 收一层,**外面那层就变成新攻击面**。
// 独立验收实测 S4 = 原 Bypass C「一字未改搬到外壳」,五个外壳注入全绿且全是真免闸。
// 追着缝隙跑没有尽头,除非外壳里**一个表达式都不剩**。
// 故这里再收一层:外壳只把 store 的**原始对象**丢进来,取字段、判空、找元素、
// 遍历比对全在 core 做。外壳退化成「把几个 store 对象转发过来」,没有可注入的地方。

/** store 原始对象(外壳原样转发,不做任何加工)。 */
export interface WithdrawalStoreSnapshot {
  now: number;
  /** 当前生效的提现地址绑定;未绑定为 undefined */
  binding: { freezeUntil?: number; verifiedAt?: number } | null | undefined;
  /** 本账户的风险档案 */
  ownRecord:
    | { hasWithdrawn?: boolean; withdrawAddresses: Array<{ hash: string; firstSeenAt: number }> }
    | null
    | undefined;
  /** 全部账户的风险档案(用于查地址跨账户复用) */
  allRecords: Array<{ accountKey: string; withdrawAddresses: Array<{ hash: string }> }>;
  accountKey: string;
  /** 本次提现地址的哈希;地址为空时传空串 */
  addressHash: string;
  address: string;
  cluster: { status: WithdrawalRiskInput["clusterStatus"]; score: number };
  freezeSuggestThreshold: number;
  newAddressHoldHours: number;
  newAddressAgeDays: number;
  largeAmountUsdt: number;
  requestedUsdt: number | undefined;
  withdrawableUsdt: number;
  smallAmountThresholdUsd: number;
  minWithdrawableUsdt: number;
  sameAddressRoute: WithdrawalRiskRoute;
  firstWithdrawalManual: boolean;
  /** 本账户落盘的当日提现计数器(跨日判定在 core 做,外壳只转发) */
  withdrawCounter: { dayIndex: number; count: number } | null | undefined;
  dailyWithdrawLimitCount: number;
}

/** store 快照 → 原始事实。取字段/判空/查找/遍历都在这里,外壳不许自己做。 */
export function toRawFacts(s: WithdrawalStoreSnapshot): WithdrawalRawFacts {
  // 以**地址原文**判空,不以 hash 判 —— 空串照样能算出一个 hash,拿 hash 判会把
  // 「没填地址」误判成「填了个地址」,两道地址闸就会误触发。
  const hasAddress = s.address.trim().length > 0;
  return {
    now: s.now,
    freezeUntil: s.binding?.freezeUntil,
    clusterStatus: s.cluster.status,
    clusterScore: s.cluster.score,
    freezeSuggestThreshold: s.freezeSuggestThreshold,
    address: s.address,
    addressSeenByOtherAccount: hasAddress
      ? s.allRecords.some(
          (r) => r.accountKey !== s.accountKey && r.withdrawAddresses.some((a) => a.hash === s.addressHash),
        )
      : false,
    ownAddressFirstSeenAt: hasAddress
      ? s.ownRecord?.withdrawAddresses.find((a) => a.hash === s.addressHash)?.firstSeenAt
      : undefined,
    newAddressHoldHours: s.newAddressHoldHours,
    hasWithdrawn: s.ownRecord?.hasWithdrawn ?? false,
    bindingVerifiedAt: s.binding?.verifiedAt,
    newAddressAgeDays: s.newAddressAgeDays,
    largeAmountUsdt: s.largeAmountUsdt,
    requestedUsdt: s.requestedUsdt,
    withdrawableUsdt: s.withdrawableUsdt,
    smallAmountThresholdUsd: s.smallAmountThresholdUsd,
    minWithdrawableUsdt: s.minWithdrawableUsdt,
    sameAddressRoute: s.sameAddressRoute,
    firstWithdrawalManual: s.firstWithdrawalManual,
    todayWithdrawCount: todayCountFrom(s.withdrawCounter, s.now),
    dailyWithdrawLimitCount: s.dailyWithdrawLimitCount,
  };
}

/** 🔴 外壳唯一该调的入口:store 快照 → 路由决策。全链路都在 core,行为哨兵全覆盖。 */
export function decideFromStores(s: WithdrawalStoreSnapshot): WithdrawalRiskDecision {
  return decideFromRawFacts(toRawFacts(s));
}

// ── FEAT-WD01b 每日提现笔数 ────────────────────────────────
// 🔴 计数与判定从一开始就放纯函数里(第 5 轮教训:留在外壳的逻辑没有哨兵覆盖)。

/**
 * 平台时区偏移(小时)。**越南是权威运营市场**(UTC+7),平台日就按当地自然日切,
 * 「每日一笔」对目标用户才是字面意义上的每日。
 *
 * 🔴 原来写死 UTC 是错的:越南用户的额度在当地早上 7 点重置,中国用户 8 点,
 * 谁的「一天」都不是自己的一天(独立验收 F4 / code review MEDIUM-1 各自实测到)。
 * PROD:服务端按平台时区裁决,client 这份只用于预判与文案。
 */
export const PLATFORM_UTC_OFFSET_HOURS = 7;
const PLATFORM_OFFSET_MS = PLATFORM_UTC_OFFSET_HOURS * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** 平台时区下的自然日序号。 */
export function platformDayIndex(ts: number): number {
  return Math.floor((ts + PLATFORM_OFFSET_MS) / DAY_MS);
}

/** 下一个平台自然日 0 点(UTC 时间戳)。文案按用户本地时钟展示这一刻。 */
export function nextDayResetAt(ts: number): number {
  return (platformDayIndex(ts) + 1) * DAY_MS - PLATFORM_OFFSET_MS;
}

/**
 * 今日已提笔数。入参是**落盘的**「日序 + 计数」二元组:
 *  - 日序与今天一致 → 返回计数
 *  - 日序是昨天或更早 → 返回 0(跨日自动归零,不需要定时清理任务)
 *  - 从未落盘过 → 0
 *
 * 🔴 用落盘值而不是内存值:并发面(两个标签页同时提交)必须以落盘计数为准,
 * 否则两边都以为「今天只提过 1 笔」而各自放行。
 *
 * 🔴 已驳回 / 已退款的单据**仍然计数** —— 额度按「当天发起过几次」算,
 * 否则「故意提一笔让它被驳回、再提一笔」就能绕过限额。
 */
export function todayCountFrom(
  counter: { dayIndex: number; count: number } | null | undefined,
  now: number,
): number {
  if (!counter) return 0;
  if (counter.dayIndex !== platformDayIndex(now)) return 0;
  // 🔴 消毒必须**对称**:NaN / 负数 / 荒谬大值都是坏数据,三种都得挡。
  // NaN:typeof NaN === "number" 混得过读盘的类型守卫,且 `NaN >= 上限` 恒 false → 额度失效。
  // 荒谬大值(1e9):`1e9 >= 1` 恒 true → 当天提现被锁死。方向相反,同样是坏数据惹的。
  // 一天提现 1 万次已属荒谬 —— 超过就是被篡改或被写坏,按「读不到」处理。
  // (client 计数本就可被本地篡改、PROD 以服务端为准,所以拒绝相信荒谬值不损失任何真防护。)
  if (!Number.isSafeInteger(counter.count)) return 0;
  if (counter.count < 0 || counter.count > MAX_SANE_DAILY_COUNT) return 0;
  return counter.count;
}

/** 计数合理上限。超过即判为坏数据(见 todayCountFrom 的对称消毒)。 */
export const MAX_SANE_DAILY_COUNT = 10_000;

/**
 * 🔴 额度**占用**决策(纯函数)。并发面的正解是「先占后建」而不是「先查后建」:
 * 查与建之间隔着风控评估的异步往返(实测 600ms),两个标签页都能在对方写盘前
 * 读到「还没提过」——独立验收 3 轮 3 中复现,code review 独立指出同一处。
 *
 * 这里返回「准不准 + 占用后的新计数」,由存储层做一次**同步**读-改-写。
 * 残余窗口 = 那次同步读写之间的微秒级间隙(跨浏览器进程理论上仍可交错),
 * 与既有的并发透支门同一量级;真正的原子性只有服务端事务能给,PROD 以服务端为准。
 */
/**
 * 🔴 「今日额度用满没有」的**唯一**判据。上限 ≤0 / 非法(含被下发成字符串)= 运营未配置
 * → 不限制(坏配置不该把提现锁死),但计数照记。
 *
 * 抽成共用谓词是因为它曾有两份实现:一份用 Number.isFinite 严判、一份靠隐式转换,
 * 配置被下发成字符串 "2" 时两份结论**相反** —— 真闸判「不限制」而 UI 判「已达上限」,
 * 追踪页说能提、提现页说不能提。判据只许有一份。
 */
export function isOverDailyCap(used: number, limitCount: number): boolean {
  const capped = Number.isFinite(limitCount) && limitCount > 0;
  return capped && used >= limitCount;
}

export function claimDailySlot(
  counter: { dayIndex: number; count: number } | null | undefined,
  limitCount: number,
  now: number,
): { allowed: boolean; next: { dayIndex: number; count: number } } {
  const today = platformDayIndex(now);
  const used = todayCountFrom(counter, now);
  const allowed = !isOverDailyCap(used, limitCount);
  return { allowed, next: { dayIndex: today, count: allowed ? used + 1 : used } };
}

/**
 * 🔴 占用是否**真的属于我**(写入后回读比对令牌)。
 *
 * 为什么需要这一步:localStorage 的「读-改-写」**跨渲染进程不是原子的**。
 * Chrome 给独立打开的同源标签页分不同渲染进程,写入的传播是异步的 ——
 * 两个标签页在 ~1ms 内会各自读到写入**之前**的值,各自算出「还没提过」而都放行。
 * 独立验收 12 轮 12 中实测复现,「先占后建」只把窗口从 600ms 压到 ~1ms,没有消除它。
 *
 * 破法不是抢更快,而是**不依赖读写原子性**:各写各的、带唯一令牌,等传播收敛后回读,
 * 令牌还在的那一个才算占到。收敛后全局只有一个胜者,所以只会建出一单。
 * (代价:并发时败者被拒 —— 上限还没用完也会被拒一次,重试即可。方向偏保守,
 *  宁可少放一笔也不多放一笔。)
 */
export function isClaimOwner(
  counter: { claimToken?: string } | null | undefined,
  token: string,
): boolean {
  if (!counter || !token) return false;
  return counter.claimToken === token;
}

/**
 * 今日额度是否已用完(**纯查询,不占用**)。给「再提一笔」这类按钮判置灰用。
 * 与 claimDailySlot 同一判据,不另写一套 —— 两套判据迟早对不上。
 */
export function isDailyLimitReached(
  counter: { dayIndex: number; count: number } | null | undefined,
  limitCount: number,
  now: number,
): boolean {
  return !claimDailySlot(counter, limitCount, now).allowed;
}

/**
 * 小额免审是否生效。
 * 阈值 0 = 运营关闭快车道;金额未输入(undefined)或非正数不启用 ——
 * 否则"还没输金额"会被当成 0 ≤ 阈值而误判成小额。
 */
export function isFastLane(requestedUsdt: number | undefined, thresholdUsd: number): boolean {
  if (!(thresholdUsd > 0)) return false;
  if (requestedUsdt === undefined || !(requestedUsdt > 0)) return false;
  return requestedUsdt <= thresholdUsd;
}

/**
 * 提现风控路由判定。
 *
 * 🔴 免审只作用于两道**冷启动保守闸**:首提必审 / 新地址 hold。
 * 风控闸(换绑冻结 · 冻结簇 · 标记簇 · 风险分 · 共用地址 · 大额账龄)**恒不受影响**。
 * 这条由 selfcheck-fastlane 的行为断言守:每道风控闸都有「免审为真时仍照常拦」的固定靶。
 */
export function decideWithdrawalRoute(input: WithdrawalRiskInput): WithdrawalRiskDecision {
  const reasons: string[] = [];
  const waivedGates: string[] = [];
  let route: WithdrawalRiskRoute = "pass";

  const fastLane = isFastLane(input.requestedUsdt, input.smallAmountThresholdUsd);

  // ── 风控闸(免审一律不参与)────────────────────────────────
  if (input.rebindFrozen) {
    route = worseRoute(route, "freeze");
    reasons.push("rebind-freeze");
  }
  if (input.clusterStatus === "frozen") {
    route = worseRoute(route, "freeze");
    reasons.push("frozen-cluster");
  } else if (input.clusterStatus === "flagged") {
    route = worseRoute(route, "manual");
    reasons.push("flagged-cluster");
  }
  if (input.clusterScore >= input.freezeSuggestThreshold) {
    route = worseRoute(route, "manual");
    reasons.push("high-risk-score");
  }
  if (!input.addressBlank && input.addressReusedByOther) {
    route = worseRoute(route, normalizeRoute(input.sameAddressRoute));
    reasons.push("shared-address");
  }
  if (input.youngBindingLargeAmount) {
    route = worseRoute(route, "manual");
    reasons.push("new-address-large-amount");
  }

  // ── 冷启动保守闸(小额免审只免这两道)──────────────────────
  if (!input.addressBlank && input.newAddressWithinHold) {
    if (fastLane) {
      waivedGates.push("new-address-hold");
    } else {
      route = worseRoute(route, "delay");
      reasons.push("new-address-hold");
    }
  }
  if (input.firstWithdrawalManual && !input.hasWithdrawn) {
    if (fastLane) {
      waivedGates.push("first-withdrawal-review");
    } else {
      route = worseRoute(route, "manual");
      reasons.push("first-withdrawal-review");
    }
  }

  // 🔴 FEAT-WD01b 每日笔数上限:达上限即**不建单不扣款**(与换绑冻结同档,
  // 区别于 manual/delay 那种"建单进队列、资金被占用"的路由)。
  // 上限 ≤ 0 视为未配置 → 不限制(避免坏配置把提现整个锁死)。
  // 判据只此一份:委托给 claimDailySlot(经 isDailyLimitReached)。
  // 曾有第二份就地实现,配置被下发成字符串 "2" 时两份结论相反 ——
  // 真闸判「不限制」而 UI 判「已达上限」,追踪页说能提、提现页说不能提。
  const dailyLimitReached = isOverDailyCap(input.todayWithdrawCount, input.dailyWithdrawLimitCount);

  return {
    route,
    riskReasons: reasons,
    fastLaneApplied: fastLane,
    waivedGates,
    dailyLimitReached,
    canSubmit:
      route !== "reject" &&
      !input.rebindFrozen &&
      !dailyLimitReached &&
      input.withdrawableUsdt >= input.minWithdrawableUsdt,
  };
}
