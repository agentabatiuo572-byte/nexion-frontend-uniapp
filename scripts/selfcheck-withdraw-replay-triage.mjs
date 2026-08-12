#!/usr/bin/env node
// 提现失败分诊的**重放感知**行为门 —— node scripts/selfcheck-withdraw-replay-triage.mjs
//
// 背景(2026-08-12,两路独立审计各自点名同一根因):
// 分诊此前只回答「**这一次**尝试在服务端定局了没有」。首次提交时那就是全部,
// 但**重放**时要回答的是「**上一次**那笔落库了没有」——两者只在「服务端幂等查询排在
// 所有拒绝之前」这个前提下等价,而 401 / 429 / 地区策略都是**边缘层**拒绝,排在它之前。
// 拿它们退役幂等键 ⇒ 下一次就是新键 ⇒ **服务端出第二笔**。
//
// 🔴 本门守的不变量:**重放路径上只有「成功」与「409」算定局**,其余一律保留键。
// 判据不是读注释,是把页面的分诊规则抽出来、拿**真的 ApiError** 逐格跑。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = readFileSync(path.join(root, "src/pages/me/wallet-withdraw.vue"), "utf8");

// 真模块:isSettledRejection / isIdempotencyConflict 都从 src/api/errors.ts 现取,不复制第二份
const errSrc = readFileSync(path.join(root, "src/api/errors.ts"), "utf8");
const js = transformSync(errSrc, { loader: "ts", format: "cjs" }).code;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { ApiError, isSettledRejection, isIdempotencyConflict } = mod.exports;

let bad = 0, total = 0;
const check = (name, cond) => {
  total++;
  if (cond) console.log(`  PASS  ${name}`);
  else { bad++; console.log(`  FAIL  ${name}`); }
};

// ── ① 接线:页面的分诊必须**知道这是不是重放** ──────────────────────────
// 形状判据守不住行为,但「catch 段里连 pending/isReplay 都不提」是**必要条件**级的洞:
// 一个字都不提,就不可能区分首次与重放。
// 🔴 **先证起点**:handleSubmit 里有**两个** `} catch (err) {` —— 前一个是资格评估的,
// 后一个才是分诊。第一版按「handleSubmit 之后的第一个」取,抠到的是前者(636 字符),
// 两格判据于是对着错的目标报「不满足」。改成从分诊的特征行**反向**定位它所属的 catch,
// 并在下面断言四档标记齐全 —— 靶进错分支时本门自己判红,不许静默给结论。
const anchor = page.indexOf("const isReplay = pending !== null;");
assert.notEqual(anchor, -1, "定位不到分诊的 isReplay 锚 —— 判据失效,判红");
const catchAt = page.lastIndexOf("} catch (err) {", anchor);
assert.notEqual(catchAt, -1, "锚之前找不到 catch 段 —— 判据失效,判红");
// 🔴 取整段,不切固定长度:第一版用 `slice(catchAt, +4000)`,而 catch 段开头那截说明就把
// 窗口吃光了,两格判据**根本没扫到目标**却报「不满足」—— 判据自己失效,不是代码坏。
// 本仓记过的同族坑(切片窗口切在半路)。改成大括号配平抠整段,并对「抠不出来」显式判红。
const catchSeg = (() => {
  const open = page.indexOf("{", catchAt);
  let depth = 0;
  for (let i = open; i < page.length; i++) {
    if (page[i] === "{") depth++;
    else if (page[i] === "}" && --depth === 0) return page.slice(open, i + 1);
  }
  return "";
})();
assert.notEqual(catchSeg, "", "抠不出 catch 段的平衡体 —— 判据失效,判红");
assert.ok(catchSeg.length > 1500, `catch 段只抠到 ${catchSeg.length} 字符,不像完整分诊 —— 判据失效,判红`);
// 四档标记齐全,才算抠对了段。少一个 = 靶进错分支,本门判红而不是给个「不满足」的结论。
for (const marker of ["isDailyLimitRejection(err)", "isIdempotencyConflict(err)", "isSettledRejection(err)", "withdrawOutcomeUnknownTitle"]) {
  assert.ok(catchSeg.includes(marker), `抠出的段里没有 ${marker} —— 抠错了目标,判据失效,判红`);
}
check("catch 分诊引用了「这是不是重放」(pending / isReplay)", /\bisReplay\b|\bpending\b/.test(catchSeg));
check("日限那档不再无条件退役幂等键", !/isDailyLimitRejection\(err\)\)\s*\{\s*\r?\n\s*forgetWithdrawAttempt/.test(catchSeg));
check("重放路径上,「确定拒绝」那档不退役键(退役被 !isReplay 门住)",
  /if \(isSettledRejection\(err\)\) \{[\s\S]{0,200}?if \(!isReplay\) forgetWithdrawAttempt/.test(catchSeg));
check("409 那档**无条件**退役(它是重放路径上唯一的定局)",
  /if \(isIdempotencyConflict\(err\)\) \{\s*\r?\n\s*forgetWithdrawAttempt/.test(catchSeg));
check("结果未知那档绝不刷费率(刷了 policyVersion 就变,重放 body 跟着变 → 撞 409)",
  !/withdrawOutcomeUnknownTitle[\s\S]{0,400}loadWithdrawalPolicy/.test(catchSeg));

// ── ② 行为:把页面规则代进真 ApiError 逐格跑 ─────────────────────────────
// 与页面同一套判据(从真模块取),不在这里复制第二份推导。
const decide = (err, isReplay) => {
  if (isIdempotencyConflict(err)) return "retire";
  if (isSettledRejection(err)) return isReplay ? "keep" : "retire";
  return "keep";
};
const http = (status) => new ApiError({ kind: "http", message: `HTTP_${status}`, status });
const CASES = [
  // [名字, 错误, 首次期望, 重放期望]
  ["409 幂等冲突", http(409), "retire", "retire"],
  ["401 鉴权失败(边缘层,重放时对上一次零信息量)", new ApiError({ kind: "auth", message: "SESSION_EXPIRED", status: 401 }), "retire", "keep"],
  ["业务拒单", new ApiError({ kind: "business", message: "REVIEW_BLOCKED" }), "retire", "keep"],
  ["403 地区限制", http(403), "retire", "keep"],
  ["400 参数错", http(400), "retire", "keep"],
  ["429 限流(通用)", http(429), "keep", "keep"],
  ["408 请求超时", http(408), "keep", "keep"],
  ["504 网关超时", http(504), "keep", "keep"],
  ["500 服务端错", http(500), "keep", "keep"],
  ["网络断", new ApiError({ kind: "network", message: "NETWORK_UNAVAILABLE" }), "keep", "keep"],
  ["响应读不懂", new ApiError({ kind: "protocol", message: "BAD_RESPONSE" }), "keep", "keep"],
  ["客户端配置错", new ApiError({ kind: "configuration", message: "REMOTE_API_DISABLED_IN_MOCK_MODE" }), "keep", "keep"],
  ["非 ApiError 的意外", new Error("boom"), "keep", "keep"],
];
for (const [name, err, first, replay] of CASES) {
  check(`首次 · ${name} → ${first}`, decide(err, false) === first);
  check(`重放 · ${name} → ${replay}`, decide(err, true) === replay);
}

// 🔴 核心不变量,单独钉一格:重放路径上退役键的**只能**是 409。
const retiredOnReplay = CASES.filter(([, err]) => decide(err, true) === "retire").map(([n]) => n);
check(`重放路径上退役键的只有 409(实得:${retiredOnReplay.join(" / ") || "无"})`,
  retiredOnReplay.length === 1 && retiredOnReplay[0].startsWith("409"));

const FLOOR = 30;
if (total < FLOOR) {
  console.log(`FAIL  只跑了 ${total} 格,低于登记的 ${FLOOR} 格 —— 靶被删或没执行`);
  process.exit(1);
}
console.log(bad === 0
  ? `replay-triage PASS —— ${total}/${total}(接线 5 格 + 行为 ${CASES.length * 2} 格 + 不变量 1 格)`
  : `replay-triage FAIL —— ${bad}/${total} 格`);
process.exit(bad === 0 ? 0 : 1);
