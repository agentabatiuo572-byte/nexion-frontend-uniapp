#!/usr/bin/env node
// FEAT-WD01a 小额免审快车道 · **行为**自检 — node 直跑:
//   node scripts/selfcheck-fastlane.mjs
//
// 🔴 守的核心不变量:**小额免审只免两道冷启动闸(首提必审 / 新地址 hold),
//    永不越过六道风控闸(换绑冻结 · 冻结簇 · 标记簇 · 风险分 · 共用地址 · 大额账龄)**。
//
// ⚠️ 本文件 2026-07-31 从「源码结构断言」整体改写为「行为断言」。原因值得留档:
// 结构版检查的是「代码长什么样」(fastLane 有没有和某个闸的关键词同行),
// 而不变量本身是「代码怎么执行」。独立验收连续攻破四种绕法,其中两种实测跑通真免闸:
//   · 别名洗白:const x = fastLane; 换个名字再去免风控闸
//   · 追加分支:阈值判定后加 `|| ...` 让快车道对任意金额生效
//   · 控制流搬迁:被 pin 的行一字不动,只把闸的**升级动作**挪进免审块 —— 最致命,
//     所有文本断言全绿而共用地址账户提 $30 从 manual 变成 pass
//   · 上游架空:把 rules 整个换成 {...rules, smallAmountThresholdUsd: 1e9}
// 词法检查永远追不上控制流。改测行为后,上述四种**全部会被抓到** ——
// 因为它们要成为漏洞就必须改变路由结果,而路由结果正是这里断言的东西。
// 反过来:不改变行为的改法本来就不是漏洞,不该报红。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "src", "store", "withdrawal-eligibility-core.ts"), "utf8");
const { code } = transformSync(src, { loader: "ts", format: "esm" });
const core = await import("data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64"));
// 🔴 测**端到端**入口 decideFromRawFacts(原始事实 → 路由),不是只测判定层。
// 第 3 轮复验教训:只测判定时,缝隙搬到了「取数/加工」那一层 ——
// 外壳对纯函数撒谎(恒传 false、只在小额时隐瞒共用地址)同样能真免闸而哨兵全绿。
// 现在加工也在 core 里,这里从原始事实喂进去,三层一起覆盖。
const { decideFromStores, decideFromRawFacts, isFastLane, platformDayIndex, nextDayResetAt, countWithdrawalsOnPlatformDay, isDailyLimitReached, isOverDailyCap, PLATFORM_UTC_OFFSET_HOURS } = core;

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

const NOW = 1_800_000_000_000;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** 干净新用户基线(原始事实形态):没提过现、地址是新绑的、风控全清。 */
function base(over = {}) {
  return {
    now: NOW,
    freezeUntil: undefined,
    clusterStatus: "clear",
    clusterScore: 0,
    freezeSuggestThreshold: 0.7,
    address: "TXaddr0000000000000000000000000000",
    addressSeenByOtherAccount: false,
    ownAddressFirstSeenAt: NOW - 1 * HOUR, // 刚绑 1 小时 → 仍在 24h hold 内
    newAddressHoldHours: 24,
    hasWithdrawn: false,
    bindingVerifiedAt: NOW - 30 * DAY,     // 绑定已满 7 天 → 大额闸不触发
    newAddressAgeDays: 7,
    largeAmountUsdt: 1000,
    requestedUsdt: 30,
    withdrawableUsdt: 100,
    smallAmountThresholdUsd: 50,
    minWithdrawableUsdt: 20,
    sameAddressRoute: "manual",
    firstWithdrawalManual: true,
    withdrawals: [],
    dailyWithdrawLimitCount: 0,
    ...over,
  };
}
// 🔴 入口必须与**生产同层**。第 5 轮复验的终极诊断:
// 「只要哨兵的入口比生产的入口低一层,那一层差额就永远是攻击面。」
// 生产走 decideFromStores,哨兵就必须也走它 —— 否则 toRawFacts 那层零覆盖。
function toSnapshot(f) {
  const hasAddr = f.address.trim().length > 0;
  const H = 'HASH-' + f.address.trim();
  return {
    now: f.now,
    binding: (f.freezeUntil === undefined && f.bindingVerifiedAt === undefined)
      ? undefined : { freezeUntil: f.freezeUntil, verifiedAt: f.bindingVerifiedAt },
    ownRecord: {
      hasWithdrawn: f.hasWithdrawn,
      withdrawAddresses: (hasAddr && f.ownAddressFirstSeenAt !== undefined)
        ? [{ hash: H, firstSeenAt: f.ownAddressFirstSeenAt }] : [],
    },
    allRecords: f.addressSeenByOtherAccount
      ? [{ accountKey: 'other', withdrawAddresses: [{ hash: H }] }] : [],
    accountKey: 'self',
    addressHash: hasAddr ? H : '',
    address: f.address,
    cluster: { status: f.clusterStatus, score: f.clusterScore },
    freezeSuggestThreshold: f.freezeSuggestThreshold,
    newAddressHoldHours: f.newAddressHoldHours,
    newAddressAgeDays: f.newAddressAgeDays,
    largeAmountUsdt: f.largeAmountUsdt,
    requestedUsdt: f.requestedUsdt,
    withdrawableUsdt: f.withdrawableUsdt,
    smallAmountThresholdUsd: f.smallAmountThresholdUsd,
    minWithdrawableUsdt: f.minWithdrawableUsdt,
    sameAddressRoute: f.sameAddressRoute,
    firstWithdrawalManual: f.firstWithdrawalManual,
    withdrawals: f.withdrawals,
    dailyWithdrawLimitCount: f.dailyWithdrawLimitCount,
  };
}
const run = (over) => decideFromStores(toSnapshot(base(over)));

// 🔴 多基线矩阵。第 3 轮复验教训:六道风控闸的固定靶原本全从**同一个**基线派生,
// 于是「把免权条件挂在该基线里恒定不变的维度上」就能全部穿过 ——
// 独立验收实测:挂在 hasWithdrawn 上(基线恒 false)可让冻结簇账户提现成功而 30/30 全绿。
// 现在每道闸都在多个基线变体上验一遍,恒定维度不再存在。
const BASELINES = [
  ["新用户", {}],
  ["老用户(提过现)", { hasWithdrawn: true }],
  ["余额充裕", { withdrawableUsdt: 5000 }],
  ["余额刚够", { withdrawableUsdt: 20 }],
  ["地址已过 hold", { ownAddressFirstSeenAt: NOW - 48 * HOUR }],
  ["同地址路由=delay", { sameAddressRoute: "delay" }],
  ["首提开关关闭", { firstWithdrawalManual: false }],
  ["小额线更高", { smallAmountThresholdUsd: 200, requestedUsdt: 150 }],
];

// ── 1. 快车道该生效时生效 ──────────────────────────────
{
  const r = run({});
  check("新用户提 $30(≤$50)→ 路由 pass(两道冷启动闸被免)", r.route === "pass", `实得 ${r.route}`);
  check("新用户提 $30 → 记下被免的两道闸",
    r.waivedGates.includes("new-address-hold") && r.waivedGates.includes("first-withdrawal-review"),
    JSON.stringify(r.waivedGates));
  check("新用户提 $30 → fastLaneApplied=true", r.fastLaneApplied === true);
  check("新用户提 $30 → canSubmit=true", r.canSubmit === true);
}

// ── 2. 快车道该失效时失效 ──────────────────────────────
{
  const r = run({ requestedUsdt: 80 });
  check("同一新用户提 $80(>$50)→ 路由 manual(不免审)", r.route === "manual", `实得 ${r.route}`);
  check("提 $80 → 理由含首提必审", r.riskReasons.includes("first-withdrawal-review"));
  check("提 $80 → waivedGates 为空", r.waivedGates.length === 0);
}
{
  // 🔴 fastLaneApplied 只表示「金额在小额线内」,和「有没有真免掉闸」是两回事。
  // 老用户(提过现)+ 地址已过 hold:两道冷启动闸本来就不会命中,免无可免。
  // 拿 fastLaneApplied 当「享受了免审」的判据渲染横幅,这里就会弹出一句空的「已免去:」。
  const r = run({ hasWithdrawn: true, ownAddressFirstSeenAt: NOW - 48 * HOUR });
  check("老用户 + 老地址提 $30 → fastLaneApplied=true 但 waivedGates 为空(判据不可混用)",
    r.fastLaneApplied === true && r.waivedGates.length === 0,
    `fastLane=${r.fastLaneApplied} waived=${JSON.stringify(r.waivedGates)}`);
}
{
  const r = run({ smallAmountThresholdUsd: 0 });
  check("小额线设 0(运营关闭)→ 快车道整体关闭,回落 manual", r.route === "manual" && !r.fastLaneApplied);
}
{
  check("金额未输入(undefined)不启用快车道 —— 防被当成 0 ≤ 阈值", isFastLane(undefined, 50) === false);
  check("金额 0 不启用", isFastLane(0, 50) === false);
  check("金额等于阈值算小额(「不超过此值」含等于)", isFastLane(50, 50) === true);
  check("金额略超阈值不算小额", isFastLane(50.01, 50) === false);
}

// ── 3. 🔴 六道风控闸:免审为真时**仍照常拦** ────────────
// 每条都把金额压在小额线内(fastLane 必为 true),再单独打开一道风控闸。
// 这是本自检的灵魂 —— 任何让免审越权的改法,都会在这里变红。
const RISK_CASES = [
  ["换绑冻结", { freezeUntil: NOW + 12 * HOUR }, "freeze", "rebind-freeze"],
  ["冻结簇", { clusterStatus: "frozen" }, "freeze", "frozen-cluster"],
  ["标记簇", { clusterStatus: "flagged" }, "manual", "flagged-cluster"],
  ["风险分 ≥0.7", { clusterScore: 0.7 }, "manual", "high-risk-score"],
  ["共用提现地址", { addressSeenByOtherAccount: true }, "manual", "shared-address"],
  // 大额闸:金额必须 ≥ 大额线,同时 ≤ 小额线才能让免审生效 → 抬高小额线制造重叠区
  ["大额账龄", { bindingVerifiedAt: NOW - 1 * DAY, requestedUsdt: 1500, smallAmountThresholdUsd: 2000 },
    "manual", "new-address-large-amount"],
];
for (const [label, over, wantRoute, wantReason] of RISK_CASES) {
  // 每道闸 × 每个基线都验一遍 —— 恒定维度不复存在,挂在任何维度上的免权都会被抓
  let allHeld = true;
  let allLogged = true;
  const misses = [];
  for (const [blLabel, blOver] of BASELINES) {
    const merged = { ...blOver, ...over };
    // 该基线本身若让免审失效(如金额超小额线),此组合无意义,跳过
    const probe = run(merged);
    if (!probe.fastLaneApplied) continue;
    // sameAddressRoute=delay 基线会把共用地址闸降级为 delay,期望值随之变
    const expectRoute =
      wantReason === "shared-address" && merged.sameAddressRoute === "delay" ? "delay" : wantRoute;
    if (probe.route !== expectRoute) { allHeld = false; misses.push(`${blLabel}:route=${probe.route}(期望${expectRoute})`); }
    if (!probe.riskReasons.includes(wantReason)) { allLogged = false; misses.push(`${blLabel}:理由缺失`); }
  }
  check(`🔴 风控闸「${label}」在小额免审生效时仍拦(跨 ${BASELINES.length} 个基线)`,
    allHeld, misses.join(" | "));
  check(`🔴 风控闸「${label}」的理由在所有基线下都被记录`, allLogged, misses.join(" | "));
}
{
  // 组合:多道风控闸同时命中,取最严
  const r = run({ clusterStatus: "frozen", addressSeenByOtherAccount: true });
  check("🔴 多闸同时命中取最严(冻结 > 人工)", r.route === "freeze", `实得 ${r.route}`);
}
{
  // 换绑冻结额外不变量:不建单不占资金
  const r = run({ freezeUntil: NOW + 12 * HOUR });
  check("🔴 换绑冻结时 canSubmit=false(不建单不占资金)", r.canSubmit === false);
}

// ── 4. 冷启动闸在非小额时正常工作(免审没把闸删掉)────────
{
  const r = run({ requestedUsdt: 80, hasWithdrawn: true, ownAddressFirstSeenAt: NOW - 1 * HOUR });
  check("老用户提 $80 + 新地址未过 hold → delay", r.route === "delay", `实得 ${r.route}`);
}
{
  const r = run({ requestedUsdt: 80, hasWithdrawn: true, ownAddressFirstSeenAt: NOW - 48 * HOUR });
  check("老用户提 $80 + 地址已过 hold + 风控干净 → pass", r.route === "pass", `实得 ${r.route}`);
}

// ── 5. 余额门 ────────────────────────────────────────
{
  const r = run({ withdrawableUsdt: 10 });
  check("可提余额低于最低提现额 → canSubmit=false", r.canSubmit === false);
}
{
  const r = run({ address: "   ", addressSeenByOtherAccount: true, ownAddressFirstSeenAt: undefined });
  check("地址未填时跳过地址相关两道闸(不误判)",
    !r.riskReasons.includes("shared-address") && !r.riskReasons.includes("new-address-hold"));
}

// ── 6. 🔴 随机取样(property-based):守「藏在任何维度上的隐藏条件」──────
//
// 第 4 轮复验教训:固定基线**再多也是有限的**,每个没被枚举到的维度都是一条缝。
// 独立验收实测 4 种全绿的真漏,全是「把免权挂在基线里恒定不变的维度上」:
//   N2 挂 newAddressHoldHours===24 · N3 挂 minWithdrawableUsdt===20
//   N4 挂 address.endsWith("0")   · N1 挂 getUTCHours()>=22  ← 时间炸弹,最狠
// N1 尤其说明问题:固定时钟的套件对 now 条件**天然失明**,加多少基线都没用。
//
// 改法:不再试图枚举维度,而是**每个维度都随机取样**。攻击者无法预知会抽到什么,
// 任何「在某组输入下才放行」的隐藏条件,只要被抽中一次就暴露。
// 不变量(与免审无关,恒成立):**任一风控闸命中 → 路由至少和该闸要求的一样严**。
const SEED0 = 0x2f6e2b1;
let seed = SEED0;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
// 🔴 连续取值。第 5 轮复验证明:pick([...]) 是**有限集合**,
// 「挂在清单之间的开区间」或「清单之外的值」上的免权,加到 2000 万组仍是 0 命中 ——
// 这是结构性盲区,不是概率问题。故数值维度一律用连续区间 + 少量边界值混采。
const between = (lo, hi) => lo + rnd() * (hi - lo);
const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));
/** 一半连续、一半取边界值 —— 兼顾「区间内任意点」与「恰好等于某常量」两类条件 */
const mix = (lo, hi, edges) => (rnd() < 0.5 ? between(lo, hi) : pick(edges));
const mixInt = (lo, hi, edges) => (rnd() < 0.5 ? intBetween(lo, hi) : pick(edges));
const ROUTE_RANK = { pass: 0, delay: 1, manual: 2, freeze: 3, reject: 4 };
/** 理由的规范次序:六道风控闸在前(先说风险),两道冷启动闸垫后(再说保守拦截)。 */
const REASON_ORDER = [
  'rebind-freeze', 'frozen-cluster', 'flagged-cluster', 'high-risk-score',
  'shared-address', 'new-address-large-amount', 'new-address-hold', 'first-withdrawal-review',
];

let violations = [];
const SAMPLES = 20000;
for (let i = 0; i < SAMPLES; i++) {
  const threshold = rnd() < 0.15 ? 0 : mix(1, 2000, [20, 50, 200, 1000]);
  const f = {
    // now 随机跨全天 + 跨月,直接打掉时间炸弹这一类
    now: Math.floor(rnd() * 4_000_000_000_000) + 1_000_000_000_000,
    clusterStatus: pick(["clear", "watch", "flagged", "frozen", "released"]),
    clusterScore: mix(0, 1, [0, 0.5, 0.7, 0.9, 1]),
    freezeSuggestThreshold: mix(0.3, 1, [0.5, 0.7, 0.9]),
    address: pick(["TXabc123", "TXdef450", "0xFEED9", "   ", ""]),
    addressSeenByOtherAccount: rnd() < 0.5,
    newAddressHoldHours: mixInt(0, 96, [1, 12, 24, 48, 72]),
    hasWithdrawn: rnd() < 0.5,
    newAddressAgeDays: mixInt(0, 60, [1, 7, 30]),
    largeAmountUsdt: mix(1, 10000, [100, 1000, 5000]),
    requestedUsdt: rnd() < 0.1 ? undefined : mix(0, 6000, [0, 1, 30, 50, 80, 1000]),
    withdrawableUsdt: mix(0, 6000, [0, 20, 100, 5000]),
    smallAmountThresholdUsd: threshold,
    minWithdrawableUsdt: mix(0, 200, [10, 20, 75]),
    sameAddressRoute: pick(["delay", "manual", "freeze"]),
    firstWithdrawalManual: rnd() < 0.5,
    withdrawCounter: null,
    dailyWithdrawLimitCount: 0,
  };
  f.freezeUntil = pick([undefined, f.now - 1000, f.now + 3600_000]);
  f.bindingVerifiedAt = pick([undefined, f.now - 1000, f.now - 40 * DAY]);
  f.ownAddressFirstSeenAt = pick([undefined, f.now - 1000, f.now - 100 * DAY]);

  const r = decideFromStores(toSnapshot(f));
  const hasAddr = f.address.trim().length > 0;
  const rank = ROUTE_RANK[r.route];

  // 逐条风控闸:命中则路由必须至少同等严格 —— 与是否免审**无关**
  const must = [];
  if (f.freezeUntil !== undefined && f.now < f.freezeUntil) must.push(["rebind-freeze", "freeze"]);
  if (f.clusterStatus === "frozen") must.push(["frozen-cluster", "freeze"]);
  if (f.clusterStatus === "flagged") must.push(["flagged-cluster", "manual"]);
  if (f.clusterScore >= f.freezeSuggestThreshold) must.push(["high-risk-score", "manual"]);
  if (hasAddr && f.addressSeenByOtherAccount) must.push(["shared-address", f.sameAddressRoute]);
  if (
    f.requestedUsdt !== undefined && f.bindingVerifiedAt !== undefined &&
    f.now - f.bindingVerifiedAt < f.newAddressAgeDays * DAY && f.requestedUsdt >= f.largeAmountUsdt
  ) must.push(["new-address-large-amount", "manual"]);

  for (const [reason, minRoute] of must) {
    if (rank < ROUTE_RANK[minRoute]) {
      violations.push(`#${i} 闸「${reason}」命中却只落 ${r.route}(至少应 ${minRoute}) fastLane=${r.fastLaneApplied}`);
    }
    if (!r.riskReasons.includes(reason)) {
      violations.push(`#${i} 闸「${reason}」命中却没记理由`);
    }
  }
  // 🔴 理由顺序:断言恒为规范序列的**子序列**(不是逐场景固定数组比对 ——
  // 那种每加一个新 reason 就崩一片,还诱使人直接改期望值)。
  // 它是用户可见文案 + 随单落盘,两次重构里已静默漂移过两回而四道机器门全绿。
  let ci = 0;
  for (const rr of r.riskReasons) {
    const at = REASON_ORDER.indexOf(rr, ci);
    if (at < 0) {
      violations.push(`#${i} 理由顺序偏离规范序列: ${JSON.stringify(r.riskReasons)}`);
      break;
    }
    ci = at + 1;
  }
  // 免审只许免这两道,不许出现第三个名字
  for (const g of r.waivedGates) {
    if (g !== "new-address-hold" && g !== "first-withdrawal-review") {
      violations.push(`#${i} 免掉了不该免的闸「${g}」`);
    }
  }
  // 没走快车道时不许有任何免闸记录
  if (!r.fastLaneApplied && r.waivedGates.length > 0) {
    violations.push(`#${i} 未走快车道却记了免闸 ${JSON.stringify(r.waivedGates)}`);
  }
  if (violations.length > 6) break;
}
check(`🔴 随机取样 ${SAMPLES} 组:任一风控闸命中必不被免审绕过(含随机时钟,打掉时间炸弹)`,
  violations.length === 0, violations.slice(0, 6).join(" | "));

// ── 7. FEAT-WD01b 每日提现笔数上限(计数源 = 提现单列表)──────────
// 不变量:今日笔数 = 提现单列表里 submittedAt 落在**平台日**(越南 UTC+7)内的行数;
// 达上限 → canSubmit=false(**不建单不扣款**,与换绑冻结同档);跨日自动归零;
// 上限 ≤0 / 非法 视为未配置 → 不限制(坏配置、后端不可达都不该把提现锁死)。
//
// 🔴 本节是 z1 审计 P0-1 的回归门。旧实现把笔数存在一个独立计数器里,由建单前的
//    claimWithdrawSlot 递增;c37e642 把建单让渡服务端事务后那个递增点随本地扣款链被删,
//    计数器从此无人写 → 读出恒空 → todayWithdrawCount 恒 0 → dailyLimitReached 恒 false,
//    而页面仍在渲染「每日最多 N 笔」并留着置灰分支(四处承诺全不可达)。
//    改成从单据现算后,「提交成功」与「计数 +1」是**同一件事**,没有第二份状态可以掉队。
{
  const RESET = nextDayResetAt(NOW);       // 下一个平台日 0 点(越南当地),即今日的右开边界
  const rows = (...ts) => ts.map((t) => ({ submittedAt: t }));
  const withRows = (list, limit) =>
    decideFromStores({ ...toSnapshot(base({})), withdrawals: list, dailyWithdrawLimitCount: limit });

  // ① 计数本身
  check("今日 1 笔 → 数出 1", countWithdrawalsOnPlatformDay(rows(NOW), NOW) === 1);
  check("今日 3 笔 → 数出 3", countWithdrawalsOnPlatformDay(rows(NOW, NOW, NOW), NOW) === 3);
  check("空列表 / 没有列表 → 0",
    countWithdrawalsOnPlatformDay([], NOW) === 0
      && countWithdrawalsOnPlatformDay(null, NOW) === 0
      && countWithdrawalsOnPlatformDay(undefined, NOW) === 0);
  // 🔴 异常在本条里接住,不许冒泡:红测实证,去掉被测的那道边界校验时 for...of 会真的抛,
  // 未捕获的话整个文件当场中止 —— 本条之后的几十条断言一条都不会跑,别的回归被顺带藏掉
  // (「fail-fast 把后续门静默停摆」那族坑)。接住 = 干净地报这一条红,其余照跑。
  check("🔴 列表不是数组(存储被写坏)→ 0,不抛异常把整页判定带崩",
    (() => {
      try {
        return countWithdrawalsOnPlatformDay("nope", NOW) === 0
          && countWithdrawalsOnPlatformDay({ length: 9 }, NOW) === 0;
      } catch { return false; }
    })());
  check("🔴 submittedAt 是坏值的行被跳过,不算进今日(算多的方向是把用户锁死)",
    countWithdrawalsOnPlatformDay([{ submittedAt: NaN }, { submittedAt: Infinity }, { submittedAt: undefined }, null], NOW) === 0);
  check("坏行与好行混在一起:只数好行",
    countWithdrawalsOnPlatformDay([{ submittedAt: NaN }, { submittedAt: NOW }, null, { submittedAt: NOW }], NOW) === 2);

  // ② 平台日边界(UTC+7)—— 四个固定靶钉死今日的左闭右开区间
  check("🔴 边界:平台日最后 1 毫秒提交的单**算今天**",
    countWithdrawalsOnPlatformDay(rows(RESET - 1), NOW) === 1);
  check("🔴 边界:平台日 0 点整提交的单**算明天**(不占今日额度)",
    countWithdrawalsOnPlatformDay(rows(RESET), NOW) === 0);
  check("🔴 边界:今日第 1 毫秒提交的单算今天",
    countWithdrawalsOnPlatformDay(rows(RESET - DAY), NOW) === 1);
  check("🔴 边界:昨日最后 1 毫秒提交的单算昨天",
    countWithdrawalsOnPlatformDay(rows(RESET - DAY - 1), NOW) === 0);
  check("🔴 边界是**平台**日不是 UTC 日(把偏移当 0 会数错这一格)",
    (() => {
      // 越南当地 0 点的那一刻,UTC 还停在前一天 17:00 —— 若判定按 UTC 切日,
      // 这两个时刻会被判成同一天,本条即红。
      const utcMidnightToday = Math.floor(NOW / DAY) * DAY;
      return PLATFORM_UTC_OFFSET_HOURS !== 0
        && platformDayIndex(RESET - 1) !== platformDayIndex(RESET)
        && platformDayIndex(utcMidnightToday) === platformDayIndex(utcMidnightToday + PLATFORM_UTC_OFFSET_HOURS * HOUR - 1);
    })());
  check("下次重置时间 = 下一个平台日的起点",
    nextDayResetAt(NOW) === (platformDayIndex(NOW) + 1) * DAY - PLATFORM_UTC_OFFSET_HOURS * HOUR);
  check("平台时区偏移 = UTC+7(越南)", PLATFORM_UTC_OFFSET_HOURS === 7);
  check("🔴 [随机] 任意时刻:重置点属于次日、且落在未来 24h 内(不会算成过去或跳一天)",
    (() => {
      let seed = 777, bad = 0;
      for (let i = 0; i < 5000; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const ts = 1.5e12 + (seed / 0x7fffffff) * 6e11;
        const reset = nextDayResetAt(ts);
        if (platformDayIndex(reset) !== platformDayIndex(ts) + 1) bad++;
        if (reset <= ts || reset - ts > DAY) bad++;
      }
      return bad === 0;
    })());

  // ③ 端到端判定:恰好到达上限的固定靶
  check("🔴 上限 1 / 今日 0 笔 → 可提", withRows([], 1).canSubmit === true);
  check("🔴 上限 1 / 今日**恰好** 1 笔 → 不可提(不建单不扣款)",
    withRows(rows(NOW), 1).canSubmit === false && withRows(rows(NOW), 1).dailyLimitReached === true);
  check("🔴 上限 3 / 今日 2 笔 → 可提(差一格时不许提前拦)",
    withRows(rows(NOW, NOW), 3).canSubmit === true && withRows(rows(NOW, NOW), 3).dailyLimitReached === false);
  check("🔴 上限 3 / 今日**恰好** 3 笔 → 不可提",
    withRows(rows(NOW, NOW, NOW), 3).canSubmit === false);
  check("超出上限也判不可提(列表被塞多也拦得住)",
    withRows(rows(NOW, NOW, NOW, NOW), 3).canSubmit === false);
  check("🔴 运营把上限从 1 调到 3 → 今日已 1 笔仍可提(限额跟着服务端 policy 实时走)",
    withRows(rows(NOW), 3).canSubmit === true);
  check("🔴 昨天的单不占今天的额度",
    withRows(rows(RESET - DAY - 1, RESET - DAY - 2), 1).canSubmit === true);
  check("🔴 边界固定靶:上限 1 + 昨日最后 1 毫秒 1 笔 → 可提;换成今日最后 1 毫秒 → 不可提",
    withRows(rows(RESET - DAY - 1), 1).canSubmit === true
      && withRows(rows(RESET - 1), 1).canSubmit === false);
  check("🔴 上限 ≤0 / 非法(未配置、policy 取不到)→ 不限制,不把提现锁死",
    withRows(rows(NOW, NOW, NOW), 0).canSubmit === true
      && withRows(rows(NOW, NOW, NOW), -1).canSubmit === true
      && withRows(rows(NOW, NOW, NOW), NaN).canSubmit === true
      && withRows(rows(NOW, NOW, NOW), undefined).canSubmit === true);
  check("🔴 上限被下发成字符串 \"1\" 也不误判成已达上限(判据只认有限数)",
    withRows(rows(NOW), "1").canSubmit === true);
  check("🔴 达上限时不改路由(只挡提交)—— 路由仍反映真实风控裁决",
    withRows(rows(NOW), 1).route === withRows([], 1).route);

  // ④ 两个页面同一判据:追踪页走 isDailyLimitReached,提现页走 decideFromStores,
  //    两者必须永远同答。历史上它们各挂一份实现,配置被下发成字符串时结论相反 ——
  //    追踪页说能提、提现页说不能提。
  check("🔴 [随机] 追踪页判据与提现页判定恒等(两页不许各说各话)",
    (() => {
      let seed = 20260811, bad = 0;
      for (let i = 0; i < 2000; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const n = seed % 5;
        const limit = (seed >> 5) % 4;
        const list = Array.from({ length: n }, (_, k) => ({
          submittedAt: (seed >> 9) % 2 === 0 ? NOW : RESET - DAY - 1 - k,
        }));
        if (isDailyLimitReached(list, limit, NOW) !== withRows(list, limit).dailyLimitReached) bad++;
      }
      return bad === 0;
    })());
  check("🔴 判据只有一份:isDailyLimitReached 与 isOverDailyCap∘countWithdrawalsOnPlatformDay 同答",
    isDailyLimitReached(rows(NOW), 1, NOW) === isOverDailyCap(countWithdrawalsOnPlatformDay(rows(NOW), NOW), 1));
}

/**
 * 取 `const x = computed(` 起的完整函数体 —— **括号配对**,不用 indexOf 找 `);`。
 * 找字面 `);` 会被内层 `fmt(..., { ... })` 提前截断,判据落在半截代码上红绿都不可信
 * (2026-08-01 哨兵自审点名的「解析器脆性」族)。
 */
/** 剥掉注释再做**反向**断言 —— 历史说明里往往会提到被禁的那个名字,不剥就被自己的注释命中假红。 */
function stripComments(s) {
  const block = new RegExp("/\\*[\\s\\S]*?\\*/", "g");
  const line = new RegExp("^\\s*//.*$", "gm");
  return s.replace(block, "").replace(line, "");
}
function balancedBody(src, from) {
  let depth = 0, started = false;
  for (let k = from; k < src.length; k++) {
    const c = src[k];
    if (c === "(" || c === "{") { depth++; started = true; }
    else if (c === ")" || c === "}") { depth--; if (started && depth === 0) return src.slice(from, k + 1); }
  }
  return null;
}
/** 抠出具名函数的**函数体**:先配对吞掉参数表 `(…)`,再从函数体 `{` 配对到闭合 ——
 *  判据先锚进函数再 indexOf,防命中别处的同名调用/注释。 */
function functionBody(src, sig) {
  const at = src.indexOf(sig);
  if (at < 0) return null;
  const params = balancedBody(src, at);
  if (!params) return null;
  const open = src.indexOf("{", at + params.length);
  return open < 0 ? null : balancedBody(src, open);
}
// ── 9. 🔴 接线门:判定守得再严,没接上也是零 ────────────────
// 独立验收 F3 实证:把计数写入摘掉,三个哨兵 + type-check 全绿而限额完全失效。
// 判定层是纯函数(上面已行为覆盖),「有没有被调用」只能在源码层守 —— 但守的是
// **精确表达式**,不是关键词,且每条都有红测(改坏必红)。
{
  const readSrc = (rel) => readFileSync(path.join(root, rel), "utf8");
  const appSrc = readSrc("src/store/app.ts");
  const elgSrc = readSrc("src/store/withdrawal-eligibility.ts");

  // z1 判决 C(2026-08-10):submitWithdrawal 客户端占额度/扣款/落盘/重放链随 c37e642
  // 整体让渡后端事务,本组接线断言(claimWithdrawSlot 占额度 / claim 先于建单 /
  // releaseWithdrawSlot 归还 / applyDebit 差分扣款 / 落盘失败回滚 / 幂等键重放 /
  // attempt<3 上限 / 平台日单号)主语灭失,整组删除;服务端义务(事务内占额度+复核)
  // 已记 HANDOFF。行为断言半区照跑。
  // 🔴 列表级问题不得读 latestWithdrawal —— 模型改成列表后,消费者若还用「只问最新一笔」
  //    的老问法去问列表级问题,在「一张在途 + 一张更新的已到账」组合下全部答错:
  //    账单结算结错单 / 钱包入口整行消失 / 换绑闸被静默架空(独立验收实测三条全中,
  //    且**全部逃过了 362 道机器门** —— 缺的正是这条守新不变量的门)。
  {
    const appVueSrc = readSrc("src/App.vue");
    const walletSrc = readSrc("src/pages/me/wallet.vue");
    const trackSrc = readSrc("src/pages/me/wallet-withdraw-tracking.vue");
    // 包 E(2026-08-05):换址闸从旧配对存储迁到 payout-address(地址直管)。
    // 判据**先于机制改写**指向新 store —— 新文件缺席时 readSrc 直接抛错 = 红,
    // 绝不允许「旧 store 删了、哨兵扫不到就当没违规」的静默假绿。
    const payoutSrc = readSrc("src/store/payout-address.ts");
    check("🔴 到账推进返回**推进了哪几笔**,账单按单号逐个结算(不问「最新一笔是谁」)",
      appSrc.includes("function advanceWithdrawalArrival(): string[] {")
        && appVueSrc.includes("const advanced = app.advanceWithdrawalArrival();")
        && /for \(const ref of advanced\)/.test(appVueSrc)
        && !/const ref = app\.latestWithdrawal\?\.id;/.test(appVueSrc));
    // 🔴 结算失败的补救必须能**跨刷新**。原实现是模块级内存 Set「记下来下次重试」——
    // 刷新一次就没了,而推进本身幂等(推过的单不再出现),那笔单永远不会再被结算:
    // 追踪页说已到账、账单页说处理中,永久裂脑。根治是**别记**:从现有数据推出待办
    // (单据已终态 + 账单行没跟上 = 待办),刷新 / 换设备 / 隔一周回来都能自愈。
    // 🔴 正反两侧都要剥注释:正向查「有没有真的调用」时,`// reconcileBills();` 也含这个子串,
    // 把调用整行注释掉照样绿(红测实证);反向查「有没有残留旧写法」时,历史说明里会提到那个名字。
    // 注释既能伪造存在、也能伪造违规 —— 两个方向都得剥。
    const appVueCode = stripComments(appVueSrc);
    check("🔴 账单对账从数据推导,不靠内存里的重试台账(内存 Set 刷新即丢 → 永久裂脑)",
      appVueCode.includes("function reconcileBills()")
        && appVueCode.includes("reconcileBills();")
        && !appVueCode.includes("pendingBillSettle"));
    // 🔴 提现在提交那一刻就扣了款,所以任何「最终没打出去」的终态都必须把钱退回去。
    // 全仓此前没有任何退款实现,账单也不会被置 failed —— 两个缺口分开看都像「反正走不到」,
    // 合起来就是「钱扣了、单子废了、没人还」。退款与置账单失败必须在**同一处**完成,
    // 否则接后端时必然只做一半(审计明确点名)。
    check("🔴 提现失败终态:退款与置账单失败成对完成,且幂等",
      appSrc.includes("function refundFailedWithdrawals(): string[] {")
        // 🔴 必须复用现成的幂等入账 action。自己拼 user.value 的绝对值会被 account-cloud 的
        // **增量合并**算回去 —— 实测:可提桶加上了、总余额纹丝不动。一半生效比不生效更难查。
        && appSrc.includes('creditRewardBucketOnce("refund:" + wd.id, "withdrawable", wd.amount)')
        && appVueCode.includes('for (const id of app.refundFailedWithdrawals()) bills.settleByRef(id, "failed");'));
    // 赠金释放只动桶和余额、不写账单 → 那行「处理中」的赠金会永远停着。从数据推出它已落地。
    // 判据必须钉到**真正干活的那一句**(遍历 bills.bills 并 settleByRef),
    // 只查条件行的话,把循环源换成空数组照样绿(红测实证:改 `for (const row of [])` 不红)。
    check("🔴 赠金释放后账单跟着入账(释放路径不写账单,只能靠对账推出来)",
      appVueCode.includes("b.pendingReviewUsdt <= 0 && b.bonusLockedUsdt <= 0")
        && /for \(const row of bills\.bills\)[\s\S]{0,220}row\.type === "bonus"[\s\S]{0,160}bills\.settleByRef\(row\.ref, "posted"\)/.test(appVueCode));

    check("🔴 钱包入口与追踪页读**主单**(优先最早的在途单),不读最新一笔",
      walletSrc.includes("app.primaryWithdrawal") && trackSrc.includes("app.primaryWithdrawal")
        && !/computed\(\(\) => app\.latestWithdrawal\)/.test(walletSrc)
        && !/computed\(\(\) => app\.latestWithdrawal\)/.test(trackSrc));
    // 🔴 换址闸(更换提现地址前的在途单拦截)问**整张在途列表**,不问最新一笔 ——
    // 只看最新一笔时,一张在途单 + 一张更新的已到账单会把闸静默架空,
    // 收款地址能在放款前被换掉(独立验收实测)。RM01a 收窄为按网络拦:
    // 判据 = 从整张 inFlightWithdrawals 列表按网络过滤,仍是列表级问法。
    check("🔴 换址闸问**整张在途列表**(按网络过滤,不读 latestWithdrawal)",
      payoutSrc.includes("useApp().inFlightWithdrawals.some((w) => w.network === CHAIN_TO_WITHDRAW_NETWORK[network])")
        && !/latestWithdrawal/.test(stripComments(payoutSrc)));
    // 🔴 同一个概念只许有一份判据。曾经有两份:白名单 IN_FLIGHT_WITHDRAWAL_STATUSES(漏 sent / frozen)
    // 与黑名单 occupiesWithdrawalSlot(非终态即占用)。换绑闸挂在漏的那份上 ——
    // 风控冻结中、钱已扣的账户能改收款地址(2026-08-01 审计,资金安全级)。
    // 白名单的失败方向是「新状态默认不在途 = 放行」,黑名单是「默认在途 = 拦住」;涉及钱一律取保守侧。
    check("🔴 全站不得再出现第二份「在途」判据(白名单谓词已删,只走 occupiesWithdrawalSlot)",
      ["src/store/payout-address-core.ts", "src/store/payout-address.ts", "src/pages/me/wallet-withdraw.vue", "src/pages/me/wallet-address-rebind.vue"]
        .every((f) => {
          const s = readSrc(f).replace(/^\s*\/\/.*$/gm, "");   // 剥注释:历史说明里会提到这个名字
          return !s.includes("IN_FLIGHT_WITHDRAWAL_STATUSES") && !s.includes("isInFlightWithdrawal");
        }));
    // 🔴 判定对 ≠ 接上(quota_claim_before_create 同族):在途闸必须真喂进 store 的
    // changeAddress 动作(hasInFlightWithdrawal 实参来自列表派生),页面的更换入口
    // 必须问 store 同一个判据 —— 页面自己另算一份迟早漂移。
    check("🔴 换址动作的在途实参来自列表派生(store 接线),且 changeAddress 首步过闸",
      payoutSrc.includes("hasInFlightWithdrawal: hasInFlightWithdrawalOn(network)")
        && payoutSrc.includes("const blocked = changeBlockReason(network);"));
    check("🔴 地址管理页的更换入口问 store 同一个判据(不自算)",
      stripComments(readSrc("src/pages/me/wallet-address-rebind.vue")).includes("payout.changeBlockReason("));
    check("🔴 store 暴露列表级派生值(inFlightWithdrawals / primaryWithdrawal)",
      appSrc.includes("const inFlightWithdrawals = computed(")
        && appSrc.includes("const primaryWithdrawal = computed<Withdrawal | null>("));
  }
  // z1(2026-08-10):入列钉现写法 —— 前插 + **按 id 去重**(服务端幂等重放同一单号时
  // 列表不得出现两行);语义强于旧「裸前插 [wd, ...]」。
  check("🔴 提现单是**列表**不是单条(与真后端 GET /api/withdrawals 同构)",
    appSrc.includes("const withdrawals = ref<Withdrawal[]>(bootSnapshot.withdrawals ?? []);")
      && appSrc.includes("const latestWithdrawal = computed<Withdrawal | null>(")
      && appSrc.includes("withdrawals.value = [canonical, ...withdrawals.value.filter((item) => item.id !== canonical.id)];"));
  check("🔴 建单是**追加**不是覆盖(覆盖会把在途单连同已扣的钱一起顶掉)",
    !/latestWithdrawal\.value = wd;/.test(appSrc));
  check("🔴 到账推进**全表扫**(单条版只看最新一笔,前面那笔到点了也永远推不动)",
    appSrc.includes("const next = prev.map((w) => advanceArrival(w, now) ?? w);"));
  check("🔴 推进落盘失败要回滚内存(否则内存说已到账、磁盘还是处理中,轮询永不重试)",
    /withdrawals\.value = next;[\s\S]{0,400}?if \(!persistAccountSnapshot\(\)\) \{[\s\S]{0,80}?withdrawals\.value = prev;/.test(appSrc));
  check("🔴 单槽产品限制已删除(列表化后新单不再顶掉在途单,那条闸只会锁死用户)",
    !/occupiesWithdrawalSlot\(latestWithdrawal/.test(appSrc));
  // z1 B4(2026-08-10):remote-only 后扣款在后端事务里,客户端义务收缩为「建单成功后
  // 同步登记风控台账」—— submitWithdrawal 在 await withdrawalApi.submit **之后**调
  // commitWithdrawal(首提标记 + 地址登记),本地预检引擎吃的就是这份台账,
  // 漏接 = 首提/换址闸对提过现的账户永不触发。三合取逐项:
  // (a) 调用在 submitWithdrawal 函数体内(functionBody 抠体再找,防命中别处);
  // (b) 调用在建单 await 之后(建单失败会 throw 冒泡,不得先记台账);
  // (c) commitWithdrawal 函数体内两笔台账(地址登记 + 首提标记)都落。
  check("🔴 风控台账接线:submitWithdrawal 建单成功后同步 commitWithdrawal(首提标记 + 地址登记)",
    (() => {
      const body = functionBody(appSrc, "async function submitWithdrawal(");
      if (!body) return false;
      const call = body.indexOf("commitWithdrawal(accountKey.value, network, address);");
      const submit = body.indexOf("await withdrawalApi.submit");
      if (call < 0 || submit < 0 || submit > call) return false;
      const elgBody = functionBody(elgSrc, "function commitWithdrawal(");
      return !!elgBody
        && elgBody.includes("recordWithdrawAddressUse(accountKey, network, address);")
        && elgBody.includes("markWithdrawn(accountKey);");
    })());
  check("🔴 commitWithdrawal 不再事后计数(挪回去 = 把并发漏洞放回去)",
    !/bumpWithdrawCounter\s*\(/.test(elgSrc));
  // ── 日限接线门(z1 审计 P0-1 的回归门,2026-08-11)────────────────
  // 判定层已被上面 §7 的行为断言全覆盖;这里守的是**接没接上、接的是不是那个源**。
  // 缺陷史:计数器无人递增(判定恒 0)+ 文案取服务端 policy 而判定取本地 config
  // (同一个「每日 N 笔」有两个数)。两处都是「判定对 ≠ 接对」,只有源码级判据守得住。
  {
    const pgSrc2 = readSrc("src/pages/me/wallet-withdraw.vue");
    const trackSrc2 = readSrc("src/pages/me/wallet-withdraw-tracking.vue");
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : (/\.(ts|vue)$/.test(e.name) ? [p] : []);
    });
    const files = walk(path.join(root, "src"));
    // 扫描面为空 = 判据失效,必须红(禁「扫不到=没违规」)
    check(`🔴 日限扫描面非空(扫 ${files.length} 个源文件)`, files.length >= 100, `只扫到 ${files.length} 个`);

    // ① 计数源:唯一合法源是提现单列表。任何「再存一份计数」的写法都必须红 ——
    //    这正是缺陷的成因:计数器与真实提交是两份状态,递增点一删就永久掉队。
    //    剥注释后再扫:本文件与源码的历史说明里都会提到这些名字。
    const revived = files
      .filter((p) => {
        const s = stripComments(readFileSync(p, "utf8"));
        return /\bclaimWithdrawSlot\s*\(|\breleaseWithdrawSlot\s*\(|\breadWithdrawCounter\s*\(|\bclaimDailySlot\s*\(|withdraw-daily-count/.test(s);
      })
      .map((p) => path.relative(root, p).replace(/\\/g, "/"));
    check("🔴 本地日限计数器没有复活(计数唯一源 = 提现单列表;要再存一份计数就先来改这条门)",
      revived.length === 0, revived.join(", "));

    // ② 限额源:只许服务端 policy.dailyLimitCount。本地 config.withdrawRules 的远端同步
    //    不覆盖 withdrawRules,取它等于按前端写死值拦人(服务端配 3 笔、客户端按 1 笔拦)。
    const localLimitUsers = files
      .filter((p) => /withdrawRules\s*[.?]*\.?\s*dailyWithdrawLimitCount|rules\.dailyWithdrawLimitCount/.test(stripComments(readFileSync(p, "utf8"))))
      .map((p) => path.relative(root, p).replace(/\\/g, "/"));
    check("🔴 每日笔数上限不许再从本地 config.withdrawRules 取(唯一源 = 服务端 policy)",
      localLimitUsers.length === 0, localLimitUsers.join(", "));

    // ③ 两个页面都把「服务端限额 + 提现单列表」喂进判定。判据钉精确表达式,不钉关键词。
    check("🔴 提现页:日限事实来自服务端 policy + app.withdrawals,且文案与闸共用同一个数",
      pgSrc2.includes("limitCount: withdrawalPolicy.value?.dailyLimitCount ?? 0,")
        && pgSrc2.includes("withdrawals: app.withdrawals,")
        && pgSrc2.includes("fmt(t.value.wallet.dailyLimitNote, { n: String(dailyFacts.value.limitCount) })")
        // 🔴 说不说这句 ⟺ 闸拦不拦。limitCount ≤0 时判定按「不限制」走,这句必须消失 ——
        // 否则后端不可达时页面会写「每日限额:0 笔/日」(实景实测过的原话)。
        && pgSrc2.includes('<text v-if="dailyFacts.limitCount > 0" class="block">{{ dailyLimitNoteText }}</text>'));
    check("🔴 提现页:显示判定与提交前复检都吃这份事实(少接一处 = 那条路径上的闸失效)",
      (pgSrc2.match(/evaluateWithdrawal\(app\.accountKey, network\.value, boundAddress\.value, maxWithdrawable\.value, dailyFacts\.value,/g) || []).length === 2
        && /requestWithdrawalEligibility\([\s\S]{0,400}?dailyFacts\.value,/.test(pgSrc2));
    check("🔴 追踪页「再提一笔」与提现页同源(否则一页说能提、一页说不能提)",
      trackSrc2.includes("dailyLimitStatus({")
        && trackSrc2.includes("limitCount: withdrawalPolicy.value?.dailyLimitCount ?? 0,")
        && trackSrc2.includes("withdrawals: app.withdrawals,"));

    // ④ 外壳仍然只转发:今日笔数在 core 现算,页面/外壳不许自己 filter 出一个数来
    //    (外壳里留表达式 = 行为门覆盖不到那一层,这是本文件反复栽过的跟头)。
    check("🔴 今日笔数在 core 现算,外壳只转发(外壳出现 filter/length 自算即红)",
      elgSrc.includes("withdrawals: daily.withdrawals,")
        && elgSrc.includes("dailyWithdrawLimitCount: daily.limitCount,")
        && !/daily\.withdrawals\s*\.\s*(filter|length|reduce)/.test(stripComments(elgSrc)));
  }
  // 🔴 双向告知的接线门。判定再准,页面不接 = 用户看不见(走查实证:快车道跑了
  // 一整轮,表单一个字都没提,用户以为「提多少都要审」)。两条判据都必须来自判定结果。
  const pgSrc = readSrc("src/pages/me/wallet-withdraw.vue");
  // 判据全用 includes 精确串,不用正则 —— 这几行历史上被 shell 转义吃掉反斜杠后
  // 会退化成「几乎什么都匹配」的假绿正则(同替换串静默损坏那族坑)。
  check("🔴 正向横幅三层前提齐全:真免了闸 + 路由放行 + **这笔现在提交得了**",
    pgSrc.includes('waivedLines.value.length > 0 && eligibility.value.route === "pass" && submitDisabledReason.value === ""')
      && pgSrc.includes("waivedGateLines(t.value, eligibility.value.waivedGates)"));
  // 🔴 CTA 承诺「改成小额线就能立刻处理」,判据必须和**提交拦截**同一个源。只看 route 不够:
  // core 把 dailyLimitReached 单独返回、不并进 route,费率不可用更是页面层的事 ——
  // 日限已达时旧判据照样劝你改成 $50,点完什么都不会发生,还把当天唯一一次机会的金额改小了。
  check("🔴 降额 CTA 与提交拦截同源(disabledReasonFor),不是只看 route 或 amount > line",
    (() => {
      const k = pgSrc.indexOf("const fastLaneOverLine = computed(");
      if (k < 0) return false;
      const body = balancedBody(pgSrc, k);
      if (!body) return false;
      return body.includes('disabledReasonFor(smallAmountLine.value, smallLineDecision.value) === ""')
        // 假设金额那次评估必须**连日限事实一起**问 —— 少喂 dailyFacts 就等于拿一份
        // 「日限恒不触发」的答案去劝用户降额,又回到 z1 P0-1 那个空头承诺。
        && pgSrc.includes("evaluateWithdrawal(app.accountKey, network.value, boundAddress.value, maxWithdrawable.value, dailyFacts.value, smallAmountLine.value)")
        // 提交拦截本身必须是「入参为金额」的函数,否则 CTA 没法对假设金额问同一个问题
        && pgSrc.includes("function disabledReasonFor(amount: number, decision: WithdrawalEligibility): string")
        && pgSrc.includes("const submitDisabledReason = computed(() => disabledReasonFor(amountNum.value, eligibility.value));");
    })());
  check("🔴 CTA 可点(说了「改小就行」必须给一键改,否则等于没下一步)",
    pgSrc.includes('@click.stop="useSmallAmountLine"') && pgSrc.includes("function useSmallAmountLine()"));
  // 🔴 判定必须跨时间边界重算。eligibility 的依赖里原本没有时间(mockServerNow 非响应源),
  // 于是冻结倒计时归零后判定还停在 freeze(横幅换个壳再说一遍冻结原因、提交被无原因兜底挡死),
  // 日限重置时刻到了也照样拦着 —— 页面刚承诺的那个时刻自己打自己脸。
  // 但也不许直接依赖每秒 tick(evaluateWithdrawal 同步读多行 storage);只取边界穿越信号。
  check("🔴 判定跨时间边界重算(冻结到期 / 平台日切),且不是每秒重算",
    (() => {
      const c = stripComments(pgSrc);
      return c.includes("const eligibilityClock = computed(")
        && c.includes("void eligibilityClock.value;")
        && c.includes("platformDayIndex(now)");
    })());
  // 🔴 账单跳交易详情必须带真实参数。只传 hash 的话,tx 页缺参会按 hash 播种**随机编**金额、
  // 网络硬回落 Ethereum —— 用户点自己那笔 $30,看到的是一笔跟他无关的四位数交易。
  // 入金侧早焊了这道防线,账单侧一直没焊(同型只修一半)。
  check("🔴 账单跳详情带真实参数(金额 / 网络 / 时间),不让 tx 页按 hash 编数",
    (() => {
      const c = stripComments(readSrc("src/pages/me/wallet-bills.vue"));
      return c.includes('p.set("amount"') && c.includes('p.set("net"') && c.includes('p.set("age"')
        // 网络必须大写:tx 页用 `options.net in NET_LINES` 白名单校验,小写会被静默丢弃
        && c.includes("m[1].toUpperCase()");
    })());
  // 🔴 账单分流三件套(2026-08-02 审计修复的机器 pin)。上一条的四根针脚**兜底分支单独即可喂饱**——
  // 把「按 ref 反查入金记录取真实确认数」的 rec 分支整个删掉照样绿,故单独 pin:
  // ① withdraw 行深链追踪页(单据真状态,不再被 tx 页恒「已确认」编造);
  // ② topup 行优先反查入金记录、传真实 confs;
  // ③ 入金面板非 credited 的链上记录不进 tx 页(在途记录渲成「已确认」=编造)。
  check("🔴 账单分流:withdraw→追踪页深链 / topup 反查记录传真实 confs / pane 非 credited 不进 tx",
    (() => {
      const bills = stripComments(readSrc("src/pages/me/wallet-bills.vue"));
      const pane = stripComments(readSrc("src/components/me/deposit-usdt-pane.vue"));
      return bills.includes("wallet-withdraw-tracking?id=")
        && bills.includes("deposits.records.find")
        && bills.includes('p.set("confs"')
        && pane.includes('r.status !== "credited"');
    })());
  // 🔴 小额线判据 z1(2026-08-10)起为**双态二选一**:
  //  · HOLD 态 —— WD01 backend 未实现快车道,smallAmountLine 恒 0(免审分支故意不可达),
  //    行 + 注释双锚:防有人「顺手」把线接回配置值而后端并不兑现免审承诺;
  //  · 恢复态 —— 线回接后台配置时,必须整组回接**三处同一个落地值**(向下取到 2 位;
  //    比较 / 写入输入框 / 文案显示)。原来比较用原值、写入 toFixed(2)、显示 toFixed(0):
  //    线配 49.999 时写进去的 50.00 反而超过原值 → 一个点多少次都没反应、永不消失的按钮;
  //    线配 20.5 时按钮写「改为 $21」而实际填 20.50,照字面手输 21 反被送出免审区间。
  check("🔴 小额线:HOLD 态(恒 0 + WD01 HOLD 注释)或恢复态(config 派生三处同源落地值)",
    (pgSrc.includes("const smallAmountLine = computed(() => 0);") && pgSrc.includes("WD01 is HOLD"))
      || (pgSrc.includes("Math.floor(cfg.config.withdrawRules.smallAmountThresholdUsd * 100) / 100")
        && pgSrc.includes("const smallAmountLineText = computed(")
        && pgSrc.includes("fmt(t.value.wallet.fastLaneCta, { n: smallAmountLineText.value })")),
    "两态皆不满足 —— 恢复快车道必须回接 config 派生三同源(比较/写入/显示同一落地值)");
  check("🔴 首审提示按判定结果显示,不再常显(否则与免审横幅当场对打)",
    pgSrc.includes('const firstTimeReviewApplies = computed(() => eligibility.value.riskReasons.includes("first-withdrawal-review"))')
      && pgSrc.includes('v-if="firstTimeReviewApplies"'));
  // 🔴 首审提示**不给时间承诺**。系统对人工复核没有任何推进机制(advanceArrival 对非 pass 恒不推进,
  // 实测把时间推到十年后仍不动),承诺一个没人兑现的时限是硬谎。
  // 曾试图新建配置项 manualReviewSlaHours 来「接单源」——但后台 D5 参数集里没有它、PRD 零命中,
  // 那只是把写死的 24 换个地方藏。这条同时守「不许再引入没有后台配置面的假配置项」。
  check("🔴 首审提示不做时间承诺,也不许再引入没有后台配置面的假配置项",
    pgSrc.includes("const firstTimeReviewText = computed(() => t.value.wallet.firstTimeReview);")
      && !readSrc("src/store/config-types.ts").includes("manualReviewSlaHours")
      && !readSrc("src/mock/platform-config.ts").includes("manualReviewSlaHours")
      && ["zh", "en", "vi"].every((l) => {
        const src = readSrc(`src/i18n/messages/${l}.ts`);
        const m = src.match(/firstTimeReview: "([^"]*)"/);
        // 判据写成语义:挖掉占位符后不许剩任何数字。不用 \b(只认 ASCII,中文那面完全不设防)、
        // 也不用「位数」近似(写「3 天」不红、含 $1,000 的正当文案反而假红)。
        return !!m && !/\d/.test(m[1].replace(/\{\w+\}/g, ""));
      }));
  check("🔴 免闸话术三语齐备且占位符是 {g}(写成 ${g} 会漏出一个裸美元符号)",
    ["zh", "en", "vi"].every((l) => {
      const src = readSrc(`src/i18n/messages/${l}.ts`);
      const m = src.match(/fastLaneOnBody: "([^"]*)"/);
      if (!m || !m[1].includes("{g}") || m[1].includes("${g}")) return false;
      // 🔴 码表必须在 waivedGates 这个块里查。原本做整文件子串搜索,而同名 code 在
      //    riskReasons 里也各有一份 —— 把 waivedGates 整块删掉这条照样 PASS,
      //    而删掉会让 waivedGateLines 对 undefined 取下标、横幅计算直接抛异常。
      const k = src.indexOf("waivedGates: {");
      if (k < 0) return false;
      const block = src.slice(k, src.indexOf("},", k));
      return block.includes('"new-address-hold":') && block.includes('"first-withdrawal-review":');
    }));
  check("🔴 码表缺失时降级为少显示一行,不炸页面",
    readSrc("src/lib/risk-reason-text.ts").includes("(t.wallet.waivedGates ?? {})"));
  // 🔴 提交在途,**参与建单的每一个输入都必须冻成快照**。
  // 曾经只冻了费用报价与 NEX 余额,唯独漏了报价的分母 —— 金额。而改金额的入口不止输入框:
  // 「全部提现」和降额 CTA 都是裸 <view @click>,提交转圈那 1.2 秒里照样点得动。
  // 后果(两个独立 agent 各自实测):下单读调用那一刻的值、写账单是 await 之后**重新读一次**同一个 ref
  // → 扣款 $30 / 单据 $30 / 账单 -$24,856;反向还能用 $50 的小额免审裁决建出全余额的自动放行单。
  check("🔴 提交在途金额冻结:handleSubmit 开头取快照,await 之后一律用它",
    (() => {
      const sig = pgSrc.indexOf("async function handleSubmit()");
      if (sig < 0) return false;
      // 从函数体的 `{` 开始配对 —— 从签名开始会被 `handleSubmit()` 的空参数括号立刻闭合
      const k = pgSrc.indexOf("{", sig);
      const body = k < 0 ? null : balancedBody(pgSrc, k);
      if (!body) return false;
      // 剥注释后找第一个真 await:金额快照必须在它之前,其后不许再出现裸 amountNum.value
      // (2026-08-04:金额快照并入统一提交快照 snap —— 账号/网络/地址/报价同刻冻结,
      //  全族判据在 selfcheck-withdraw-freeze;这里只守金额这一条,两边互为交叉验证)
      const code = body.split("\r\n").filter((l) => !l.trim().startsWith("//")).join("\r\n");
      const s = code.indexOf("amount: amountNum.value,");
      const a = code.indexOf("await ");
      if (s < 0 || a < 0 || s > a) return false;
      return !code.slice(a).includes("amountNum.value");
    })());
  check("🔴 提交在途金额冻结:两个改金额的入口都有 inputsLocked 守卫(输入框有 :disabled,它俩没有)",
    ["function useMax() {", "function useSmallAmountLine() {"].every((sig) => {
      const k = pgSrc.indexOf(sig);
      if (k < 0) return false;
      return pgSrc.slice(k, k + 200).includes("if (inputsLocked.value) return;");
    }));
  // 🔴 账单的运行余额只认服务端下发的 balanceAfter。旧实现把**自己算错的**值写进每条账单并落盘,
  // 读盘不剥的话页面会把那批旧错值(实测盘上就有 60.3065,真实余额两万四)原样渲染 ——
  // 等于把已修的 P0 换个方式放回去。
  check("🔴 读盘剥掉存量脏 balanceAfter(不剥 = 把旧错值原样渲染回去)",
    readSrc("src/store/bills.ts").includes("balanceAfter: _drop, ...rest"));
  check("🔴 store 不再自己算 balanceAfter(账单是**部分**流水,正推倒推都对不上)",
    !/b\.balanceAfter\s*=/.test(readSrc("src/store/bills.ts"))
      && !readSrc("src/pages/me/wallet-bills.vue").includes("const runningBalance = computed"));
  check("🔴 提现路径的时钟统一走 mockServerNow(不直读 Date.now)",
    !/Date\.now\(\)/.test(elgSrc));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
