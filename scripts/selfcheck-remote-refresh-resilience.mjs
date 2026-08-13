#!/usr/bin/env node
// 远端刷新缝的「权威不可达」韧性门 — node 直跑:
//   node scripts/selfcheck-remote-refresh-resilience.mjs
//
// 背景(2026-08-10 z1 判决包 B1):c37e642 给 ~10 个 store 接了远端刷新缝,其中
// v-rank / commission / genesis 三处裸 await —— 后端不可达时每次启动稳定抛
// unhandled rejection,把 6 条「console error = 0」运行时门全部打红。
//
// 🔴 守的不变量:**任何远端刷新缝在 API 抛错时必须自吞并落到降级态**,
//   不许把 rejection 冒泡到顶层(unavailable authority 是常态输入,不是异常)。
//
// 方法:esbuild 载真 store,@/api/runtime 换成「调用即抛」的 stub 但 remoteApiEnabled=true,
// 然后逐个 await 刷新函数 —— 必须 resolve;进程级 unhandledRejection 必须为 0。
// 覆盖清单从磁盘扫(所有 store 里 `void <fn>()` 触发的 async 刷新函数),不手抄。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";
import { VUE_STUB_NXREF } from "./lib/harness-stubs.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

console.log("selfcheck-remote-refresh-resilience — 权威不可达时刷新缝必须自吞降级");

// ── 覆盖清单:磁盘真相,不手抄 ────────────────────────────────────────────────
// 判据:src/store/*.ts 里被 `void xxx()` 触发、且函数体引用了 `@/api/runtime` 某 Api 的
// async 函数。0 个候选 = 判据失效,必红。
// 🔴 扫描面与写法覆盖(z1 R2 对抗审计):v1 只认 `src/store/*.ts` 里的**无参裸函数名**
//    `void fn()`,实测漏三族真实缝 —— 带参 `void joinRemote(id)`、成员调用
//    `void x.refreshRemote()`、箭头函数 `const refreshRemote = async () => {}`
//    (后者还会因 `indexOf("async function fn(")` 找不到而**静默 continue**)。
//    这里三族全收,扫描面扩到 store + composables + lib;基数写成台账(见文件尾),
//    不用 `>= 3` 下限 —— 从 13 退化到 3 也判绿的下限等于没守删除向。
const SCAN_DIRS = ["store", "composables", "lib"];
const targets = [];
for (const dir of SCAN_DIRS) {
  const abs = path.join(SRC, dir);
  let entries = [];
  try { entries = readdirSync(abs).filter((n) => n.endsWith(".ts")); } catch { continue; }
  for (const f of entries) {
    const rel = `src/${dir}/${f}`;
    const src = readFileSync(path.join(abs, f), "utf8");
    if (!/from "@\/api\/runtime"/.test(src)) continue;
    // 三族写法:void fn(…) / void obj.fn(…) / void fn(…).catch(…)。
    // 🔴 只吃到**第一个左括号**为止:早期版本允许跨过 `()` 再取一段,于是
    //    `void refreshRemote().catch(...)` 被读成 `.catch`,payout-address 那条缝整条漏掉。
    for (const m of src.matchAll(/void\s+([\w$.]+)\s*\(/g)) {
      const fn = m[1].split(".").pop();
      if (!fn || fn === "0") continue;
      // 函数体定位:async function fn( / const fn = async ( / fn: async (
      const declRe = new RegExp(`(?:async function ${fn}\\s*\\(|(?:const|let)\\s+${fn}\\s*=\\s*async\\s*\\(|\\b${fn}\\s*:\\s*async\\s*\\()`);
      const declHit = declRe.exec(src);
      if (!declHit) continue; // 跨模块调用(如 useContentCopy().x())本文件定位不到,不算本文件的缝
      if (!/Api\b/.test(src.slice(declHit.index, declHit.index + 2000))) continue;
      targets.push({ file: rel, fn });
    }
  }
}
const uniq = [...new Map(targets.map((t) => [`${t.file}#${t.fn}`, t])).values()];

// ── harness:remote 开、API 全抛 ─────────────────────────────────────────────
const disk = new Map();
globalThis.uni = {
  getStorageSync(k) { const r = disk.get(k); return r === undefined ? "" : JSON.parse(r); },
  setStorageSync(k, v) { disk.set(k, JSON.stringify(v)); },
  removeStorageSync(k) { disk.delete(k); },
  getSystemInfoSync() { return { language: "en" }; },
};

// runtime-stub 手写成「remote 开 + 全 API 抛」:这是本门的靶态,与共享 runtimeStub
// (mock 关)语义相反,不能复用。导出清单仍从磁盘扫,防新 API 掉队。
function throwingRuntimeStub() {
  const src = readFileSync(path.join(root, "src", "api", "runtime.ts"), "utf8");
  const names = [...src.matchAll(/^export (?:const|let|function|async function) (\w+)/gm)].map((m) => m[1]);
  if (!names.includes("remoteApiEnabled")) throw new Error("runtime.ts 形状变了 —— 判据失效必红");
  const special = {
    remoteApiEnabled: "export const remoteApiEnabled = true;",
    apiRuntimeConfig: 'export const apiRuntimeConfig = { mode: "remote", baseUrl: "http://unreachable.invalid" };',
  };
  const body = names
    // 🔴 每次 API 调用记一笔:这是「这条缝真的跑了」的唯一硬凭据(z1 R2 对抗审计:
    //    原来只要 bindAccount 存在就 exercised++,缝被挪到别的入口一样报「全部触发」)。
    .map((n) => special[n] ?? `export const ${n} = new Proxy({}, { get: () => (...a) => { globalThis.__z1ApiCalls++; return Promise.reject(new Error("AUTHORITY_UNREACHABLE")); } });`)
    .join("\n");
  return body;
}

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
  "vue-stub": VUE_STUB_NXREF,
  "runtime-stub": throwingRuntimeStub(),
};

const rejections = [];
process.on("unhandledRejection", (err) => { rejections.push(String(err?.message ?? err)); });

async function loadEntry(contents) {
  const out = await build({
    stdin: { contents, resolveDir: root, loader: "ts" },
    bundle: true, write: false, format: "esm", platform: "neutral",
    // 🔴 z6:runtime-config.ts 在**模块加载期**读 import.meta.env.VITE_*(free-trial 的模块图
    //    把它拉进来,实测载入即 TypeError)—— 那是 harness 缺陷不是缝缺陷:真栈里 Vite 会
    //    define 全部 env 键。三个已知键给靶态值;再兜一个 "import.meta.env": "{}"
    //    (esbuild 最长匹配优先),未来新增的 env 键读到 undefined 而不是崩。
    define: {
      "import.meta.env.PROD": "false", "import.meta.env.DEV": "true", "import.meta.env.MODE": '"test"',
      "import.meta.env.VITE_NEXGRID_API_MODE": '"remote"',
      "import.meta.env.VITE_NEXGRID_API_BASE_URL": '"http://unreachable.invalid"',
      "import.meta.env.VITE_NEXGRID_API_DEV_BASE_URL": '""',
      "import.meta.env": "{}",
    },
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
        b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
        b.onResolve({ filter: /^@\/api\/runtime$/ }, () => ({ path: "runtime-stub", namespace: "stub" }));
        b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "selfcheck-remote-refresh-resilience"));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
      },
    }],
  });
  const dataUrl = "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64");
  return import(dataUrl);
}

// 每个刷新缝:载它所在 store,取出同名导出或经 store 实例调用。刷新函数多为 store 内部
// 函数,不一定导出 —— 统一经 bindAccount / 直调导出两条路径触发,再看 rejection 计数。
// 🔴 触发登记表(z1 R2 对抗审计 P1-23):有些缝天然从门外触发不到(要业务参数,
//    如 joinRemote(eventId))。这类必须**显式登记原因**,不许混在「已触发」里充数;
//    未登记又没真打 API 的,一律红。判据 = 每条缝的 API 调用计数真的涨了。
// 目前全部 16 条都能从门外触发到(直调导出或经 bindAccount),故为空。
// 将来确有触发不到的缝,在此登记 `"file#fn": "为什么门外触发不到"`;
// 登记了却其实能触发的(陈旧登记)由下面的 stale 断言顶回来 —— 登记表本身也要被守。
const UNREACHABLE = {};
globalThis.__z1ApiCalls = 0;
let exercised = 0;
const notExercised = [];
for (const t of uniq) {
  const key = `${t.file}#${t.fn}`;
  const modName = t.file.replace(/^src\//, "@/").replace(/\.ts$/, "");
  const before = globalThis.__z1ApiCalls;
  try {
    const mod = await loadEntry(`export * from "${modName}";`);
    // 直调导出的刷新函数(若导出);否则触发 use store + bindAccount(常见 void 调用点)。
    if (typeof mod[t.fn] === "function") {
      await mod[t.fn]();
    } else {
      const useName = Object.keys(mod).find((k) => k.startsWith("use"));
      const store = useName ? mod[useName]() : null;
      if (store && typeof store[t.fn] === "function") await store[t.fn]();
      else if (store && typeof store.bindAccount === "function") store.bindAccount("resilience-probe@nexgrid.test");
    }
  } catch (err) {
    check(`${key} await 后 resolve(权威不可达不许 reject 冒泡)`, false, String(err?.message ?? err).slice(0, 160));
    continue;
  }
  // 让 fire-and-forget 的调用有机会发出去
  await new Promise((r) => setTimeout(r, 5));
  if (globalThis.__z1ApiCalls > before) exercised++;
  else notExercised.push(key);
}
const unregistered = notExercised.filter((k) => !UNREACHABLE[k]);
check(`🔴 未触发的缝必须登记原因(未登记 ${unregistered.length} 条)`, unregistered.length === 0,
  unregistered.join(", "));
const staleReg = Object.keys(UNREACHABLE).filter((k) => !notExercised.includes(k));
check(`🔴 登记表无陈旧项(登记为不可达、实际却触发到的:${staleReg.length} 条)`, staleReg.length === 0,
  staleReg.join(", "));
check(`🔴 已触发的缝有真凭据(API 调用计数上涨):${exercised} 条;登记为门外不可达 ${notExercised.length} 条`,
  exercised + notExercised.length === uniq.length);
// 🔴 基数台账(z1 R2 对抗审计 P1-25):`>= N` 下限守不住删除向 —— 从 16 退化到 3 也判绿。
// 缝数变化必须有人来改这个数,顺带逼他确认新增/删除的那条缝该不该有门。
// 2026-08-13 z6:16 → 27。新增 11 条系 z1 R2 扫描面三族扩收(带参 void / 成员调用 /
// 箭头函数)后进来的**既有缝**;27 条逐一回源确认(app×2 / bills / cards / commission /
// conversations / daily-powerup / deposits / earn-config / event-quest×3 / free-trial /
// genesis / nex-faucet / notifications / payout-address / quest / referral-reward /
// repurchase / risk-disclosure / staking / tickets / v-rank / voucher×2 / weekly-quest),
// 全部是「remote 开 + void 触发」的远端读缝,不变量适用全体,无一例外。
// ⚠️ 已知扫描盲区:**.vue 文件里的 void 裸发**不在扫描面(声明与调用跨文件,本门的
// 同文件定位逻辑天然测不到)。z6 实锤 1 例:orders#refreshRemote 被 checkout 裸 void
// (已在调用点补 .catch;orders 契约保持 reject,因其 await 消费方靠 reject 中断验证链)。
const EXPECTED_SEAMS = 27;
check(`🔴 刷新缝基数台账:${uniq.length} == ${EXPECTED_SEAMS}(增删缝须同步改此数)`,
  uniq.length === EXPECTED_SEAMS, `实扫 ${uniq.length} 条:${uniq.map((t) => `${t.file}#${t.fn}`).join(", ")}`);
// microtask 清空,让 fire-and-forget 的 rejection 有机会冒出来
await new Promise((r) => setTimeout(r, 50));

// (原「全部刷新缝已触发」断言由上面三条取代:真凭据 + 登记表 + 基数台账)
check(`unhandledRejection = 0(实测 ${rejections.length})`, rejections.length === 0,
  rejections.slice(0, 3).join(" | "));

console.log(`\n${pass} pass / ${fail} fail(样本:${uniq.length} 个刷新缝 · remote 开 + API 全抛靶态 · rejection 计数 ${rejections.length})`);
process.exit(fail === 0 ? 0 : 1);
