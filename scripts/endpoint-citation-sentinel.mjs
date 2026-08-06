#!/usr/bin/env node
/**
 * endpoint-citation-sentinel — 注释里的 PROD 接口地址必须在台账里有据。
 *
 * 缺陷族(2026-08-04 R4):注释写 `POST /api/stakes/:id/claim` 而 PRD 是
 * `/api/staking/:id/claim`;注释写 `POST /api/genesis/purchase` / `POST /api/swap`
 * 而 PRD 根本没这个接口。tsc / verify 全绿也抓不到 —— 注释不参与编译。
 *
 * 判据:扫全部**注释行**里的 `/api/...` 引用,逐条对下面的 LEDGER 比对。
 *   - 代码里出现、台账里没有  → RED(新接口没登记,或是笔误 / 虚构)
 *   - 台账里有、代码里没出现  → RED(台账过期,防止台账变成只增不减的垃圾场)
 *   - 一条都没扫到            → RED(判据本身失效,空集全过是哨兵最常见的假绿)
 *
 * LEDGER 每条必须注明出处:`PRD §X.Y`(前端 PRD 有定义)或 `TBD: <原因>`
 * (PRD 未定义 —— 注释侧必须同时写明 TBD / 候选,不许当既定契约引用)。
 * 台账**写在本文件里**,不写在被查文件里 —— 否则改注释的同时改台账,门等于没有。
 *
 * 用法:node scripts/endpoint-citation-sentinel.mjs [--dump]
 *   --dump  只打印扫到的实际引用(加新接口时用来对齐台账),不做判定
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src"];
const EXT = new Set([".ts", ".tsx", ".vue", ".js", ".mjs"]);
const SKIP_DIR = new Set(["node_modules", ".git", ".trash", "dist", "unpackage", ".playwright-mcp"]);

/**
 * 台账:normalized citation → 出处。
 * 前端 PRD = D:\WORKS\PLAN\PRD\NexGrid_产品功能架构设计文档_v3.7.md
 */
const LEDGER = {
  // ── auth / session ────────────────────────────────────────────────────
  "GET /api/auth/session": "PRD §4.9 / §9.11a",
  "POST /api/auth/login": "PRD §9.11e",
  "POST /api/auth/logout": "PRD §4.7",
  "POST /api/auth/otp/send": "PRD §4.6.2",
  "POST /api/auth/otp/verify": "PRD §4.6.2 / §9.11e",
  "POST /api/auth/password/reset": "PRD §9.11e",
  "POST /api/auth/register": "PRD §4.9(`POST /api/auth/{register,login}`)",
  "POST /api/auth/{register,login}": "PRD §4.9",
  "POST /api/auth/signin": "PRD §4.7(多载体 session registry)",
  "GET /api/account/sessions": "PRD §4.7",
  "POST /api/account/sessions/:id/revoke": "PRD §4.7",
  "POST /api/me/password": "TBD: PRD §4.6.5 用 POST /api/auth/password/change;本处为旧候选名,接后台时以 auth 为准",
  "GET /api/pulse/rank-snapshot": "TBD: PRD 未定义 —— 包 G 排名 24h 快照的候选名(rank-snapshot.ts 注释已标 TBD),PRD 同步时定名",
  "/api/me/*": "PRD §12.2(自身档案读写族,非单一 endpoint)",

  // ── config(server-canonical 业务参数)──────────────────────────────
  "GET /api/config/platform": "PRD §9.11c.1",
  "GET /api/config/commission/rates": "PRD §9.11c.1",
  "GET /api/config/leadership-pool": "PRD §9.11c.1",
  "GET /api/config/milestones": "PRD §9.11c.1",
  "GET /api/config/phone-tiers": "PRD §9.11c.1",
  "GET /api/config/staking/pools": "PRD §9.11c.1",
  "GET /api/config/task-capacity": "PRD §6.8 / §9.11c.1(PRD 原文标 TBD)",
  "GET /api/config/tradein": "PRD §7.5.1 / §9.11c.1",
  "GET /api/config/v-ranks": "PRD §9.11c.1",
  "GET /api/config/bank-accounts": "PRD §9.2.8",
  "GET /api/config/deposit-channels": "PRD §9.2.8",
  "/api/config/deposit-channels": "PRD §9.2.8",
  "/api/config/leadership-pool": "PRD §9.11c.1",
  "/api/config/tradein": "PRD §7.5.1 / §9.11c.1",
  "GET /api/config/fx": "PRD §9.11c.1",
  "GET /api/config/genesis": "PRD §9.11c.1",
  "GET /api/config/gpu-tiers": "PRD §9.11c.1",
  "GET /api/config/release-gates": "PRD §9.11c.1",

  // ── genesis ───────────────────────────────────────────────────────────
  "POST /api/genesis/primary/subscribe": "PRD §10.1.1",
  "POST /api/genesis/secondary/fulfill": "PRD §10.2.4",
  "POST /api/genesis/{list,unlist}": "PRD §10.2.4",
  "GET /api/genesis/eligibility": "PRD §10.1.1",
  "POST /api/genesis/invite/redeem": "PRD §10.1.1(核销次数规则待主人定)",

  // ── staking ───────────────────────────────────────────────────────────
  // 注:`POST /api/staking/open` 曾在 stake-sheet.vue 被引用,2026-08-04 并发的
  // staking-CAS 改造把那条注释改写掉了 —— 台账随之删除(引用回归时哨兵会报
  // 「未登记」,按流程重新登记 PRD §9.11e 即可)。
  "POST /api/staking/:id/claim": "PRD §9.11e",
  "POST /api/staking/:id/{claim|early-withdraw}": "PRD §9.11e",

  // ── trial ─────────────────────────────────────────────────────────────
  "GET /api/trial/eligibility": "PRD §9.11a.2",
  "GET /api/trial/state": "PRD §9.11a.2",
  "POST /api/trial/start": "PRD §9.11a.2",
  "POST /api/trial/convert": "PRD §9.11a.2 / §9.11e",
  "POST /api/trial/cancel": "PRD §9.11a.2",

  // ── orders / store ────────────────────────────────────────────────────
  "POST /api/orders": "PRD §7.5 / §9.10 / §9.11e",
  "GET /api/orders/:id": "PRD §7.4(SSE)",
  "GET /api/store/catalog": "PRD §7.1",

  // ── wallet / withdrawals / deposits ───────────────────────────────────
  "GET /api/withdrawals": "PRD §9.4",
  "POST /api/withdrawals": "PRD §9.4 / §9.11e",
  "GET /api/withdrawals/:id": "PRD §9.11f(`GET /api/{module}/:id` 通式)",
  "POST /api/withdrawals/eligibility": "PRD §9.3.1-3",
  "GET /api/payout-addresses": "TBD: 包 E 提现地址直管(FEAT-KYC-RM01a)新接口,PRD 接口章节待实现批次 C1 式修订收口(候选命名)",
  "POST /api/payout-addresses": "TBD: 同上 —— 添加地址(OTP 在服务端事务内核验)",
  "PUT /api/payout-addresses/{network}": "TBD: 同上 —— 原子更换(在途单拦截 / 频控 / 冻结由服务端裁决)",
  "GET /api/deposits": "PRD §9.2.8",
  "GET /api/deposits/address": "PRD §9.2.8",
  "POST /api/deposits/bank-intents": "PRD §9.2.8",
  "POST /api/deposits/card": "PRD §9.2.8",
  "POST /api/admin/deposits/:id/resolve": "TBD: 入金后台处置 endpoint,PAY 规格未定义 API 层(见 deposits.ts 顶部声明)",
  "POST /api/admin/deposits/bank-intents/:id/resolve": "TBD: 同上,候选命名",
  "GET /api/bills": "PRD §9.3",
  "GET /api/me/bills": "PRD §11.5a",
  "GET /api/me/vouchers": "PRD §9.11c.2",
  "PATCH /api/me/rewards/seen": "PRD §11.5a",
  "GET /api/me/earnings": "PRD §9.11c.1",
  "/api/me/earnings/stream": "PRD §9.11c.1(SSE)",

  // ── vouchers ──────────────────────────────────────────────────────────
  "GET /api/vouchers": "PRD §9.11c.2",
  "POST /api/vouchers/:id/claim": "PRD §11.5a",
  "GET /api/vouchers/:id": "PRD §9.11f(`GET /api/{module}/:id` 通式)",
  "GET /api/users/:id/vouchers": "TBD: PRD 未定义运营读他人券包 endpoint(admin 侧,候选名)",

  // ── quests / faucet / milestones ──────────────────────────────────────
  "GET /api/quest": "PRD §9.11c.2",
  "POST /api/quest/complete": "PRD §9.11c.2",
  "GET /api/quests/weekly": "PRD §9.11c.2",
  "POST /api/quests/weekly/{tier1}": "PRD §11.13.5",
  "POST /api/quests/weekly/{tier2/:id}": "PRD §11.13.5",
  "POST /api/quests/weekly/{bonus}": "PRD §11.13.5",
  "POST /api/quests/weekly/{tier1|tier2/:id|bonus}": "PRD §11.13.5",
  "POST /api/faucet/sign-in": "PRD §11.12",
  "POST /api/nex/sign-in": "TBD: PRD 用 POST /api/faucet/sign-in;本处为旧候选名,接后台时以 faucet 为准",
  "POST /api/me/milestones/:id/claim": "PRD §11.3a",

  // ── events / lucky spin ───────────────────────────────────────────────
  "GET /api/events": "PRD §9.11c.2",
  "POST /api/events/:id/spin": "PRD §11.10.9",
  "POST /api/events/:id/join": "PRD §11.10.7",
  "POST /api/events/:id/claim": "PRD §11.10.7",

  // ── devices / heartbeat / onboarding ──────────────────────────────────
  "POST /api/device/:id/heartbeat": "PRD §6.11 / §12.2(PRD 原文标『endpoint TBD,候选名』)",
  "GET /api/devices/eligibility": "PRD §7.5.1",
  "POST /api/devices/deactivate": "PRD §9.11c.1(composer endpoints,PRD 原文标 TBD; candidates)",
  "/api/gate/logout": "TBD: 退役 prototype 的 Next middleware reviewer-cookie 路由,uni 端已弃用(非 PROD 契约)",
  "GET /api/onboarding/calibrate/result": "PRD §12.2",
  "GET /api/users/me": "PRD §12.2",

  // ── social / network / misc ───────────────────────────────────────────
  "POST /api/share/event": "PRD §11.9",
  "POST /api/sponsorship/bind": "PRD §9.11e",
  "GET /api/platform/stats": "PRD §5.5",
  // FEAT-HOME02:排名派生目前是 client 纯函数(lib/network-rank.ts),真后台接管后
  // 由本端点返回同一套结果。前端 PRD 尚无该条目 —— 实现批次收口时随 nexion-prd-sync 补。
  "GET /api/platform/rank": "TBD: FEAT-HOME02 排名派生;规格已签字,PRD 条目待收口时补",
  "GET /api/leaderboard": "PRD §8.11.3",
  "GET /api/config/exchange/caps": "PRD §9.11c.1",
  "POST /api/exchange/swap": "PRD §9.4.3",
  "POST /api/admin/exchange/pause": "PRD §9.11d",
  "GET /api/network/members": "PRD §8.7",
  "GET /api/network/regions": "PRD §11.6",
  "GET /api/pool/state": "PRD §8.5.2",
  "GET /api/server-time": "PRD §9.11a.4",
  "GET /api/market": "TBD: 与 §10.3 `/api/market/nex` 是同一个平台牌价,重复候选名;注释应改指 /api/market/nex",
  "/api/market/nex": "PRD §10.3(WebSocket 推送)",
  "GET /api/market/tokens": "PRD §11.9.3",
  "GET /api/admin/platform/phase-config": "PRD §9.11d",
  "PUT /api/admin/tradein/config": "TBD: PRD 未定义置换配置写接口(admin 侧,候选名)",
};

// ── 扫描 ────────────────────────────────────────────────────────────────
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.has(extname(e.name))) files.push(p);
  }
})(join(ROOT, SCAN_DIRS[0]));

/**
 * 标出每一行是不是注释。**必须带块状态**:Vue SFC 顶部的 `<!-- … -->` 和 JSDoc
 * `/* … *\/` 的**续行**没有任何前缀,只按行首前缀匹配会整片漏掉(2026-08-04 实测
 * rewards.vue 的 `GET /api/me/bills` 就是这么漏的)。
 */
function markCommentLines(lines) {
  const out = new Array(lines.length).fill(false);
  let inBlock = false; // /* */
  let inHtml = false; // <!-- -->
  lines.forEach((line, i) => {
    if (inBlock || inHtml) {
      out[i] = true;
      if (inBlock && line.includes("*/")) inBlock = false;
      if (inHtml && line.includes("-->")) inHtml = false;
      return;
    }
    if (/^\s*\/\//.test(line) || /\S\s+\/\/\s/.test(line)) out[i] = true;
    if (line.includes("/*")) {
      out[i] = true;
      if (!line.includes("*/")) inBlock = true;
    }
    if (line.includes("<!--")) {
      out[i] = true;
      if (!line.includes("-->")) inHtml = true;
    }
  });
  return out;
}
/** `.` 不进路径 —— 注释里常跟字段访问(`…/tradein.promo.routes`);`,` 进,因为
 *  PRD 自己用 `{register,login}` 这种花括号并列写法 */
const CITE = /(?:\b(GET|POST|PUT|PATCH|DELETE)\s+)?(\/api\/[A-Za-z0-9_:{},*|/?=&…-]*)/g;

/**
 * 归一:去 query string(台账登记的是 endpoint,不是每种调用变体)、去句读尾巴、
 * 去尾斜杠;必须还剩至少一个 segment —— 挡掉注释换行截断出来的裸 `/api/`。
 */
function normalizePath(raw) {
  const p = raw
    .replace(/\?.*$/, "")
    .replace(/[,.;:)]+$/, "")
    .replace(/\/+$/, "");
  return /^\/api\/[A-Za-z{]/.test(p) ? p : null;
}

const found = new Map(); // token → [{file, line}]
for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  const isComment = markCommentLines(lines);
  lines.forEach((line, i) => {
    if (!isComment[i]) return;
    for (const m of line.matchAll(CITE)) {
      const p = normalizePath(m[2]);
      if (!p) continue;
      const token = (m[1] ? `${m[1]} ` : "") + p;
      if (!found.has(token)) found.set(token, []);
      found.get(token).push({ file: relative(ROOT, f).replace(/\\/g, "/"), line: i + 1 });
    }
  });
}

if (process.argv.includes("--dump")) {
  for (const [t, locs] of [...found.entries()].sort()) {
    console.log(`${String(locs.length).padStart(3)}  ${t}${LEDGER[t] ? "" : "   <<< NOT IN LEDGER"}`);
    if (!LEDGER[t]) locs.forEach((l) => console.log(`       ${l.file}:${l.line}`));
  }
  process.exit(0);
}

const totalCitations = [...found.values()].reduce((s, v) => s + v.length, 0);
const unregistered = [...found.entries()].filter(([t]) => !LEDGER[t]);
const orphanLedger = Object.keys(LEDGER).filter((t) => !found.has(t));

const fail = [];
// ③ 判据失效兜底:一条都没扫到 = 正则 / 路径写错了,空集全过是假绿
if (totalCitations === 0) {
  fail.push(
    `扫描 0 命中 —— 判据失效(扫了 ${files.length} 个文件却一条 /api/ 注释引用都没找到)。` +
      `先修扫描逻辑,别把空集当通过。`,
  );
}
// ① 代码里有、台账里没有
for (const [t, locs] of unregistered) {
  fail.push(
    `未登记的接口引用 \`${t}\`(${locs.length} 处):\n` +
      locs.map((l) => `      ${l.file}:${l.line}`).join("\n") +
      `\n      → 与前端 PRD 核对后加进 scripts/endpoint-citation-sentinel.mjs 的 LEDGER,` +
      `并注明 "PRD §X.Y" 或 "TBD: <原因>";PRD 没有的接口注释侧必须写明 TBD / 候选,不许当既定契约。`,
  );
}
// ② 台账里有、代码里没有
for (const t of orphanLedger) {
  fail.push(
    `台账条目 \`${t}\` 在代码注释里已不存在 —— 台账过期,请从 LEDGER 删除` +
      `(出处记录:${LEDGER[t]})。`,
  );
}

if (fail.length) {
  console.error("✗ endpoint-citation-sentinel FAIL");
  fail.forEach((m, i) => console.error(`  ${i + 1}. ${m}`));
  process.exit(1);
}

console.log(
  `✓ endpoint-citation-sentinel PASS — ${totalCitations} 处注释接口引用 / ` +
    `${found.size} 个去重地址,全部在台账有据(扫描 ${files.length} 个源文件;` +
    `台账 ${Object.keys(LEDGER).length} 条,其中 ` +
    `${Object.values(LEDGER).filter((v) => v.startsWith("TBD")).length} 条 PRD 未定义)`,
);
