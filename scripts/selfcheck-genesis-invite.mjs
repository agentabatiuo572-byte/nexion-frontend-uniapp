#!/usr/bin/env node
// 创世邀请码「码表核销」自检 — node 直跑,不起浏览器:
//   node scripts/selfcheck-genesis-invite.mjs
//
// 背景(规格 FEAT-GEN11):旧实现 `setGenesisInviteCode` 只跑一条正则
//   /^NEXGRID-OG-[A-Z0-9]{4}$/ —— 任何符合格式的串都通过、同一个码可被无限个账号使用,
//   创世资格门第 4 条通道等于形同虚设。改为查平台码表 + 三态校验。
//
// 🔴 守的不变量(编号对应红测文档 docs/changes/2026-08-04-invite-registry-redtest.md):
//   ① 同一个码第二次核销必拒(一码一用)。
//   ② 本账号已持码,再提另一个码必拒;**已持有的码不受影响**,新码也不被吞掉。
//   ③ 码不存在 / 已作废 各自拒绝,且两者文案不同(不泄露核销者身份)。
//   ④ 两个账号并发提交同一个码,只有一个成功(先占后改 + 单次落盘)。
//   ⑤ 已核销的码没有作废路径:used 是终态,本仓没有任何出口能把它改回去 —— 作废只属于
//      运营后台(落点 2026-08-04 待主人裁决),前端连 API 都不该有。
//   ⑥ 格式正确但**从未发放**的码必须被拒 —— 这是原缺陷本体。
//   ⑦ 接线门:资格门真的按「本账号持有一个已核销的码」判定,不再看格式(判定对不对 /
//      有没有被接上是两道门)。
//   ⑧ 四种拒绝 + 一种失败态的文案三语真解析取值、非空、互不相同。
//
// 方法:结构断言跑在**剥注释后的正主源码**上(注释里出现判定式文本不得哄绿);行为断言
// esbuild 载**真 app store + 真码表模块**跑真代码(不是抄一份判据副本),两个 store 实例
// = 两个账号,共享同一份 JSON 序列化的假 storage(与 localStorage 同语义)。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");
const STORE_DIR = path.join(SRC, "store");
const registryRaw = readFileSync(path.join(STORE_DIR, "genesis-invite.ts"), "utf8");
const appRaw = readFileSync(path.join(STORE_DIR, "app.ts"), "utf8");
const gateRaw = readFileSync(path.join(SRC, "composables", "use-genesis-eligibility.ts"), "utf8");
const sheetRaw = readFileSync(path.join(SRC, "components", "genesis", "eligibility-sheet.vue"), "utf8");

const samples = { accounts: 0, targets: 0, locales: 0, rejectKeys: 0 };
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
  if (start < 0) throw new Error(`selfcheck-genesis-invite: 源码里找不到 \`${needle}\`(实现被改名或删除?)`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`selfcheck-genesis-invite: \`${needle}\` 括号不闭合`);
}

// ── 假 uni storage:JSON 序列化,与 localStorage 同语义(两个实例拿不到同一个对象引用) ──
const disk = new Map();
let failWrites = null; // 写盘故障注入:命中该键的 setStorageSync 抛错
const uni = {
  getStorageSync(key) {
    const raw = disk.get(key);
    return raw === undefined ? "" : JSON.parse(raw);
  },
  setStorageSync(key, value) {
    if (failWrites && failWrites(key)) throw new Error("storage full");
    disk.set(key, JSON.stringify(value));
  },
  removeStorageSync(key) { disk.delete(key); },
  getSystemInfoSync: () => ({ platform: "devtools" }),
};
globalThis.uni = uni;

// ── 载真 store(只 stub pinia/vue 两个运行时外壳,码表与 app 是被测对象,绝不 stub) ──
const STUBS = {
  "pinia-stub": `export const defineStore = (_id, setup) => setup;`,
  "vue-stub": `export const ref = (v) => ({ value: v });
    export const computed = (f) => ({ get value() { return f(); } });
    export const watch = () => {};
    export const reactive = (v) => v;`,
};
async function loadModule(abs) {
  const out = await build({
    entryPoints: [abs],
    bundle: true, write: false, format: "esm",
    define: { "import.meta.env.PROD": "false", "import.meta.env.DEV": "true" },
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
        b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
        b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "selfcheck-genesis-invite"));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
      },
    }],
  });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text, "utf8").toString("base64"));
}
const loadStore = (rel) => loadModule(path.join(STORE_DIR, rel));

const { useApp } = await loadStore("app.ts");
const {
  GENESIS_INVITE_REGISTRY_KEY,
  claimGenesisInviteCode,
  redeemedInviteCodeOf,
} = await loadStore("genesis-invite.ts");

const LANGS = ["en", "zh", "vi"];
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
/** 真解析:bundle 出 locale 模块取**值**,不是在文件文本里找 key 名(注释能骗过子串扫描)。 */
async function loadLocale(l) {
  const mod = await loadModule(path.join(SRC, "i18n", "messages", `${l}.ts`));
  return mod[l] ?? mod.default ?? Object.values(mod)[0];
}
const LOCALES = Object.fromEntries(await Promise.all(LANGS.map(async (l) => [l, await loadLocale(l)])));

console.log("selfcheck-genesis-invite — 创世邀请码码表核销(一码一用 + 本账号限一次)");

// 出厂码表(与 src/store/genesis-invite.ts 的 SEED 同批;这里只用码值,状态从真码表读)
const UNUSED_A = "NEXGRID-OG-7K3M";
const UNUSED_B = "NEXGRID-OG-9QX4";
const UNUSED_C = "NEXGRID-OG-A2VH";
const SEED_USED = "NEXGRID-OG-5RTB";
const SEED_VOID = "NEXGRID-OG-C6WY";
/** 格式完全合法、但**从未发放** —— 原缺陷本体的固定靶。 */
const NEVER_ISSUED = "NEXGRID-OG-ZZ99";

function resetDisk() { disk.clear(); }
function registry() { return uni.getStorageSync(GENESIS_INVITE_REGISTRY_KEY) || []; }
function rowOf(code) { return registry().find((r) => r.code === code) ?? null; }
/** 开一个「账号」:独立 store 实例 + bindAccount,共享同一份 storage。 */
function openAccount(email) {
  const app = useApp();
  app.bindAccount(email);
  samples.accounts++;
  return app;
}
/** setup store 的 ref 在真 Pinia 里会被解包,本 harness 的 vue 桩不会 —— 统一在这里解。
 *  🔴 解错了会让所有 `(x ?? null) === null` 式断言**恒真**(undefined ?? null = null),
 *  整片固定靶静默空转。所以下面 harnessSanity() 用正向断言把这一格钉死。 */
const userOf = (app) => app.user?.value ?? app.user;
const acctOf = (app) => app.accountKey?.value ?? app.accountKey;
const heldCodeOf = (app) => userOf(app).genesisInviteCode ?? null;

function harnessSanity() {
  resetDisk();
  const app = openAccount("harness-probe@nexgrid.test");
  if (typeof acctOf(app) !== "string") {
    throw new Error("selfcheck-genesis-invite: harness 解包失败(accountKey 不是字符串)—— 断言会空转,拒绝继续。");
  }
  if (heldCodeOf(app) !== null) {
    throw new Error("selfcheck-genesis-invite: harness 异常(新账号一开始就持码?)—— 拒绝继续。");
  }
  const r = app.setGenesisInviteCode(UNUSED_A);
  if (r.ok !== true || typeof heldCodeOf(app) !== "string" || heldCodeOf(app) !== UNUSED_A) {
    throw new Error(`selfcheck-genesis-invite: harness 解包失败(核销成功后读不到 user.genesisInviteCode`
      + `,读到 ${JSON.stringify(heldCodeOf(app))})—— 「凭证仍为 null」这类断言会恒真,拒绝继续。`);
  }
  resetDisk();
}

harnessSanity();

// ── ⑥ 🔴 格式正确但从未发放的码必须被拒(原缺陷本体) ──────────────────────────
{
  resetDisk();
  const app = openAccount("gate6@nexgrid.test");
  const r = app.setGenesisInviteCode(NEVER_ISSUED);
  check("⑥ 🔴 格式合法但从未发放的码 → 拒绝(旧实现这里会通过 —— 缺陷本体)",
    r.ok === false && r.reason === "invalid", JSON.stringify(r));
  check("⑥ 被拒后账号没有拿到任何凭证(user.genesisInviteCode 仍为 null)",
    heldCodeOf(app) === null, String(heldCodeOf(app)));
  check("⑥ 被拒后码表里也没有凭空多出这个码",
    rowOf(NEVER_ISSUED) === null);
  const bad = app.setGenesisInviteCode("nexgrid-og-!!!!");
  check("⑥ 格式本身就不对的串同样按「无效」拒(格式仍是兜底,不是唯一判据)",
    bad.ok === false && bad.reason === "invalid");
  samples.targets += 2;
}

// ── ① 🔴 同一个码第二次核销必拒(一码一用) ────────────────────────────────────
{
  resetDisk();
  const first = openAccount("one@nexgrid.test");
  const ok = first.setGenesisInviteCode(UNUSED_A);
  check("① 未使用的码首次核销成功", ok.ok === true && ok.code === UNUSED_A, JSON.stringify(ok));
  check("① 成功后码转 used,并记下核销账号与时刻",
    rowOf(UNUSED_A)?.status === "used"
    && rowOf(UNUSED_A)?.redeemedBy === "one@nexgrid.test"
    && typeof rowOf(UNUSED_A)?.redeemedAt === "number", JSON.stringify(rowOf(UNUSED_A)));

  const second = openAccount("two@nexgrid.test");
  const again = second.setGenesisInviteCode(UNUSED_A);
  check("① 🔴 换个账号提交同一个码 → 拒绝(归因 used)",
    again.ok === false && again.reason === "used", JSON.stringify(again));
  check("① 🔴 第二个账号没有拿到凭证,码的归属也没被改写",
    heldCodeOf(second) === null
    && rowOf(UNUSED_A).redeemedBy === "one@nexgrid.test");
  const sameAccountAgain = first.setGenesisInviteCode(UNUSED_A);
  check("① 同一个账号再提交同一个码也拒(此时归因是「本账号已持码」,不是静默成功)",
    sameAccountAgain.ok === false && sameAccountAgain.reason === "already-held");
  samples.targets += 2;
}

// ── ② 🔴 本账号已持码 → 再提另一个码必拒,且两个码都不受影响 ────────────────────
{
  resetDisk();
  const app = openAccount("holder@nexgrid.test");
  app.setGenesisInviteCode(UNUSED_B);
  const held = heldCodeOf(app);
  const r = app.setGenesisInviteCode(UNUSED_C);
  check("② 🔴 已持码账号再提另一个码 → 拒绝(归因 already-held)",
    r.ok === false && r.reason === "already-held", JSON.stringify(r));
  check("② 🔴 已持有的码不受影响:user 侧凭证没被新码覆盖",
    heldCodeOf(app) === held && held === UNUSED_B, String(heldCodeOf(app)));
  check("② 🔴 已持有的码也没被释放(码表里仍是 used + 归本账号)",
    rowOf(UNUSED_B)?.status === "used" && rowOf(UNUSED_B)?.redeemedBy === "holder@nexgrid.test");
  check("② 🔴 新提交的那个码没被吞掉,仍是未使用(拒绝发生在占码之前)",
    rowOf(UNUSED_C) === null || rowOf(UNUSED_C).status === "unused", JSON.stringify(rowOf(UNUSED_C)));
  const other = openAccount("other@nexgrid.test");
  check("② 被拒的那个码对别的账号仍然可用(证明它真的没被消耗)",
    other.setGenesisInviteCode(UNUSED_C).ok === true);
  samples.targets += 1;
}

// ── ③ 🔴 码不存在 / 已作废 各自拒绝,且文案不同 ────────────────────────────────
{
  resetDisk();
  const app = openAccount("reasons@nexgrid.test");
  const missing = app.setGenesisInviteCode(NEVER_ISSUED);
  const voided = app.setGenesisInviteCode(SEED_VOID);
  const used = app.setGenesisInviteCode(SEED_USED);
  check("③ 码不存在 → invalid", missing.ok === false && missing.reason === "invalid");
  check("③ 🔴 已作废 → void(与「不存在」分开归因)", voided.ok === false && voided.reason === "void");
  check("③ 🔴 已被使用 → used(与「已作废」分开归因)", used.ok === false && used.reason === "used");
  check("③ 三种拒绝归因两两不同(合并成一种 = 用户不知道该找谁)",
    new Set([missing.reason, voided.reason, used.reason]).size === 3);
  check("③ 🔴 拒绝结果里不含核销者身份(不泄露谁用掉了这个码)",
    !JSON.stringify(used).includes("og-holder-0142"), JSON.stringify(used));
  check("③ 🔴 三次被拒后账号仍然没有凭证,且码表一次都没被写过(拒绝路径零落盘)",
    heldCodeOf(app) === null && disk.has(GENESIS_INVITE_REGISTRY_KEY) === false,
    `held=${heldCodeOf(app)} wrote=${disk.has(GENESIS_INVITE_REGISTRY_KEY)}`);
  check("③ 复提同两个码,归因逐字不变(状态确实没被前几次尝试改动)",
    app.setGenesisInviteCode(SEED_VOID).reason === "void"
    && app.setGenesisInviteCode(SEED_USED).reason === "used");
  samples.targets += 3;
}

// ── ④ 🔴 并发同码只成功一个 ──────────────────────────────────────────────────
{
  resetDisk();
  const a = openAccount("race-a@nexgrid.test");
  const b = openAccount("race-b@nexgrid.test");
  const ra = a.setGenesisInviteCode(UNUSED_A);
  const rb = b.setGenesisInviteCode(UNUSED_A);
  const wins = [ra, rb].filter((r) => r.ok).length;
  check("④ 🔴 两个账号提交同一个码,恰好一个成功", wins === 1, `${JSON.stringify(ra)} / ${JSON.stringify(rb)}`);
  check("④ 🔴 失败的那个按「已被使用」拒,不是静默成功",
    [ra, rb].filter((r) => !r.ok).every((r) => r.reason === "used"));
  check("④ 🔴 码表上这个码只有一个终态、只归一个账号",
    registry().filter((r) => r.code === UNUSED_A).length === 1
    && rowOf(UNUSED_A).status === "used"
    && ["race-a@nexgrid.test", "race-b@nexgrid.test"].includes(rowOf(UNUSED_A).redeemedBy));
  check("④ 🔴 只有一个账号拿到 user 侧凭证(另一个仍为 null)",
    [a, b].filter((app) => heldCodeOf(app) !== null).length === 1,
    `${heldCodeOf(a)} / ${heldCodeOf(b)}`);
  check("④ 资格门只对赢的那个开(输的那个 hasInvite 判定为 false)",
    [a, b].filter((app) => redeemedInviteCodeOf(acctOf(app)) !== null).length === 1);
  samples.targets += 1;
}

// ── ⑤ 🔴 已核销的码在用户侧没有任何作废/释放路径 ──────────────────────────────
{
  resetDisk();
  const app = openAccount("terminal@nexgrid.test");
  app.setGenesisInviteCode(UNUSED_A);
  const before = JSON.stringify(rowOf(UNUSED_A));
  // 用户侧唯一的写入口就是 claim;它只接受 unused,used 一律原样返回拒绝。
  const retry = claimGenesisInviteCode(UNUSED_A, "someone-else@nexgrid.test");
  check("⑤ 🔴 claim 对 used 的码只会拒绝,不返回可回滚句柄",
    retry.ok === false && retry.reason === "used" && !("rollback" in retry));
  check("⑤ 🔴 尝试之后那一行逐字节没变(used 是终态)",
    JSON.stringify(rowOf(UNUSED_A)) === before);
  const registrySrc = strip(registryRaw);
  check("⑤ 🔴 码表模块没有导出任何作废/释放 API(作废只属于运营后台)",
    !/export\s+(function|const)\s+\w*(void|revoke|release|unredeem|reset)\w*/i.test(registrySrc),
    (registrySrc.match(/export\s+(function|const)\s+\w+/g) || []).join(","));
  const claimBlock = grabBlock(registrySrc, "export function claimGenesisInviteCode");
  check("⑤ 🔴 状态只往 used 写,没有任何把 used 写回别的状态的分支(rollback 只翻自己刚占的那一行)",
    (claimBlock.match(/status:\s*"used"/g) || []).length === 1
    && /row\.redeemedBy === account && row\.redeemedAt === claimedAt/.test(claimBlock));
  samples.targets += 1;
}

// ── ⑦ 接线门:资格门按「本账号真持有一个已核销的码」判定,不是看格式 ────────────
{
  resetDisk();
  const app = openAccount("gate@nexgrid.test");
  check("⑦ 未核销时 hasInvite=false", redeemedInviteCodeOf("gate@nexgrid.test") === null);
  app.setGenesisInviteCode(UNUSED_A);
  check("⑦ 核销后 hasInvite=true,且指得出是哪个码",
    redeemedInviteCodeOf("gate@nexgrid.test") === UNUSED_A, String(redeemedInviteCodeOf("gate@nexgrid.test")));
  check("⑦ 🔴 别人核销的码不算本账号持有(跨账号旁路封死)",
    redeemedInviteCodeOf("someone-else@nexgrid.test") === null);

  // 🔴 存量账号迁移:旧实现(只校验格式)写下的、码表里根本没有的串不算「已核销过」——
  // 否则这批人既不算持码(资格门不认)、又不许再核销(已持码),被卡死在死角。
  const legacy = openAccount("legacy@nexgrid.test");
  userOf(legacy).genesisInviteCode = NEVER_ISSUED;
  check("⑦ 🔴 存量账号里的历史遗留串不算持码(资格门不认)",
    redeemedInviteCodeOf("legacy@nexgrid.test") === null);
  const migrated = legacy.setGenesisInviteCode(UNUSED_B);
  check("⑦ 🔴 遗留串不挡真码核销(不许把存量用户卡死在「既不算又不许」)",
    migrated.ok === true && redeemedInviteCodeOf("legacy@nexgrid.test") === UNUSED_B, JSON.stringify(migrated));

  const gate = strip(gateRaw);
  check("⑦ 接线:资格门真的调 redeemedInviteCodeOf,且不再用「字段非空」当判据",
    /hasInvite:\s*redeemedInviteCodeOf\(/.test(gate)
    && !/hasInvite:[^\n]*!=\s*null/.test(gate), gate.match(/hasInvite:[^\n]*/g)?.join(" | "));
  const appBody = grabBlock(strip(appRaw), "function setGenesisInviteCode");
  check("⑦ 接线:核销 action 真的走码表(claimGenesisInviteCode),不再只跑正则",
    appBody.includes("claimGenesisInviteCode(") && !appBody.includes("GENESIS_INVITE_PATTERN"));
  check("⑦ 接线:「本账号已持码」的判定排在占码之前(否则新码会被白白消耗)",
    appBody.indexOf("already-held") < appBody.indexOf("claimGenesisInviteCode("));
  check("⑦ 🔴 接线:「已持码」问的是码表单源,不是可能陈旧的 user.value",
    /redeemedInviteCodeOf\(accountKey\.value\) !== null/.test(appBody)
    && !/user\.value\.genesisInviteCode[^\n]*already-held/.test(appBody));
  samples.targets += 2;
}

// ── ⑩ 🔴 陈旧标签页:同一个账号不许在两个标签页各占一个码 ──────────────────────
{
  resetDisk();
  const tabA = openAccount("stale@nexgrid.test");
  const tabB = openAccount("stale@nexgrid.test"); // 同一账号的第二个标签页,各自内存副本
  check("⑩ 前置:两个标签页一开始都认为自己没持码", heldCodeOf(tabA) === null && heldCodeOf(tabB) === null);
  const first = tabA.setGenesisInviteCode(UNUSED_A);
  check("⑩ A 标签页正常核销成功(先手不受影响)", first.ok === true);
  // B 的 user.value 还是陈旧的「没持码」—— 照它放行就会让同一个账号占掉第二个码。
  const second = tabB.setGenesisInviteCode(UNUSED_B);
  check("⑩ 🔴 B 标签页拿着陈旧内存态再核销另一个码 → 拒(归因 already-held)",
    second.ok === false && second.reason === "already-held", JSON.stringify(second));
  check("⑩ 🔴 该账号在码表上仍然只有一个码",
    registry().filter((r) => r.status === "used" && r.redeemedBy === "stale@nexgrid.test").length === 1,
    JSON.stringify(registry().filter((r) => r.status === "used")));
  check("⑩ 🔴 B 想占的那个码没被消耗,别人还能用",
    rowOf(UNUSED_B) === null || rowOf(UNUSED_B).status === "unused");
  samples.targets += 1;
}

// ── ⑧ 落盘失败:码退回未使用 + 账号不留半截状态 ────────────────────────────────
{
  resetDisk();
  const app = openAccount("wfail@nexgrid.test");
  // 只让账号快照那张表写不进去 —— 码占住了、凭证没落到账号上,正是「码被吞掉」的现场。
  failWrites = (key) => key !== GENESIS_INVITE_REGISTRY_KEY;
  const r = app.setGenesisInviteCode(UNUSED_B);
  failWrites = null;
  if (rowOf(UNUSED_B) === null) {
    throw new Error("selfcheck-genesis-invite: ⑧ 注入未生效(码表根本没被写过)—— 靶子没立起来,拒绝继续。");
  }
  check("⑧ 🔴 账号快照落盘失败 → 整笔报失败(不是「返回成功但凭证没落地」)",
    r.ok === false && r.reason === "failed", JSON.stringify(r));
  check("⑧ 🔴 码退回未使用(不能把用户的限量凭证吞掉)",
    rowOf(UNUSED_B).status === "unused" && rowOf(UNUSED_B).redeemedBy === null, JSON.stringify(rowOf(UNUSED_B)));
  check("⑧ 🔴 账号侧也没留下半截凭证", heldCodeOf(app) === null);
  const retry = app.setGenesisInviteCode(UNUSED_B);
  check("⑧ 反向:恢复落盘后同一个码仍能正常核销(证明拒单来自落盘失败,不是码坏了)",
    retry.ok === true && rowOf(UNUSED_B).status === "used");
  samples.targets += 1;
}

// ── ⑨ i18n:四种拒绝 + 失败态,三语真解析取值、非空、互不相同 ────────────────────
{
  const KEYS = ["inviteInvalid", "inviteUsed", "inviteVoided", "inviteAlreadyHeld", "inviteFailed"];
  samples.locales = LANGS.length;
  samples.rejectKeys = KEYS.length;
  const bad = [];
  for (const l of LANGS) {
    for (const k of KEYS) {
      const v = LOCALES[l]?.genesisEligibility?.[k];
      if (!nonEmpty(v)) bad.push(`${l}.genesisEligibility.${k}=${JSON.stringify(v)}`);
    }
  }
  check(`⑨ ${KEYS.length} key × ${LANGS.length} 语真解析取值且非空(取值不是找 key 名 —— 注释骗不过)`,
    bad.length === 0, bad.join(","));
  check("⑨ 🔴 同一语言内五条文案互不相同(合并成一条 = 用户分不清是哪种失败)",
    LANGS.every((l) => new Set(KEYS.map((k) => LOCALES[l].genesisEligibility[k])).size === KEYS.length),
    LANGS.map((l) => `${l}:${new Set(KEYS.map((k) => LOCALES[l].genesisEligibility[k])).size}`).join(" "));
  check("⑨ 三语互不相同(整份复制粘贴 = 有值但没翻译)",
    KEYS.every((k) => new Set(LANGS.map((l) => LOCALES[l].genesisEligibility[k])).size === LANGS.length),
    LANGS.map((l) => LOCALES[l].genesisEligibility.inviteUsed).join(" | "));
  check("⑨ 🔴 拒绝文案里不出现核销者身份字样",
    LANGS.every((l) => KEYS.every((k) => !/@|holder-\d/.test(LOCALES[l].genesisEligibility[k]))));

  // 接线:页面真的按归因分文案,而不是四种失败都渲染同一句 inviteInvalid。
  const sheet = strip(sheetRaw);
  check("⑨ 接线:核销面板按归因分支渲染五种文案(不是一句 inviteInvalid 兜底)",
    KEYS.every((k) => sheet.includes(`el.${k}`)),
    KEYS.filter((k) => !sheet.includes(`el.${k}`)).join(","));
  check("⑨ 接线:面板接住了拒绝归因(result.reason),不是只看布尔",
    /result\.reason/.test(sheet) && /inviteReject\.value = result\.reason/.test(sheet));
}

console.log(`\n${pass} pass / ${fail} fail(样本:${samples.accounts} 个 app store 实例=${samples.accounts} 个账号共享 1 份序列化 storage`
  + ` · ${samples.targets} 组固定靶(⑥缺陷本体 / ①一码一用 / ②本账号限一次 / ③三种归因 / ④并发 / ⑤终态 / ⑦接线 / ⑧落盘失败回滚)`
  + ` · ${samples.rejectKeys} 个拒绝文案 key × ${samples.locales} 语真解析取值 · 落盘故障注入未生效直接抛错)`);
process.exit(fail ? 1 : 0);
