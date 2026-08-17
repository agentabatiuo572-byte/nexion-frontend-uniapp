// verify 范围化共用库(包 ar,2026-08-17 主人拍板 Q1A)——三档制的「算范围」那一半。
//
// 为什么是机器算、不是模型判(提案 §3 不变量③):范围由 `git 改动集 ∩ 门声明的输入文件集` 决定,
// 可审计、可红测;模型「觉得只改了 X」不算数。失败方向偏保守:算不出改动集 → 全量;
// 门没在 manifest 声明 → 照跑;改动命中全局不变量清单 → 自动升 full 并说明。
//
// 三个消费者共用同一份判定,不许各抄一份(单源):
//   · scripts/verify-chain.mjs   —— 18 步链的 runner(步骤级 + h5 子探针级)
//   · scripts/verify.sh          —— 通过 `plan --format shell` 拿到 SCOPE_RUN[id] 表(门级)
//   · hooks(verify-on-stop / verify-fresh-before-merge)—— 读树指纹判「上次绿还算不算数」
//
// CLI:
//   node scripts/lib/verify-scope.mjs fingerprint            → JSON {headTree,dirty,fingerprint,dirtyFiles}
//   node scripts/lib/verify-scope.mjs changed [--base REF]   → JSON {base,files,reason}
//   node scripts/lib/verify-scope.mjs plan --mode scoped|static|full [--format json|shell]
//   node scripts/lib/verify-scope.mjs lint                    → manifest ↔ verify.sh 接线一致性(门的门)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const MANIFEST_PATH = path.join(ROOT, "scripts", "gates.manifest.json");
export const CACHE_DIR = path.join(ROOT, ".verify-cache");
export const LAST_RUN_PATH = path.join(CACHE_DIR, "last-run.json");
export const MODES = ["full", "scoped", "static"];

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

/** 主线名:VERIFY_MAINLINE > origin/UniApp > origin/main > origin/master > 本地同名。 */
export function mainlineRef() {
  const env = process.env.VERIFY_MAINLINE;
  const candidates = env ? [env, `origin/${env}`] : ["origin/UniApp", "origin/main", "origin/master", "UniApp", "main", "master"];
  for (const c of candidates) if (git(["rev-parse", "--verify", "--quiet", `${c}^{commit}`])) return c;
  return null;
}

/**
 * 改动集 = 提交层(merge-base(HEAD, 主线)..HEAD)∪ 暂存 ∪ 未暂存 ∪ 未跟踪。
 * base 可用 SCOPE_BASE / --base 覆盖。算不出 → null(调用方升 full)。
 */
export function changedSet({ base } = {}) {
  const ml = mainlineRef();
  let baseRef = base || process.env.SCOPE_BASE || null;
  let reason;
  if (!baseRef) {
    if (!ml) return null;
    baseRef = git(["merge-base", "HEAD", ml]);
    if (!baseRef) return null;
    reason = `merge-base(HEAD, ${ml})`;
  } else {
    reason = `SCOPE_BASE=${baseRef}`;
  }
  const committed = git(["diff", "--name-only", "--diff-filter=ACMRTD", `${baseRef}...HEAD`]);
  if (committed === null) return null;
  const status = workingStatus();
  if (status === null) return null;
  const files = new Set();
  committed.split(/\r?\n/).filter(Boolean).forEach((f) => files.add(norm(f)));
  status.forEach((s) => files.add(s.path));
  return { base: baseRef, baseReason: reason, mainline: ml, files: [...files].sort() };
}

export function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

export function matchAny(file, globs) {
  return (globs || []).some((g) => path.matchesGlob(file, g));
}

/**
 * 出跑单。mode: full → 全跑;scoped → 按输入交集(命中全局清单升 full);static → 不起 server、不跑测试套件,其余静态门按输入交集(命中全局清单则静态门全跑)。
 * 返回 { mode(生效), requested, upgraded(升档原因|null), changed, gates:{id:{run,reason}}, steps:{...}, h5Probes:{...} }
 */
export function plan({ mode = "full", manifest = loadManifest(), changed = undefined } = {}) {
  if (!MODES.includes(mode)) throw new Error(`unknown mode ${mode}`);
  const requested = mode;
  let upgraded = null;
  let changedInfo = null;
  // static 与 scoped 都按改动集缩范围;区别只在 static 一律不碰需要 server 的门。
  // static 下改动集算不出 / 命中全局清单 → 「静态门全跑」(staticAll),仍不起 server(保守方向,不升 full)。
  let staticAll = false;
  if (mode === "scoped" || mode === "static") {
    changedInfo = changed === undefined ? changedSet() : changed;
    if (!changedInfo) {
      if (mode === "scoped") { upgraded = "改动集算不出(非 git / 无主线 / merge-base 失败)→ 升 full(保守方向)"; mode = "full"; }
      else { upgraded = "改动集算不出 → 静态门全跑(不起 server)"; staticAll = true; }
    } else {
      const hit = changedInfo.files.filter((f) => matchAny(f, manifest.globals));
      if (hit.length) {
        const list = `${hit.slice(0, 5).join(", ")}${hit.length > 5 ? " …" : ""}`;
        if (mode === "scoped") { upgraded = `改动命中全局不变量清单:${list} → 升 full`; mode = "full"; }
        else { upgraded = `改动命中全局不变量清单:${list} → 静态门全跑(不起 server)`; staticAll = true; }
      }
    }
  }
  const decide = (entry, id) => {
    if (mode === "full") return { run: true, reason: "full" };
    if (entry.fullOnly) return { run: false, reason: "full-only(只在全量档跑)" };
    const needsServer = entry.kind === "runtime" || entry.kind === "server";
    if (mode === "static" && needsServer) return { run: false, reason: "static:需要 dev server" };
    if (mode === "static" && entry.kind === "test") return { run: false, reason: "static:测试套件留给 scoped/full" };
    if (entry.always) return { run: true, reason: "always" };
    if (mode === "static" && staticAll) return { run: true, reason: "static:全跑" };
    // scoped / static:按输入交集
    if (!entry.inputs || !entry.inputs.length) return { run: true, reason: "no-inputs-declared(照跑)" };
    const hits = changedInfo.files.filter((f) => matchAny(f, entry.inputs));
    return hits.length ? { run: true, reason: `hit:${hits[0]}${hits.length > 1 ? ` +${hits.length - 1}` : ""}` } : { run: false, reason: `${mode}:输入未变` };
  };
  const table = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([id, e]) => [id, decide(e, id)]));
  return {
    requested, mode, upgraded,
    changed: changedInfo ? { base: changedInfo.base, baseReason: changedInfo.baseReason, files: changedInfo.files } : null,
    gates: table(manifest.gates), steps: table(manifest.steps), h5Probes: table(manifest.h5Probes),
  };
}

/** verify.sh 用的 shell 片段:SCOPE_MODE / SCOPE_UPGRADED / SCOPE_RUN[id]=1|0 SCOPE_WHY[id]。 */
export function planToShell(p) {
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const lines = [`SCOPE_MODE=${q(p.mode)}`, `SCOPE_REQUESTED=${q(p.requested)}`, `SCOPE_UPGRADED=${q(p.upgraded || "")}`,
    `SCOPE_CHANGED_COUNT=${p.changed ? p.changed.files.length : -1}`, `SCOPE_BASE_USED=${q(p.changed ? p.changed.base : "")}`];
  for (const [id, d] of Object.entries(p.gates)) {
    lines.push(`SCOPE_RUN[${q(id)}]=${d.run ? 1 : 0}`);
    lines.push(`SCOPE_WHY[${q(id)}]=${q(d.reason)}`);
  }
  return lines.join("\n") + "\n";
}

/** 门的门:manifest 里的 gate id ↔ verify.sh 里的 scope_hit 调用点一一对应;glob 至少命中一个存在文件。 */
export function lint({ manifest = loadManifest(), verifySh = fs.readFileSync(path.join(ROOT, "scripts", "verify.sh"), "utf8") } = {}) {
  const problems = [];
  const idsInSh = new Set([...verifySh.matchAll(/scope_hit\s+"?([A-Za-z0-9._-]+)"?/g)].map((m) => m[1]));
  const idsInManifest = new Set(Object.keys(manifest.gates || {}));
  for (const id of idsInSh) if (!idsInManifest.has(id)) problems.push(`verify.sh 调了 scope_hit ${id},manifest.gates 没有它(会按「未声明照跑」处理,但接线意图丢了)`);
  for (const id of idsInManifest) if (!idsInSh.has(id)) problems.push(`manifest.gates.${id} 在 verify.sh 里没有 scope_hit 调用点(声明了却没接线 = 空转)`);
  const allFiles = git(["ls-files"])?.split(/\r?\n/).filter(Boolean) || [];
  const checkGlobs = (owner, globs) => {
    for (const g of globs || []) {
      if (g.includes("*") ? !allFiles.some((f) => path.matchesGlob(f, g)) : !fs.existsSync(path.join(ROOT, g))) {
        problems.push(`${owner} 的输入 glob「${g}」在仓里一个文件都不命中(路径漂移?)`);
      }
    }
  };
  checkGlobs("globals", manifest.globals);
  for (const [k, e] of Object.entries(manifest.gates || {})) checkGlobs(`gates.${k}`, e.inputs);
  for (const [k, e] of Object.entries(manifest.steps || {})) checkGlobs(`steps.${k}`, e.inputs);
  for (const [k, e] of Object.entries(manifest.h5Probes || {})) checkGlobs(`h5Probes.${k}`, e.inputs);
  for (const [k, e] of Object.entries({ ...(manifest.gates || {}), ...(manifest.steps || {}), ...(manifest.h5Probes || {}) })) {
    if (!e.always && (!e.inputs || !e.inputs.length)) problems.push(`${k} 既没 inputs 也没 always —— 要么声明输入,要么显式 always:true`);
    if (e.kind && !["static", "runtime", "server", "test", "build", "meta"].includes(e.kind)) problems.push(`${k}.kind=${e.kind} 不认识`);
  }
  return problems;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && /verify-scope\.mjs$/.test(process.argv[1])) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : null; };
  if (cmd === "fingerprint") {
    const fp = treeFingerprint();
    if (!fp) { console.error("fingerprint: 不是 git 工作树"); process.exit(2); }
    console.log(JSON.stringify(fp));
  } else if (cmd === "changed") {
    const c = changedSet({ base: opt("--base") });
    if (!c) { console.error("changed: 算不出改动集"); process.exit(2); }
    console.log(JSON.stringify(c, null, 1));
  } else if (cmd === "plan") {
    const p = plan({ mode: opt("--mode") || "full" });
    const fmt = opt("--format") || "json";
    process.stdout.write(fmt === "shell" ? planToShell(p) : JSON.stringify(p, null, 1) + "\n");
  } else if (cmd === "lint") {
    const problems = lint();
    if (problems.length) { console.error("gates.manifest lint FAIL:\n  - " + problems.join("\n  - ")); process.exit(1); }
    const m = loadManifest();
    console.log(`gates.manifest lint PASS —— gates ${Object.keys(m.gates).length} · steps ${Object.keys(m.steps).length} · h5Probes ${Object.keys(m.h5Probes).length} · globals ${m.globals.length};全部接线一致、glob 均命中`);
  } else {
    console.error("usage: verify-scope.mjs fingerprint | changed [--base REF] | plan --mode full|scoped|static [--format json|shell] | lint");
    process.exit(2);
  }
}
