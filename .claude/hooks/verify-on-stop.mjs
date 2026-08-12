#!/usr/bin/env node
// Stop 门 —— 把 verify.sh 的判决真正**送到**该看的人手里。
//
// 为什么要这层壳(2026-08-11):
//   settings.json 以前直接挂 `bash scripts/verify.sh all`。Claude Code 的 hook 语义是
//   exit 2 = 阻断并把 **stderr** 回喂给 Claude,exit 0/1/其它 = 不阻断。而 verify.sh
//   末行只会给 0 或 1,且 158 处 FAIL 全打 **stdout** —— 于是「红了」这件事:
//     ① 拦不住任何东西(1 不阻断);② 明细走 stdout,exit≠0 时被丢弃。
//   门是装饰品。同工作区的 Nexion-admin-prototype/.claude/hooks/verify-on-stop.mjs
//   早就是对的写法(捕获 stdout → 写 stderr → exit 2),本仓照抄。
//
// 环境不满足 ≠ 代码有问题:
//   verify.sh 的 13 道运行时门要一台**本树 + mock 模式**的 dev server。没有它时
//   verify 必红(preflight 是 fail-closed 的)。若照直阻断,任何没起 server 的机器
//   每回合都会被顶回去 —— 所以这里先探环境:靶子不对就只警告不阻断,和 admin 仓
//   「dev server 未起则跳过 verify(仅警告),不阻断」同一条约定。
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

// 🔴 服务端那份是**源码文本**里的 JSON 转义值,分隔符是两个反斜杠字符(`C:\\Users\\…`),
//    本地 path.resolve 出来的是一个。不折叠连续斜杠 → 恒不相等 → 这道门永远「跳过」,
//    也就永远不阻断(红测 [A] 就是这么抓出来的,别删这一步)。
const norm = (p) =>
  p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^([A-Za-z]):/, "$1").replace(/\/+$/, "").toLowerCase();

// ── 1) 靶子对不对?(和 verify.sh [2.5]/[2.6] 同判据,只是提前问一遍)──
let envHead = "";
try {
  envHead = execSync(`curl -s --max-time 5 "${BASE_URL}/src/api/runtime-config.ts"`, {
    encoding: "utf8",
  }).split("\n").slice(0, 2).join("\n");
} catch {
  envHead = "";
}

const servedRoot = (envHead.match(/"VITE_ROOT_DIR": *"([^"]*)"/) || [])[1] || "";
const isMock = /"VITE_NEXGRID_API_MODE": *"mock"/.test(envHead);
const isThisTree = servedRoot && norm(servedRoot) === norm(PROJECT_DIR);

if (!envHead || !servedRoot || !isThisTree || !isMock) {
  const why = !envHead
    ? `${BASE_URL} 上没有 vite dev server`
    : !servedRoot
      ? `${BASE_URL} 的 env 里没有 VITE_ROOT_DIR(uni 版本变了?)`
      : !isThisTree
        ? `${BASE_URL} 服务的是另一棵树:${servedRoot}(本树 ${PROJECT_DIR})`
        : `${BASE_URL} 不是 mock 模式`;
  process.stderr.write(
    `[verify-on-stop] (提示)跳过 verify.sh —— ${why}。\n` +
      `  要让这道门真正生效:VITE_NEXGRID_API_MODE=mock npm run dev:h5 -- --port <本树端口>,\n` +
      `  然后 BASE_URL=http://localhost:<本树端口> 跑。环境不满足只警告、不阻断。\n`,
  );
  process.exit(0);
}

// ── 2) 靶子对了 → verify 说了算,红就阻断,并把明细送到 stderr ──
try {
  execSync("bash scripts/verify.sh all", { cwd: PROJECT_DIR, stdio: "pipe", env: process.env });
} catch (e) {
  const out = (e.stdout ? e.stdout.toString() : "") + (e.stderr ? e.stderr.toString() : "");
  // 只回喂 FAIL/SKIP 行 + 末尾 result —— 400+ 行全文回喂等于没说。
  const lines = out.split("\n");
  const verdicts = lines.filter((l) => /\bFAIL\b|\bSKIP\b|━━ result:/.test(l));
  process.stderr.write(
    "[verify-on-stop] ✗ verify.sh 未通过,先修再收工:\n" +
      (verdicts.length ? verdicts.join("\n") : out.slice(-4000)) +
      "\n",
  );
  process.exit(2);
}
