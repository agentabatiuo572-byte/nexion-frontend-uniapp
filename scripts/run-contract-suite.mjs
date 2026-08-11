#!/usr/bin/env node
// 契约测试登记门 + 执行器 —— node 直跑:
//   node scripts/run-contract-suite.mjs
//
// 背景(z1 判决包 P0-1,2026-08-10 独立审计抓出):c37e642 新增了 8 个契约测试文件,
// **两条门链一个都没接**;而本包的判决表还把其中 hard-block-k1 当成「删门后的替代防线」
// 引用 —— 空头支票。根因不是「谁忘了接」,而是**这个仓的测试文件天然可以变成孤儿**:
// 建一个新文件不需要任何登记动作,谁也不会红。
//
// 🔴 守的不变量:scripts/*.test.mjs 的**每一个文件**必须在下面的 REGISTRY 里显式登记
//   归属;登记不了就判红。新建测试文件而不登记 = 门红,不会静默成孤儿。
//   三种归属:
//     chain    — 由本执行器跑(接进 npm run verify)
//     elsewhere— 已由别的入口跑(写明是哪个,便于回查)
//     excluded — 明确不跑,必须写清原因(如依赖本机不存在的兄弟仓)
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPTS = path.join(root, "scripts");

const REGISTRY = {
  // ── chain:本执行器跑(原孤儿,z1 接入)──
  "hard-block-auth-contract.test.mjs": { how: "chain" },
  "hard-block-d5-runtime-contract.test.mjs": { how: "chain" },
  "hard-block-h9-runtime-contract.test.mjs": { how: "chain" },
  "hard-block-k1-runtime-contract.test.mjs": { how: "chain" },
  "hard-block-k6-runtime-contract.test.mjs": { how: "chain" },
  "g-remote-authority-contract.test.mjs": { how: "chain" },
  "g-remote-authority-behavior.test.mjs": { how: "chain" },
  "withdraw-idempotency-contract.test.mjs": { how: "chain" },
  // ── elsewhere:已有入口在跑 ──
  "kyc-removal-contract.test.mjs": { how: "elsewhere", by: "npm run test:kyc-removal" },
  "probe-safety-contract.test.mjs": { how: "elsewhere", by: "npm run test:probe-safety" },
  "static-review-routes.test.mjs": { how: "elsewhere", by: "npm run test:probe-safety" },
  "earnings-accrual-contract.test.mjs": { how: "elsewhere", by: "npm run test:earnings-accrual(需 --experimental-strip-types)" },
  "janus-stop-cancellation.test.mjs": { how: "elsewhere", by: "npm run test:janus-stop-cancellation + verify.sh" },
  // ── excluded:写清原因 ──
  "h-remote-authority-contract.test.mjs": {
    how: "excluded",
    why: "断言读兄弟仓 ../nexion-backend 的 Java 源(本机无该 checkout,ENOENT 必红)。在有后端仓的环境用 node --test 单跑;已记 HANDOFF。",
  },
};

const found = readdirSync(SCRIPTS).filter((f) => f.endsWith(".test.mjs")).sort();
if (found.length === 0) {
  console.error("FAIL 扫不到任何 *.test.mjs —— 判据失效必红(禁空集全过)");
  process.exit(1);
}
const unregistered = found.filter((f) => !REGISTRY[f]);
const stale = Object.keys(REGISTRY).filter((f) => !found.includes(f));
if (unregistered.length || stale.length) {
  if (unregistered.length) console.error(`FAIL 未登记的契约测试(新建即孤儿的根因):${unregistered.join(", ")}\n  → 在 scripts/run-contract-suite.mjs 的 REGISTRY 里登记归属(chain / elsewhere / excluded+原因)`);
  if (stale.length) console.error(`FAIL 登记表里有磁盘上不存在的文件(改名/删除未同步):${stale.join(", ")}`);
  process.exit(1);
}

const chain = found.filter((f) => REGISTRY[f].how === "chain");
const elsewhereN = found.filter((f) => REGISTRY[f].how === "elsewhere").length;
const excluded = found.filter((f) => REGISTRY[f].how === "excluded");
for (const f of excluded) console.log(`  SKIP(登记在案)${f} — ${REGISTRY[f].why}`);

const res = spawnSync(process.execPath, ["--test", ...chain.map((f) => path.join("scripts", f))], {
  cwd: root, encoding: "utf8", stdio: "pipe",
});
process.stdout.write((res.stdout || "").split("\n").filter((l) => /^. (pass|fail)|^not ok|^# Subtest|Error/.test(l)).join("\n") + "\n");
if (res.status !== 0) {
  process.stderr.write(res.stdout || "");
  process.stderr.write(res.stderr || "");
  console.error(`FAIL 契约测试套件失败(chain ${chain.length} 个)`);
  process.exit(1);
}
console.log(`contract-suite PASS — chain ${chain.length} 跑过 · elsewhere ${elsewhereN} 由别的入口跑 · excluded ${excluded.length} 登记在案 · 登记覆盖 ${found.length}/${found.length}`);
