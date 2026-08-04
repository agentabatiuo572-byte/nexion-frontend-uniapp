#!/usr/bin/env node
// 质押持仓写入「乐观并发(CAS)」自检 — node 直跑,不起浏览器:
//   node scripts/selfcheck-staking-cas.mjs
//
// 背景(2026-08-04 存量 P1 · 跨标签页竞态双记账):
//   staking 的 earlyWithdraw / claim 是裸 find → map → persist,persist 走
//   writeAccountRow(纯覆盖式 last-write-wins);全仓又没有任何 storage 事件重新水合持仓。
//   H5 端 uni storage 就是 localStorage,同源多标签页共享同一份 —— 于是窗口不是几毫秒的
//   传播延迟,而是「两个标签页只要都打开过质押页,状态就永久不同步」。同一笔仓位被两边
//   各领一次,而 usdtBalance 在 account-cloud 的 ADDITIVE_NUMBER_KEYS 里(按增量三路合并)
//   → 两次入账都记 = 真·双花。
//
// 🔴 守的不变量(编号对应红测文档 docs/changes/2026-08-04-staking-cas-redtest.md):
//   ① 变更的前置条件在**磁盘最新状态**上复核 —— 别处已经领走的仓位不再放行(一笔只入账一次)。
//   ①b 「读完到写之间被插队」也拦得住 —— rev 版本号 CAS(单纯的写前复读挡不住这一格)。
//   ② 正常单标签页路径不受影响(建仓 / 领取 / 提前赎回照常成交并落盘)。
//   ③ 失败可区分:版本冲突 conflict=true,「本来就不该成交」conflict=false(页面据此决定
//      是提示「已刷新」还是静默)。
//   ④ 向后兼容:不传版本的老调用方(writeAccountRow,28 处在用)行为与 CAS 上线前一致。
//   ⑤ 追加型变更(建仓)冲突时重放到最新列表上,两个标签页各自建的仓都留得住。
//   ⑥ 接线门:staking 真的走了 CAS(判定对不对 / 有没有被接上是两道门)。
//
// 方法:结构断言跑在**剥注释后的正主源码**上(注释里出现判定式文本不得哄绿);行为断言
// esbuild 载**真 store + 真 account-scoped-storage**跑真代码(不是抄一份判据副本),两个
// store 实例 = 两个标签页,共享同一份 JSON 序列化的假 storage(与 localStorage 同语义:
// 跨标签页不共享对象引用)。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STORE_DIR = path.join(root, "src", "store");
const storageRaw = readFileSync(path.join(STORE_DIR, "account-scoped-storage.ts"), "utf8");
const stakingRaw = readFileSync(path.join(STORE_DIR, "staking.ts"), "utf8");
const pageRaw = readFileSync(path.join(root, "src", "pages", "staking", "staking.vue"), "utf8");

const samples = { tabs: 2, targets: 6, storeFiles: 0, locales: 0 };
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
  if (start < 0) throw new Error(`selfcheck-staking-cas: 源码里找不到 \`${needle}\`(实现被改名或删除?)`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`selfcheck-staking-cas: \`${needle}\` 括号不闭合`);
}

/** 取两个锚点之间的原文。任一锚点消失 = 实现被改名/删除,直接炸(不许静默放行)。 */
function grabBetween(src, from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  if (a < 0 || b < 0) throw new Error(`selfcheck-staking-cas: 取不到 \`${from}\` → \`${to}\` 之间的实现`);
  return src.slice(a, b);
}

console.log("selfcheck-staking-cas — 质押持仓写入乐观并发 + 跨标签页双记账");

// ── 假 uni storage:JSON 序列化,与 localStorage 同语义(两个标签页拿不到同一个对象引用) ──
const store = new Map();
let interleave = null; // 一次性钩子:模拟「A 读完、还没写」的那一瞬别的标签页抢先写入
const uni = {
  getStorageSync(key) {
    const raw = store.get(key);
    const value = raw === undefined ? "" : JSON.parse(raw);
    if (interleave) { const fn = interleave; interleave = null; fn(); }
    return value;
  },
  setStorageSync(key, value) { store.set(key, JSON.stringify(value)); },
};
globalThis.uni = uni;

// ── 载真 store(只 stub 掉 pinia/vue 两个运行时外壳,storage 层是被测对象,绝不 stub) ──
const STUBS = {
  "pinia-stub": `export const defineStore = (_id, setup) => setup;`,
  "vue-stub": `export const ref = (v) => ({ value: v });`,
};
async function loadStore(rel) {
  const out = await build({
    entryPoints: [path.join(STORE_DIR, rel)],
    bundle: true, write: false, format: "esm",
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
        b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
        b.onResolve({ filter: /^@\// }, (a) => {
          const base = path.join(root, "src", a.path.slice(2));
          const hit = [base, `${base}.ts`, path.join(base, "index.ts")].find((p) => existsSync(p));
          if (!hit) throw new Error(`selfcheck-staking-cas: 解析不到 ${a.path}`);
          return { path: hit };
        });
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
      },
    }],
  });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text, "utf8").toString("base64"));
}
const { useStaking } = await loadStore("staking.ts");
const { readAccountRow, writeAccountRow, writeAccountRowCas, accountRowRev } =
  await loadStore("account-scoped-storage.ts");

const ACCOUNTS_KEY = "nexgrid-v3-staking-accounts-v1";
const ONE_DAY = 86400 * 1000;
const ACCT = "tab-race@nexgrid.test";

/** 一笔**已到期**的持仓(claim 的资格门要求 now >= unlockTs)。 */
function maturedPosition(id, amountUSDT) {
  const now = Date.now();
  return {
    id, amountUSDT, termDays: 90, apy: 0.35,
    startTs: now - 120 * ONE_DAY, unlockTs: now - 30 * ONE_DAY, status: "active",
  };
}
/** 用**老调用方**写盘(不带 rev)= 真实存量行的形态,顺便证明老行能被 CAS 直接接管。 */
function seedDisk(positions) {
  store.clear();
  writeAccountRow(ACCOUNTS_KEY, ACCT, { positions });
}
function diskPositions() {
  return readAccountRow(ACCOUNTS_KEY, ACCT).positions;
}
/** 开一个「标签页」:独立 store 实例,共享同一份 storage。 */
function openTab() {
  const s = useStaking();
  s.bindAccount(ACCT);
  return s;
}
/** 页面 handleClaim 的入账语义(app.creditBalance 是 ADDITIVE 的,ok 才加)。 */
function creditIfOk(ledger, r) {
  if (r.ok) ledger.usdt = +(ledger.usdt + r.principal + r.interest).toFixed(2);
  return r;
}

// ── ① 双标签页领同一笔:余额只增加一次 ──────────────────────────────────────────
{
  seedDisk([maturedPosition("stk-race", 500)]);
  const tabA = openTab();               // A 打开页面(读到 active),之后一直没再刷新
  const tabB = openTab();
  const ledger = { usdt: 0 };

  const rB = creditIfOk(ledger, tabB.claim("stk-race"));
  check("① B 标签页正常领取成功(先手不受影响)", rB.ok === true && rB.principal === 500);
  const afterB = ledger.usdt;

  const rA = creditIfOk(ledger, tabA.claim("stk-race"));
  check("① 🔴 A 标签页拿着陈旧状态再领 → 被拒(这一笔已经在别处领走)",
    rA.ok === false && rA.principal === 0 && rA.interest === 0);
  check("① 🔴 余额只增加一次(双花的核心断言)",
    ledger.usdt === afterB && afterB > 0, `afterB=${afterB} final=${ledger.usdt}`);
  check("① 拒单归因为版本冲突(conflict=true),页面据此提示已刷新", rA.conflict === true);
  check("① 磁盘上该仓位只有一个终态 claimed,不会被 A 的陈旧数组覆盖回 active",
    diskPositions().filter((p) => p.id === "stk-race").every((p) => p.status === "claimed"));
  check("① A 的内存态被刷新到最新(UI 立刻看到别处的结果,不再永久陈旧)",
    tabA.positions.value.find((p) => p.id === "stk-race").status === "claimed");
}

// ── ①b 「读完到写之间被插队」:写前复读挡不住,rev 版本号 CAS 才挡得住 ────────────
{
  seedDisk([maturedPosition("stk-interleave", 800)]);
  const tabA = openTab();
  const tabB = openTab();
  const ledger = { usdt: 0 };

  // A 读到最新的 active 状态之后、写回之前,B 完成一次完整的领取(真实多标签页里就是另一个
  // 进程插队;localStorage 没有锁,这一格是「写前复读校验」永远补不上的)。
  interleave = () => { creditIfOk(ledger, tabB.claim("stk-interleave")); };
  const rA = creditIfOk(ledger, tabA.claim("stk-interleave"));

  check("①b 插队确实发生了(B 在 A 的读与写之间成交,固定靶不是空转)",
    ledger.usdt > 0 && diskPositions()[0].status === "claimed");
  check("①b 🔴 A 的写入被版本号挡下 → 被拒", rA.ok === false && rA.conflict === true);
  check("①b 🔴 余额仍只增加一次(800 本金 + 一次利息)",
    ledger.usdt > 800 && ledger.usdt < 1600, `ledger=${ledger.usdt}`);
}

// ── ② 正常单标签页路径不受影响 ────────────────────────────────────────────────
{
  seedDisk([maturedPosition("stk-solo", 300)]);
  const tab = openTab();

  const opened = tab.stake(1000, 180);
  check("② 建仓成功并落盘(id / 金额 / APY / 解锁时刻都对)",
    opened.amountUSDT === 1000 && opened.termDays === 180
    && diskPositions().some((p) => p.id === opened.id && p.amountUSDT === 1000));

  const rEarly = tab.earlyWithdraw(opened.id);
  check("② 提前赎回成功:退款 = 本金 − 罚金(180 天档罚 30%)",
    rEarly.ok === true && rEarly.penalty === 300 && rEarly.refund === 700);
  check("② 提前赎回落盘为 early-withdrawn",
    diskPositions().find((p) => p.id === opened.id).status === "early-withdrawn");

  const rClaim = tab.claim("stk-solo");
  check("② 到期领取成功:本金 300 + 利息按 APY×期限",
    rClaim.ok === true && rClaim.principal === 300 && +rClaim.interest.toFixed(4) === +(300 * 0.35 * (90 / 365)).toFixed(4));
  check("② 领取落盘为 claimed,且正常路径 0 次 conflict",
    diskPositions().find((p) => p.id === "stk-solo").status === "claimed"
    && !rEarly.conflict && !rClaim.conflict);

  const tabReload = openTab(); // 关掉再打开 = 重新水合
  check("② 重新水合读回同一份持仓(2 笔,状态与磁盘一致)",
    tabReload.positions.value.length === 2
    && tabReload.positions.value.find((p) => p.id === "stk-solo").status === "claimed");

  const rAfterMature = tabReload.claim("stk-solo");
  check("② 同一标签页重复领取被拒(既有语义未变)", rAfterMature.ok === false);
  check("② 🔴 重复领取不是版本冲突(conflict=false)—— 别把「本来就不该成交」误报成「数据已更新」",
    rAfterMature.conflict === false);
}

// ── ③ 失败可区分:三种失败各自的返回值 ────────────────────────────────────────
{
  seedDisk([{ ...maturedPosition("stk-live", 200), unlockTs: Date.now() + 30 * ONE_DAY }]);
  const tab = openTab();

  const unknown = tab.claim("stk-does-not-exist");
  check("③ 不存在的仓位:ok=false / conflict=false / 金额 0",
    unknown.ok === false && unknown.conflict === false && unknown.principal === 0);

  const notDue = tab.claim("stk-live");
  check("③ 未到期领取:ok=false / conflict=false(既有语义,原样保留)",
    notDue.ok === false && notDue.conflict === false);

  const notActive = (() => {
    tab.earlyWithdraw("stk-live");
    return tab.earlyWithdraw("stk-live");
  })();
  check("③ 已赎回的仓位再赎回:ok=false / conflict=false / refund=penalty=0",
    notActive.ok === false && notActive.conflict === false
    && notActive.refund === 0 && notActive.penalty === 0);

  check("③ 成功路径不带 conflict 噪声(ok=true 时 conflict 恒为 undefined)",
    tab.stake(50, 30) && tab.earlyWithdraw(tab.positions.value[0].id).conflict === undefined);

  // 返回形状不变:页面既有 `if (r.ok)` 分支一个字不用改
  const shape = tab.claim("stk-nope");
  check("③ 对外返回形状未变(claim: ok/principal/interest;earlyWithdraw: ok/refund/penalty)",
    "ok" in shape && "principal" in shape && "interest" in shape
    && ["ok", "refund", "penalty"].every((k) => k in tab.earlyWithdraw("stk-nope")));
}

// ── ④ 向后兼容:不传版本的老调用方行为与 CAS 上线前一致 ──────────────────────────
{
  const TBL = "compat-table-v1";
  store.clear();

  const wrote = writeAccountRow(TBL, "Alice@x.com", { a: 1, list: [1, 2] });
  const back = readAccountRow(TBL, "alice@x.com");
  check("④ 老写法:返回 true,大小写归一后可读回,内容逐字节相同",
    wrote === true && JSON.stringify(back) === JSON.stringify({ a: 1, list: [1, 2] }));
  check("④ 🔴 老写法不注入 rev 字段(写进去什么就是什么,键集合不变)",
    Object.keys(back).join(",") === "a,list" && !("rev" in back));

  writeAccountRow(TBL, "bob@x.com", { a: 9 });
  writeAccountRow(TBL, "alice@x.com", { a: 2 });
  check("④ 老写法仍是覆盖式 last-write-wins(不合并、不拒绝、不报冲突)",
    JSON.stringify(readAccountRow(TBL, "alice@x.com")) === JSON.stringify({ a: 2 }));
  check("④ 老写法只动自己那一行,同表其它账号行不受影响",
    readAccountRow(TBL, "bob@x.com").a === 9);
  check("④ 老写法读不出的行返回 null(既有语义)", readAccountRow(TBL, "nobody@x.com") === null);

  const stripped = strip(storageRaw);
  const oldWriter = grabBlock(stripped, "export function writeAccountRow<T>");
  check("④ 🔴 结构:老写法函数体内 0 处 rev / CAS 相关引用(两条路径彻底不耦合)",
    !/rev|Cas|expected/i.test(oldWriter), oldWriter.replace(/\s+/g, " ").slice(0, 120));

  // 老行(无 rev)天然从 0 起步,CAS 直接接管,不需要任何迁移
  check("④ CAS 接管老行:expectedRev=0 通过并写成 rev=1",
    accountRowRev(readAccountRow(TBL, "bob@x.com")) === 0
    && writeAccountRowCas(TBL, "bob@x.com", { a: 10 }, 0).rev === 1);
  check("④ CAS 版本不符时不写盘(磁盘还是旧值,绝不静默覆盖)",
    writeAccountRowCas(TBL, "bob@x.com", { a: 99 }, 0).conflict === true
    && readAccountRow(TBL, "bob@x.com").a === 10);

  // 爆炸半径:本轮只接质押一个消费者
  const storeFiles = readdirSync(STORE_DIR).filter((f) => f.endsWith(".ts"));
  samples.storeFiles = storeFiles.length;
  const casConsumers = storeFiles.filter((f) =>
    f !== "account-scoped-storage.ts" && readFileSync(path.join(STORE_DIR, f), "utf8").includes("writeAccountRowCas"));
  check(`④ 爆炸半径受控:${storeFiles.length} 个 store 文件里只有 staking.ts 接了 CAS,其余 ${storeFiles.length - 2} 个一行没动`,
    casConsumers.length === 1 && casConsumers[0] === "staking.ts", casConsumers.join(","));
}

// ── ⑤ 追加型变更:两个标签页各建一仓,两笔都留得住 ──────────────────────────────
{
  seedDisk([]);
  const tabA = openTab();
  const tabB = openTab();
  const posA = tabA.stake(111, 30);
  const posB = tabB.stake(222, 90);
  const disk = diskPositions();
  const amounts = disk.map((p) => p.amountUSDT).sort((a, b) => a - b);
  check("⑤ 🔴 两个标签页各建的仓都在磁盘上(建仓不会被对方的陈旧数组顶掉)",
    disk.length === 2 && amounts[0] === 111 && amounts[1] === 222, amounts.join(","));
  check("⑤ 两笔 id 不重号 —— 重号会让 find(id) 永远只命中第一笔,第二笔从此领不出来",
    posA.id !== posB.id && new Set(disk.map((p) => p.id)).size === 2, `${posA.id} / ${posB.id}`);
  const outA = tabA.earlyWithdraw(posA.id);
  const outB = tabB.earlyWithdraw(posB.id);
  check("⑤ 两笔都能各自独立领出来,退款各按各的本金与档位罚金(重号的话第二笔会失败)",
    outA.ok && outB.ok && outA.refund.toFixed(2) === "105.45" && outB.refund.toFixed(2) === "188.70",
    `${outA.refund} / ${outB.refund}`);
}

// ── ⑥ 接线门:判定对不对 / 有没有被接上,是两道门 ──────────────────────────────
{
  const s = strip(stakingRaw);
  check("⑥ staking 落盘只走 CAS(0 处裸 writeAccountRow,否则这道门等于没接)",
    /writeAccountRowCas</.test(s) && !/[^C]\bwriteAccountRow\(/.test(s));
  // commit 的签名里就有对象类型字面量,花括号配对会停在类型上 —— 用前后两个稳定锚点取整段。
  const commitBody = grabBetween(s, "function commit<R>", "function bindAccount(");
  check("⑥ commit 以**磁盘最新**持仓为基准 + 带 rev 做 CAS(不是拿内存副本自证)",
    commitBody.includes("readSnapshot(boundKey)") && /writeAccountRowCas<[\s\S]*?baseRev,/.test(commitBody));
  check("⑥ 四条变更路径(建仓/提前赎回/领取/到期标记)全部经由 commit,没有旁路",
    (s.match(/commit\(/g) || []).length === 4);
  const p = strip(pageRaw);
  check("⑥ 页面区分版本冲突并明示(领取 + 提前赎回两处,禁点了没反应)",
    (p.match(/else if \(r\.conflict\)/g) || []).length === 2
    && (p.match(/toast\.warn\(t\.value\.stakingV3\.toast\.staleTitle/g) || []).length === 2);
  const locales = ["en", "zh", "vi"];
  samples.locales = locales.length;
  check(`⑥ i18n 冲突提示 ${locales.length} 语齐(staleTitle + staleSubtitle)`,
    locales.every((l) => {
      const src = readFileSync(path.join(root, "src", "i18n", "messages", `${l}.ts`), "utf8");
      return src.includes("staleTitle:") && src.includes("staleSubtitle:");
    }));
}

console.log(`\n${pass} pass / ${fail} fail(样本:${samples.tabs} 个 store 实例=${samples.tabs} 标签页共享 1 份序列化 storage`
  + ` · ${samples.targets} 组跨标签页固定靶 · ${samples.storeFiles} 个 store 文件扫爆炸半径 · ${samples.locales} 语 i18n)`);
process.exit(fail ? 1 : 0);
