#!/usr/bin/env node
// npm run verify:sentinels 的入口:经 findBash() 跑 scripts/verify.sh,退出码原样传出。
import { spawnSync } from "node:child_process";
import path from "node:path";
import { findBash } from "./lib/find-bash.mjs";

const bash = findBash();
if (!bash) {
  console.error("BASH_RUNTIME_NOT_FOUND:请安装 Git Bash 或设置 BASH_EXE");
  process.exit(1);
}
const result = spawnSync(bash, ["scripts/verify.sh"], { cwd: path.resolve(import.meta.dirname, ".."), stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
