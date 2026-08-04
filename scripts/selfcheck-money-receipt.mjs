#!/usr/bin/env node
// 「资金 ⊗ 收据」不变量自检 — node 直跑,不起浏览器:
//   node scripts/selfcheck-money-receipt.mjs
//
// 背景(2026-08-04 R4 ·「钱动了、账没记上」缺陷族,≥3 次同型复发):
//   落盘失败在这一层是**静默**的 —— account-cloud 写不进去只是 persisted:false,
//   bills.add 写不进去只是 return null,两者都不抛异常;而调用方一律按「一定成功」
//   继续铸货、写账单、弹成功提示。实测四处同型:app.ts 四个资金原语丢弃 persist 结果、
//   创世购买 / 结算 / 复投三处丢弃 bills.add 返回值。最惨的一格是近 $15k 已扣、席位已铸、
//   弹「购买成功」,账单页查无此单。
//
// 🔴 守的不变量(编号对应红测文档 docs/changes/2026-08-04-receipt-invariant-redtest.md):
//   ① 资金原语落盘失败 → 返回 false 且**内存不脏**(内存与磁盘不许不对称)。
//   ② bills 写失败 → 收口点整笔回滚 + 报失败:不许出现「钱动了、账没记上」。
//   ③ 退款把 withdrawableUsdt 还原到扣款前(裸 creditBalance 只加总余额 = 可提额永久压低)。
//   ④ 成功路径与改前等价(负控:金额 / 舍入 / clamp / 守卫拒绝 一个不变)。
//   ⑤ 接线门:三处调用点真的走了收口点(判定对不对 / 有没有被接上是两道门)。
//   ⑥ 迁移棘轮:仍在裸调 bills.add 的存量点只许减不许增(收口点已就位,新代码没有借口)。
//   ⑦ 多腿交易(兑换一进一出)原子性:两条分录**一次落盘**,失败时两腿资金一起还原,
//     账上零残留 —— 尤其不许只剩一条(半边账)。
//
// 方法:行为断言用 esbuild 载**真 store + 真收口点**跑真代码(不抄判据副本),假 uni storage
// 可定点注入写失败;结构断言跑在**剥注释后的正主源码**上(注释里出现判定式文本不得哄绿)。
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");

const samples = { primitives: 4, targets: 0, scanned: 0, ledgerFiles: 0, locales: 0 };
let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
/** 行首 // 与块注释一起剥 —— 只剥「整行就是注释」的,不碰 url 里的 //。 */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
/** 从 needle 起花括号配对抠出整块原文。抠不到 = 实现被改名/删除,直接炸(不许静默放行)。 */
function grabBlock(src, needle) {
  const start = src.indexOf(needle);
  if (start < 0) throw new Error(`selfcheck-money-receipt: 源码里找不到 \`${needle}\`(实现被改名或删除?)`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`selfcheck-money-receipt: \`${needle}\` 括号不闭合`);
}

console.log("selfcheck-money-receipt — 资金变更 ⊗ 收据:落盘失败不许静默");

// ── 假 uni storage:JSON 序列化(与 localStorage 同语义);写失败可按 key 定点注入 ──
const disk = new Map();
let failKey = null; // (key, nthWriteToThatKey) => boolean;命中即抛,模拟配额撑满 / storage 不可用
const writes = []; // 落盘次数台账 —— 「两条分录一次落盘」这条不变量只有数写入次数才证得出来
const uni = {
  getStorageSync(key) {
    const raw = disk.get(key);
    return raw === undefined ? "" : JSON.parse(raw);
  },
  setStorageSync(key, value) {
    writes.push(key);
    if (failKey && failKey(key, writes.filter((k) => k === key).length)) throw new Error("QuotaExceededError (injected)");
    disk.set(key, JSON.stringify(value));
  },
  removeStorageSync(key) { disk.delete(key); },
  getSystemInfoSync() { return { language: "en" }; },
};
globalThis.uni = uni;

const CLOUD_KEY = "nexgrid-account-cloud-v1";
const BILLS_KEY = "nexgrid-bills-accounts-v1";

// ── 载真代码。pinia stub 必须复刻两条真语义,否则测的不是线上那条路径:
//    ① 记忆化:一个 id 一个实例(否则收口点里的 useApp() 每次新建,状态对不上);
//    ② **自动解包 ref**:store 上的 `app.user` 在真 pinia 里就是 UserState,不是 {value}。
//       少了这条,收口点里 `app.user.usdtBalance` 恒 undefined —— 判据会静默走错分支而全绿。 ──
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
    contents: `export { postMoneyBill, postMoneyBills, postReceiptOnly } from "@/lib/money-receipt";
export { useApp } from "@/store/app";
export { useBills } from "@/store/bills";
export { useUI } from "@/store/ui";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true, write: false, format: "esm",
  // vite 注入的编译期常量;node 里没有 import.meta.env,不 define 会在模块顶层直接炸。
  define: { "import.meta.env": JSON.stringify({ PROD: false, DEV: true, MODE: "selfcheck" }) },
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
      b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
      b.onResolve({ filter: /^@\// }, (a) => {
        const base = path.join(SRC, a.path.slice(2));
        // 文件优先于目录:`@/i18n` 既是目录也有 index.ts,先命中目录会让 esbuild 读目录报错。
        const hit = [`${base}.ts`, path.join(base, "index.ts"), base].find((p) => existsSync(p) && statSync(p).isFile());
        if (!hit) throw new Error(`selfcheck-money-receipt: 解析不到 ${a.path}`);
        return { path: hit };
      });
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
    },
  }],
});
const { postMoneyBill, postMoneyBills, postReceiptOnly, useApp, useBills, useUI } =
  await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text, "utf8").toString("base64"));

const app = useApp();
const bills = useBills();
const ui = useUI();
const ACCT = "receipt-invariant@nexgrid.test";

/** 把账号重置到一个干净的起点(总余额 = 可提额度 = usdt)。 */
function reset({ usdt = 10000, nex = 500, withdrawable = null } = {}) {
  failKey = null;
  disk.clear();
  app.bindAccount(ACCT);
  bills.bindAccount(ACCT);
  // 🔴 必须整体换新对象:user 与 lastCloudSnapshot.user 是同一个引用,原地改会把
  // 三路合并的 base 一起改掉 → delta 恒为 0,种子写不进去(种到一半比种不进去更难查)。
  const u = app.user;
  app.user = {
    ...u,
    usdtBalance: usdt,
    nexBalance: nex,
    earningBuckets: { ...u.earningBuckets, withdrawableUsdt: withdrawable === null ? usdt : withdrawable },
  };
  app.persistAccountSnapshot();
  bills.bills = []; // 丢掉 mock 种子的 30 天流水,账单条数断言才有意义
  ui.toasts = [];
  writes.length = 0;
  return money();
}
function money() {
  const u = app.user;
  return { usdt: u.usdtBalance, nex: u.nexBalance, withdrawable: u.earningBuckets.withdrawableUsdt };
}
/** 磁盘上那份(不是内存)—— 内存/磁盘不对称正是本族的病根,必须分开看。 */
function diskMoney() {
  const u = uni.getStorageSync(CLOUD_KEY)?.[ACCT]?.user;
  return u ? { usdt: u.usdtBalance, nex: u.nexBalance, withdrawable: u.earningBuckets?.withdrawableUsdt } : null;
}
function billCount() {
  return (uni.getStorageSync(BILLS_KEY)?.[ACCT]?.bills ?? []).length;
}
function writesTo(key) {
  return writes.filter((k) => k === key).length;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const draft = (over = {}) => ({ type: "purchase", symbol: "USDT", amount: -100, status: "posted", memo: "selfcheck", ...over });

// ── ① 资金原语落盘失败 → 返回 false 且内存不脏 ────────────────────────────────────
{
  const PRIMS = [
    ["debitBalance", () => app.debitBalance(250)],
    ["creditBalance", () => app.creditBalance(250)],
    ["debitNex", () => app.debitNex(60)],
    ["creditNex", () => app.creditNex(60)],
  ];
  samples.targets += PRIMS.length;
  for (const [name, run] of PRIMS) {
    const before = reset();
    const beforeDisk = diskMoney();
    failKey = (k) => k === CLOUD_KEY; // 只让资金落盘失败
    const ok = run();
    check(`① ${name} 落盘失败时返回 false(不再"改了内存就当成功")`, ok === false, `返回 ${ok}`);
    check(`① 🔴 ${name} 落盘失败后**内存不脏**(与磁盘保持对称,刷新不会回退)`,
      same(money(), before), `内存 ${JSON.stringify(money())} vs 期望 ${JSON.stringify(before)}`);
    check(`① ${name} 落盘失败后磁盘原样未动`, same(diskMoney(), beforeDisk));
  }
}

// ── ② bills 写失败 → 整笔回滚 + 报失败(核心:不许"钱动了、账没记上")──────────────
{
  samples.targets += 2;
  const before = reset();
  failKey = (k) => k === BILLS_KEY; // 资金写得进去,收据写不进去
  const outcome = postMoneyBill(draft({ amount: -1500 }));
  check("② 收口点报失败(不再返回成功)", outcome === "failed", `outcome=${outcome}`);
  check("② 🔴 资金被整笔还原 —— 内存里钱没少", same(money(), before), JSON.stringify(money()));
  check("② 🔴 磁盘上钱也没少(内存假装回滚、磁盘还扣着 = 刷新即少钱)",
    same(diskMoney(), { usdt: before.usdt, nex: before.nex, withdrawable: before.withdrawable }),
    JSON.stringify(diskMoney()));
  check("② 账上一条记录都不留(内存 + 磁盘)", bills.bills.length === 0 && billCount() === 0);
  check("② 🔴 用户看得到失败提示(静默吞掉 = 用户以为成功)",
    ui.toasts.some((t) => t.kind === "error"), JSON.stringify(ui.toasts));
  // 反向断言:本族的病症形态 = 钱动了 && 账上无凭证。这一条为 false 才算病治好。
  const moneyMoved = !same(money(), before) || !same(diskMoney(), { usdt: before.usdt, nex: before.nex, withdrawable: before.withdrawable });
  check("② 🔴 病症形态不成立:「钱动了 && 没收据」为假", !(moneyMoved && billCount() === 0));

  // 入账方向同样收口(试用返还 / 奖励走的是这条)
  const before2 = reset();
  failKey = (k) => k === BILLS_KEY;
  const credited = postMoneyBill(draft({ type: "bonus", amount: 88 }));
  check("② 入账方向同样回滚(+88 收据写失败 → 余额没多出来)",
    credited === "failed" && same(money(), before2), `${credited} / ${JSON.stringify(money())}`);
  const beforeNex = reset();
  failKey = (k) => k === BILLS_KEY;
  const nexed = postMoneyBill(draft({ type: "bonus", symbol: "NEX", amount: 120 }));
  check("② NEX 方向同样回滚(symbol 决定动哪种币,回滚也按同一维度)",
    nexed === "failed" && same(money(), beforeNex), `${nexed} / ${JSON.stringify(money())}`);

  // 资金侧写失败时压根不该写收据(否则变成反向病症:账记了、钱没动)
  reset();
  failKey = (k) => k === CLOUD_KEY;
  const moneyFailed = postMoneyBill(draft({ amount: -300 }));
  check("② 资金写失败时收据也不落(反向病症:账记了、钱没动)",
    moneyFailed === "failed" && bills.bills.length === 0);
}

// ── ③ 退款把 withdrawableUsdt 还原到扣款前 ───────────────────────────────────────
{
  samples.targets += 1;
  // 审计场景:可提 $8000 的账号,扣掉 7999 后可提被 clamp 到 1;退款若只加总余额,
  // 可提额度就永久停在 1 —— 钱回来了却提不出去。
  const before = reset({ usdt: 8000, withdrawable: 8000 });
  const snapshot = app.captureMoney(); // 调用点拿到的就是这份(不是测试自己拼的形状)
  const paid = postMoneyBill(draft({ amount: -7999 }));
  check("③ 扣款成功,可提额度被 clamp 到剩余总余额(既有不变量,未改)",
    paid === "ok" && money().usdt === 1 && money().withdrawable === 1, JSON.stringify(money()));
  check("③ captureMoney 返回的就是资金三元组(字段名与 restoreMoney 对得上)",
    same(Object.keys(snapshot).sort(), ["nexBalance", "usdtBalance", "withdrawableUsdt"]), Object.keys(snapshot).join(","));

  const reversed = postMoneyBill(draft({ amount: 7999, memo: "reversal" }), { restoreTo: snapshot });
  check("③ 🔴 冲正后 withdrawableUsdt 恢复到扣款前(不是停在被 clamp 的 1)",
    reversed === "ok" && same(money(), before), JSON.stringify(money()));
  check("③ 冲正也落到磁盘(内存对、磁盘不对 = 刷新又变回去)",
    same(diskMoney(), { usdt: before.usdt, nex: before.nex, withdrawable: before.withdrawable }), JSON.stringify(diskMoney()));
  check("③ 冲正是**反向分录**不是改写原行:扣款行 + 退款行两条并存,净额为 0",
    bills.bills.length === 2
    && bills.bills.reduce((s, b) => s + b.amount, 0) === 0, JSON.stringify(bills.bills.map((b) => b.amount)));

  // 负控:证明「裸 creditBalance 退款」确实还不回可提额度 —— 不变量②的必要性不是臆想
  const before2 = reset({ usdt: 8000, withdrawable: 8000 });
  app.debitBalance(7999);
  app.creditBalance(7999);
  check("③ 负控:裸 creditBalance 退款**还不回**可提额度(所以退款必须走 restoreTo)",
    money().usdt === before2.usdt && money().withdrawable === 1, JSON.stringify(money()));
}

// ── ④ 成功路径负控:与改前逐项等价 ───────────────────────────────────────────────
{
  samples.targets += 1;
  // 用二进制可精确表示的金额下靶(0.25 / 0.5),再单独测「两位小数截断」这条属性,
  // 免得断言写成浮点噪声(0.005 那类值本身就落在 toFixed 的边界上,测不出语义)。
  reset({ usdt: 1000.25, nex: 300 });
  check("④ 成功路径:扣款金额与舍入不变(两位小数,与改前同一条表达式)",
    app.debitBalance(0.25) === true && app.user.usdtBalance === 1000, `${app.user.usdtBalance}`);
  check("④ 成功路径:入账金额与舍入不变",
    app.creditBalance(0.25) === true && app.user.usdtBalance === 1000.25, `${app.user.usdtBalance}`);
  check("④ 成功路径:两位小数截断照旧(0.001 级零头不进余额)",
    app.debitBalance(0.001) === true && app.user.usdtBalance === 1000.25, `${app.user.usdtBalance}`);
  check("④ 成功路径:NEX 双向不变",
    app.debitNex(0.5) === true && app.user.nexBalance === 299.5
    && app.creditNex(0.5) === true && app.user.nexBalance === 300, `${app.user.nexBalance}`);

  reset({ usdt: 100, nex: 10 });
  check("④ 守卫拒绝语义不变:NaN / Infinity / 负数 / 余额不足 一律 false 且零副作用",
    [app.debitBalance(NaN), app.debitBalance(Infinity), app.debitBalance(-1), app.debitBalance(101),
      app.creditBalance(NaN), app.creditBalance(-1),
      app.debitNex(NaN), app.debitNex(-1), app.debitNex(11), app.creditNex(NaN), app.creditNex(-1)].every((r) => r === false)
    && app.user.usdtBalance === 100 && app.user.nexBalance === 10);

  const start = reset({ usdt: 5000, withdrawable: 5000 });
  const ok = postMoneyBill(draft({ amount: -1234.56, ref: "SC-OK-1" }));
  check("④ 成功路径:收口点返回 ok,余额精确扣减,账上正好一条",
    ok === "ok" && money().usdt === +(start.usdt - 1234.56).toFixed(2) && bills.bills.length === 1);
  check("④ 成功路径:资金与收据都真落盘(不是只在内存里好看)",
    diskMoney().usdt === money().usdt && billCount() === 1);
  check("④ 收据字段原样透传(type / symbol / status / memo / ref 一个不改)",
    (() => { const b = bills.bills[0];
      return b.type === "purchase" && b.symbol === "USDT" && b.status === "posted" && b.memo === "selfcheck" && b.ref === "SC-OK-1"; })());
  check("④ 余额不足与落盘失败是两种结果(前者零副作用,调用点用自己的文案)",
    postMoneyBill(draft({ amount: -999999 })) === "insufficient" && bills.bills.length === 1);
  check("④ 金额非法(0 / NaN)零副作用",
    postMoneyBill(draft({ amount: 0 })) === "insufficient" && postMoneyBill(draft({ amount: NaN })) === "insufficient"
    && bills.bills.length === 1);

  // postReceiptOnly:资金已不可回滚时的既定处置 = 明确告知,绝不静默
  reset();
  check("④ postReceiptOnly 正常写入返回 true", postReceiptOnly(draft({ amount: -10, ref: "SC-RO" })) === true);
  ui.toasts = [];
  failKey = (k) => k === BILLS_KEY;
  check("④ 🔴 postReceiptOnly 写失败返回 false 且弹错(不可回滚场景也不许静默)",
    postReceiptOnly(draft({ amount: -10, ref: "SC-RO-2" })) === false
    && ui.toasts.some((t) => t.kind === "error"));
  failKey = null;
}

// ── ⑦ 多腿交易(兑换:一进一出两腿 + 两条分录)原子性 ────────────────────────────────
// 设计裁决:两条分录**一次落盘**(bills.addMany 单次 persist)。因此「第一条落了、第二条
// 失败」的中间态不存在 —— 既不需要删第一条,也不需要补冲正分录(没有既成事实可冲)。
{
  samples.targets += 3;
  // (a) 成功路径:两腿资金都动、正好两条分录、且**只写了一次盘**(原子性的活体证明)
  const start = reset({ usdt: 1000, nex: 200 });
  const billWritesBefore = writesTo(BILLS_KEY);
  const ok = postMoneyBills([
    { type: "swap", symbol: "USDT", amount: -100, status: "posted", memo: "swap out", ref: "SW-1" },
    { type: "swap", symbol: "NEX", amount: 1176, status: "posted", memo: "swap in", ref: "SW-1" },
  ]);
  check("⑦ 一进一出成功:两腿资金都动(USDT −100 / NEX +1176)",
    ok === "ok" && money().usdt === start.usdt - 100 && money().nex === start.nex + 1176, JSON.stringify(money()));
  check("⑦ 🔴 两条分录**一次落盘**(写盘次数 = 1;循环调 add 会是 2,那才有半边账的中间态)",
    writesTo(BILLS_KEY) - billWritesBefore === 1, `写了 ${writesTo(BILLS_KEY) - billWritesBefore} 次`);
  check("⑦ 两条分录都在,且共用同一时刻(它们本来就是同一笔交易)",
    billCount() === 2 && bills.bills[0].ts === bills.bills[1].ts && bills.bills[0].id !== bills.bills[1].id);

  // (b) 分录写失败 → **两腿**资金都还原、账上零残留(绝不允许留半边账)
  const before = reset({ usdt: 1000, nex: 200 });
  failKey = (k) => k === BILLS_KEY;
  const failed = postMoneyBills([
    { type: "swap", symbol: "USDT", amount: -100, status: "posted", memo: "swap out", ref: "SW-2" },
    { type: "swap", symbol: "NEX", amount: 1176, status: "posted", memo: "swap in", ref: "SW-2" },
  ]);
  check("⑦ 🔴 分录写失败 → 两腿资金都还原(USDT 与 NEX 同时回到交易前)",
    failed === "failed" && same(money(), before), JSON.stringify(money()));
  check("⑦ 🔴 账上零残留 —— 尤其不许只剩一条(半边账比没有账更难对)",
    bills.bills.length === 0 && billCount() === 0, `${bills.bills.length} / ${billCount()}`);

  // (c) 第二腿资金落盘失败 → 第一腿也要退回来(资金原语只保证自己那一次的对称)
  const before2 = reset({ usdt: 1000, nex: 200 });
  const cloudWrites = writesTo(CLOUD_KEY);
  failKey = (k, n) => k === CLOUD_KEY && n === cloudWrites + 2; // 放行第一腿,炸第二腿
  const legFailed = postMoneyBills([
    { type: "swap", symbol: "USDT", amount: -100, status: "posted", memo: "swap out", ref: "SW-3" },
    { type: "swap", symbol: "NEX", amount: 1176, status: "posted", memo: "swap in", ref: "SW-3" },
  ]);
  failKey = null;
  check("⑦ 🔴 第二腿落盘失败 → 第一腿已扣的钱也退回(不留「扣了没换到」)",
    legFailed === "failed" && same(money(), before2), `${legFailed} / ${JSON.stringify(money())}`);
  check("⑦ 第二腿失败时一条分录都不写", bills.bills.length === 0 && billCount() === 0);

  // (d) 合计预检:两腿各自够、合计不够 —— 必须零副作用退出,不许扣了第一腿才发现
  reset({ usdt: 150, nex: 0 });
  const overdrawn = postMoneyBills([
    { type: "purchase", symbol: "USDT", amount: -100, status: "posted", memo: "a", ref: "SW-4" },
    { type: "purchase", symbol: "USDT", amount: -100, status: "posted", memo: "b", ref: "SW-4" },
  ]);
  check("⑦ 合计预检:单腿够 / 合计不够 → insufficient 且零副作用",
    overdrawn === "insufficient" && money().usdt === 150 && bills.bills.length === 0, `${overdrawn} / ${money().usdt}`);
}

// ── ⑤ 接线门:判定对不对 / 有没有被接上,是两道门 ─────────────────────────────────
{
  const appSrc = strip(read("src", "store", "app.ts"));
  for (const fn of ["function creditBalance", "function debitBalance", "function creditNex", "function debitNex"]) {
    const body = grabBlock(appSrc, fn);
    check(`⑤ app.ts ${fn.replace("function ", "")} 接了落盘结果 + 失败回滚`,
      /if \(!persistAccountSnapshot\(\)\)/.test(body) && /adoptAccountSnapshot\(previousSnapshot\)/.test(body),
      body.replace(/\s+/g, " ").slice(0, 100));
  }
  check("⑤ app.ts 暴露 captureMoney / restoreMoney(冲正的唯一正确基准)",
    /captureMoney,\s*restoreMoney/.test(appSrc) && /function restoreMoney\(/.test(appSrc));

  const WIRED = [
    ["src/components/genesis/purchase-sheet.vue", ["postMoneyBill"]],
    ["src/pages/me/wallet-repurchase.vue", ["postMoneyBill"]],
    ["src/pages/store/checkout.vue", ["postMoneyBill", "postReceiptOnly"]],
    ["src/pages/me/wallet-exchange.vue", ["postMoneyBills"]],
  ];
  for (const [rel, needles] of WIRED) {
    const src = strip(readFileSync(path.join(root, rel), "utf8"));
    check(`⑤ ${rel.split("/").pop()} 走收口点且不再裸调 bills.add`,
      needles.every((n) => src.includes(`${n}(`)) && src.includes('from "@/lib/money-receipt"')
      && !/\bbills\.add\(/.test(src), needles.join("+"));
  }
  const locales = ["en", "zh", "vi"];
  samples.locales = locales.length;
  check(`⑤ i18n 失败提示 ${locales.length} 语齐(txNotSaved + billMissing + 两条冲正 memo)`,
    locales.every((l) => {
      const src = read("src", "i18n", "messages", `${l}.ts`);
      return ["txNotSavedTitle:", "txNotSavedMsg:", "billMissingTitle:", "billMissingMsg:", "genesisReversed:", "stakeReversed:"]
        .every((k) => src.includes(k));
    }));
}

// ── ⑥ 迁移棘轮:仍在裸调 bills 写入的存量点只许减不许增 ─────────────────────────────
{
  // 收口点(postMoneyBill / postReceiptOnly)已就位,新代码没有理由再裸调。存量点是本轮
  // 文件边界外的迁移欠账(另有并发 agent 在这些文件上),这道门保证它**只减不增**。
  // 键是文件不是行号 —— 行号会被并发编辑冲掉,文件+条数不会。
  const LEDGER = {
    "src/App.vue": 2,
    "src/components/home/weekly-quest-hero.vue": 2,
    "src/components/home/weekly-quest-list.vue": 2,
    "src/components/lucky-spin-sheet.vue": 2,
    
    "src/components/tradein-sheets.vue": 3,
    "src/lib/share.ts": 2,
    "src/pages/daily/daily.vue": 3,
    "src/pages/events/events.vue": 1,
    "src/pages/genesis/marketplace.vue": 1,
    "src/pages/me/achievements.vue": 2,
    "src/pages/me/wallet-cards-new.vue": 2,
    "src/pages/me/wallet-topup.vue": 1,
    "src/pages/staking/staking.vue": 2,
    "src/pages/store/bundle.vue": 1,
    "src/store/deposits.ts": 3,
  };
  const CHOKEPOINT = "src/lib/money-receipt.ts";
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p = path.join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|vue)$/.test(e)) files.push(p);
    }
  })(SRC);
  samples.scanned = files.length;
  const CALL = /(?:useBills\(\)|bills|billsStore)\.(?:add|addOnce|addForAccount)\(\s*[{a-zA-Z"'`]/g;
  const found = {};
  for (const f of files) {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    if (rel === CHOKEPOINT) continue;
    const src = strip(readFileSync(f, "utf8"));
    for (const line of src.split(/\r?\n/)) {
      CALL.lastIndex = 0;
      const m = CALL.exec(line);
      if (!m) continue;
      // 返回值被丢弃 = 调用处在语句位:调用前缀为空,或以 ; { } 或 `if (…)` 的右括号收尾。
      const prefix = line.slice(0, m.index).trim();
      if (prefix === "" || /[;{}]$/.test(prefix) || /\)$/.test(prefix)) found[rel] = (found[rel] ?? 0) + 1;
    }
  }
  samples.ledgerFiles = Object.keys(LEDGER).length;
  const grown = Object.entries(found).filter(([f, n]) => n > (LEDGER[f] ?? 0));
  const total = Object.values(found).reduce((a, b) => a + b, 0);
  check(`⑥ 🔴 裸调 bills 写入不许新增(扫 ${files.length} 个源文件,存量 ${total} 处 / ${Object.keys(found).length} 文件)`,
    grown.length === 0, grown.map(([f, n]) => `${f}: ${n} > ${LEDGER[f] ?? 0}`).join(" | "));
  // 台账收干净了只是提示不是失败:并发迁移期这会来回抖,而"减少"本身不是回归。
  // 硬门只守"增长"那一面(见上一条)。
  const stale = Object.keys(LEDGER).filter((f) => !(f in found));
  if (stale.length) console.log(`  INFO  ⑥ 台账里这些文件已清空,可从 LEDGER 删除:${stale.join(", ")}`);
  check("⑥ 扫描器没有空转(判据失效 = 空集全过,这一条是它的活体证明)",
    total > 0 && files.length > 100, `total=${total} files=${files.length}`);
}

console.log(`\n${pass} pass / ${fail} fail(样本:${samples.primitives} 个资金原语 × 3 断言 · `
  + `${samples.targets} 组固定靶(真 store + 真收口点,注入式落盘失败) · `
  + `${samples.scanned} 个源文件扫裸调 · ${samples.ledgerFiles} 个文件在迁移台账 · ${samples.locales} 语 i18n)`);
process.exit(fail ? 1 : 0);
