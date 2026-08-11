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
const RECEIPT = path.join(root, "src", "lib", "money-receipt.ts");
const exRaw = readFileSync(EXCHANGE, "utf8");
const shRaw = readFileSync(SHEET, "utf8");
const receiptRaw = readFileSync(RECEIPT, "utf8");

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
/** 从 needle 起抠出一条到分号为止的语句(括号配平后才认分号)。抠不到直接炸。 */
function grabStatement(src, needle) {
  const start = src.indexOf(needle);
  if (start < 0) throw new Error(`selfcheck-exchange-genesis-guard: 源码里找不到 \`${needle}\`(实现被改名或删除?)`);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if ("({[".includes(c)) depth++;
    else if (")}]".includes(c)) depth--;
    else if (c === ";" && depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`selfcheck-exchange-genesis-guard: \`${needle}\` 语句不闭合`);
}
const ts2js = (src) => transformSync(src, { loader: "ts" }).code;

/**
 * 把页面的**取整 / 报价 / 展示**四个正主(money / amtLabel / quoteTo / swapLine)原文抠出来
 * 执行 —— 判据绝不抄一份副本:抄了的话固定靶就是在跟自己的复制品比对,页面怎么漂都发现不了。
 * MONEY_SRC 单独拎出来是因为 quoteTo 与 handleConfirm 都依赖它,注入哪边都得带上。
 */
const MONEY_SRC = ts2js(grabStatement(exRaw, "const money = "));
const pageMath = new Function(
  `${MONEY_SRC}\n${ts2js([
    grabStatement(exRaw, "const amtLabel = "),
    grabBlock(exRaw, "function quoteTo("),
    grabBlock(exRaw, "function swapLine("),
  ].join("\n"))}\n; return { money, amtLabel, quoteTo, swapLine };`,
)();

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
  check("A② 复验与页面展示共用同一个报价公式 quoteTo(报价实现全文只此一处)",
    /function quoteTo\(/.test(strip(exRaw))
    && /const toAmount = computed\(\(\) => quoteTo\(/.test(strip(exRaw))
    && (strip(exRaw).match(/return money\(dir === "usdt2nex" \? from \/ r : from \* r\);/g) || []).length === 1);
  check("A② 账号 + 额度复验也排在扣款之前(拒单零资金动作)",
    confirmBody.indexOf("app.accountKey !== snap.account") > iAwait
    && confirmBody.indexOf("app.accountKey !== snap.account") < iDebit
    && confirmBody.indexOf("!v3.canExchange(snap.usd).ok") < iDebit);
  check("A③ 守卫复位在 finally(所有出口统一解锁,不会有分支漏掉 → 不会永久锁死)",
    /finally \{[\s\S]{0,200}submitting\.value = false;[\s\S]{0,40}\}/.test(confirmBody));
  check("A③ 结算延迟写成 await(setTimeout 回调版守卫在函数返回时就复位了 = 等于没守)",
    /await new Promise\(\(r\) => setTimeout\(r, 900\)\)/.test(confirmBody));
  // 🔴 守的是**性质**(成交入参必须来自快照),不是「调用了哪个函数」。
  // 原判据点名 `app.debitBalance(snap.fromAmount)` 等四个裸原语,收口成 postMoneyBills 之后
  // 它们在页面里不再出现 —— 这次恰好判假红了,但同族写法(扫不到 → 没有违规 → 绿)正是
  // 判据比它所判的形态活得更久、静默失效的经典形态。所以:扫**一组**资金原语,
  // **一个都扫不到直接判失败**,再断言入参是 snap.*。
  const MONEY_CALLS = ["postMoneyBills(", "postMoneyBill(", "app.debitBalance(", "app.debitNex(",
    "app.creditBalance(", "app.creditNex("];
  const moneyHit = MONEY_CALLS.filter((c) => confirmBody.includes(c));
  check(`A② 成交经由资金原语落地(扫 ${MONEY_CALLS.length} 个,命中 ${moneyHit.length} 个;一个都扫不到即判失败)`,
    moneyHit.length > 0, "成交链里找不到任何资金原语 —— 判据已与实现脱节,不是没有违规");
  // 两腿 = 一进一出,金额与币种都必须取自快照;日限计数同理。少一腿 = 复式账本只记了一半。
  const LEGS = [
    ["出账腿金额", "amount: -snap.fromAmount"],
    ["出账腿币种", "symbol: snap.fromSym"],
    ["入账腿金额", "amount: snap.toAmount"],
    ["入账腿币种", "symbol: snap.toSym"],
    ["日限计数", "v3.record(snap.usd)"],
  ];
  const notSnap = LEGS.filter(([, s]) => !confirmBody.includes(s)).map(([n]) => n);
  check(`A② 成交 ${LEGS.length} 项入参全部取自快照(一进一出两腿的金额+币种、日限计数)`,
    notSnap.length === 0, notSnap.join(","));
}
// ══ A④ 展示精度 == 账本精度(结构):全页只有一个取整口径,四个展示口零二次舍入 ══════
{
  const ex = strip(exRaw);
  check("A④ 账本精度单源 money() = +n.toFixed(2),报价两个方向共用它(不再分方向各取各的整)",
    /const money = \(n: number\): number => \+n\.toFixed\(2\);/.test(ex)
    && /return money\(dir === "usdt2nex" \? from \/ r : from \* r\);/.test(ex));
  check("A④ 用户输入进入资金链路时就归到账本精度(否则账单记 1.2345 而账本只动 1.23)",
    /const fromAmount = computed\(\(\) => \{[\s\S]{0,120}return isNaN\(n\) \? 0 : money\(n\);/.test(ex));
  check("A④ 展示口径固定 2 位(min=max 同时钉死;只钉 max 会被 toLocaleString 的默认 min=0 放过)",
    /const amtLabel = [\s\S]{0,160}minimumFractionDigits: 2, maximumFractionDigits: 2/.test(ex));
  // 🔴 四个展示口逐个点名 —— 「新写法在不在」是弱判据,四处**全部**经由 amtLabel 才算数。
  const SITES = [
    ["收款卡", /const toAmountLabel = computed\(\(\) => amtLabel\(toAmount\.value\)\)/],
    ["确认弹窗", /message: `\$\{snap\.fromSym\} \$\{amtLabel\(snap\.fromAmount\)\} → \$\{snap\.toSym\} \$\{amtLabel\(snap\.toAmount\)\}`/],
    ["成功 toast", /\.replace\("\{fromAmt\}", amtLabel\(snap\.fromAmount\)\)[\s\S]{0,80}\.replace\("\{toAmt\}", amtLabel\(snap\.toAmount\)\)/],
    ["历史行", /return `\$\{amtLabel\(h\.fromAmount\)\} \$\{h\.fromSym\} → \$\{amtLabel\(h\.toAmount\)\} \$\{h\.toSym\}`/],
  ];
  const off = SITES.filter(([, re]) => !re.test(ex)).map(([n]) => n);
  check(`A④ 🔴 ${SITES.length} 个展示口(收款卡/确认弹窗/成功 toast/历史行)全部经由 amtLabel`,
    off.length === 0, off.join(","));
  // 🔴 强判据 = 数「旧表述还剩几处」,为 0 才算修了(只验新写法在不在会漏掉遗留的那一处)。
  const OLD = [
    ["确认弹窗 NEX 取 0 位", /snap\.(from|to)Amount\.toFixed\(/],
    ["历史行 NEX 取 0 位", /h\.(from|to)Amount\.toFixed\(/],
    ["收款卡 maximumFractionDigits 分币种", /toAmount\.value\.toLocaleString\(undefined, \{ maximumFractionDigits/],
    ["报价按方向分取整", /\+\(from [/*] r\)\.toFixed\(/],
  ];
  const left = OLD.filter(([, re]) => re.test(ex)).map(([n]) => n);
  check(`A④ 🔴 ${OLD.length} 种旧的二次舍入写法全文 0 残留`, left.length === 0, left.join(","));
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
const purchaseBody = strip(grabBlock(strip(shRaw), "async function handlePurchase()"));
{
  const sh = strip(shRaw);
  check("B④ 守卫是实例级 ref(false),不是模块级 `let`(跨实例共享 = 忘复位就永久锁死)",
    /const purchasing = ref\(false\)/.test(sh) && !/^let (confirming|purchasing)\b/m.test(sh));
  check("B④ 重入守卫排在最前(先于资格门与任何资金动作)",
    /function handlePurchase\(\) \{\s*if \(purchasing\.value\) return;/.test(purchaseBody));
  const iLockP = purchaseBody.indexOf("purchasing.value = true");
  // z1 判决(2026-08-10):c37e642 起创世购买是远端原子事务,「动钱」= 提交
  // `await genesis.purchase(...)` 本身,上锁点必须在它之前;旧的 5 个客户端资金原语
  // 语义反转 —— 在 handlePurchase 体内必须 **0 命中**(命中 = 本地扣款复活)。
  // 判据失效不许静默绿:锁点或提交锚点抠不到时,下面两条都必须红,不是「扫不到 = 没违规」。
  const iSubmitP = purchaseBody.indexOf("await genesis.purchase(");
  check("B④ 上锁点在提交动作之前(purchasing.value = true 先于 await genesis.purchase;锚点抠不到即红)",
    iLockP >= 0 && iSubmitP >= 0 && iLockP < iSubmitP, `lock@${iLockP} submit@${iSubmitP}`);
  // 🔴 原清单 5 项漏掉 4 个真实出口(z1 R2 对抗审计 P1-20):`"postMoneyBills(".includes("postMoneyBill(")`
  //    是 **false**(后面跟的是 s 不是括号),于是 postMoneyBills / postMoneyBillsOnce /
  //    postReceiptOnly / postReceiptOnce / app.creditNex 全部漏网,本地扣款可以照常复活。
  //    收口点那半从**磁盘扫**(与 money-receipt 同一份真相),app.* 原语按前缀匹配。
  const chokepointExports = [...receiptRaw.matchAll(/^export (?:async )?function (post\w+)/gm)].map((m) => `${m[1]}(`);
  if (chokepointExports.length < 3) throw new Error(`收口点导出面只扫到 ${chokepointExports.length} 个 —— 判据失效,拒绝继续`);
  const MONEY_PRIMS = [
    ...chokepointExports,
    "app.captureMoney()", "app.debitBalance(", "app.debitNex(", "app.creditBalance(", "app.creditNex(",
  ];
  const localPrims = MONEY_PRIMS.filter((p) => purchaseBody.includes(p));
  check(`B④ 客户端本地资金原语 0 命中(扫 ${MONEY_PRIMS.length} 个;提交锚点在场才算数)`,
    iSubmitP >= 0 && localPrims.length === 0,
    iSubmitP < 0 ? "提交锚点 await genesis.purchase( 抠不到" : `本地扣款复活:${localPrims.join(",")}`);
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
const LANGS = ["en", "zh", "vi"];
/** 值必须是**非空字符串**。undefined / null / "" / 全空白一律不算有文案 —— 用户看到的是空白提示。 */
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
/** 真解析:把 locale 模块 bundle 出来取**值**,不是在文件文本里找 key 名(注释能骗过子串扫描)。 */
async function loadLocale(l) {
  const out = await build({
    entryPoints: [path.join(root, "src", "i18n", "messages", `${l}.ts`)],
    bundle: true, write: false, format: "esm",
  });
  const mod = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text, "utf8").toString("base64"));
  return mod[l] ?? mod.default ?? Object.values(mod)[0];
}
const LOCALES = Object.fromEntries(await Promise.all(LANGS.map(async (l) => [l, await loadLocale(l)])));

/** 真解析:bundle 出 src 下的模块取**实现**。 */
async function loadSrcModule(...rel) {
  const out = await build({
    entryPoints: [path.join(root, "src", ...rel)],
    bundle: true, write: false, format: "esm",
  });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text, "utf8").toString("base64"));
}
// 🔴 handleConfirm 的 catch 分支引用了 geoPolicyUserMessage 这个自由变量。
// 本门用 new Function 注入真源码执行,env 少一个 key 就是 ReferenceError ——
// 而且会把**整道门**炸掉,不是某条断言红。今天没踩到只因现有场景都走 return
// 不走 throw;这是「还没人踩」不是「雷不存在」。凡改了被 eval 的函数,
// 必须扫全部 eval 它的门脚本同步喂依赖(姊妹门 selfcheck-staking-cas.mjs 同理)。
const { geoPolicyUserMessage } = await loadSrcModule("api", "geo-policy-error.ts");
const EN = LOCALES.en;
const t = { value: EN };
const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

function makeApp(usdt, nex) {
  const calls = [];
  return {
    calls,
    accountKey: "acct-1",
    // withdrawableUsdt 一并建模:退款只还总余额不还可提额度正是 restoreMoney 要防的那个坑,
    // 少了这一维,「退款还原对不对」就无从判起。
    user: { usdtBalance: usdt, nexBalance: nex, earningBuckets: { withdrawableUsdt: usdt } },
    debitBalance(n) {
      calls.push(["debitBalance", n]);
      if (this.user.usdtBalance < n) return false;
      this.user.usdtBalance -= n;
      // 对齐 app.ts:扣款把可提额度 clamp 到扣款后的总余额(退款不还原就永久压低)。
      this.user.earningBuckets.withdrawableUsdt = Math.min(this.user.earningBuckets.withdrawableUsdt, this.user.usdtBalance);
      return true;
    },
    debitNex(n) { calls.push(["debitNex", n]); if (this.user.nexBalance < n) return false; this.user.nexBalance -= n; return true; },
    creditBalance(n) { calls.push(["creditBalance", n]); this.user.usdtBalance += n; return true; },
    creditNex(n) { calls.push(["creditNex", n]); this.user.nexBalance += n; return true; },
    captureMoney() {
      return { usdtBalance: this.user.usdtBalance, nexBalance: this.user.nexBalance, withdrawableUsdt: this.user.earningBuckets.withdrawableUsdt };
    },
    restoreMoney(snap) {
      calls.push(["restoreMoney", snap.usdtBalance]);
      this.user.usdtBalance = snap.usdtBalance;
      this.user.nexBalance = snap.nexBalance;
      this.user.earningBuckets.withdrawableUsdt = snap.withdrawableUsdt;
      return true;
    },
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
  const src = `${MONEY_SRC}\n${ts2js(grabBlock(exRaw, "function quoteTo("))}\n${ts2js(grabBlock(exRaw, "async function handleConfirm()"))}\n; return handleConfirm;`;
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func — 正主代码块原文注入执行
  return new Function(...names, src)(...names.map((n) => env[n]));
}
/**
 * 一整套兑换页现场,默认 100 NEX → USDT @0.085。
 * 🔴 到账额用**页面自己的 quoteTo** 算(不是在这里手写一遍公式)——
 * 判据抄一份副本的话,页面报价怎么漂,固定靶都会跟着漂,永远绿。
 */
function buildPostMoneyBills(app, bills, toast) {
  // 同 buildPostMoneyBill:从**返回类型**处起抠函数体,避开参数默认值 `opts = {}` 的花括号。
  const grabbed = grabBlock(receiptRaw.slice(receiptRaw.indexOf("export function postMoneyBills(")), "): MoneyReceiptOutcome");
  const body = grabbed.slice(grabbed.indexOf("{"));
  const src = `function postMoneyBills(drafts, opts = {}) ${ts2js(body)}\n; return postMoneyBills;`;
  // eslint-disable-next-line no-new-func — 正主代码块原文注入执行
  return new Function("useApp", "useBills", "getT", "toast", src)(() => app, () => bills, () => t.value, toast);
}
function exchangeFixture({ onConfirm, direction: dir = "nex2usdt", from = 100, rate: r = 0.085 } = {}) {
  const app = makeApp(500, 1000);
  const v3 = makeV3();
  const swaps = [];
  const billRows = [];
  const toasts = [];
  const confirmMessages = [];
  const billsStub = {
    add: (r2) => { billRows.push(r2); return r2; },
    addMany: (ds) => { billRows.push(...ds); return ds; },
  };
  const toastStub = {
    info: (a, b) => toasts.push(["info", a, b]),
    error: (a, b) => toasts.push(["error", a, b]),
    success: (a, b) => toasts.push(["success", a, b]),
  };
  const rate = { value: r };
  const direction = { value: dir };
  const fromAmount = { value: pageMath.money(from) };
  const toAmount = { value: pageMath.quoteTo(dir, pageMath.money(from), r) };
  const swapUSDValue = { value: dir === "usdt2nex" ? fromAmount.value : toAmount.value };
  const env = {
    // This harness exercises the explicit mock branch. Remote calls have a
    // separate contract and must not be required by legacy local-CAS checks.
    remoteApiEnabled: false,
    exchangeApi: { fetchState: async () => { throw new Error("REMOTE_STUB_UNUSED"); }, swap: async () => { throw new Error("REMOTE_STUB_UNUSED"); } },
    geoPolicyUserMessage,
    submitting: { value: false },
    valid: { value: true },
    direction, fromAmount, toAmount, rate, swapUSDValue,
    fromSym: { value: dir === "usdt2nex" ? "USDT" : "NEX" },
    toSym: { value: dir === "usdt2nex" ? "NEX" : "USDT" },
    input: { value: String(from) },
    app, v3, t, fmt,
    amtLabel: pageMath.amtLabel,
    uni: { navigateTo: () => {} },
    setTimeout: (fn) => globalThis.setTimeout(fn, 0),
    confirm: async (opts) => {
      confirmMessages.push(opts?.message);
      if (onConfirm) onConfirm({ rate, direction, fromAmount, toAmount, swapUSDValue, app });
      return true;
    },
    toast: toastStub,
    exchange: { recordSwap: (e) => { swaps.push(e); return { ...e, id: `SW-${swaps.length}` }; } },
    billsStore: billsStub,
    // 兑换是一进一出**两条分录**,收口点是复数腿的 postMoneyBills;同样跑真实现,
    // 不写替身 —— 替身一写,「展示 == 入账」就变成在跟我自己写的假入账对账。
    postMoneyBills: buildPostMoneyBills(app, billsStub, toastStub),
  };
  return { env, app, v3, swaps, billRows, toasts, confirmMessages, rate, direction, fromAmount,
    toAmount, swapUSDValue, handleConfirm: buildHandleConfirm(env) };
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
  // 🔴 先断言期望值本身非空,再比对:两边都可能是 undefined 的等式恒成立 = 判据自证。
  // 文案被删空时这条必须红,而不是「toast 传 undefined、期望也 undefined」皆大欢喜。
  check("C① 拒单走「报价已过期」并说明未扣款(给出下一步,不是无声失败)",
    nonEmpty(EN.exchange.quoteStaleTitle) && nonEmpty(EN.exchange.quoteStaleRate)
    && f.toasts.some((x) => x[0] === "error" && x[1] === EN.exchange.quoteStaleTitle && x[2] === EN.exchange.quoteStaleRate),
    `title=${JSON.stringify(EN.exchange.quoteStaleTitle)}`);
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

// ── ⑦ 两腿原子性:收据落不了盘 → 两侧资金都还原、账上零残留 ──────────────────
// 兑换是复式的一进一出。这一维此前没人守:资金动完两腿、收据写失败,若只还原一侧
// (或干脆不还原),用户就会「NEX 少了、USDT 没多」而账单页什么都查不到。
// 收口点的选择是 N 条分录**一次** addMany —— 所以「第一腿落了第二腿没落」这个中间态
// 按构造根本不存在;要守的是**落盘失败时资金侧的对称还原**。
{
  const f = exchangeFixture();
  f.env.billsStore.addMany = () => null;              // 收据落盘失败(bills.addMany 返回 null)
  const nex0 = f.app.user.nexBalance, usdt0 = f.app.user.usdtBalance;
  await f.handleConfirm();
  check("C⑦ 收据落盘失败 → 两侧资金都还原(NEX 与 USDT 双双回到成交前),不是只还一侧",
    f.app.user.nexBalance === nex0 && f.app.user.usdtBalance === usdt0,
    `nex ${nex0}→${f.app.user.nexBalance} usdt ${usdt0}→${f.app.user.usdtBalance}`);
  check("C⑦ 账上零残留 + 不记 swap 历史 + 日限不计(半执行痕迹一条都不许留)",
    f.billRows.length === 0 && f.swaps.length === 0 && f.v3.recorded.length === 0,
    `bills=${f.billRows.length} swaps=${f.swaps.length} rec=${f.v3.recorded.length}`);
  check("C⑦ 用户拿到明确失败提示(不是静默吞掉后照弹「兑换完成」)",
    f.toasts.some((x) => x[0] === "error") && !f.toasts.some((x) => x[0] === "success"),
    JSON.stringify(f.toasts.map((x) => x[0])));
  // ponytail:「N 条分录一次落盘」这一维**不在这里重复焊**。
  // 它归 money_receipt_gate ⑦ 段,那边是数真实写盘次数(setStorageSync 调用数 = 1)——
  // 行为判据,重命名骗不过它;而我这边只能对**别人的文件**做源码正则,
  // 一次无害的形参改名就会误红。那正是本轮元教训里「判据钉死实现形态」的另一面:
  // 钉在自己不拥有的文件上,连修都轮不到我。本段只守**调用方**的正交面(见上三条)。
}

// ── ⑥ 🔴 展示 == 入账:四个展示口与实际到账逐位同值(1/0.085 是本轮实测反例)────────
/** 取字符串里最后一个数字(去掉千分位)。展示串形如 `USDT 1.00 → NEX 11.76`。 */
const lastNum = (s) => {
  const m = String(s).match(/[\d,]+\.\d+|\d+/g);
  return m ? Number(m[m.length - 1].replace(/,/g, "")) : NaN;
};
/** 取字符串里第一个数字 —— 付出腿(`NEX 11.76 → USDT 1.00`)。 */
const firstNum = (s) => {
  const m = String(s).match(/[\d,]+\.\d+|\d+/g);
  return m ? Number(m[0].replace(/,/g, "")) : NaN;
};
{
  // 收款腿:1 USDT @0.085 → 11.76 NEX。旧实现三个展示口把 NEX 取整到 0 位 → 屏幕上写「12」。
  const f = exchangeFixture({ direction: "usdt2nex", from: 1, rate: 0.085 });
  const before = f.app.user.nexBalance;
  await f.handleConfirm();
  const credited = +(f.app.user.nexBalance - before).toFixed(2);
  const quote = pageMath.quoteTo("usdt2nex", 1, 0.085);
  const shown = [
    ["收款卡", pageMath.amtLabel(quote)],                                  // toAmountLabel = amtLabel(toAmount)
    ["确认弹窗", f.confirmMessages[0]],                                     // 正主 handleConfirm 真传给 confirm() 的那句
    ["成功 toast", f.toasts.find((x) => x[0] === "success")?.[2]],
    ["历史行", pageMath.swapLine(f.swaps[0])],                              // 正主 swapLine 跑真的 SwapEvent
  ];

  check("⑥ 固定靶成立:1 USDT @0.085 实际到账 11.76 NEX(报价与入账同值)",
    credited === 11.76 && quote === 11.76, `credited=${credited} quote=${quote}`);
  check("⑥ 🔴 固定靶不是同值自证:旧写法(NEX 取 0 位)会显示「12」,与到账 11.76 差 0.24",
    (11.76).toFixed(0) === "12" && +(Number((11.76).toFixed(0)) - credited).toFixed(2) === 0.24);
  const wrong = shown.filter(([, s]) => lastNum(s) !== credited).map(([n, s]) => `${n}="${s}"`);
  check(`⑥ 🔴 ${shown.length} 个展示口读出来的数都 == 实际到账 ${credited}(逐口 parse 回数比,不比字符串)`,
    wrong.length === 0 && shown.every(([, s]) => typeof s === "string" && s.length > 0), wrong.join(" | "));
  check("⑥ 🔴 四个展示口一个都没出现旧的「12」",
    shown.every(([, s]) => !/\b12\b/.test(String(s))), shown.map(([n, s]) => `${n}=${s}`).join(" | "));
  check("⑥ 账单两行也记同一个数(-1 USDT 出 / +11.76 NEX 入,不是 +12)",
    f.billRows.length === 2 && f.billRows[0].amount === -1 && f.billRows[1].amount === 11.76,
    JSON.stringify(f.billRows.map((b) => b.amount)));
}
{
  // 付出腿:余额 11.76 NEX 点 MAX → 11.76 NEX 出。旧实现弹窗/历史同样取整成「12 NEX」,
  // 而实际扣的是 11.76 —— 与收款腿是同一个缺陷的另一面,不能只修一面。
  const f = exchangeFixture({ direction: "nex2usdt", from: 11.76, rate: 0.085 });
  const before = f.app.user.nexBalance;
  await f.handleConfirm();
  const debited = +(before - f.app.user.nexBalance).toFixed(2);
  const shown = [
    ["确认弹窗", f.confirmMessages[0]],
    ["成功 toast", f.toasts.find((x) => x[0] === "success")?.[2]],
    ["历史行", pageMath.swapLine(f.swaps[0])],
  ];
  const wrong = shown.filter(([, s]) => firstNum(s) !== debited).map(([n, s]) => `${n}="${s}"`);
  check(`⑥ 🔴 付出腿同样对齐:实扣 ${debited} NEX,${shown.length} 个展示口读出来的都是它(旧写法显示 12)`,
    debited === 11.76 && wrong.length === 0, wrong.join(" | "));
  check("⑥ 付出腿账单行 = 实扣额(-11.76,不是 -12)",
    f.billRows[0]?.amount === -11.76, JSON.stringify(f.billRows.map((b) => b.amount)));
}
{
  // 反方向的「过细」形态:NEX→USDT 旧实现报 4 位小数,而账本只落 2 位 → 展示 10.5374 实入 10.54。
  const f = exchangeFixture({ direction: "nex2usdt", from: 123, rate: 0.08567 });
  const before = f.app.user.usdtBalance;
  await f.handleConfirm();
  const credited = +(f.app.user.usdtBalance - before).toFixed(2);
  check("⑥ 🔴 过细的一面也堵上:123 NEX @0.08567 报价 10.54 == 入账 10.54(旧写法报 10.5374)",
    credited === 10.54 && pageMath.quoteTo("nex2usdt", 123, 0.08567) === 10.54
    && +(123 * 0.08567).toFixed(4) === 10.5374,
    `credited=${credited} quote=${pageMath.quoteTo("nex2usdt", 123, 0.08567)}`);
  check("⑥ 展示口读出来的仍 == 入账(4 位小数那份从没真正到过账)",
    lastNum(f.confirmMessages[0]) === credited && lastNum(pageMath.swapLine(f.swaps[0])) === credited,
    `msg=${f.confirmMessages[0]}`);
}

// ── ④ 创世同 tick 连点 → 只提交一次(重入锁)────────────────────────────────
function buildHandlePurchase(env) {
  // z1(2026-08-10):handlePurchase 已是 async(远端原子事务)。needle 必须带 async 前缀:
  // 从 "function handlePurchase()" 抠会子串命中却把 async 关键字截掉,esbuild 对块内的
  // await 直接炸 —— 函数体保持原生 async 形态注入,调用方 await 其返回值。
  const src = `${ts2js(grabBlock(shRaw, "async function handlePurchase()"))}\n; return handlePurchase;`;
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func — 正主代码块原文注入执行
  return new Function(...names, src)(...names.map((n) => env[n]));
}
/**
 * z1 判决(2026-08-10):c37e642 把创世购买改成远端原子事务 —— handlePurchase 体内
 * 资金原语(captureMoney / postMoneyBill / restore)全删,扣款 / 铸造 / 账单 / 冲正整体
 * 移进 store→genesisApi 的远端契约,不再归本门管(B④ 结构面盯死「0 本地资金原语」)。
 * 半屏剩下的职责:闸(阻断 / 资格 / 限购)零提交、重入锁、失败解锁可重试、成交持锁到关面板。
 * 行为固定靶按这份契约用最小 stub 环境跑正主函数体,genesis.purchase 只计调用次数 ——
 * 原先的本地扣款 / 账单 / 冲正靶(makeApp + postMoneyBill 真实现注入)随原语一并退役。
 */
function genesisFixture({ result = { ok: true, cost: 9999 }, capRemaining = 5, sheetBlocked = false } = {}) {
  const calls = [];
  const toasts = [];
  const closes = [];
  const purchasing = { value: false };
  const toast = { error: (a, b) => toasts.push(["error", a, b]), success: (a, b) => toasts.push(["success", a, b]) };
  const env = {
    purchasing,
    qty: { value: 1 },
    gate: { value: { eligible: true, capRemaining } },
    // FEAT-GEN10:半屏自己接了市场闸。默认「未阻断」让重入靶照跑;下面另有一组设成阻断态。
    sheetBlocked: { value: sheetBlocked },
    sheetBlockText: { value: "市场暂未开放" },
    t, fmt,
    genesis: { purchase: async (n) => { calls.push(n); return result; } },
    toast,
    emitClose: () => closes.push(1),
    GENESIS_ELIGIBILITY: { perUserCap: 5 },
  };
  return { env, calls, toasts, closes, purchasing, handlePurchase: buildHandlePurchase(env) };
}
{
  const f = genesisFixture();
  const p1 = f.handlePurchase();   // 第 1 次:过闸、上锁、挂起在 await genesis.purchase
  const p2 = f.handlePurchase();   // 双击:面板还没卸载(emitClose 要等下一次渲染)
  const p3 = f.handlePurchase();   // 三击:手速再快也一样
  await Promise.all([p1, p2, p3]);
  check("C④ 同 tick 连点 3 次只提交 1 次:genesis.purchase 恰被调 1 次(重入锁生效)",
    f.calls.length === 1 && f.calls[0] === 1, `calls=${JSON.stringify(f.calls)}`);
  check("C④ 成交后继续持锁 + 恰 1 次关闭(面板正在关闭,解锁就是给双击留窗口)",
    f.purchasing.value === true && f.closes.length === 1,
    `lock=${f.purchasing.value} closes=${f.closes.length}`);
  check("C④ 成功 toast 只弹 1 次(1 次购买 = 1 条反馈)",
    f.toasts.filter((x) => x[0] === "success").length === 1, JSON.stringify(f.toasts.map((x) => x[0])));
}
// ── C⑦ 市场闸:阻断态**零提交**(FEAT-GEN10 异常4 / 2026-08-05 验收 P1-7)──────
// 半屏开着的时候运营切关闭:一次远端提交都不许发起(z1 后客户端不动钱,提交即动钱),
// 且不上锁 —— 解除后立刻可重试,不用关面板。
{
  const f = genesisFixture({ sheetBlocked: true });
  await Promise.all([f.handlePurchase(), f.handlePurchase(), f.handlePurchase()]);
  check("🔴 C⑦ 阻断态连点 3 次:0 次提交(genesis.purchase 一次都没被调)",
    f.calls.length === 0, `实得 ${f.calls.length} 次`);
  check("C⑦ 阻断态给了说明(禁静默无反应)", f.toasts.length >= 1, `toasts=${f.toasts.length}`);
  check("C⑦ 阻断态不上重入锁(解除后能立刻重试,不用关面板)", f.purchasing.value === false);
  // 反向对照:同一 fixture 不阻断时必须真提交,证明上面的 0 不是 fixture 坏了才全 0
  const ok = genesisFixture({ sheetBlocked: false });
  await ok.handlePurchase();
  check("🔴 C⑦ 反向对照:不阻断时确实提交了 1 次并关面板(否则上面的 0 是假绿)",
    ok.calls.length === 1 && ok.closes.length === 1, `calls=${ok.calls.length} closes=${ok.closes.length}`);
}
{
  // 🔴 反向不变量:失败路径必须立刻解锁 —— 否则一次拒单就把后续购买永久锁死。
  const rejected = genesisFixture({ result: { ok: false, cost: 0, reason: "sold-out" } });
  await rejected.handlePurchase();
  check("C④ 远端拒单 → 错误反馈 · 不关面板 · 守卫**已解锁**(可重试,不是永久锁死)",
    rejected.toasts.some((x) => x[0] === "error") && rejected.closes.length === 0
    && rejected.purchasing.value === false,
    `lock=${rejected.purchasing.value} closes=${rejected.closes.length}`);
  rejected.env.genesis.purchase = async (n) => { rejected.calls.push(n); return { ok: true, cost: 9999 }; };
  await rejected.handlePurchase();
  check("C④ 失败后重试真的能成(解锁不是嘴上说说:第二次提交跑通并关面板)",
    rejected.calls.length === 2 && rejected.closes.length === 1,
    `calls=${rejected.calls.length} closes=${rejected.closes.length}`);
  const ineligible = genesisFixture({ capRemaining: 0 });
  await ineligible.handlePurchase();
  await ineligible.handlePurchase();
  check("C④ 限购已满 → 零提交且不上锁(资格门失败不该锁住入口)",
    ineligible.calls.length === 0 && ineligible.purchasing.value === false
    && ineligible.toasts.filter((x) => x[0] === "error").length === 2,
    `calls=${ineligible.calls.length} lock=${ineligible.purchasing.value}`);
}

// ── i18n:新增拒单文案三语齐 ───────────────────────────────────────────────
// 🔴 这道门此前是**纯子串扫描**(`src.includes(`${k}:`)`),两个致命假绿:
//   ① key 名写进注释就能骗过 —— 审计红测实证:删掉三个文案值、只在注释里留 key 名,
//      门仍 43/43 全绿,而真实用户看到的是**空白的错误提示**。
//   ② 更糟的是上面 C① 的 `x[1] === EN.exchange.quoteStaleTitle`:key 缺失时
//      toast 传的和期望的**两边都是 undefined**,恒等成立 —— 判据自证。
// 改法:真解析取值 + 断言「值本身是非空字符串」(不是「key 名字符串存在于文件里」);
// 比对类断言一律先过 nonEmpty 再比,杜绝 undefined === undefined。
{
  const keys = ["quoteStaleTitle", "quoteStaleRate", "quoteStaleContext"];
  const bad = [];
  for (const l of LANGS) {
    for (const k of keys) {
      const v = LOCALES[l]?.exchange?.[k];
      if (!nonEmpty(v)) bad.push(`${l}.exchange.${k}=${JSON.stringify(v)}`);
    }
  }
  check(`i18n:拒单文案 ${keys.length} key × ${LANGS.length} 语真解析取值且非空(en/zh/vi)`,
    bad.length === 0, bad.join(","));
  check("i18n:三语文案互不相同(整份复制粘贴 = 有值但没翻译,子串扫描一样看不出来)",
    new Set(LANGS.map((l) => LOCALES[l].exchange.quoteStaleTitle)).size === LANGS.length,
    LANGS.map((l) => LOCALES[l].exchange.quoteStaleTitle).join(" | "));
}

// PASS 行打样本量:光看「N pass」看不出这门到底覆盖了多少东西,也就看不出它有没有空转。
console.log(
  `\n${pass} pass / ${fail} fail(样本:兑换 handleConfirm + 创世 handlePurchase 两个正主函数原文注入执行` +
  ` · ${confirmBody.slice(iAwait).split(/\r?\n/).length} 行 await 后代码逐行扫 9 个活值 token` +
  ` · 8 项成交输入快照 + 5 个动钱/计数入口 · 5 组行为固定靶(汇率漂移/方向金额篡改/连点3次/创世同tick3击/正常路径)` +
  ` · 创世远端原子事务(z1):handlePurchase 0 本地资金原语(扫 5 个)+ genesis.purchase stub 计次` +
  ` · 4 条创世反向靶(阻断零提交+反向对照·远端拒单解锁·失败后重试·限购满不上锁)` +
  ` · 兑换两腿原子性 3 靶(收据落盘失败 → 双侧资金还原·账上零残留·明确失败;单次落盘归 money_receipt_gate ⑦)` +
  ` · 资金收口点 postMoneyBills 跑真实现(lib/money-receipt.ts 原文注入,兑换侧) · 3 key × 3 语 i18n)`,
);
process.exit(fail ? 1 : 0);
