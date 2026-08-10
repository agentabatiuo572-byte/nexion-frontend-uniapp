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
const storeDir = path.join(SRC, "store");
const targets = [];
for (const f of readdirSync(storeDir).filter((n) => n.endsWith(".ts"))) {
  const src = readFileSync(path.join(storeDir, f), "utf8");
  if (!/from "@\/api\/runtime"/.test(src)) continue;
  for (const m of src.matchAll(/void (\w+)\(\)/g)) {
    const fn = m[1];
    const bodyAt = src.indexOf(`async function ${fn}(`);
    if (bodyAt < 0) continue;
    if (!/Api\b/.test(src.slice(bodyAt, bodyAt + 2000))) continue;
    targets.push({ file: `src/store/${f}`, fn });
  }
}
const uniq = [...new Map(targets.map((t) => [`${t.file}#${t.fn}`, t])).values()];
check(`覆盖清单非空(磁盘扫出 ${uniq.length} 个 void 触发的远端刷新缝)`, uniq.length >= 3,
  `找到 ${uniq.length} 个 —— 少于 3 说明扫描判据失效`);

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
    .map((n) => special[n] ?? `export const ${n} = new Proxy({}, { get: () => () => Promise.reject(new Error("AUTHORITY_UNREACHABLE")) });`)
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
    define: { "import.meta.env.PROD": "false", "import.meta.env.DEV": "true", "import.meta.env.MODE": '"test"' },
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
let exercised = 0;
for (const t of uniq) {
  const modName = t.file.replace(/^src\//, "@/").replace(/\.ts$/, "");
  try {
    const mod = await loadEntry(`export * from "${modName}";`);
    // 直调导出的刷新函数(若导出);否则触发 use store + bindAccount(常见 void 调用点)。
    if (typeof mod[t.fn] === "function") {
      await mod[t.fn]();
    } else {
      const useName = Object.keys(mod).find((k) => k.startsWith("use"));
      if (!useName) { check(`${t.file}#${t.fn} 可触发`, false, "store 无 use* 导出,触发不到"); continue; }
      const store = mod[useName]();
      if (typeof store.bindAccount === "function") store.bindAccount("resilience-probe@nexgrid.test");
      else if (typeof store[t.fn] === "function") await store[t.fn]();
      else { check(`${t.file}#${t.fn} 可触发`, false, "既不导出也无 bindAccount 入口"); continue; }
    }
    exercised++;
  } catch (err) {
    check(`${t.file}#${t.fn} await 后 resolve(权威不可达不许 reject 冒泡)`, false, String(err?.message ?? err).slice(0, 160));
  }
}
// microtask 清空,让 fire-and-forget 的 rejection 有机会冒出来
await new Promise((r) => setTimeout(r, 50));

check(`全部刷新缝已触发(${exercised}/${uniq.length})`, exercised === uniq.length, `只触发到 ${exercised}`);
check(`unhandledRejection = 0(实测 ${rejections.length})`, rejections.length === 0,
  rejections.slice(0, 3).join(" | "));

console.log(`\n${pass} pass / ${fail} fail(样本:${uniq.length} 个刷新缝 · remote 开 + API 全抛靶态 · rejection 计数 ${rejections.length})`);
process.exit(fail === 0 ? 0 : 1);
