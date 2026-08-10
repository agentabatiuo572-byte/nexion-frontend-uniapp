#!/usr/bin/env node
// 创世邀请码「服务端核销」行为门 — node 直跑,不起浏览器:
//   node scripts/selfcheck-genesis-invite.mjs
//
// ══ z1 判决 A(2026-08-10):核销让渡服务端 ══════════════════════════════════════
// c37e642 删除了本地码表(registry / SEED / claim / rollback,-157 行):
// src/store/genesis-invite.ts 现在只有 `redeemGenesisInviteCode(raw)` —— 格式预检
// (GENESIS_INVITE_PATTERN,不合法不打 API)+ `genesisApi.redeem` + 错误码→归因映射。
// 一码一用 / 一账号一次是**服务端事务义务**(已记 HANDOFF);旧门的「本地码表 / SEED /
// 跨账号 / 并发占码 / 落盘回滚」固定靶主语灭失,按新架构重写为:
//   ① 5 个服务端错误码逐个映射正确,未知错误码→failed,归因集合恰为五态全集。
//   ② 成功返回 { ok:true, code },code 归一大写、以服务端回包为准(不是回显输入)。
//   ③ 格式非法**不调用** genesisApi(calls=0)且 reason=invalid —— 预检真挡在网络前。
//   ④ 网络层异常(非 ApiError)→ failed(asApiError 兜底路径)。
//   ⑤ 负向结构:GENESIS_INVITE_REGISTRY_KEY 与 SEED 码字面量不得在 src/ 复活。
//   ⑥ genesis-invite.ts 的值导出面 = 恰好 redeemGenesisInviteCode(无 claim/rollback/作废 API)。
//   ⑦ 接线:app.setGenesisInviteCode 真走 redeemGenesisInviteCode,成功仅写展示缓存。
//   ⑧ 五种归因文案三语真解析取值、非空、互不相同,面板按 result.reason 分支渲染。
// 客户端仅存「错误码映射 + 格式预检」两样,本门守的就是这两样。
//
// 方法:行为断言 esbuild 载**真模块**(genesisApi 换成可编程 stub:能按计划回包 / 抛
// ApiError / 抛裸 Error,并记每次调用);结构断言跑在剥注释后的正主源码上。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";
import { VUE_STUB_PLAIN, runtimeStub } from "./lib/harness-stubs.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");

const samples = { mappings: 0, formatProbes: 0, scanned: 0, locales: 0, rejectKeys: 0 };
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

// 依赖图里有 store 模块(genesis.ts 及其存储层),node 里没有 uni —— 给最小 stub。
globalThis.uni = {
  getStorageSync: () => "",
  setStorageSync: () => {},
  removeStorageSync: () => {},
  getSystemInfoSync: () => ({}),
};

// ── 可编程 genesisApi:计划(__giPlan)决定回包/抛错;__giCalls 记每次实参 ──────────
// 🔴 stub 基座取共享单源 runtimeStub(导出面从 src/api/runtime.ts 磁盘扫出,新 API 不掉队),
// 只把 genesisApi 一行换成可编程实现;换不上(runtime 导出面变了)必须炸,禁静默降级。
globalThis.__giCalls = [];
globalThis.__giPlan = null;
const GENESIS_API_LINE = "export const genesisApi = unavailable;";
const runtimeBase = runtimeStub(root);
if (!runtimeBase.includes(GENESIS_API_LINE)) {
  throw new Error("selfcheck-genesis-invite: runtimeStub 里找不到 genesisApi 导出行 —— stub 基座变了,拒绝静默降级");
}
const RUNTIME_PROGRAMMABLE = 'import { ApiError } from "@/api/errors";\n' + runtimeBase.replace(
  GENESIS_API_LINE,
  `export const genesisApi = {
  redeem: async (code) => {
    globalThis.__giCalls.push(code);
    const plan = globalThis.__giPlan;
    if (plan && plan.apiErrorMessage) throw new ApiError({ kind: "business", message: plan.apiErrorMessage });
    if (plan && plan.plainError) throw new Error(plan.plainError);
    return { code: plan && plan.code ? plan.code : code };
  },
};`,
);

const STUBS = {
  "pinia-stub": `export const defineStore = (_id, setup) => setup;`,
  "vue-stub": VUE_STUB_PLAIN,
  "runtime-stub": RUNTIME_PROGRAMMABLE,
};
async function loadModule(absOrStdin, viaStdin = false) {
  const out = await build({
    ...(viaStdin
      ? { stdin: { contents: absOrStdin, resolveDir: root, loader: "ts" } }
      : { entryPoints: [absOrStdin] }),
    bundle: true, write: false, format: "esm",
    define: { "import.meta.env.PROD": "false", "import.meta.env.DEV": "true" },
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
        b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
        b.onResolve({ filter: /^@\/api\/runtime$/ }, () => ({ path: "runtime-stub", namespace: "stub" }));
        b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "selfcheck-genesis-invite"));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
          contents: STUBS[a.path],
          loader: "js",
          resolveDir: root, // stub 里的 `@/api/errors` 也要能解析(ApiError 与被测代码同一 bundle,instanceof 才成立)
        }));
      },
    }],
  });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text, "utf8").toString("base64"));
}

const { redeemGenesisInviteCode, GENESIS_INVITE_PATTERN } = await loadModule(
  `export { redeemGenesisInviteCode } from "@/store/genesis-invite";
export { GENESIS_INVITE_PATTERN } from "@/store/genesis";`,
  true,
);

/** 每个用例前重置计划与调用台账。 */
function plan(p) {
  globalThis.__giPlan = p;
  globalThis.__giCalls = [];
}
const calls = () => globalThis.__giCalls;

const VALID = "NEXGRID-OG-ABCD1234EFGH5678"; // 16 位段,匹配 GENESIS_INVITE_PATTERN

// ── harness sanity:成功回路真的通(不通则所有映射断言都在测 stub,拒绝继续) ──────
{
  plan({});
  const r = await redeemGenesisInviteCode(VALID);
  if (r.ok !== true || calls().length !== 1) {
    throw new Error(`selfcheck-genesis-invite: harness 失效(成功计划得到 ${JSON.stringify(r)},API 调用 ${calls().length} 次)—— 拒绝继续`);
  }
  if (!GENESIS_INVITE_PATTERN.test(VALID)) {
    throw new Error("selfcheck-invite: 固定靶 VALID 不匹配真 GENESIS_INVITE_PATTERN —— 格式判据在空转,拒绝继续");
  }
}

console.log("selfcheck-genesis-invite — 服务端核销:错误码映射 + 格式预检(z1 判决 A)");

// ── ① 🔴 服务端错误码逐个映射 ─────────────────────────────────────────────────
{
  const MAPPING = [
    ["GENESIS_INVITE_ACCOUNT_ALREADY_REDEEMED", "already-held"],
    ["GENESIS_INVITE_NOT_FOUND", "invalid"],
    ["GENESIS_INVITE_CODE_INVALID", "invalid"],
    ["GENESIS_INVITE_STATE_CONFLICT", "used"],
    ["GENESIS_INVITE_VOIDED", "void"],
    ["GENESIS_TOTALLY_NEW_ERRCODE", "failed"], // 未知错误码兜底
  ];
  samples.mappings = MAPPING.length;
  const seen = new Set();
  for (const [code, want] of MAPPING) {
    plan({ apiErrorMessage: code });
    const r = await redeemGenesisInviteCode(VALID);
    seen.add(r.ok === false ? r.reason : "(ok)");
    check(`① 🔴 ${code} → ${want}`, r.ok === false && r.reason === want, JSON.stringify(r));
  }
  check("① 🔴 归因集合恰为五态全集 {invalid, used, void, already-held, failed}(少一态 = 有归因被合并)",
    seen.size === 5 && ["invalid", "used", "void", "already-held", "failed"].every((x) => seen.has(x)),
    [...seen].join(","));
}

// ── ② 🔴 成功:归一大写 + 以服务端回包为准 ─────────────────────────────────────
{
  plan({});
  const r = await redeemGenesisInviteCode(`  ${VALID.toLowerCase()}  `);
  check("② 🔴 小写带空白的输入:成功且 code 归一大写", r.ok === true && r.code === VALID, JSON.stringify(r));
  check("② 🔴 API 收到的就是归一后的码(trim + 大写在预检前完成)",
    calls().length === 1 && calls()[0] === VALID, JSON.stringify(calls()));

  const SERVER_CODE = "NEXGRID-OG-0000111122223333";
  plan({ code: SERVER_CODE });
  const echo = await redeemGenesisInviteCode(VALID);
  check("② 🔴 返回的 code 以服务端回包为准(不是回显本地输入)",
    echo.ok === true && echo.code === SERVER_CODE, JSON.stringify(echo));
}

// ── ③ 🔴 格式预检:非法串不打 API(原缺陷「只跑正则」的镜像面:正则只当预检,不当判据) ──
{
  const BAD = ["bad code", "NEXGRID-OG-123", "nexgrid-og-!!!!!!!!!!!!!!!!", ""];
  samples.formatProbes = BAD.length;
  for (const raw of BAD) {
    if (GENESIS_INVITE_PATTERN.test(raw.trim().toUpperCase())) {
      throw new Error(`selfcheck-genesis-invite: 格式靶 ${JSON.stringify(raw)} 竟匹配真 pattern —— 靶子失效`);
    }
    // 计划设成「若真打到 API 会返回可映射错误」:预检被删时 calls>0 当场暴露,而不是靠 reason 碰巧同值。
    plan({ apiErrorMessage: "GENESIS_INVITE_NOT_FOUND" });
    const r = await redeemGenesisInviteCode(raw);
    check(`③ 🔴 格式非法 ${JSON.stringify(raw)} → invalid 且 0 次 API 调用`,
      r.ok === false && r.reason === "invalid" && calls().length === 0,
      `${JSON.stringify(r)} calls=${calls().length}`);
  }
}

// ── ④ 网络层异常(非 ApiError)→ failed ───────────────────────────────────────
{
  plan({ plainError: "socket hang up" });
  const r = await redeemGenesisInviteCode(VALID);
  check("④ 🔴 裸网络异常经 asApiError 兜底 → failed(不冒充四种业务归因)",
    r.ok === false && r.reason === "failed", JSON.stringify(r));
}

// ── ⑤ 🔴 负向结构:本地码表不得复活 ──────────────────────────────────────────
{
  const files = [];
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|vue)$/.test(name)) files.push(p);
    }
  })(SRC);
  samples.scanned = files.length;
  if (files.length < 100) throw new Error(`selfcheck-genesis-invite: src 扫描面只有 ${files.length} 个文件 —— 扫描器坏了,拒绝把空集当通过`);
  const registryHits = [];
  const seedHits = [];
  for (const f of files) {
    const raw = readFileSync(f, "utf8");
    const rel = path.relative(root, f).replace(/\\/g, "/");
    if (raw.includes("GENESIS_INVITE_REGISTRY_KEY")) registryHits.push(rel);
    // 引号里完整的具体码(≥4 位段)才算 SEED 字面量;i18n 占位文案(NEXGRID-OG-16位邀请码)
    // 段里带非 [A-Z0-9] 字符,不命中。
    for (const m of raw.matchAll(/["'`](NEXGRID-OG-[A-Z0-9]{4,})["'`]/g)) seedHits.push(`${rel}: ${m[1]}`);
  }
  check(`⑤ 🔴 GENESIS_INVITE_REGISTRY_KEY 在 src/ 复活次数 = 0(实扫 ${files.length} 个文件)`,
    registryHits.length === 0, registryHits.join(","));
  check("⑤ 🔴 SEED 码字面量(引号内完整 NEXGRID-OG-XXXX…)在 src/ 复活次数 = 0",
    seedHits.length === 0, seedHits.slice(0, 3).join(" | "));
}

// ── ⑥ 🔴 模块导出面 = 恰好 redeemGenesisInviteCode ────────────────────────────
{
  const invRaw = readFileSync(path.join(SRC, "store", "genesis-invite.ts"), "utf8");
  const inv = strip(invRaw);
  const valueExports = [...inv.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  check("⑥ 🔴 genesis-invite.ts 值导出面恰为 [redeemGenesisInviteCode](多任何一个 = 客户端长回核销以外的能力)",
    valueExports.length === 1 && valueExports[0] === "redeemGenesisInviteCode", valueExports.join(","));
  check("⑥ 🔴 无 claim / rollback / 作废 / 释放 / registry 词干的导出(作废只属于运营后台)",
    !/export\s+(?:async\s+)?(?:function|const)\s+\w*(claim|rollback|revoke|release|void|registry|seed)\w*/i.test(inv));
  check("⑥ 模块自述服务端唯一真理源(头注 Server-only redemption 仍在,防后来者当成待补的半成品)",
    /Server-only redemption/.test(invRaw));
}

// ── ⑦ 接线:app.setGenesisInviteCode 真走服务端核销,成功仅写展示缓存 ─────────────
{
  const appStrip = strip(readFileSync(path.join(SRC, "store", "app.ts"), "utf8"));
  const body = grabBlock(appStrip, "async function setGenesisInviteCode");
  check("⑦ 🔴 action 调 redeemGenesisInviteCode(不再自跑正则/查本地表)",
    body.includes("redeemGenesisInviteCode(") && !body.includes("GENESIS_INVITE_REGISTRY_KEY"));
  check("⑦ 成功路径只写 user.genesisInviteCode 展示缓存(资格与一次性由服务端复核)",
    /user\.value = \{ \.\.\.user\.value, genesisInviteCode: result\.code \}/.test(body), body.replace(/\s+/g, " ").slice(0, 160));
}

// ── ⑧ i18n:五种归因文案三语真解析取值,面板按 reason 分支 ─────────────────────
{
  const LANGS = ["en", "zh", "vi"];
  const KEYS = ["inviteInvalid", "inviteUsed", "inviteVoided", "inviteAlreadyHeld", "inviteFailed"];
  samples.locales = LANGS.length;
  samples.rejectKeys = KEYS.length;
  const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
  const LOCALES = {};
  for (const l of LANGS) {
    const mod = await loadModule(path.join(SRC, "i18n", "messages", `${l}.ts`));
    LOCALES[l] = mod[l] ?? mod.default ?? Object.values(mod)[0];
  }
  const bad = [];
  for (const l of LANGS) {
    for (const k of KEYS) {
      if (!nonEmpty(LOCALES[l]?.genesisEligibility?.[k])) bad.push(`${l}.genesisEligibility.${k}`);
    }
  }
  check(`⑧ ${KEYS.length} key × ${LANGS.length} 语真解析取值且非空(取值不是找 key 名,注释骗不过)`,
    bad.length === 0, bad.join(","));
  check("⑧ 🔴 同一语言内五条文案互不相同(合并 = 用户分不清哪种失败)",
    LANGS.every((l) => new Set(KEYS.map((k) => LOCALES[l].genesisEligibility[k])).size === KEYS.length));
  check("⑧ 三语互不相同(整份复制粘贴 = 有值但没翻译)",
    KEYS.every((k) => new Set(LANGS.map((l) => LOCALES[l].genesisEligibility[k])).size === LANGS.length));

  const sheet = strip(readFileSync(path.join(SRC, "components", "genesis", "eligibility-sheet.vue"), "utf8"));
  check("⑧ 接线:核销面板按归因分支渲染五种文案(不是一句 inviteInvalid 兜底)",
    KEYS.every((k) => sheet.includes(`el.${k}`)), KEYS.filter((k) => !sheet.includes(`el.${k}`)).join(","));
  check("⑧ 接线:面板接住了拒绝归因(inviteReject.value = result.reason)",
    /inviteReject\.value = result\.reason/.test(sheet));
}

console.log(`\n${pass} pass / ${fail} fail(样本:${samples.mappings} 条错误码映射(真模块+可编程 genesisApi)`
  + ` · ${samples.formatProbes} 个格式靶(0 API 调用为判据) · src 全扫 ${samples.scanned} 个文件负向结构`
  + ` · ${samples.rejectKeys} 个归因 key × ${samples.locales} 语真解析取值 · harness 成功回路失效直接抛错)`);
process.exit(fail ? 1 : 0);
