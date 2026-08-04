#!/usr/bin/env node
// 「领奖」族的幂等与顺序自检 — node 直跑:
//   node scripts/selfcheck-claim-idempotency.mjs
//
// 背景(2026-08-04 对抗审计 B-P1-3 / B-P1-4 / P1-4③):
//   「领奖」要同时满足两件互斥的事 —— 资格只能消费一次(防重复领),奖必须发到(不能领了没发)。
//   两种顺序各有一个失效面:
//     · 先消费资格 → 发钱失败,资格没了、奖归零(5 处现状,用户白损失);
//     · 先发钱 → 消费资格失败,下一拍再发一次(里程碑那处实况,平台重复出钱)。
//   只要发钱这一步**可以安全重放**,第二种顺序就没有失效面。postMoneyBillsOnce 按 ref 判重。
//
// 🔴 守的不变量:
//   ① 同一个 ref 重放**不动钱、不写第二条分录**,且返回 "ok"(调用方据此继续消费资格)。
//   ② 首次调用与 postMoneyBills 行为等价(不因判重逻辑改变正常路径)。
//   ③ 空 ref **直接抛错**,不静默降级 —— 静默降级 = 一个看起来幂等其实不幂等的调用点。
//   ④ 各调用点的 ref **不带时间戳**:带时间戳判重永不命中,幂等出口退化成普通出口。
//   ⑤ 顺序门:能反序的四处必须「先发钱后消费资格」;反不过来的两处(签到 / 里程碑,
//      金额由消费动作自己决定)必须有自愈补发。
//
// 方法:①②③ 用 esbuild 载**真收口点 + 真 store** 跑真代码;④⑤ 是结构断言,跑在正主源码上。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";
import { strip } from "./lib/strip-code.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

console.log("selfcheck-claim-idempotency — 领奖族:发钱可重放,资格只消费一次");

// ── 假 storage ──────────────────────────────────────────────────────────────
const disk = new Map();
const uni = {
  getStorageSync(k) { const r = disk.get(k); return r === undefined ? "" : JSON.parse(r); },
  setStorageSync(k, v) { disk.set(k, JSON.stringify(v)); },
  removeStorageSync(k) { disk.delete(k); },
  getSystemInfoSync() { return { language: "en" }; },
};
globalThis.uni = uni;

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
  "vue-stub": `export const ref = (v) => ({ __nxRef: true, value: v });
export const computed = (fn) => ({ __nxRef: true, get value() { return typeof fn === "function" ? fn() : fn.get(); } });
export const reactive = (v) => v;
export const watch = () => {};`,
};
const bundle = await build({
  stdin: {
    contents: `export { postMoneyBills, postMoneyBillsOnce } from "@/lib/money-receipt";
export { useApp } from "@/store/app";
export { useBills } from "@/store/bills";`,
    resolveDir: root, loader: "ts",
  },
  bundle: true, write: false, format: "esm",
  define: { "import.meta.env": JSON.stringify({ PROD: false, DEV: true, MODE: "selfcheck" }) },
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
      b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
      b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "selfcheck-claim-idempotency"));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
    },
  }],
});
const { postMoneyBills, postMoneyBillsOnce, useApp, useBills } =
  await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text, "utf8").toString("base64"));

const ACCT = "claim-idem@nexgrid.test";
const app = useApp();
const bills = useBills();
function reset() {
  disk.clear();
  app.bindAccount(ACCT);
  bills.bindAccount(ACCT);
  const u = app.user;
  app.user = { ...u, usdtBalance: 1000, nexBalance: 500 };
  app.persistAccountSnapshot();
  bills.bills = [];
}
const draft = (ref) => [{ type: "bonus", symbol: "NEX", amount: 30, status: "posted", memo: "probe", ref }];

// ── ① 重放不动钱、不写第二条,且返回 ok ───────────────────────────────────────
{
  reset();
  const nexBefore = app.user.nexBalance;
  const r1 = postMoneyBillsOnce(draft("PROBE-STABLE"));
  const nexAfter1 = app.user.nexBalance;
  const count1 = bills.bills.length;
  const r2 = postMoneyBillsOnce(draft("PROBE-STABLE"));
  const nexAfter2 = app.user.nexBalance;
  const count2 = bills.bills.length;
  check("① 首次调用正常发钱 + 写分录", r1 === "ok" && nexAfter1 === nexBefore + 30 && count1 === 1,
    `r1=${r1} nex=${nexBefore}→${nexAfter1} bills=${count1}`);
  check("① 🔴 同 ref 重放:返回 ok 但**钱一分没动、分录一条没加**", r2 === "ok" && nexAfter2 === nexAfter1 && count2 === count1,
    `r2=${r2} nex=${nexAfter1}→${nexAfter2} bills=${count1}→${count2}`);
  // 反向靶:换个 ref 就该真发 —— 证明上面那条不是「什么都没做」的空转
  const r3 = postMoneyBillsOnce(draft("PROBE-OTHER"));
  check("① 反向靶:换 ref 照常发(证明判重不是一律拒绝)",
    r3 === "ok" && app.user.nexBalance === nexAfter2 + 30 && bills.bills.length === count2 + 1);
}

// ── ② 首次路径与 postMoneyBills 等价 ─────────────────────────────────────────
{
  reset();
  const a = postMoneyBills(draft("EQ-A"));
  const nexA = app.user.nexBalance;
  reset();
  const b = postMoneyBillsOnce(draft("EQ-B"));
  const nexB = app.user.nexBalance;
  check("② 首次路径与 postMoneyBills 等价(结果与余额都一致)", a === b && nexA === nexB, `${a}/${b} ${nexA}/${nexB}`);
}

// ── ③ 空 ref 直接抛错,不静默降级 ────────────────────────────────────────────
{
  reset();
  let threw = false;
  try { postMoneyBillsOnce([{ type: "bonus", symbol: "NEX", amount: 1, status: "posted", memo: "x" }]); }
  catch { threw = true; }
  check("③ 🔴 空 ref 直接抛错(静默降级 = 看起来幂等其实不幂等的调用点)", threw);
}

// ── ④ 调用点的 ref 不带时间戳 ────────────────────────────────────────────────
{
  const SITES = [
    "src/components/home/weekly-quest-hero.vue",
    "src/components/home/weekly-quest-list.vue",
    "src/pages/events/events.vue",
    "src/pages/me/achievements.vue",
    "src/pages/daily/daily.vue",
  ];
  const bad = [];
  for (const rel of SITES) {
    // 🔴 过 strip:文件头注里常写着示例调用(实测 hero / achievements 的头注就有
    // `wq.claimTier1()` 与 `postMoneyBills`),不剥的话顺序门会拿文档当代码,报假阳性。
    const src = strip(readFileSync(path.join(root, rel), "utf8"));
    // 抠出每个 postMoneyBillsOnce( 的实参块,看里面的 ref 有没有掺时间戳
    let from = 0;
    for (;;) {
      const i = src.indexOf("postMoneyBillsOnce(", from);
      if (i < 0) break;
      let depth = 0, j = i + "postMoneyBillsOnce".length;
      for (; j < src.length; j++) {
        if (src[j] === "(") depth++;
        else if (src[j] === ")") { depth--; if (depth === 0) { j++; break; } }
      }
      const args = src.slice(i, j);
      // 🔴 判据不能用 `ref:[^,}]*` —— 模板串里的 `${ev.id}` 自带一个 `}`,字符类当场被挡住,
      // 于是 `ref: \`EVENT-${ev.id}-${Date.now()}\`` 这种真·假幂等一个都抓不到(红测实测漏判)。
      // 改成:从 `ref:` 取到**本行结尾**再判 —— ref 一律写在一行内,足够且不会被 `}` 截断。
      for (const m of args.matchAll(/ref:([^\r\n]*)/g)) {
        if (/(Date\.now|mockServerNow|Math\.random)/.test(m[1])) {
          bad.push(`${rel}(ref 掺了时间戳/随机数:${m[1].trim().slice(0, 48)})`);
        }
      }
      from = j;
    }
  }
  check(`④ 🔴 ${SITES.length} 个调用点的 ref 全部稳定(带时间戳 = 判重永不命中 = 假幂等)`,
    bad.length === 0, bad.join(" | "));
}

// ── ⑤ 顺序门 ────────────────────────────────────────────────────────────────
{
  // 能反序的四处:发钱必须排在消费资格之前
  const ORDERED = [
    ["src/components/home/weekly-quest-hero.vue", "wq.claimTier1()"],
    ["src/components/home/weekly-quest-list.vue", "wq.claimTier2("],
    ["src/pages/events/events.vue", "eventQuest.claim("],
    ["src/pages/me/achievements.vue", "ach.claim("],
  ];
  const wrong = [];
  for (const [rel, consume] of ORDERED) {
    const src = strip(readFileSync(path.join(root, rel), "utf8"));
    const post = src.indexOf("postMoneyBillsOnce(");
    const eat = src.indexOf(consume);
    if (post < 0 || eat < 0) { wrong.push(`${rel}(锚点找不到:post=${post} consume=${eat})`); continue; }
    if (post > eat) wrong.push(`${rel}(消费资格排在发钱之前)`);
  }
  check(`⑤ 可反序的 ${ORDERED.length} 处:发钱排在消费资格之前`, wrong.length === 0, wrong.join(" | "));

  // 反不过来的两处(daily 的签到与里程碑,金额由消费动作自己决定)必须有自愈补发
  const daily = strip(readFileSync(path.join(root, "src", "pages", "daily", "daily.vue"), "utf8"));
  check("⑤ 反不过来的两处有自愈补发(reconcileFaucetBills)且真的被挂上",
    /function reconcileFaucetBills\(/.test(daily) && /onMounted\([\s\S]{0,200}reconcileFaucetBills\(\)/.test(daily));
  // 🔴 判据只能用**代码结构**,不能用字符串字面量的内容 —— strip 会把模板串的字面部分抹掉
  // (那是它的正确行为:字面量里不可能有调用)。第一版写了 `STREAK-D${m.day}` 当判据,
  // 剥完就找不到,自己把自己判红了。改判「自愈函数体里同时走了两条数据源」。
  const reconcile = daily.slice(daily.indexOf("function reconcileFaucetBills("));
  const body = reconcile.slice(0, reconcile.indexOf("\nfunction ", 1));
  check("⑤ 自愈覆盖两类:签到(取 faucet 流水)+ 里程碑(取静态档位表)",
    /signInRef\(/.test(body) && /faucet\.claimedMilestones/.test(body) && /MILESTONES\.find\(/.test(body),
    `signInRef=${/signInRef\(/.test(body)} milestones=${/faucet\.claimedMilestones/.test(body)} table=${/MILESTONES\.find\(/.test(body)}`);
}

console.log(`\n${pass} pass / ${fail} fail(样本:3 组行为固定靶(真收口点 + 真 store)· 5 个调用点扫 ref 稳定性 · 4 处顺序门 + 2 处自愈门)`);
process.exit(fail === 0 ? 0 : 1);
