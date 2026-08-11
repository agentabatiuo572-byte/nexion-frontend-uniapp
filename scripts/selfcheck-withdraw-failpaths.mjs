#!/usr/bin/env node
// 提现**失败路径**行为门 — node 直跑:
//   node scripts/selfcheck-withdraw-failpaths.mjs
//
// 🔴 为什么单独建这一套(2026-08-11 R2 结构性反思,族 A):
// 本包在同一个任务里三次写下「失败时会如何如何」的注释,三次都与实际行为相反:
//   ①「提现单随账号快照持久」—— 建单后**根本没落盘**;
//   ②「取活值能看见另一标签页的提交」—— 跨标签页的写入根本进不到本标签页内存;
//   ③「落盘失败不回滚内存」—— 实际会把刚建的单**静默抹掉**。
// 共同根因:**正常路径我会跑浏览器、会写固定靶;失败路径我只写注释。而注释不参与执行,
// 写什么都不会红。** 所以根治不是「写注释更小心」,而是:
//   **失败路径的行为断言,必须有一条注入该失败的测试**;没有测试就不许写进注释。
// 本文件就是那条测试该待的地方 —— 载**真 app store + 真 account-cloud**,注入真实失败。
//
// 覆盖的失败注入:
//   ① 落盘写失败(配额撑满 / storage 不可用)—— 建单后单据必须仍在内存
//   ② 刷新(从磁盘重新水合)—— 建单后今日笔数必须仍然算得到(本包修的原始缺陷的回归门)
//   ③ 落盘写失败 + 刷新 —— 诚实边界:这一格会丢,断言它**只丢磁盘不丢当次内存**
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";
import { VUE_STUB_NXREF, runtimeStub } from "./lib/harness-stubs.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

console.log("selfcheck-withdraw-failpaths — 提现失败路径:注释声称的行为必须真的发生");

// ── 假 uni storage:可按 key 定点注入写失败 ──
const disk = new Map();
let failKey = null;
const uni = {
  getStorageSync(key) { const raw = disk.get(key); return raw === undefined ? "" : JSON.parse(raw); },
  setStorageSync(key, value) {
    if (failKey && failKey(key)) throw new Error("QuotaExceededError (injected)");
    disk.set(key, JSON.stringify(value));
  },
  removeStorageSync(key) { disk.delete(key); },
  getSystemInfoSync() { return { language: "en" }; },
};
globalThis.uni = uni;

const CLOUD_KEY = "nexgrid-account-cloud-v1";

// 🔴 服务端建单响应的桩。只桩**网络那一层**(withdrawalApi),
// `toCanonicalWithdrawal` / account-cloud / app store 全是真代码 —— 被测的正是它们。
const HOLD_UNTIL = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
let serverSeq = 0;
const WORKING_WITHDRAWAL_API = `export const withdrawalApi = {
  policy: async () => { throw new Error("policy 不在本自检范围"); },
  submit: async () => globalThis.__nextSubmission(),
};`;
globalThis.__nextSubmission = () => {
  serverSeq += 1;
  return {
    withdrawalNo: `WD-FAILPATH-${serverSeq}`,
    amount: 50, chain: "USDT-TRC20", status: "SUBMITTED", holdUntil: HOLD_UNTIL,
    networkConfirmUsd: 1, networkFee: 1, penaltyFee: 0, grossFee: 1,
    nexBurned: 0, feeWaived: 0, actualFee: 1, netReceive: 49,
    policyVersion: "failpath", useNexFeeOffset: false, riskRoute: "fast-pass", idSource: "server",
  };
};

// 🔴 runtimeStub(root) 仍要跑一次:它会校验 src/api/runtime.ts 的导出面没漂移
// (解析失败即抛)。我们只是在它之外**追加**一个可用的 withdrawalApi 覆盖同名导出。
const baseRuntime = runtimeStub(root);
const DEAD_LINE = "export const withdrawalApi = unavailable;";
if (!baseRuntime.includes(DEAD_LINE)) {
  throw new Error("harness: 运行时桩里找不到 withdrawalApi 的占位导出 —— 桩已失效,禁静默放行");
}
// 🔴 只**覆盖 withdrawalApi 这一个导出**,其余照旧走共用桩(它同时校验 runtime.ts 的
// 导出面没漂移)。整份替换会让 genesis / earningsRelease 等一串导出凭空消失,构建即炸。
const runtimeWithWorkingWithdrawApi = baseRuntime.replace(DEAD_LINE, WORKING_WITHDRAWAL_API);
const STUBS = {
  "pinia-stub": `const cache = new Map();
const unwrap = (v) => (v && typeof v === "object" && v.__nxRef === true);
export const defineStore = (id, setup) => () => {
  if (!cache.has(id)) cache.set(id, new Proxy(setup(), {
    get(t, k) { const v = Reflect.get(t, k); return unwrap(v) ? v.value : v; },
    set(t, k, val) { const v = Reflect.get(t, k); if (unwrap(v)) { v.value = val; return true; } return Reflect.set(t, k, val); },
  }));
  return cache.get(id);
};`,
  "vue-stub": VUE_STUB_NXREF,
  "runtime-stub": runtimeWithWorkingWithdrawApi,
};
const bundle = await build({
  stdin: {
    contents: `export { useApp } from "@/store/app";
export { countWithdrawalsOnPlatformDay } from "@/store/withdrawal-eligibility-core";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true, write: false, format: "esm",
  define: { "import.meta.env": JSON.stringify({ PROD: false, DEV: true, MODE: "selfcheck" }) },
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
      b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
      b.onResolve({ filter: /^@\/api\/runtime$/ }, () => ({ path: "runtime-stub", namespace: "stub" }));
      b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "selfcheck-withdraw-failpaths"));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
    },
  }],
});
const { useApp, countWithdrawalsOnPlatformDay } =
  await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text, "utf8").toString("base64"));

const app = useApp();
const ACCT = "failpath@nexgrid.test";
const FEE = { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1 };
const submit = () => app.submitWithdrawal(50, "USDT-TRC20", "TXfailpath0000000000000000000000001", FEE, false, "failpath", `idem-${serverSeq + 1}`);
function reset() {
  failKey = null;
  disk.clear();
  app.bindAccount(ACCT);
}
/** 磁盘上那份(不是内存)—— 内存/磁盘不对称正是本族的病根,必须分开看。 */
const diskWithdrawals = () => {
  const raw = disk.get(CLOUD_KEY);
  if (!raw) return null;
  const row = JSON.parse(raw)[ACCT];
  return row ? row.withdrawals : null;
};
/** 模拟刷新:丢掉内存,从磁盘重新水合(bindAccount 走的正是真实冷启动那条路)。 */
const refresh = () => { app.bindAccount(ACCT); };

// ── ① 正常路径:建单后内存与磁盘都要有 ────────────────────────────
{
  reset();
  const id = await submit();
  check("① 建单成功返回单号", typeof id === "string" && id.startsWith("WD-FAILPATH-"), String(id));
  check("① 建单后单据在内存里", app.withdrawals.some((w) => w.id === id));
  check("🔴 ① 建单后单据**落到磁盘**(此前只改内存,刷新即丢 —— 本包修的原始缺陷)",
    (diskWithdrawals() ?? []).some((w) => w.id === id),
    JSON.stringify((diskWithdrawals() ?? []).map((w) => w.id)));
}

// ── ② 刷新回归门:今日笔数必须跨刷新存活 ──────────────────────────
{
  reset();
  const id = await submit();
  refresh();
  check("🔴 ② 刷新后单据还在(冷启动从磁盘水合)", app.withdrawals.some((w) => w.id === id),
    JSON.stringify(app.withdrawals.map((w) => w.id)));
  check("🔴 ② 刷新后**今日笔数仍为 1** —— 日限闸不会被一次 F5 清零",
    countWithdrawalsOnPlatformDay(app.withdrawals, Date.now()) === 1,
    String(countWithdrawalsOnPlatformDay(app.withdrawals, Date.now())));
}

// ── ③ 落盘失败注入:单据不许从内存消失 ────────────────────────────
{
  reset();
  await submit();                       // 先落一单成功,制造「磁盘上已有旧行」的前提
  const firstDisk = (diskWithdrawals() ?? []).length;
  failKey = (key) => key === CLOUD_KEY; // 从这一刻起账号快照写不进去
  const id2 = await submit();
  check("🔴🔴 ③ 落盘失败时,刚建的单**仍在内存**(不是被磁盘旧值 adopt 回去而静默丢单)",
    app.withdrawals.some((w) => w.id === id2),
    `内存: ${JSON.stringify(app.withdrawals.map((w) => w.id))}`);
  check("🔴 ③ 落盘失败时今日笔数把这一单也算上(否则日限在设备最脏的时刻反而放行)",
    countWithdrawalsOnPlatformDay(app.withdrawals, Date.now()) === 2,
    String(countWithdrawalsOnPlatformDay(app.withdrawals, Date.now())));
  check("③ 诚实边界:磁盘确实没写进去(失败是真的被注入了,不是断言在空转)",
    (diskWithdrawals() ?? []).length === firstDisk,
    `磁盘 ${(diskWithdrawals() ?? []).length} 条 / 注入前 ${firstDisk} 条`);
}

// ── ④ 诚实边界:落盘失败 + 刷新 = 这一单会丢。写下来,免得被当成已覆盖 ──
{
  reset();
  await submit();
  failKey = (key) => key === CLOUD_KEY;
  const id2 = await submit();
  failKey = null;
  refresh();
  check("④ [已知代价] 落盘失败后再刷新,那一单确实丢失 —— 降级到「磁盘没有」,不是错乱",
    !app.withdrawals.some((w) => w.id === id2) && app.withdrawals.length === 1,
    JSON.stringify(app.withdrawals.map((w) => w.id)));
}

// ── ⑤ 🔴🔴 歧义结局判定:拿**真的 ApiError** 逐格验 ────────────────
// 为什么这一节非有不可:判错的代价是**重复出账**。此前它只有字符串门(把函数改回
// 「每次现造新键」时 114 条断言全绿),而边界本身是用假后端端到端实测出来的 ——
// `createdThen504` 档(先建单再让网关超时)下客户端拿到 http/504,
// 判成「确定」→ 换新键重试 → 服务端真出第二笔(台账 orderCount 2);修正后恒为 1。
// 复现命令见 scripts/dev-stub-backend.mjs 顶部注释。
{
  const mod = await import("data:text/javascript;base64," + Buffer.from(
    (await build({
      stdin: { contents: `export { ApiError, isAmbiguousOutcome } from "@/api/errors";`, resolveDir: root, loader: "ts" },
      bundle: true, write: false, format: "esm",
      define: { "import.meta.env": JSON.stringify({ PROD: false, DEV: true, MODE: "selfcheck" }) },
      plugins: [{ name: "alias", setup(b) { b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "failpaths-errors")); } }],
    })).outputFiles[0].text, "utf8").toString("base64"));
  const { ApiError, isAmbiguousOutcome } = mod;
  const mk = (kind, status) => new ApiError({ kind, message: "X", status });

  // 歧义(必须保留幂等键)—— 服务端**可能已经处理**
  check("🔴🔴 网关超时 504 判为歧义(实测:判错即重复出账)", isAmbiguousOutcome(mk("http", 504)) === true);
  check("🔴 服务端 500 判为歧义", isAmbiguousOutcome(mk("http", 500)) === true);
  check("🔴 请求超时 408 判为歧义", isAmbiguousOutcome(mk("http", 408)) === true);
  check("🔴 连接断(network)判为歧义", isAmbiguousOutcome(mk("network")) === true);
  check("🔴🔴 响应读不懂(protocol)判为歧义 —— 响应已回来,单多半已建",
    isAmbiguousOutcome(mk("protocol", 200)) === true);
  check("🔴 不是 ApiError 的未知错一律判歧义(保守方向 = 不重复出账)",
    isAmbiguousOutcome(new Error("boom")) === true && isAmbiguousOutcome(undefined) === true);

  // 确定(可以换新键)—— 服务端明确拒绝或根本没处理
  check("🔴 业务拒单判为确定", isAmbiguousOutcome(mk("business", 200)) === false);
  check("🔴 鉴权失败判为确定", isAmbiguousOutcome(mk("auth", 401)) === false);
  check("🔴 配置错判为确定", isAmbiguousOutcome(mk("configuration")) === false);
  check("🔴 超额拒单 429 判为确定(它是被拒绝,不是被处理)",
    isAmbiguousOutcome(mk("http", 429)) === false);
  check("🔴 400 参数错判为确定", isAmbiguousOutcome(mk("http", 400)) === false);
  // 🔴 方向性自证:把「歧义」判反的代价是重复出账,判保守的代价只是多留一把键。
  //    所以任何**新增**的错误类别若判不准,必须落在歧义侧 —— 这条断言钉住那个默认。
  check("🔴 默认落在歧义侧(新增未知 kind 时不会悄悄变成「确定」)",
    isAmbiguousOutcome({ kind: "brand-new-kind" }) === true);
}

console.log(`\n${pass} pass / ${fail} fail(样本:真 app store + 真 account-cloud + 真 storage 语义 · 4 组失败/刷新注入 · 12 格歧义判定用真 ApiError)`);
process.exit(fail ? 1 : 0);
