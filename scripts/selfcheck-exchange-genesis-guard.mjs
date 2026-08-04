#!/usr/bin/env node
// 兑换确认快照 + 创世购买重入守卫 自检 — node 直跑,不起浏览器:
//   node scripts/selfcheck-exchange-genesis-guard.mjs
//
// 背景(2026-08-04 存量 2×P1,同一个根:**动钱的入口没有守卫、跨 await 读活值**):
//   P1-① 兑换页 handleConfirm:额度门读活值 → await confirm() → setTimeout 900ms 回调里
//         direction/fromAmount/toAmount/rate/swapUSDValue 仍是活读。那 900ms 内汇率自己跳
//         (15s 定时刷新)、用户还能翻方向改金额 → 实际成交 ≠ 用户确认的那笔;额度只按确认
//         那一刻校验过一次,确认后把金额改大即可绕过每日额度。全文件零重入守卫,连点排队
//         多个 setTimeout → 多次完整兑换。
//   P1-② 创世购买半屏 handlePurchase:全程同步零守卫,emitClose() 是异步生效(要等下一次
//         渲染才真卸载面板),移动端快速双击 → 扣两笔钱、铸两份额度;提交按钮也没有 disabled。
//
// 🔴 守的不变量(编号对应红测文档 docs/changes/2026-08-04-exchange-genesis-redtest.md):
//   ① 成交快照冻在**第一个 await 之前**,覆盖全部成交输入;首个 await 之后不再裸读活值。
//   ② 确认后复验拿**当前**权威值(拿快照汇率复验快照报价 = 等式恒真,门等于没有);
//      不成立一律拒单、零资金动作,绝不静默按新值成交。
//   ③ 重入守卫置位在第一个 await 之前、复位在 finally(不是模块级 `let`:跨实例共享 +
//      提前 return 忘复位 = 永久锁死)。
//   ④ 创世半屏守卫是 `ref(false)` 实例级;成交路径持锁到面板关闭,失败路径立刻解锁可重试。
//   ⑤ 提交按钮 disabled 态走《05》§6.1 派生公式(文字降 --v5-ink-4 + 填充降 surface 系)。
//
// 方法:结构断言跑在**剥注释后的正主源码**上(注释里出现判定式文本不得哄绿);
// 行为断言把正主代码块原文抠出来执行(不是抄一份判据副本)。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build, transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXCHANGE = path.join(root, "src", "pages", "me", "wallet-exchange.vue");
const SHEET = path.join(root, "src", "components", "genesis", "purchase-sheet.vue");
const exRaw = readFileSync(EXCHANGE, "utf8");
const shRaw = readFileSync(SHEET, "utf8");

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
  if (start < 0) throw new Error(`selfcheck-exchange-genesis-guard: 源码里找不到 \`${needle}\`(实现被改名或删除?)`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`selfcheck-exchange-genesis-guard: \`${needle}\` 括号不闭合`);
}
const ts2js = (src) => transformSync(src, { loader: "ts" }).code;

console.log("selfcheck-exchange-genesis-guard — 兑换成交快照单源化 + 创世购买重入守卫");

// ══ A. 兑换页 handleConfirm 的快照纪律(结构) ═══════════════════════════════
const confirmBody = strip(grabBlock(strip(exRaw), "async function handleConfirm()"));
const iGuard = confirmBody.indexOf("if (submitting.value) return");
const iSnap = confirmBody.indexOf("const snap = {");
const iLock = confirmBody.indexOf("submitting.value = true");
const iAwait = confirmBody.indexOf("await ");
const iRateGate = confirmBody.indexOf("quoteTo(snap.direction, snap.fromAmount, rate.value) !== snap.toAmount");
const iDebit = Math.min(
  ...["app.debitBalance(snap.", "app.debitNex(snap."].map((n) => {
    const i = confirmBody.indexOf(n);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  }),
);
{
  check("A① 重入守卫排在最前(先于快照与任何 await)",
    iGuard >= 0 && iGuard < iSnap && iGuard < iAwait, `guard@${iGuard} snap@${iSnap} await@${iAwait}`);
  check("A① 成交快照冻在第一个 await 之前",
    iSnap >= 0 && iAwait >= 0 && iSnap < iAwait, `snap@${iSnap} await@${iAwait}`);
  check("A① 守卫置位也在第一个 await 之前(弹窗打开那几秒不挡就能叠出第二个弹窗)",
    iLock >= 0 && iLock < iAwait, `lock@${iLock} await@${iAwait}`);
  const keys = ["direction:", "fromSym:", "toSym:", "fromAmount:", "toAmount:", "rate:", "usd:", "account:"];
  const seg = confirmBody.slice(iSnap, iSnap + 800);
  const missing = keys.filter((k) => !seg.includes(k));
  check(`A① 快照覆盖 ${keys.length} 项成交输入(方向/两币种/两金额/汇率/USD计值/账号)`,
    missing.length === 0, missing.join(","));
}
{
  // A② 首个 await 之后逐行扫活值。
  // 🔴 豁免必须精确到**表达式**,不能是「这行里有 snap. 就放过」——
  // 红测 R2 实证:把 `app.debitNex(snap.fromAmount)` 改成 `app.debitNex(fromAmount.value)`,
  // 整行因为还有个 `snap.direction` 就被整行豁免掉了,原缺陷形态从这道门底下走了过去。
  // 混着写的那一行恰恰是最危险的形态。改法:先把「确认后复验」那两个准许的表达式
  // 从行里抠掉,剩下的任何活值一律算违例。
  const ALLOW = [
    /app\.accountKey !== snap\.account/g,
    /quoteTo\(snap\.direction, snap\.fromAmount, rate\.value\)/g,
  ];
  const LIVE = ["direction.value", "fromSym.value", "toSym.value", "fromAmount.value",
    "toAmount.value", "swapUSDValue.value", "app.accountKey", "valid.value", "rate.value"];
  const tail = confirmBody.slice(iAwait);
  const lines = tail.split(/\r?\n/);
  const offenders = [];
  for (const line of lines) {
    const scrubbed = ALLOW.reduce((s, re) => s.replace(re, ""), line);
    for (const tok of LIVE) {
      if (scrubbed.includes(tok)) offenders.push(`${tok} @ ${line.trim().slice(0, 60)}`);
    }
  }
  check(`A② 首个 await 之后 0 处裸读活值(扫 ${LIVE.length} 个 token · ${lines.length} 行)`,
    offenders.length === 0, offenders.join(" | "));
  // rate.value 是**故意**留下的唯一活值:它就是「确认后复验」那一步的入参。
  check("A② 确认后复验拿**当前**汇率(rate.value)对比快照到账额,不是拿快照复验快照",
    iRateGate >= 0 && iRateGate > iAwait && iRateGate < iDebit,
    `gate@${iRateGate} await@${iAwait} debit@${iDebit}`);
  check("A② 复验与页面展示共用同一个报价公式 quoteTo(全文只此一处 toFixed 报价实现)",
    /function quoteTo\(/.test(strip(exRaw))
    && /const toAmount = computed\(\(\) => quoteTo\(/.test(strip(exRaw))
    && (strip(exRaw).match(/\+\(from \/ r\)\.toFixed|\+\(from \* r\)\.toFixed/g) || []).length === 2);
  check("A② 账号 + 额度复验也排在扣款之前(拒单零资金动作)",
    confirmBody.indexOf("app.accountKey !== snap.account") > iAwait
    && confirmBody.indexOf("app.accountKey !== snap.account") < iDebit
    && confirmBody.indexOf("!v3.canExchange(snap.usd).ok") < iDebit);
  check("A③ 守卫复位在 finally(所有出口统一解锁,不会有分支漏掉 → 不会永久锁死)",
    /finally \{[\s\S]{0,200}submitting\.value = false;[\s\S]{0,40}\}/.test(confirmBody));
  check("A③ 结算延迟写成 await(setTimeout 回调版守卫在函数返回时就复位了 = 等于没守)",
    /await new Promise\(\(r\) => setTimeout\(r, 900\)\)/.test(confirmBody));
  // 成交动作一律读快照 —— 逐个动钱/记账入口点名核对。
  const SETTLE = ["app.debitBalance(snap.fromAmount)", "app.debitNex(snap.fromAmount)",
    "app.creditNex(snap.toAmount)", "app.creditBalance(snap.toAmount)", "v3.record(snap.usd)"];
  const notSnap = SETTLE.filter((s) => !confirmBody.includes(s));
  check(`A② 全部 ${SETTLE.length} 个动钱/计数入口的入参都是快照`, notSnap.length === 0, notSnap.join(","));
}
{
  // 提交在途时输入面整体冻结(裸 <view @click> 入口没有 :disabled,得自己挡)。
  const ex = strip(exRaw);
  check("A③ 输入面在途冻结:input :disabled + flip/setMax 早退 + CTA 置灰派生自 ctaEnabled",
    ex.includes(':disabled="submitting"')
    && /function setMax\(\) \{\s*if \(submitting\.value\) return;/.test(ex)
    && /function flip\(\) \{\s*if \(submitting\.value\) return;/.test(ex)
    && /const ctaEnabled = computed\(\(\) => valid\.value && !submitting\.value\)/.test(ex)
    && /background: ctaEnabled\.value \? "var\(--v5-brand\)" : "var\(--v5-surface-2\)"/.test(ex)
    && /color: ctaEnabled\.value \? "var\(--v5-on-brand\)" : "var\(--v5-ink-4\)"/.test(ex));
}

// ══ B. 创世购买半屏 handlePurchase 的守卫纪律(结构) ═════════════════════════
const purchaseBody = strip(grabBlock(strip(shRaw), "function handlePurchase()"));
{
  const sh = strip(shRaw);
  check("B④ 守卫是实例级 ref(false),不是模块级 `let`(跨实例共享 = 忘复位就永久锁死)",
    /const purchasing = ref\(false\)/.test(sh) && !/^let (confirming|purchasing)\b/m.test(sh));
  check("B④ 重入守卫排在最前(先于资格门与任何资金动作)",
    /function handlePurchase\(\) \{\s*if \(purchasing\.value\) return;/.test(purchaseBody));
  const iLockP = purchaseBody.indexOf("purchasing.value = true");
  const iDebitP = purchaseBody.indexOf("app.debitBalance(cost)");
  check("B④ 上锁点在第一次动钱之前", iLockP >= 0 && iLockP < iDebitP, `lock@${iLockP} debit@${iDebitP}`);
  check("B④ 复位在 finally,且只有真成交才继续持锁(committed 标记)",
    /finally \{[\s\S]{0,400}if \(!committed\) purchasing\.value = false;[\s\S]{0,40}\}/.test(purchaseBody)
    && /committed = true;\s*emitClose\(\);/.test(purchaseBody));
  check("B④ open watcher 兜底解锁(成交后面板重开 = 新的一次购买)",
    /\(o\) => \{\s*if \(o\) \{\s*qty\.value = 1;\s*purchasing\.value = false;/.test(sh));
  check("B⑤ 提交按钮绑 disabled 态:aria-disabled + 撤按下反馈 + 《05》§6.1 派生(ink-4 + surface)",
    /:aria-disabled="purchasing \? 'true' : 'false'"/.test(sh)
    && /:class="\{ 'active:opacity-85': !purchasing \}"/.test(sh)
    && /background: purchasing\.value \? "var\(--v5-surface-2\)" : "var\(--v5-brand\)"/.test(sh)
    && /color: purchasing\.value \? "var\(--v5-ink-4\)" : "var\(--v5-on-brand\)"/.test(sh)
    && /boxShadow: purchasing\.value \? "none"/.test(sh));
}

// ══ C. 行为固定靶 —— 跑**页面里那两个正主函数**,不是抄一份逻辑 ═══════════════
// 依赖用 stub(判的是页面的快照/守卫纪律,不是 store 算术);t 载真 en.ts,
// 缺 key 会直接暴露成 undefined。
const enMod = await import(
  "data:text/javascript;base64," +
  Buffer.from(
    (await build({ entryPoints: [path.join(root, "src", "i18n", "messages", "en.ts")], bundle: true, write: false, format: "esm" }))
      .outputFiles[0].text,
    "utf8",
  ).toString("base64")
);
const EN = enMod.default ?? enMod.en ?? Object.values(enMod)[0];
const t = { value: EN };
const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

function makeApp(usdt, nex) {
  const calls = [];
  return {
    calls,
    accountKey: "acct-1",
    user: { usdtBalance: usdt, nexBalance: nex },
    debitBalance(n) { calls.push(["debitBalance", n]); if (this.user.usdtBalance < n) return false; this.user.usdtBalance -= n; return true; },
    debitNex(n) { calls.push(["debitNex", n]); if (this.user.nexBalance < n) return false; this.user.nexBalance -= n; return true; },
    creditBalance(n) { calls.push(["creditBalance", n]); this.user.usdtBalance += n; return true; },
    creditNex(n) { calls.push(["creditNex", n]); this.user.nexBalance += n; return true; },
  };
}
function makeV3(capUsd = 50) {
  return {
    used: 0, recorded: [], queued: [],
    canExchange(usd) { return this.used + usd > capUsd ? { ok: false, reason: "user-cap", usedToday: this.used, cap: capUsd } : { ok: true }; },
    record(usd) { this.used += usd; this.recorded.push(usd); },
    enqueue(r) { this.queued.push(r); },
  };
}

/** 把兑换页的 quoteTo + handleConfirm 原文注入执行(改坏它这里必红)。 */
function buildHandleConfirm(env) {
  const src = `${ts2js(grabBlock(exRaw, "function quoteTo("))}\n${ts2js(grabBlock(exRaw, "async function handleConfirm()"))}\n; return handleConfirm;`;
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func — 正主代码块原文注入执行
  return new Function(...names, src)(...names.map((n) => env[n]));
}
/** 一整套兑换页现场:100 NEX → USDT @0.085。 */
function exchangeFixture({ onConfirm } = {}) {
  const app = makeApp(500, 1000);
  const v3 = makeV3();
  const swaps = [];
  const billRows = [];
  const toasts = [];
  const rate = { value: 0.085 };
  const direction = { value: "nex2usdt" };
  const fromAmount = { value: 100 };
  const toAmount = { value: +(100 * 0.085).toFixed(4) };
  const swapUSDValue = { value: +(100 * 0.085).toFixed(4) };
  const env = {
    submitting: { value: false },
    valid: { value: true },
    direction, fromAmount, toAmount, rate, swapUSDValue,
    fromSym: { value: "NEX" }, toSym: { value: "USDT" },
    input: { value: "100" },
    app, v3, t, fmt,
    uni: { navigateTo: () => {} },
    setTimeout: (fn) => globalThis.setTimeout(fn, 0),
    confirm: async () => { if (onConfirm) onConfirm({ rate, direction, fromAmount, toAmount, swapUSDValue, app }); return true; },
    toast: {
      info: (a, b) => toasts.push(["info", a, b]),
      error: (a, b) => toasts.push(["error", a, b]),
      success: (a, b) => toasts.push(["success", a, b]),
    },
    exchange: { recordSwap: (e) => { swaps.push(e); return { ...e, id: `SW-${swaps.length}` }; } },
    billsStore: { add: (r) => billRows.push(r) },
  };
  return { env, app, v3, swaps, billRows, toasts, rate, direction, fromAmount, toAmount, swapUSDValue,
    handleConfirm: buildHandleConfirm(env) };
}

// ── ⑤ 正常路径不受影响(先立基线,否则后面「零成交」全是同值自证)────────────
let BASE;
{
  const f = exchangeFixture();
  await f.handleConfirm();
  BASE = { usdt: f.app.user.usdtBalance, nex: f.app.user.nexBalance };
  check("C⑤ 正常路径:100 NEX → 8.5 USDT 正常成交(NEX 1000→900 · USDT 500→508.5)",
    f.app.user.nexBalance === 900 && f.app.user.usdtBalance === 508.5, `nex=${f.app.user.nexBalance} usdt=${f.app.user.usdtBalance}`);
  check("C⑤ 正常路径:1 笔 swap 记录 + 2 行账单 + 日限计入 8.5(样本 1 次成交)",
    f.swaps.length === 1 && f.billRows.length === 2 && f.v3.recorded.length === 1 && f.v3.recorded[0] === 8.5,
    `swaps=${f.swaps.length} bills=${f.billRows.length} rec=${JSON.stringify(f.v3.recorded)}`);
  check("C⑤ 正常路径:守卫已复位(下一笔还能提交)", f.env.submitting.value === false);
  check("C⑤ 正常路径:成功 toast 是 swapped,不是拒单",
    f.toasts.some((x) => x[0] === "success" && x[1] === EN.exchange.swapped)
    && !f.toasts.some((x) => x[0] === "error"));
}

// ── ① 确认后汇率变动 → 拒单零成交 ────────────────────────────────────────
{
  const f = exchangeFixture({ onConfirm: ({ rate }) => { rate.value = 0.09; } });
  await f.handleConfirm();
  check("C① 确认后汇率 0.085→0.09 → 零资金动作(余额一分未动 · 0 swap · 0 账单 · 0 计数)",
    f.app.user.nexBalance === 1000 && f.app.user.usdtBalance === 500
    && f.swaps.length === 0 && f.billRows.length === 0 && f.v3.recorded.length === 0,
    `nex=${f.app.user.nexBalance} usdt=${f.app.user.usdtBalance} swaps=${f.swaps.length}`);
  check("C① 拒单走「报价已过期」并说明未扣款(给出下一步,不是无声失败)",
    f.toasts.some((x) => x[0] === "error" && x[1] === EN.exchange.quoteStaleTitle && x[2] === EN.exchange.quoteStaleRate));
  check("C① 固定靶不是同值自证:新汇率算出的到账额(9)确实 ≠ 弹窗展示的 8.5",
    +(100 * 0.09).toFixed(4) !== 8.5 && BASE.usdt === 508.5);
  check("C① 反证:旧实现(回调里重读活值)会按 0.09 成交 —— 差别就在「用哪份」",
    500 + +(100 * 0.09).toFixed(4) !== BASE.usdt);
  check("C① 守卫已复位(拒单后用户能按新报价重试)", f.env.submitting.value === false);
}

// ── ② 确认后方向 / 金额被改 → 按快照成交,绝不按新值 ──────────────────────
{
  const f = exchangeFixture({
    onConfirm: ({ direction, fromAmount, toAmount, swapUSDValue }) => {
      direction.value = "usdt2nex";       // 用户翻了方向
      fromAmount.value = 9999;            // 并改大了金额(旧实现:额度门形同虚设)
      toAmount.value = 117635.29;
      swapUSDValue.value = 9999;
    },
  });
  await f.handleConfirm();
  check("C② 按快照成交:扣的是 100 NEX(不是翻转后的 9999 USDT)",
    f.app.user.nexBalance === 900 && f.app.user.usdtBalance === 508.5,
    `nex=${f.app.user.nexBalance} usdt=${f.app.user.usdtBalance}`);
  check("C② 方向未被篡改:debitNex 被调用、debitBalance 一次都没有",
    f.app.calls.some((c) => c[0] === "debitNex" && c[1] === 100)
    && !f.app.calls.some((c) => c[0] === "debitBalance"),
    JSON.stringify(f.app.calls));
  check("C② 日限按**被闸校验过的那个数**计入 8.5(不是 9999 —— 这正是绕过每日额度的入口)",
    f.v3.recorded.length === 1 && f.v3.recorded[0] === 8.5, JSON.stringify(f.v3.recorded));
  check("C② swap 记录与账单三处金额都是快照(2 行账单 · 100 NEX 出 / 8.5 USDT 入)",
    f.swaps[0]?.fromAmount === 100 && f.swaps[0]?.toAmount === 8.5 && f.swaps[0]?.fromSym === "NEX"
    && f.billRows.length === 2 && f.billRows[0].amount === -100 && f.billRows[1].amount === 8.5,
    JSON.stringify(f.billRows));
}

// ── ③ 连点两次 → 只成交一次 ──────────────────────────────────────────────
{
  const f = exchangeFixture();
  const p1 = f.handleConfirm();   // 跑到第一个 await 就让出,此时守卫已置位
  const p2 = f.handleConfirm();   // 第二次点击
  const p3 = f.handleConfirm();   // 第三次(手速再快也一样)
  await Promise.all([p1, p2, p3]);
  check("C③ 连点 3 次只成交 1 次:1 次扣款 · 1 笔 swap · 2 行账单 · 日限只计 1 次",
    f.app.calls.filter((c) => c[0] === "debitNex").length === 1
    && f.swaps.length === 1 && f.billRows.length === 2 && f.v3.recorded.length === 1,
    `debits=${f.app.calls.filter((c) => c[0] === "debitNex").length} swaps=${f.swaps.length} bills=${f.billRows.length}`);
  check("C③ 余额只被扣一次(NEX 1000→900,不是 →800/→700)",
    f.app.user.nexBalance === 900 && f.app.user.usdtBalance === 508.5,
    `nex=${f.app.user.nexBalance} usdt=${f.app.user.usdtBalance}`);
  check("C③ 日限计数只累加一次(8.5 而非 17 / 25.5)—— 旧实现每条链各算各的额度门",
    f.v3.used === 8.5, `used=${f.v3.used}`);
}

// ── ④ 创世双击 → 只扣一次款只铸一份 ──────────────────────────────────────
function buildHandlePurchase(env) {
  const src = `${ts2js(grabBlock(shRaw, "function handlePurchase()"))}\n; return handlePurchase;`;
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func — 正主代码块原文注入执行
  return new Function(...names, src)(...names.map((n) => env[n]));
}
function genesisFixture({ usdt = 50000, capRemaining = 5, mint = { ok: true } } = {}) {
  const app = makeApp(usdt, 0);
  const minted = [];
  const billRows = [];
  const toasts = [];
  const closes = [];
  const purchasing = { value: false };
  const env = {
    purchasing,
    qty: { value: 1 },
    price: { value: 9999 },
    remaining: { value: 940 },
    gate: { value: { eligible: true, capRemaining } },
    app, t, fmt,
    genesis: { purchase: (n) => { if (!mint.ok) return { ok: false, cost: 0, reason: mint.reason }; minted.push(n); return { ok: true, cost: n * 9999 }; } },
    bills: { add: (r) => billRows.push(r) },
    toast: { error: (a, b) => toasts.push(["error", a, b]), success: (a, b) => toasts.push(["success", a, b]) },
    emitClose: () => closes.push(1),
    GENESIS_ELIGIBILITY: { perUserCap: 5 },
  };
  return { env, app, minted, billRows, toasts, closes, purchasing, handlePurchase: buildHandlePurchase(env) };
}
{
  const f = genesisFixture();
  f.handlePurchase();
  f.handlePurchase();   // 双击:面板还没卸载(emitClose 要等下一次渲染)
  f.handlePurchase();
  check("C④ 双击/三击只买 1 台:1 次扣款 · 1 次铸造 · 1 行账单 · 1 次关闭",
    f.app.calls.filter((c) => c[0] === "debitBalance").length === 1
    && f.minted.length === 1 && f.minted[0] === 1 && f.billRows.length === 1 && f.closes.length === 1,
    `debits=${f.app.calls.length} minted=${JSON.stringify(f.minted)} bills=${f.billRows.length}`);
  check("C④ 只扣一台的钱($50000 − $9999 = $40001,不是扣两三台)",
    f.app.user.usdtBalance === 40001, `usdt=${f.app.user.usdtBalance}`);
  check("C④ 成交后继续持锁(面板正在关闭,解锁就是给双击留窗口)", f.purchasing.value === true);
  check("C④ 成功 toast 只弹 1 次(1 次购买 = 1 条反馈)",
    f.toasts.filter((x) => x[0] === "success").length === 1, JSON.stringify(f.toasts.map((x) => x[0])));
}
{
  // 🔴 反向不变量:失败路径必须立刻解锁 —— 否则「提前 return 忘复位」= 后续购买永久锁死。
  const poor = genesisFixture({ usdt: 100 });
  poor.handlePurchase();
  check("C④ 余额不足 → 零铸造、零账单,且守卫**已解锁**(可重试,不是永久锁死)",
    poor.minted.length === 0 && poor.billRows.length === 0 && poor.purchasing.value === false
    && poor.app.user.usdtBalance === 100);
  const soldOut = genesisFixture({ mint: { ok: false, reason: "sold-out" } });
  soldOut.handlePurchase();
  check("C④ 铸造失败 → 已扣款原路退回(余额复原)+ 守卫解锁 + 0 行账单",
    soldOut.app.user.usdtBalance === 50000 && soldOut.purchasing.value === false
    && soldOut.billRows.length === 0 && soldOut.closes.length === 0);
  soldOut.env.genesis.purchase = (n) => { soldOut.minted.push(n); return { ok: true, cost: n * 9999 }; };
  soldOut.handlePurchase();
  check("C④ 失败后重试真的能成(解锁不是嘴上说说:第二次跑通并铸出 1 份)",
    soldOut.minted.length === 1 && soldOut.app.user.usdtBalance === 40001 && soldOut.closes.length === 1);
  const ineligible = genesisFixture({ capRemaining: 0 });
  ineligible.handlePurchase();
  ineligible.handlePurchase();
  check("C④ 限购已满 → 零资金动作且不上锁(资格门失败不该锁住入口)",
    ineligible.app.calls.length === 0 && ineligible.purchasing.value === false
    && ineligible.toasts.filter((x) => x[0] === "error").length === 2);
}

// ── i18n:新增拒单文案三语齐 ───────────────────────────────────────────────
{
  const keys = ["quoteStaleTitle", "quoteStaleRate", "quoteStaleContext"];
  const langs = ["en", "zh", "vi"];
  const missing = [];
  for (const l of langs) {
    const src = readFileSync(path.join(root, "src", "i18n", "messages", `${l}.ts`), "utf8");
    for (const k of keys) if (!src.includes(`${k}:`)) missing.push(`${l}.${k}`);
  }
  check(`i18n:拒单文案 ${keys.length} key × ${langs.length} 语齐(en/zh/vi)`, missing.length === 0, missing.join(","));
}

// PASS 行打样本量:光看「N pass」看不出这门到底覆盖了多少东西,也就看不出它有没有空转。
console.log(
  `\n${pass} pass / ${fail} fail(样本:兑换 handleConfirm + 创世 handlePurchase 两个正主函数原文注入执行` +
  ` · ${confirmBody.slice(iAwait).split(/\r?\n/).length} 行 await 后代码逐行扫 9 个活值 token` +
  ` · 8 项成交输入快照 + 5 个动钱/计数入口 · 5 组行为固定靶(汇率漂移/方向金额篡改/连点3次/创世同tick3击/正常路径)` +
  ` · 4 条创世反向靶(余额不足·铸造失败·失败后重试·限购满不上锁) · 3 key × 3 语 i18n)`,
);
process.exit(fail ? 1 : 0);
