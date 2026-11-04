#!/usr/bin/env node
// `npm run verify` 的执行体:类型检查、静态检查和生产构建,不含测试。
//
//   node scripts/verify-chain.mjs [--static] [--only a,b] [--force-typecheck]
//
//   不 fail-fast:一步红,后面的照跑;收尾把 PASS / FAIL / CACHED / KNOWN-RED / NOT-RUN / SCOPED-SKIP 分开列。
//   --static 跳过生产构建和产物检查,记 SCOPED-SKIP。
// 步骤清单声明在 package.json `verify:steps`(`&&` 串,可直接裸跑作对照)。
// 产物:.verify-cache/last-run.json(mode/tree/steps/verdict)、
//       .verify-chain.code(第 1 行退出码,第 2 行摘要)、.verify-cache/logs/<step>.log。
//       同一时间只允许一条链写这些固定路径；后来者在写入前以 exit 2 退出，避免假绿/假红。
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, CACHE_DIR, LAST_RUN_PATH, treeFingerprint } from "./lib/verify-scope.mjs";
import { acquireVerifyRunLock } from "./lib/verify-run-lock.mjs";
import { loadKnownRed, applyKnownRedToSteps } from "./lib/known-red.mjs";
import { captureCommitCandidate, verifiedCommitCandidate } from "../.githooks/commit-verification.mjs";

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const mode = flag("--static") ? "static" : "full";
const only = (opt("--only") || "").split(",").map((s) => s.trim()).filter(Boolean);
const forceTypecheck = flag("--force-typecheck");
const runLock = acquireVerifyRunLock(ROOT);
if (!runLock.acquired) {
  const owner = runLock.owner;
  console.error(`VERIFY_CHAIN_BUSY: 已有 verify-chain 正在持有互斥锁${owner ? ` (pid=${owner.pid}, startedAt=${owner.startedAt || "?"})` : ""}；为防止覆写 .verify-cache/last-run.json、.verify-chain.code 与 logs，本次未执行。`);
  process.exit(2);
}
// exit 回调是同步的；SIGKILL/断电留下的锁会由下一次基于已死 PID 的恢复逻辑接管。
process.once("exit", () => runLock.release());
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => process.exit(130));
}
const LOG_DIR = path.join(CACHE_DIR, "logs");
fs.mkdirSync(LOG_DIR, { recursive: true });

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[2m", n: "\x1b[0m" };
const say = (m) => console.log(m);

// ── 步骤清单:package.json verify:steps 的 `&&` 串 ─────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const chain = String(pkg.scripts["verify:steps"] || "");
if (!chain) { console.error("package.json 缺 scripts[\"verify:steps\"](`npm run a && npm run b …` 串)"); process.exit(2); }
const STEPS = chain.split("&&").map((s) => s.trim()).map((s) => s.replace(/^npm run\s+/, "")).filter(Boolean);
const bad = STEPS.filter((s) => !pkg.scripts[s]);
if (bad.length) { console.error(`verify:steps 里有 package.json 不认识的脚本:${bad.join(", ")}`); process.exit(2); }
const BUILD_STEPS = new Set(["build:h5:prod", "verify:prod-artifact"]);

const fpStart = treeFingerprint();
const commitStart = captureCommitCandidate(ROOT);
// 🔴 开跑即写 verdict:"running" 占位:半路崩掉时,不许有人拿**上一轮**的 pass 记录放行。
try { fs.writeFileSync(LAST_RUN_PATH, JSON.stringify({ mode, verdict: "running", startedAt: new Date().toISOString(), tree: null, headTree: null, dirty: fpStart?.dirty ?? null, head: fpStart?.head || null, steps: [] }, null, 1)); } catch { /* 写不了占位不影响跑 */ }
say(`${C.c}━━ verify-chain · mode=${mode} · ${STEPS.length} 步 · tree ${fpStart ? fpStart.fingerprint.slice(0, 10) : "?"}${fpStart?.dirty ? "(dirty)" : ""} ━━${C.n}`);

// ── 单步执行 ─────────────────────────────────────────────────────────────────
const npmCli = [process.env.npm_execpath, path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")].find((c) => c && fs.existsSync(c));
function runCommand(cmd, args, logFile) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(cmd, args, { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"], shell: false });
    // 日志边跑边落盘,`tail -f .verify-cache/logs/<step>.log` 能看进度,内存里只留尾巴给摘要用
    const stream = fs.createWriteStream(logFile, { flags: "w" });
    let out = "";
    const onData = (c) => { const t = c.toString(); stream.write(t); out = (out + t).slice(-200_000); };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code) => { stream.end(); resolve({ code, out, ms: Date.now() - t0 }); });
    child.on("error", (e) => { out += String(e); stream.end(String(e)); resolve({ code: 1, out, ms: Date.now() - t0 }); });
  });
}
const npmRun = (script, logFile) => runCommand(
  npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm"),
  [...(npmCli ? [npmCli] : []), "run", script], logFile,
);

const results = [];
for (const step of STEPS) {
  const logFile = path.join(LOG_DIR, `${step.replace(/[:/]/g, "_")}.log`);
  if (only.length && !only.includes(step)) { results.push({ step, status: "NOT-RUN", ms: 0, reason: "--only 未列出" }); continue; }
  if (mode === "static" && BUILD_STEPS.has(step)) {
    results.push({ step, status: "SCOPED-SKIP", ms: 0, reason: "--static 不跑生产构建" });
    say(`${C.y}↷ ${step}${C.n} ${C.d}SCOPED-SKIP(--static 不跑生产构建)${C.n}`);
    continue;
  }
  process.stdout.write(`${C.c}▶ ${step}${C.n} ${C.d}(log ${path.relative(ROOT, logFile).replace(/\\/g, "/")})${C.n} `);
  let r;
  if (step === "type-check:cached") {
    r = await runCommand(process.execPath, [path.join(ROOT, "scripts", "typecheck-cached.mjs"), ...(forceTypecheck ? ["--force"] : [])], logFile);
    r.cached = /\(cached/.test(r.out);
  } else {
    r = await npmRun(step, logFile);
  }
  const status = r.code === 0 ? (r.cached ? "CACHED" : "PASS") : "FAIL";
  results.push({ step, status, ms: r.ms, code: r.code });
  const secs = `${(r.ms / 1000).toFixed(1)}s`;
  if (status === "PASS") say(`${C.g}✓ PASS${C.n} ${C.d}${secs}${C.n}`);
  else if (status === "CACHED") say(`${C.g}≡ CACHED${C.n} ${C.d}${secs} · ${r.out.trim().split(/\r?\n/).at(-1)}${C.n}`);
  else {
    say(`${C.r}✗ FAIL${C.n} ${C.d}${secs} · exit ${r.code} · 日志 ${path.relative(ROOT, logFile)}${C.n}`);
    const tail = r.out.replace(/\x1b\[[0-9;]*m/g, "").trim().split(/\r?\n/);
    const picked = tail.filter((l) => /^\s*FAIL\b|✗|Error|error TS|not ok|✖|✘/.test(l)).slice(-40);
    (picked.length ? picked : tail.slice(-12)).forEach((l) => say(`    ${C.d}${l.slice(0, 200)}${C.n}`));
  }
}

// ── 汇总 + 产物 ──────────────────────────────────────────────────────────────
const fpEnd = treeFingerprint();
const commitEnd = captureCommitCandidate(ROOT);
// 已知红:FAIL 步命中 scripts/known-red.json 未到期条目 → KNOWN-RED,不进 verdict;到期 → 仍 FAIL 并写明;清单本身坏了 → 追加一条 FAIL。
const knownRed = loadKnownRed();
if (knownRed.problems.length) results.push({ step: "known-red.json", status: "FAIL", ms: 0, code: 2, reason: `已知红清单不可用:${knownRed.problems[0]}(node scripts/lib/known-red.mjs lint 看全部)` });
else applyKnownRedToSteps(results, knownRed.steps);
const count = (s) => results.filter((r) => r.status === s).length;
const totalMs = results.reduce((a, r) => a + r.ms, 0);
const treeMoved = !!(fpStart && fpEnd && fpStart.fingerprint !== fpEnd.fingerprint);
const failed = results.filter((r) => r.status === "FAIL" || r.status === "NOT-RUN");
const verdict = failed.length ? "fail" : "pass";
say(`\n${C.c}━━ verify-chain result · mode=${mode} · ${(totalMs / 1000 / 60).toFixed(1)} min ━━${C.n}`);
for (const r of results) {
  const col = r.status === "PASS" || r.status === "CACHED" ? C.g : r.status === "FAIL" || r.status === "NOT-RUN" ? C.r : C.y; // KNOWN-RED / SCOPED-SKIP 黄
  say(`  ${col}${r.status.padEnd(11)}${C.n} ${r.step.padEnd(34)} ${r.ms ? (r.ms / 1000).toFixed(1).padStart(7) + "s" : "".padStart(8)}${r.reason ? `  ${C.d}${String(r.reason).split(/\r?\n/)[0].slice(0, 120)}${C.n}` : ""}`);
}
say(`  ${C.g}PASS ${count("PASS")}${C.n} · ${C.g}CACHED ${count("CACHED")}${C.n} · ${C.r}FAIL ${count("FAIL")}${C.n} · ${C.y}KNOWN-RED ${count("KNOWN-RED")}${C.n} · ${C.y}SCOPED-SKIP ${count("SCOPED-SKIP")}${C.n} · ${C.r}NOT-RUN ${count("NOT-RUN")}${C.n} / ${STEPS.length} 步` +
    (count("KNOWN-RED") ? `${C.y} —— ${count("KNOWN-RED")} 步是已知红(scripts/known-red.json 有理由有到期日,不进 verdict;到期未清自动回红)${C.n}` : "") +
    (mode !== "full" ? `${C.y} —— 这是 ${mode} 档,不等于全量绿${C.n}` : "") +
    (treeMoved ? `${C.r} —— ⚠ 跑的过程中工作树变了(${fpStart.fingerprint.slice(0, 10)} → ${fpEnd.fingerprint.slice(0, 10)}),本次结论不锚定任何一棵树${C.n}` : ""));

const record = {
  mode, verdict, treeMoved,
  commitCandidate: verifiedCommitCandidate(commitStart, commitEnd, { mode, verdict, treeMoved }),
  startedTree: fpStart, endedTree: fpEnd,
  tree: !treeMoved && fpEnd ? fpEnd.fingerprint : null, headTree: !treeMoved && fpEnd ? fpEnd.headTree : null, dirty: fpEnd ? fpEnd.dirty : null,
  head: fpEnd?.head || null, at: new Date().toISOString(), totalMs,
  knownRed: results.filter((r) => r.status === "KNOWN-RED").map((r) => ({ step: r.step, until: r.knownRed?.until, why: r.knownRed?.why })),
  steps: results,
};
fs.writeFileSync(LAST_RUN_PATH, JSON.stringify(record, null, 1));
const exitCode = verdict === "pass" ? 0 : 1;
fs.writeFileSync(path.join(ROOT, ".verify-chain.code"), `${exitCode}\nmode=${mode} pass=${count("PASS") + count("CACHED")} fail=${count("FAIL")} scoped_skip=${count("SCOPED-SKIP")} not_run=${count("NOT-RUN")} known_red=${count("KNOWN-RED")} tree=${record.tree || "moved"}\n`);
process.exit(exitCode);
