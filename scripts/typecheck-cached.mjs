#!/usr/bin/env node
// vue-tsc 的指纹缓存壳(包 ar,2026-08-17 提案 §3.2-5)。
//
// 为什么:同一棵树一轮任务里 vue-tsc 被处方跑 ≥5 次(审计 Step0 / 每次修完 / P3 / verify.sh [1] / npm 链首步),
// 每次 35s 全量。类型检查是 f(源码, tsconfig, 编译器版本) 的确定性函数 —— 输入没变结论不变。
//   ① 指纹 = 所有输入文件(src/** + tsconfig* + shims + package.json)的内容哈希 + vue-tsc/typescript 版本;
//   ② 指纹等于上次 PASS 记录 → 直接报 PASS(cached),0 秒;
//   ③ 否则跑 `vue-tsc --noEmit --incremental --tsBuildInfoFile .verify-cache/tsbuildinfo`(实测冷 28s / 热 9s),
//      PASS 才写记录;FAIL 不写(下次照跑)。
// 缓存目录 .verify-cache/ 不入库。`--force` 跳过缓存但仍用 incremental;`--no-incremental` 回到裸 vue-tsc。
// 报法三态:PASS(cached · fp xxxx)/ PASS(ran)/ FAIL —— cached 是同输入的既有裁决,不是「没跑」。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT, CACHE_DIR } from "./lib/verify-scope.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const noIncremental = args.includes("--no-incremental");
const RECORD = path.join(CACHE_DIR, "typecheck.json");
const BUILDINFO = path.join(CACHE_DIR, "tsbuildinfo");

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|vue|js|mjs|cjs|json|d\.ts)$/.test(e.name)) out.push(p);
  }
}
function fingerprint() {
  const files = [];
  walk(path.join(ROOT, "src"), files);
  for (const f of fs.readdirSync(ROOT)) if (/^(tsconfig.*\.json|shims-uni\.d\.ts|package\.json|vite\.config\.ts|uno\.config\.ts)$/.test(f)) files.push(path.join(ROOT, f));
  files.sort();
  const h = crypto.createHash("sha256");
  const ver = (name) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", name, "package.json"), "utf8")).version; } catch { return "?"; } };
  h.update(`vue-tsc=${ver("vue-tsc")};typescript=${ver("typescript")};node=${process.version}\n`);
  for (const f of files) { h.update(path.relative(ROOT, f).replace(/\\/g, "/") + "\0"); h.update(fs.readFileSync(f)); h.update("\0"); }
  return { fp: h.digest("hex"), count: files.length };
}

const t0 = Date.now();
const { fp, count } = fingerprint();
let record = null;
try { record = JSON.parse(fs.readFileSync(RECORD, "utf8")); } catch { /* 无记录 */ }
if (!force && record && record.fp === fp && record.verdict === "pass") {
  console.log(`vue-tsc 0 errors (cached · fp ${fp.slice(0, 8)} · ${count} 输入文件未变 · 上次 ${record.at})`);
  process.exit(0);
}
fs.mkdirSync(CACHE_DIR, { recursive: true });
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const tscArgs = ["vue-tsc", "--noEmit", ...(noIncremental ? [] : ["--incremental", "--tsBuildInfoFile", BUILDINFO])];
const r = spawnSync(npx, tscArgs, { cwd: ROOT, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] });
const out = (r.stdout || "") + (r.stderr || "");
const ms = Date.now() - t0;
if (r.status === 0) {
  fs.writeFileSync(RECORD, JSON.stringify({ fp, verdict: "pass", at: new Date().toISOString(), ms, files: count, incremental: !noIncremental }, null, 1));
  console.log(`vue-tsc 0 errors (ran ${(ms / 1000).toFixed(1)}s${noIncremental ? "" : " · incremental"} · fp ${fp.slice(0, 8)})`);
  process.exit(0);
}
try { fs.rmSync(RECORD, { force: true }); } catch { /* 记录删不掉也不影响判红 */ }
process.stdout.write(out);
console.log(`vue-tsc FAIL (${(ms / 1000).toFixed(1)}s · exit ${r.status})`);
process.exit(r.status || 1);
