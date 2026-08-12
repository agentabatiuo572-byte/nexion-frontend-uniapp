#!/usr/bin/env node
// 提现状态回读 **runtime** 门 —— 真页面、真 store、真 action,只桩网络那一层。
//
//   node scripts/withdraw-status-mirror-runtime.mjs          # 自己起一台 remote 档 server
//   BASE_URL=http://127.0.0.1:5263 node scripts/...          # 打已经起好的 remote 档 server
//
// 🔴 为什么必须是 runtime 门(本包立案的直接原因):
//   在此之前,全仓守这条链的**唯一**断言是 remote-authority-simulation.test.mjs 里的
//   `assert.equal(typeof app.refreshRemoteWithdrawals, "function")` —— 它只证「函数存在」。
//   实测(2026-08-11 红测):把 App.vue 里那行调用换成 `void Promise.resolve([])`,
//   contract-suite 仍 40 pass / 0 fail。**调用点被摘掉,门全绿,而在途单永远不终结**:
//   occupiesWithdrawalSlot 恒真 → 换绑入口与下一笔提现被永久拦死,账单行永远停在处理中。
//   「有生产者」≠「跑得到」,静态判据守不了可达性 —— 这一刀只有真跑一遍才守得住。
//
// 🔴 为什么自己起 server:回读只在 **remote 档**存在(mock 档 apiClient 一律 reject,
//   提现单压根建不出来),而 scripts/verify.sh 的 [2.5] 前置断言**要求 server 是 mock 档**
//   —— 本门借不了那台。不自带 server 就只能靠人手动起一台 remote 的,那等于这道门不会跑
//   (孤儿门是本仓记过的坑)。起法照 verify-h5-runtime.mjs:随机空闲端口 + 用完杀进程树。
//
// 🔴 桩打在 **transport(apiClient.request)** 那一层,不是 withdrawalApi 的方法上:
//   桩方法会把 parseStatusSnapshot 一起桩掉,而那个解析器才是契约的真正守卫
//   (状态闭集、原因码归一、retriable 类型校验)。现在返回**原始报文**,解析器照跑。
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 🔴 控件标签从 i18n 源码**读真值**,不在门里手抄一份(手抄的那份会静默过期:
// 首版抄成 "submit another",真值是 "Withdraw again",于是「找到 0 个控件」——
// 判据没命中任何东西却差点被当成通过)。三语都读,页面用哪个语种都认得出。
const AGAIN_LABELS = ["en", "zh", "vi"].map((locale) => {
  const src = fs.readFileSync(path.join(root, `src/i18n/messages/${locale}.ts`), "utf8");
  const m = /trackSubmitAnother:\s*"([^"]+)"/.exec(src);
  if (!m) throw new Error(`${locale}.ts 读不到 trackSubmitAnother —— 门的判据失效,不许静默跳过`);
  return m[1];
});
// 🔴 每个场景一个**独立单号**。四轮复用一个号会互相打架:上一轮的终态已经落盘,
// 下一轮把内存改回在途再落盘时,account-cloud 的合并让磁盘上那条终态赢回来
// (首跑实测:⑤⑥⑧ 读到的全是 ④ 那轮的值)。真实世界本来也是一单一号,复用本就不真。
const ID = {
  confirm: "WD-MIRROR-CONFIRM",
  orphan: "WD-MIRROR-ORPHAN",
  reject: "WD-MIRROR-REJECT",
  reasonOnly: "WD-MIRROR-REASON",
  frozenOut: "WD-MIRROR-FROZEN-OUT",
  render: "WD-MIRROR-RENDER",
  wiring: "WD-MIRROR-WIRING",
};

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

const probe = (url) => new Promise((resolve) => {
  const request = http.get(url, (response) => { response.resume(); resolve(response.statusCode === 200); });
  request.setTimeout(1000, () => request.destroy());
  request.once("error", () => resolve(false));
});

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`dev server exited early (${child.exitCode})\n${output()}`);
    if (await probe(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`dev server did not become ready\n${output()}`);
}

function stopTree(child) {
  if (!child || !child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

let server;
let baseUrl = process.env.BASE_URL;
if (!baseUrl) {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const npmCli = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].find((candidate) => candidate && fs.existsSync(candidate));
  server = spawn(
    npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm"),
    [...(npmCli ? [npmCli] : []), "run", "dev:h5", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    // 🔴 显式 remote:remote 是默认档,但**默认值不是断言**。别的门用 env 把它按成 mock,
    // 谁在同一个 shell 里导出过就会把本门验到错的对象上(本仓记过「验错对象」的假绿)。
    { cwd: root, env: { ...process.env, VITE_NEXGRID_API_MODE: "remote" }, shell: false, stdio: ["ignore", "pipe", "pipe"] },
  );
  let out = "";
  server.stdout.on("data", (c) => { out = (out + c).slice(-12_000); });
  server.stderr.on("data", (c) => { out = (out + c).slice(-12_000); });
  await waitForServer(`${baseUrl}/?nx_device=off`, server, () => out);
}

// 🔴 浏览器也放进 try 之前会漏进程:server 已起、chromium 启动失败时 finally 还没生效。
// 这里用一个包住两者的 try/finally(见下),两个资源都由同一个 finally 回收。
let browser;
let page;
// remote 档 + 无后端 = 启动期一堆网络失败是**预期噪声**,不作判据(会淹掉真信号)。
// 真信号取 pageerror(未捕获异常):那是代码坏了,不是后端不在。
const crashes = [];

try {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => crashes.push(error.message));
  await page.goto(`${baseUrl}/?nx_device=off#/pages/me/wallet`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => typeof window.uni !== "undefined" && document.querySelector("#app")?.children.length,
    null,
    { timeout: 30_000 },
  );

  const result = await page.evaluate(async ({ ID }) => {
    const [rt, appMod] = await Promise.all([import("/src/api/runtime.ts"), import("/src/store/app.ts")]);
    const app = appMod.useApp();
    // 环境不对就判失败并交底 ——「环境不对 → 跳过」是本仓明令禁止的假绿(跳过 ≠ 放宽)。
    if (!rt.remoteApiEnabled) return { notRemote: true };

    const seen = [];
    const realRequest = rt.apiClient.request;
    // 🔴 桩必须**按请求的单号**回话。上一版不看 req.path 一律回同一份报文,而
    // refreshRemoteWithdrawals 会把**所有在途单**逐个问一遍(前几轮的单据经三路合并
    // 还留在列表里)—— 于是这一轮的结论被套到了别人头上,断言时而红时而绿(实测:
    // ⑧ 读到的盘上原因是 ⑩ 那轮的 user-cancelled)。抖动的门比没有门更坏:
    // 它绿的时候你不知道是真绿还是这次刚好没撞上。不是目标单号就抛,让它保持原样。
    const mirrorOnce = async (payload) => {
      rt.apiClient.request = async (req) => {
        seen.push({ method: req.method, path: req.path });
        if (!String(req.path).endsWith(encodeURIComponent(payload.withdrawalNo))) {
          throw new Error("NOT_THE_TARGET_ORDER");
        }
        return payload;
      };
      try { return await app.refreshRemoteWithdrawals(); }
      finally { rt.apiClient.request = realRequest; }
    };

    // 🔴 **每个场景先证起点,再证结果**(包 z7 结构性反思的落地项:同族「门看起来在测、
    // 实际没测到」在本包内出现过三次 —— 靶没落盘、桩不看单号、标签手抄错)。
    // seed 现在**返回被观测到的起点**:该单确实在内存里、确实被判为在途(回读只查在途单)、
    // 以及它在磁盘上的状态。任何一格的起点不成立,它后面那些绿都不作数。
    const starts = {};
    const seed = (id, over = {}) => {
      app.withdrawals = [{
        id,
        amount: 120,
        network: "USDT-TRC20",
        address: "TRX9Yh7mQ2vK8pLxN4dW6sJ3fBcHgR5tZa",
        fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1 },
        status: "processing",
        riskRoute: "pass",
        submittedAt: Date.now() - 3600_000,
        estimatedCompletion: Date.now() + 3600_000,
        ...over,
      }];
      starts[id] = {
        inMemory: app.withdrawals.some((w) => w.id === id),
        // 回读只问在途单;靶若不在在途集,这一格根本不会发生任何网络请求(空跑)。
        inFlight: app.inFlightWithdrawals.some((w) => w.id === id),
      };
      return starts[id];
    };
    const live = (id) => app.withdrawals.find((w) => w.id === id);
    const stored = (id) => ((uni.getStorageSync("nexgrid-account-cloud-v1") || {})[app.accountKey]?.withdrawals || [])
      .find((w) => w.id === id);

    // ── ①②③ 服务端说 confirmed → 本地跟着变 + 落盘 ─────────────────────────
    seed(ID.confirm);
    const advancedByLocal = app.advanceWithdrawalArrival();
    const mirroredIds = await mirrorOnce({
      withdrawalNo: ID.confirm, status: "CONFIRMED", confirmedAt: Date.now(), terminalReason: null, retriable: null,
    });
    const afterConfirm = live(ID.confirm)?.status;
    const diskAfterConfirm = stored(ID.confirm)?.status;

    // ── ④ TX_ORPHANED:后台真会产生的终态,此前会把整张镜像打死 ────────────────
    seed(ID.orphan);
    const orphanIds = await mirrorOnce({
      withdrawalNo: ID.orphan, status: "TX_ORPHANED", confirmedAt: null, terminalReason: "OTHER", retriable: true,
    });
    const afterOrphan = live(ID.orphan)?.status;

    // ── ⑤⑥ 终态原因 + 不可重试 ──────────────────────────────────────────────
    seed(ID.reject);
    await mirrorOnce({
      withdrawalNo: ID.reject, status: "REVIEW_REJECTED", confirmedAt: null,
      terminalReason: "RISK_HIT", retriable: false,
    });
    const rejected = live(ID.reject) || {};

    // ── ⑧ 状态没动、但原因/可重试变了,也必须落盘。
    //  🔴 靶必须用**非终态**:回查只查在途单(occupiesWithdrawalSlot),
    //  终态单已经离开在途集、再也不会被查 —— 拿 review-rejected 当靶的话这条断言
    //  在任何实现下都不可能通过,是个假靶(本门首版就写错成那样)。
    //  frozen 不在终态清单里(风控冻结仍算在途),正是「状态不动但结论会被人工改写」的真实场景。
    seed(ID.reasonOnly, { status: "frozen", riskRoute: "freeze" });
    // 🔴 必须**先落盘**再镜像(2026-08-11 独立审计 P1:上一版少了这一行,
    // 磁盘上根本没有这个单号 → 三路合并走的是「map 里没有它,直接放进去」那条分支,
    // 同状态冲突的裁决代码一次都没被执行 → 这一格恒绿,被测行为坏成什么样都测不出来)。
    // 这是「哨兵会假绿」的又一种形态:空的不是集合,是冲突。
    app.persistAccountSnapshot();
    const diskBeforeReasonOnly = stored(ID.reasonOnly);
    const reasonOnlyIds = await mirrorOnce({
      withdrawalNo: ID.reasonOnly, status: "FROZEN", confirmedAt: null,
      terminalReason: "ADDRESS_RISK", retriable: false,
    });
    const reasonOnlyRow = live(ID.reasonOnly) || {};

    // ── ⑩ 🔴 已落盘的**冻结单**收到终态结论必须进得来(2026-08-11 独立审计 P0 的原型场景)。
    //  frozen 与四个终态在状态档位表里同档,而 frozen 是在途态 ——「冻结 → D2 处置成退款/拒绝」
    //  是天天走的正常流程。合并层原本平局取磁盘值,于是这条边**每一次**都被丢弃:
    //  单据不在失败清单里 → 退款永不触发;occupiesWithdrawalSlot 恒真 → 换绑入口与
    //  下一笔提现被永久拦死。必须先落盘再镜像,否则走的是「盘上没有它」那条无冲突分支(测不到)。
    seed(ID.frozenOut, { status: "frozen", riskRoute: "freeze" });
    app.persistAccountSnapshot();
    const frozenOutIds = await mirrorOnce({
      withdrawalNo: ID.frozenOut, status: "REFUNDED", confirmedAt: null,
      terminalReason: "USER_CANCELLED", retriable: true,
    });
    const frozenOutMem = live(ID.frozenOut)?.status;
    const frozenOutDisk = stored(ID.frozenOut)?.status;

    // ── ⑦ 解析器的**分档**规矩(R2 审计改过一次判据,这里守的是改后的规矩)────────
    // 抛不抛看「这个字段驱动什么」:
    //   驱动钱与状态机(status / 单号身份)→ 认不出必抛;
    //   只驱动显示(confirmedAt / terminalReason / retriable)→ 坏值降级成「没给」,绝不抛。
    // 为什么显示字段不许抛:抛出去会被调用方吞掉 → 整张单据镜像失败 → 单据永久停在处理中,
    // 而代价只是一句话没显示。两害相权。
    const apiMod = await import("/src/api/withdrawal-api.ts");
    const probeSnapshot = async (over) => {
      rt.apiClient.request = async () => ({
        withdrawalNo: ID.confirm, status: "CONFIRMED", confirmedAt: null,
        terminalReason: null, retriable: null, ...over,
      });
      try { return { ok: true, snap: await apiMod.createWithdrawalApi(rt.apiClient).get(ID.confirm) }; }
      // 两种协议错都算:认不出状态抛 STATUS_INVALID,其余报文违规抛 RESPONSE_INVALID。
      // (只认后者会让「状态闸」这一格永远判不过 —— 门自己的判据也要对得上被测代码。)
      catch (e) { return { ok: false, protocol: /WITHDRAWAL_(RESPONSE|STATUS)_INVALID/.test(String(e && e.message)) }; }
    };

    // (a) 认不出的**状态** = 驱动钱的字段 → 必抛。
    const badStatus = await probeSnapshot({ status: "WAT_IS_THIS" });
    const parserAlive = !badStatus.ok && badStatus.protocol;
    // (b) 单号对不上 → 必抛(服务端串号会把别人的状态和退款打到这张单上)。
    const crossTalk = await probeSnapshot({ withdrawalNo: "WD-SOMEONE-ELSE" });
    const idMismatchThrows = !crossTalk.ok && crossTalk.protocol;
    // (c) 显示字段的坏值一律降级成 null / other,**不抛**。
    //     confirmedAt: 0 是服务端最常见的「未设置」哨兵;retriable 给字符串;原因码给对象/数组。
    const degrade = [];
    for (const [label, over, expect] of [
      ["confirmedAt=0", { confirmedAt: 0 }, (s) => s.confirmedAt === null],
      ["confirmedAt 乱串", { confirmedAt: "not-a-date" }, (s) => s.confirmedAt === null],
      ["retriable 字符串", { retriable: "yes" }, (s) => s.retriable === null],
      ["原因码给对象", { terminalReason: { nope: 1 } }, (s) => s.terminalReason === null],
      ["原因码给数组", { terminalReason: ["RISK_HIT"] }, (s) => s.terminalReason === null],
    ]) {
      const r = await probeSnapshot(over);
      degrade.push({ label, ok: r.ok && expect(r.snap) });
    }
    // (d) 不认识的**字符串**码回落 other 而不抛(后台加新码不该打死老客户端)。
    const future = await probeSnapshot({ terminalReason: "SOME_FUTURE_CODE" });
    const unknownCodeFallsBack = future.ok && future.snap.terminalReason === "other";
    rt.apiClient.request = realRequest;

    // 渲染面留一张被拒的单(带原因 + 不可重试),交给页面断言。
    seed(ID.render, { status: "review-rejected", terminalReason: "risk-hit", retriable: false });
    app.persistAccountSnapshot();
    // 渲染类场景的起点 = 靶真的落到了盘上(页面是 SPA 内跳转后从快照读它的)。
    starts[ID.render].onDisk = !!stored(ID.render);

    return {
      starts,
      seen, advancedByLocal,
      mirroredIds, afterConfirm, diskAfterConfirm,
      orphanIds, afterOrphan,
      rejectedStatus: rejected.status, rejectedReason: rejected.terminalReason, rejectedRetriable: rejected.retriable,
      diskReason: stored(ID.reject)?.terminalReason,
      frozenOutIds, frozenOutMem, frozenOutDisk,
      reasonOnlyIds,
      reasonOnlySeeded: !!diskBeforeReasonOnly,
      reasonOnlyDiskReason: stored(ID.reasonOnly)?.terminalReason,
      reasonOnlyStatus: reasonOnlyRow.status,
      reasonOnlyReason: reasonOnlyRow.terminalReason,
      reasonOnlyRetriable: reasonOnlyRow.retriable,
      parserAlive, idMismatchThrows, degrade, unknownCodeFallsBack,
    };
  }, { ID });

  if (result.notRemote) {
    check("环境是远端档(回读只在远端档存在)", false, "当前是 mock 档 —— 本门在 mock 下测不到任何东西,不能算过");
  } else {
    const R = result;
    console.log("withdraw-status-mirror-runtime — 回查接口真的被调用,且返回值真的被消费\n");
    // 🔴 起点断言先行:靶没进在途集 = 这一格根本不会发生网络请求,后面的绿全是空跑。
    // 本包内同族失误三次(靶没落盘 / 桩不看单号 / 标签手抄错)的构造性修法,
    // 见 docs/changes/2026-08-11-z7-structural-reflection.md。
    // 起点按场景定义,不一刀切:回读类场景的起点是「在在途集里」(回读只问在途单);
    // 渲染类场景的靶**故意是终态单**(终态本就不在在途集),它的起点是「落了盘、页面读得到」。
    // 一刀切会把「靶摆对了」误判成失败 —— 判据本身也要经得起这一问。
    const startEntries = Object.entries(R.starts || {});
    const badStarts = startEntries
      .filter(([id, v]) => (id === ID.render ? !(v.inMemory && v.onDisk) : !(v.inMemory && v.inFlight)))
      .map(([id, v]) => `${id}(内存 ${v.inMemory} / 在途 ${v.inFlight} / 盘上 ${v.onDisk})`);
    check(`⓪ 每个场景的起点都成立(${startEntries.length} 格:回读类必在在途集,渲染类必已落盘)`,
      startEntries.length >= 5 && badStarts.length === 0,
      badStarts.join(" · ") || "靶数不足 —— 判据失效,后面的绿不作数");
    check("① 回查真的被调用(桩收到对该单号的 GET,路径就是回查那条)",
      R.seen.some((c) => c.method === "GET" && c.path === `/api/withdrawals/${ID.confirm}`),
      `实际请求 ${JSON.stringify(R.seen.slice(0, 4))}`);
    check("① 远端档下本地推进不参与(状态只能来自服务端)",
      Array.isArray(R.advancedByLocal) && R.advancedByLocal.length === 0,
      `本地推进返回 ${JSON.stringify(R.advancedByLocal)}`);
    check("② 返回值被消费:服务端说 confirmed,本地单据跟着变",
      R.afterConfirm === "confirmed" && R.mirroredIds.includes(ID.confirm),
      `状态 ${R.afterConfirm} · 返回 ${JSON.stringify(R.mirroredIds)}`);
    check("③ 真落盘(只在内存 = 刷新后退回处理中)", R.diskAfterConfirm === "confirmed", `盘上 ${R.diskAfterConfirm}`);
    check("④ 🔴 TX_ORPHANED 不再打死镜像,落到 tx-failed(此前:抛 protocol → 永久停在处理中)",
      R.afterOrphan === "tx-failed" && R.orphanIds.includes(ID.orphan),
      `状态 ${R.afterOrphan} · 返回 ${JSON.stringify(R.orphanIds)}`);
    check("⑤ terminalReason 归一并落到本地单据(线上 RISK_HIT → 本地 risk-hit)",
      R.rejectedStatus === "review-rejected" && R.rejectedReason === "risk-hit",
      `状态 ${R.rejectedStatus} · 原因 ${R.rejectedReason}`);
    check("⑤ 原因随单落盘(客服要查的就是它,刷新后必须还在)", R.diskReason === "risk-hit", `盘上 ${R.diskReason}`);
    check("⑥ retriable=false 落到本地单据并落盘",
      R.rejectedRetriable === false, `实测 ${JSON.stringify(R.rejectedRetriable)}`);
    check("⑧ 靶先落了盘(不落盘 = 合并冲突分支不执行 = 本格恒绿)", R.reasonOnlySeeded === true,
      "磁盘上没有这张单,下一格测不到任何东西");
    check("⑧ 状态没变、只有原因/可重试变了也要**穿过三路合并**落盘(平局取磁盘 = 整拍丢掉)",
      R.reasonOnlyIds.includes(ID.reasonOnly)
        && R.reasonOnlyStatus === "frozen"
        && R.reasonOnlyReason === "address-risk"
        && R.reasonOnlyDiskReason === "address-risk"
        && R.reasonOnlyRetriable === false,
      `返回 ${JSON.stringify(R.reasonOnlyIds)} · 状态 ${R.reasonOnlyStatus} · 原因 ${R.reasonOnlyReason} · 盘上原因 ${R.reasonOnlyDiskReason} · 可重试 ${JSON.stringify(R.reasonOnlyRetriable)}`);
    check("⑩ 🔴 已落盘的冻结单收到终态结论必须进得来(同档位互转,平局取磁盘 = 这条边永远走不通)",
      R.frozenOutIds.includes(ID.frozenOut) && R.frozenOutMem === "refunded" && R.frozenOutDisk === "refunded",
      `内存 ${R.frozenOutMem} · 盘上 ${R.frozenOutDisk} · 返回 ${JSON.stringify(R.frozenOutIds)}`);
    check("⑦ 认不出的**状态**必抛(它驱动钱与状态机,猜一个等于拿钱赌)",
      R.parserAlive === true, "认不出的状态却没抛 —— 驱动钱的字段失守了");
    check("⑦ 🔴 单号对不上必抛(服务端串号会把别人的状态和退款打到这张单上)",
      R.idMismatchThrows === true, "响应里的单号与请求的不一致,却被照单全收");
    check("⑦ 🔴 只驱动显示的字段坏值一律降级成「没给」,**绝不抛**(抛 = 整张单据镜像失败 = 单据永久卡住)",
      Array.isArray(R.degrade) && R.degrade.length === 5 && R.degrade.every((d) => d.ok),
      (R.degrade || []).filter((d) => !d.ok).map((d) => d.label).join(" · "));
    check("⑦ 但不认识的**字符串**码必须回落 other 而**不抛**(否则后台加个新码就打死老客户端)",
      R.unknownCodeFallsBack === true, "未知码没回落到 other");
  }

  // ── ⑨ 🔴 接线断言:**App 自己**去调,本脚本一根手指都不碰那个 action ──────────
  // 上面 ①-⑧ 证的是「这个 action 干得对」,证不了「有人调它」—— 我在测试里手调了它。
  // 摘掉 App.vue 那行调用,①-⑧ 会全绿,而在途单永远不终结:这正是本包立案的那个洞,
  // 门要是复制了这个盲区,就是换个地方重演一遍。所以这一格只做三件事:
  // 装桩 → 让 App 的业务循环跑起来 → 等 → 看单据变没变。中间不调 refreshRemoteWithdrawals。
  const wiring = await page.evaluate(async ({ id }) => {
    const [rt, appMod, authMod] = await Promise.all([
      import("/src/api/runtime.ts"), import("/src/store/app.ts"), import("/src/store/auth.ts"),
    ]);
    const app = appMod.useApp();
    // 业务循环的前置条件:已登录 + onboarding 完成 + 非白名单路由(session 无 id 时 validate 恒 active)。
    const auth = authMod.useAuth();
    auth.isAuthenticated = true;
    auth.onboardingComplete = true;

    app.withdrawals = [{
      id,
      amount: 88,
      network: "USDT-TRC20",
      address: "TRX9Yh7mQ2vK8pLxN4dW6sJ3fBcHgR5tZa",
      fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1 },
      status: "processing",
      riskRoute: "pass",
      submittedAt: Date.now() - 3600_000,
      estimatedCompletion: Date.now() + 3600_000,
    }];

    let asked = 0;
    const realRequest = rt.apiClient.request; // 🔴 用完必还原:不还原会把这个 origin 的
    // apiClient 永久钉在桩上,脚本头部文档化的「BASE_URL 打已有 server」用法会污染真账号。
    rt.apiClient.request = async (req) => {
      if (req.method === "GET" && req.path === `/api/withdrawals/${id}`) {
        asked += 1;
        return { withdrawalNo: id, status: "CONFIRMED", confirmedAt: Date.now(), terminalReason: null, retriable: null };
      }
      // 其余请求照「后端不在」的样子失败 —— 别顺手把整个 app 桩成一个假世界。
      throw new Error("NO_BACKEND_IN_GATE");
    };

    // onShow → ensureBusinessLoopsRunning:首次会立刻跑一轮,已在跑则靠 5s 轮询那一拍。
    uni.redirectTo({ url: "/pages/me/wallet" });
    await new Promise((r) => setTimeout(r, 7000)); // > ARRIVAL_TICK_MS(5s),覆盖两条路径
    const row = app.withdrawals.find((w) => w.id === id);
    rt.apiClient.request = realRequest;
    return { asked, status: row?.status, route: location.hash };
  }, { id: ID.wiring });

  check("⑨ 🔴 App 自己发起了回查(本脚本没调 action —— 摘掉调用点这一格必红)",
    wiring.asked > 0, `被问次数 ${wiring.asked} · 当前路由 ${wiring.route}`);
  check("⑨ 🔴 App 自己消费了返回值(单据被服务端的结论推到终态)",
    wiring.status === "confirmed", `状态 ${wiring.status} · 被问 ${wiring.asked} 次`);

  // ── 渲染面:原因翻成话术、码不上页面、按钮真置灰 ────────────────────────────
  // 用 SPA 内跳转而不是整页 reload:留在同一个 JS 上下文里,不重放一轮启动期请求。
  await page.evaluate((id) => uni.redirectTo({ url: `/pages/me/wallet-withdraw-tracking?id=${id}` }), ID.render);
  await page.waitForTimeout(1800);
  const view = await page.evaluate((labels) => ({
    text: document.body.innerText,
    // 🔴 按 aria-label **点名**那个控件,不数「页面上有没有任一 aria-disabled」
    //(独立审计 P2:形状判据今天红得对是巧合 —— 换个控件被置灰它也绿)。
    againDisabled: [...document.querySelectorAll('[role="button"]')]
      .filter((b) => labels.includes((b.getAttribute("aria-label") || "").trim()))
      .map((b) => b.getAttribute("aria-disabled")),
  }), AGAIN_LABELS);
  check("⑤ 追踪页把原因渲染成业务话术(渲染面接得上生产面)",
    /did not pass our security review|没有通过安全审核|không qua được kiểm tra an toàn/.test(view.text),
    view.text.replace(/\s+/g, " ").slice(0, 200));
  check("⑤ 🔴 页面上不出现原始枚举码(工程值禁直出)",
    !/RISK_HIT|risk-hit|TX_ORPHANED/.test(view.text), "页面出现了原始码");
  check("⑥ retriable=false 如实说给用户(这笔不能再发起 + 联系客服)",
    /cannot be resubmitted|不能再次发起|Không thể gửi lại/.test(view.text),
    view.text.replace(/s+/g, " ").slice(0, 220));
  // 🔴 反向断言:单据级的「这笔不能重发」**不许**去禁账号级的「再提一笔」
  //(独立审计 P1:失败单永久留存 + 终态不再回查 → 一张历史废单会把入口永久锁死)。
  check("⑥ 🔴 但它**不**置灰「再提一笔」(单据级结论不许禁账号级动作)",
    view.againDisabled.length > 0 && view.againDisabled.every((v) => v !== "true"),
    `找到 ${view.againDisabled.length} 个该控件,aria-disabled=${JSON.stringify(view.againDisabled)}`);

  check("零未捕获异常(remote 档无后端的网络失败是预期噪声,不作判据)",
    crashes.length === 0, crashes.slice(0, 3).join(" | "));
} finally {
  if (browser) await browser.close();
  stopTree(server);
}

console.log(`\n${pass} pass / ${fail} fail(真页面 + 真 store + 真 action;仅桩 apiClient.request 一层)`);
process.exit(fail ? 1 : 0);
