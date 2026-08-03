#!/usr/bin/env node
// 里程碑庆祝队列自检 — node 直跑,不起浏览器:
//   node scripts/selfcheck-milestone-queue.mjs
//
// 背景(2026-08-03 三路独立走查同族缺陷):.ms-overlay z-index 9300 盖住支付确认/
// 宽限提示/提现表单并吞点击;且 active 是单槽,连跨两级门槛时前一级被覆盖永久丢失。
//
// 🔴 守的核心不变量(编号对应 verify 门与红测文档):
//   ① 钱链路(checkout / withdraw / trial)期间庆祝 UI 挂起,但奖励/记账**不受
//     UI 门牵连**(App.vue pollMilestones 组合里 credit/bill 无条件,分离证明)
//   ② 离开钱链路后**逐条**补发 — 连跨两级 = 补两条且先低后高,不是只剩最后一条
//   ③ z 层级:.ms-overlay < .nx-toast-host < .nx-mask(庆祝永远压在业务 UI 之下)
//   ④ 非钱链路页面照常即时弹 + 白名单前缀不过宽(pages/store/store 等不误伤)
//
// 方法:esbuild bundle 真 src/store/milestones.ts(stub pinia/vue/storage),
// 测**正主行为**不测复制品;分离证明用 App.vue 源码结构断言补上跨文件那半。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const STUBS = {
  "pinia-stub": `export const defineStore = (_id, setup) => setup;`,
  "vue-stub": `export const ref = (v) => ({ value: v });`,
  "storage-stub": `const mem = new Map();
export const readAccountRow = (t, k) => mem.get(t + "|" + k) ?? null;
export const writeAccountRow = (t, k, row) => { mem.set(t + "|" + k, row); return true; };`,
  "cloud-stub": `export const normalizeAccountKey = (s) => String(s || "default").trim().toLowerCase();`,
};

const bundle = await build({
  entryPoints: [path.join(root, "src", "store", "milestones.ts")],
  bundle: true,
  write: false,
  format: "esm",
  plugins: [
    {
      name: "selfcheck-stubs",
      setup(b) {
        b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
        b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
        b.onResolve({ filter: /account-scoped-storage$/ }, () => ({ path: "storage-stub", namespace: "stub" }));
        b.onResolve({ filter: /account-cloud$/ }, () => ({ path: "cloud-stub", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
      },
    },
  ],
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text, "utf8").toString("base64")
);
const { useMilestones, isMoneyFlowRoute, MONEY_FLOW_ROUTE_PREFIXES } = mod;

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

// defineStore stub 返回 setup 本体 → 每次调用 = 全新 store 实例(测试隔离)。
const freshStore = () => useMilestones();
const M100 = { id: "earn-100", threshold: 100, nexReward: 100, label: "earn100" };
const M500 = { id: "earn-500", threshold: 500, nexReward: 250, label: "earn500" };

const MONEY_ROUTES = [
  "pages/store/checkout",
  "pages/me/wallet-withdraw",
  "pages/me/wallet-withdraw-tracking",
  "pages/me/trial",
];
const PLAIN_ROUTES = ["pages/index/index", "pages/store/store", "pages/me/wallet", "pages/earn/earn"];

console.log("selfcheck-milestone-queue — 钱链路挂起 / 逐条补发 / z 层级 / 即时弹");

// ── ① 钱链路挂起(UI 侧):4 条钱链路路由上 show+advance 都不得上屏 ──
{
  let suspended = 0;
  for (const route of MONEY_ROUTES) {
    const s = freshStore();
    s.show(M100);
    const promoted = s.advance(route);
    const okHere = promoted === false && s.active.value === null && s.pendingCelebrations.value.length === 1;
    check(`① [${route}] 庆祝挂起(active=null,队列保 1 条)`, okHere,
      `promoted=${promoted} active=${JSON.stringify(s.active.value)} pending=${s.pendingCelebrations.value.length}`);
    if (okHere) suspended++;
  }
  check(`① 挂起覆盖全部钱链路路由(样本 ${suspended}/${MONEY_ROUTES.length})`, suspended === MONEY_ROUTES.length);

  // 程序化跳转边:弹层正在显示时闯进钱链路 → 收回并排回队首(离场后足秒重放)。
  const s = freshStore();
  s.show(M100);
  s.advance("pages/index/index"); // 上屏
  s.show(M500);
  s.advance("pages/store/checkout"); // 闯入钱链路
  check("① 显示中闯入钱链路:弹层收回且排回队首(order 保持 100→500)",
    s.active.value === null &&
      s.pendingCelebrations.value.length === 2 &&
      s.pendingCelebrations.value[0].id === "earn-100" &&
      s.pendingCelebrations.value[1].id === "earn-500",
    JSON.stringify(s.pendingCelebrations.value.map((x) => x.id)));
}

// ── ① 分离证明(奖励侧):App.vue pollMilestones 里 credit/bill 无条件,
//     不许接路由门或 stopMilestonePoll(那会变成「钱链路期间不发奖励」)。──
{
  const appSrc = readFileSync(path.join(root, "src", "App.vue"), "utf8");
  const start = appSrc.indexOf("function pollMilestones()");
  const end = appSrc.indexOf("function startMilestonePoll()");
  const bodyFound = start !== -1 && end !== -1 && end > start;
  check("① App.vue 里 pollMilestones 函数体可定位(分离证明的前提)", bodyFound, `start=${start} end=${end}`);
  if (bodyFound) {
    const body = appSrc.slice(start, end);
    const iMark = body.indexOf("markFired");
    const iCredit = body.indexOf("creditNex");
    const iBill = body.indexOf(".add(");
    const iShow = body.indexOf(".show(");
    check("① 组合完整且有序:markFired → creditNex → bills.add → show(4/4 步齐)",
      iMark !== -1 && iCredit !== -1 && iBill !== -1 && iShow !== -1 &&
        iMark < iCredit && iCredit < iBill && iBill < iShow,
      `idx mark=${iMark} credit=${iCredit} bill=${iBill} show=${iShow}`);
    check("① 奖励侧不接 UI 路由门:pollMilestones 体内无 isMoneyFlowRoute 调用",
      body.indexOf("isMoneyFlowRoute") === -1);
    check("① 奖励侧不接停轮询机制:pollMilestones 体内无 stopMilestonePoll 调用",
      body.indexOf("stopMilestonePoll") === -1);
  }
}

// ── ② 逐条补发:连跨两级(钱链路用 trial,离场用 pages/me/me,与①④取样错开)──
{
  const s = freshStore();
  s.show(M100);
  s.show(M500);
  check("② 🔴 连跨两级队列保两条且先低后高(单槽回归会只剩最后一条)",
    s.pendingCelebrations.value.length === 2 &&
      s.pendingCelebrations.value[0].id === "earn-100" &&
      s.pendingCelebrations.value[1].id === "earn-500",
    JSON.stringify(s.pendingCelebrations.value.map((x) => x.id)));
  s.advance("pages/me/trial");
  s.advance("pages/me/trial");
  check("② 钱链路里反复推进也不上屏、不丢队列", s.active.value === null && s.pendingCelebrations.value.length === 2);
  const replayed = [];
  if (s.advance("pages/me/me")) replayed.push(s.active.value.id);
  check("② 离场第一条补发 = 先到的 $100 级(不是最后一条)", s.active.value?.id === "earn-100",
    String(s.active.value?.id));
  check("② 补发第一条期间第二条仍在队列(逐条,不并发上屏)",
    s.pendingCelebrations.value.length === 1 && s.pendingCelebrations.value[0].id === "earn-500");
  check("② 上一条未 dismiss 时不抢屏", s.advance("pages/me/me") === false && s.active.value?.id === "earn-100");
  s.dismiss();
  if (s.advance("pages/me/me")) replayed.push(s.active.value.id);
  check("② 第二条补发 = $500 级,队列清空", s.active.value?.id === "earn-500" && s.pendingCelebrations.value.length === 0);
  s.dismiss();
  check(`② 补发总量与顺序:${JSON.stringify(replayed)}(样本 2 条,0 丢失)`,
    replayed.length === 2 && replayed[0] === "earn-100" && replayed[1] === "earn-500");
}

// ── ③ z 层级:.ms-overlay < .nx-toast-host < .nx-mask(解析失败=红,不许假绿)──
{
  const msSrc = readFileSync(path.join(root, "src", "components", "milestone-celebration.vue"), "utf8");
  const guiSrc = readFileSync(path.join(root, "src", "components", "global-ui.vue"), "utf8");
  const zOf = (src, selector) => {
    const m = src.match(new RegExp(selector.replace(".", "\\.") + "\\s*\\{[^}]*?z-index:\\s*(\\d+)", "s"));
    return m ? parseInt(m[1], 10) : null;
  };
  const zOverlay = zOf(msSrc, ".ms-overlay");
  const zToast = zOf(guiSrc, ".nx-toast-host");
  const zMask = zOf(guiSrc, ".nx-mask");
  check(`③ 三个层级值都解析得到(样本 3 selector:overlay=${zOverlay} toast=${zToast} mask=${zMask})`,
    zOverlay !== null && zToast !== null && zMask !== null);
  check("③ 🔴 .ms-overlay < .nx-mask(庆祝不得盖确认弹窗)", zOverlay !== null && zMask !== null && zOverlay < zMask);
  check("③ .ms-overlay < .nx-toast-host(庆祝不得盖 toast/宽限提示)", zOverlay !== null && zToast !== null && zOverlay < zToast);
}

// ── ④ 非钱链路即时弹 + 白名单不过宽 ──
{
  const s = freshStore();
  s.show(M100);
  const promoted = s.advance("pages/index/index");
  check("④ 普通页照常即时弹(advance 即上屏,队列清空)",
    promoted === true && s.active.value?.id === "earn-100" && s.pendingCelebrations.value.length === 0);

  const wrongPositive = PLAIN_ROUTES.filter((r) => isMoneyFlowRoute(r));
  check(`④ 白名单不误伤普通路由(样本 ${PLAIN_ROUTES.length}:store 首页/钱包首页等前缀近亲)`,
    wrongPositive.length === 0, wrongPositive.join(","));
  const missed = MONEY_ROUTES.filter((r) => !isMoneyFlowRoute(r));
  check(`④ 钱链路路由全命中(样本 ${MONEY_ROUTES.length},含 withdraw-tracking 前缀盖延)`,
    missed.length === 0, missed.join(","));
  check("④ 白名单前缀形态合法(都以 pages/ 开头且非裸前缀,防「pages/」一刀全挂起)",
    MONEY_FLOW_ROUTE_PREFIXES.length > 0 &&
      MONEY_FLOW_ROUTE_PREFIXES.every((p) => p.startsWith("pages/") && p.length > "pages/".length));
  check("④ 空路由(boot 期)不算钱链路", isMoneyFlowRoute("") === false);

  // 账号切换 / reset 不把 A 的庆祝漏给 B
  const s2 = freshStore();
  s2.show(M100);
  s2.show(M500);
  s2.bindAccount("user-b@example.com");
  check("④ bindAccount 清空 active+队列(A 的庆祝不弹给 B)",
    s2.active.value === null && s2.pendingCelebrations.value.length === 0);
  const s3 = freshStore();
  s3.show(M100);
  s3.reset();
  check("④ reset 清空 active+队列", s3.active.value === null && s3.pendingCelebrations.value.length === 0);
}

console.log(
  `selfcheck-milestone-queue: ${pass} pass / ${fail} fail(样本:${MONEY_ROUTES.length} 钱链路路由挂起、2 条逐条补发、3 个 z 层级、${PLAIN_ROUTES.length} 个近亲路由反例)`,
);
process.exit(fail > 0 ? 1 : 0);
