#!/usr/bin/env node
// 老哨兵套件的自启壳 —— node 直跑(也是 npm run verify 的一环):
//   node scripts/run-legacy-suite.mjs
//
// 为什么要这层壳(z1 收口,2026-08-10):
//   `scripts/verify.sh` 里的运行时探针要一个**跑在 mock 模式**的 dev server。
//   以前靠「你自己先起一个 5173」这个口头约定,于是两种翻车都真发生过:
//     ① 忘了起 → 探针整片 SKIP/红,或(更糟)打到别人的 checkout 上验错了对象;
//     ② 起了但没 mock → app 走 remote 分支,注册等流程整条绕开被测代码,门静默失效。
//   这层壳照 verify-h5-runtime.mjs 的家法:自己挑空闲端口、以 mock 模式起**本工作树**的
//   server、把 BASE_URL 交给 sh、跑完连进程树一起收掉。套件从此对外部环境零依赖,
//   接进官方门链才不会互相踩(多个 worktree 会话并发时尤其重要 —— 各起各的端口)。
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function stopTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

async function waitForServer(url, child, tailOutput, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`dev server 提前退出(code ${child.exitCode}):\n${tailOutput()}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`dev server 在 ${timeoutMs / 1000}s 内没起来:\n${tailOutput()}`);
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const npmCli = [
  process.env.npm_execpath,
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
].find((c) => c && fs.existsSync(c));
const server = spawn(
  npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm"),
  [...(npmCli ? [npmCli] : []), "run", "dev:h5", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: root, env: { ...process.env, VITE_NEXGRID_API_MODE: "mock" }, shell: false, stdio: ["ignore", "pipe", "pipe"] },
);
let out = "";
server.stdout.on("data", (c) => { out = (out + c).slice(-12_000); });
server.stderr.on("data", (c) => { out = (out + c).slice(-12_000); });

let code = 1;
try {
  await waitForServer(`${baseUrl}/?nx_device=off`, server, () => out);
  console.log(`legacy-suite:已在 ${baseUrl} 起隔离 mock server(本工作树),开始跑 scripts/verify.sh`);
  const res = spawnSync("bash", ["scripts/verify.sh"], {
    cwd: root,
    env: { ...process.env, BASE_URL: baseUrl, VITE_NEXGRID_API_MODE: "mock" },
    stdio: "inherit",
    shell: false,
  });
  code = res.status ?? 1;
} finally {
  stopTree(server);
}
process.exit(code);
