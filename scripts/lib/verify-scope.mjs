// verify 共用库:仓库根、.verify-cache 路径和树指纹。
// verify-chain.mjs 用树指纹判断跑的过程中工作树有没有变,typecheck-cached.mjs 用路径存缓存。
//
// CLI:
//   node scripts/lib/verify-scope.mjs fingerprint            → JSON {headTree,dirty,fingerprint,dirtyFiles}
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const CACHE_DIR = path.join(ROOT, ".verify-cache");
export const LAST_RUN_PATH = path.join(CACHE_DIR, "last-run.json");

export function git(args, opts = {}) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], ...opts }).replace(/\r?\n$/, "");
  } catch {
    return null;
  }
}

const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "");

/** `git status --porcelain=v1 -z` 解析 → [{code, path}](重命名取新路径;不含 ignored)。 */
export function workingStatus() {
  const raw = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (raw === null) return null;
  const out = [];
  const parts = raw.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (!e) continue;
    const code = e.slice(0, 2);
    let p = e.slice(3);
    if (/^(R|C)/.test(code)) { /* v1 -z:重命名的原路径跟在下一个字段 */ i += 1; }
    out.push({ code, path: norm(p) });
  }
  return out;
}

/**
 * 树指纹 = HEAD 树对象 + 工作树里每个改动文件的内容哈希(git hash-object,与 git 同口径)。
 * 干净工作树 → fingerprint === headTree(合并守卫据此比对分支 tip 树)。
 * 算不出(非 git 目录)→ null,调用方按「不能复用任何缓存」处理。
 */
export function treeFingerprint() {
  const headTree = git(["rev-parse", "HEAD^{tree}"]);
  if (!headTree) return null;
  const status = workingStatus();
  if (status === null) return null;
  const files = status.map((s) => s.path).filter(Boolean).sort();
  const existing = files.filter((f) => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile());
  let hashes = {};
  if (existing.length) {
    const out = execFileSync("git", ["-C", ROOT, "hash-object", "--stdin-paths"], { input: existing.join("\n") + "\n", encoding: "utf8" });
    out.trim().split(/\r?\n/).forEach((h, i) => { hashes[existing[i]] = h; });
  }
  const lines = files.map((f) => `${f}:${hashes[f] || "deleted"}`);
  const dirty = files.length > 0;
  const fingerprint = dirty
    ? crypto.createHash("sha256").update(headTree + "\n" + lines.join("\n")).digest("hex")
    : headTree;
  return { headTree, dirty, fingerprint, dirtyFiles: files, head: git(["rev-parse", "HEAD"]) };
}

if (process.argv[1] && /verify-scope\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const fp = treeFingerprint();
  if (!fp) { console.error("fingerprint: 不是 git 工作树"); process.exit(2); }
  console.log(JSON.stringify(fp));
}
