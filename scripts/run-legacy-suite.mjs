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

function findBash() {
  if (process.platform !== "win32") return "bash";
  const candidates = [process.env.BASH_EXE];
  const locatedGit = spawnSync("where.exe", ["git"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  for (const gitExe of String(locatedGit.stdout || "").split(/\r?\n/).filter(Boolean)) {
    candidates.push(path.resolve(path.dirname(gitExe), "..", "bin", "bash.exe"));
  }
  candidates.push(
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
  );
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
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
  const bash = findBash();
  if (!bash) throw new Error("BASH_RUNTIME_NOT_FOUND:请安装 Git Bash 或设置 BASH_EXE");
  const res = spawnSync(bash, ["scripts/verify.sh"], {
    cwd: root,
    env: { ...process.env, BASE_URL: baseUrl, VITE_NEXGRID_API_MODE: "mock" },
    stdio: "inherit",
    shell: false,
  });
  if (res.error) throw res.error;
  code = res.status ?? 1;
  // 🔴 中止 ≠ 判红(2026-08-12 加,同型第二次之后)。
  // 套件半路暴毙时退出码同样非零,而红门数会**变少** —— 两次都差点被读成好消息:
  //   ① 跨仓测试 ENOENT 崩在第 2 步 → 红门 27 → 0;② unbound variable 崩在第 263 行 → 27 → 2。
  // 靠人眼比 PASS 条数才看出来,那不是门。这里读哨兵第二行的基数,低于下限一律判「中止」。
  // 下限取 400:写下时满跑 435 pass + 27 fail = 462,留出正常增删门的余量;
  // 真要大批删门,连同这个数一起改 —— 改它是显式动作,崩掉不是。
  //
  // 🔴 462 这个数**只能当下限的由来看,不能当基线比**(2026-08-13 我自己踩了才补这句):
  // verify.sh 里有十几段是循环驱动的(逐源文件 / 逐路由 / 逐 i18n namespace 逐条 emit),
  // 所以总格数**随被测树的内容浮动** —— 隔几个提交再跑,少个二十格是正常的数据漂移,
  // 不是「门掉了」。我当时就是拿 441 去减 462,推出一句「有 21 格门没跑」的错结论,
  // 回源 diff 才发现同期 verify.sh 其实**净增 4 道门、一道没少**。
  // 要判「门有没有掉」,查的是 `git diff <旧> HEAD -- scripts/verify.sh` 里消失的 ok/bad 调用,
  // 以及各门自报的样本量有没有塌(那才是构造性判据);这里这个总数只负责区分「跑完 vs 中止」。
  const FLOOR = 400;
  let tally = null;
  try {
    const line = fs.readFileSync(path.join(root, ".verify-exit.code"), "utf8").split(/\r?\n/)[1] ?? "";
    const m = line.match(/pass=(\d+) fail=(\d+) skip=(\d+)/);
    if (m) tally = { pass: +m[1], fail: +m[2], skip: +m[3] };
  } catch { /* 哨兵读不到,按下面的 null 分支处理 */ }
  if (!tally) {
    console.error("legacy-suite:FAIL —— 读不到退出码哨兵的基数行,无法区分「跑完判红」与「半路中止」");
    code = code || 1;
  } else {
    const ran = tally.pass + tally.fail;
    console.log(`legacy-suite:本次实跑 ${ran} 格(pass ${tally.pass} / fail ${tally.fail} / skip ${tally.skip})`);
    if (ran < FLOOR) {
      console.error(
        `legacy-suite:FAIL —— 只跑了 ${ran} 格,低于下限 ${FLOOR} ⇒ **套件中途中止,不是判红**。` +
        "红门数变少在这种情况下是假象;先看日志最后一行的报错(unbound variable / 语法错 / 某步崩溃),别拿本次红门数做对比。",
      );
      code = code || 1;
    }
  }
} finally {
  stopTree(server);
}
process.exit(code);
