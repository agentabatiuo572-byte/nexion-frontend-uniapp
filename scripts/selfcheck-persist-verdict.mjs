#!/usr/bin/env node
/**
 * selfcheck-persist-verdict.mjs — 结算链上「落盘 / CAS 判决必须交回并被消费」的机器门(AST,不是 grep)。
 *
 * 为什么有这道门:审计 R4→R6 同一族连出五次 —— persistAccountSnapshot() / createOrder 的 persist() /
 * voucher.markUsed() / freeTrial 的 persist() / persistReceiptRecovery 的 writeAccountRow() / voucher.release()
 * 的返回值被当语句丢掉。每一次都是同一形状:**store 写盘的 boolean 落地在一条表达式语句里,没人接**。
 * 逐个调用点补是补丁,这里把它升成不变量:钱路文件里,写盘 / CAS / 资金原语的调用**不许作为裸表达式语句出现**
 * (`if (!x())` / `const ok = x()` / `return x()` / `a && x()` 都算消费;`void x()` 是显式丢弃,放行;
 * 确需忽略的行尾或上一行写 `persist-verdict-ok: <理由>`)。
 *
 * 判据用 TypeScript AST(vue SFC 只取 <script> 块),不是正则:换行 / 链式 / 泛型实参都不影响。
 * Usage: node scripts/selfcheck-persist-verdict.mjs [--selftest]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 钱路 / 发票链上的文件(结算页 + 它调用的每个会落盘的 store)。 */
const FILES = [
  "src/pages/store/checkout.vue",
  "src/pages/store/bundle.vue",
  "src/store/orders.ts",
  "src/store/voucher.ts",
  "src/store/free-trial.ts",
  "src/store/pending-checkout.ts",
];
/** 返回「成没成」的原语:落盘 / CAS / 资金移动 / 收据收口。 */
const VERDICT_CALLS = new Set([
  "persist", "writeAccountRow", "writeAccountRowCas", "persistAccountSnapshot",
  "markUsed", "release", "consume", "restoreMoney", "debitBalance", "creditBalance", "creditNex",
  "createOrder", "createOrders", "cancelOrder", "postMoneyBill", "postReceiptOnly", "commit",
]);
const OK_MARK = "persist-verdict-ok";

function scriptBlocks(file, src) {
  if (!file.endsWith(".vue")) return [{ code: src, offset: 0 }];
  const out = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(src))) out.push({ code: m[1], offset: m.index + m[0].indexOf(m[1]) });
  return out;
}

function calleeName(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isNonNullExpression(expr) || ts.isParenthesizedExpression(expr)) return calleeName(expr.expression);
  return null;
}

/** 返回 [{ line, name, text }] —— 裸表达式语句里的判决调用。 */
export function findDiscardedVerdicts(code, fileLabel = "snippet.ts") {
  const sf = ts.createSourceFile(fileLabel, code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const lines = code.split(/\r?\n/);
  const hits = [];
  const visit = (node) => {
    if (ts.isExpressionStatement(node)) {
      let e = node.expression;
      if (ts.isAwaitExpression(e)) e = e.expression;
      if (ts.isCallExpression(e)) {
        const name = calleeName(e.expression);
        if (name && VERDICT_CALLS.has(name)) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line; // 0-based
          const here = lines[line] ?? "";
          const prev = lines[line - 1] ?? "";
          if (!here.includes(OK_MARK) && !prev.includes(OK_MARK)) {
            hits.push({ line: line + 1, name, text: here.trim().slice(0, 120) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function selftest() {
  const bad = [
    "function f(){ persist(); }",                       // bare
    "function f(){ store.markUsed(id); }",               // property access
    "async function f(){ await orders.createOrder(x); }", // awaited bare
    "function f(){ rows.commit((c) => null); }",          // commit bare
  ];
  const good = [
    "function f(){ if (!persist()) return false; }",
    "function f(){ const ok = app.debitBalance(1); return ok; }",
    "function f(){ return voucher.release(id); }",
    "function f(){ void persist(); }",                          // explicit discard
    "function f(){ persist(); // persist-verdict-ok: best-effort prune\n }",
    "function f(){ // persist-verdict-ok: read-only sync\n rows.commit(() => null); }",
    "function f(){ ok && persist(); }",                          // consumed in expression? (binary → still an ExpressionStatement of BinaryExpression → allowed)
  ];
  let fail = 0;
  for (const s of bad) { const h = findDiscardedVerdicts(s); if (h.length !== 1) { console.error("SELFTEST FAIL (should flag):", s, h); fail++; } }
  for (const s of good) { const h = findDiscardedVerdicts(s); if (h.length !== 0) { console.error("SELFTEST FAIL (should pass):", s, h); fail++; } }
  // vue extraction: script block only, template ignored
  const vue = "<template><view @click=\"persist()\" /></template>\n<script setup lang=\"ts\">\nfunction g(){ persist(); }\n</script>";
  const blocks = scriptBlocks("x.vue", vue);
  const vh = blocks.flatMap((b) => findDiscardedVerdicts(b.code));
  if (blocks.length !== 1 || vh.length !== 1) { console.error("SELFTEST FAIL (vue extraction):", blocks.length, vh); fail++; }
  if (fail) { console.error(`persist-verdict selftest: ${fail} failed`); process.exit(2); }
  console.log("persist-verdict selftest: OK (4 flagged · 7 allowed · vue script-only)");
}

if (process.argv.includes("--selftest")) { selftest(); process.exit(0); }

let total = 0;
const report = [];
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.error(`persist-verdict: missing file ${rel} (钱路文件清单与仓库不符 → 门失效)`); process.exit(2); }
  const src = fs.readFileSync(abs, "utf8");
  const blocks = scriptBlocks(rel, src);
  if (blocks.length === 0) { console.error(`persist-verdict: no <script> block in ${rel}`); process.exit(2); }
  for (const b of blocks) {
    const hits = findDiscardedVerdicts(b.code, rel);
    // line numbers relative to the block → absolute
    const before = src.slice(0, b.offset).split(/\r?\n/).length - 1;
    for (const h of hits) report.push({ file: rel, line: h.line + before, name: h.name, text: h.text });
    total += 1;
  }
}
if (report.length) {
  console.error(`persist-verdict: ${report.length} discarded verdict(s) on the money path — a store write / CAS / money primitive is used as a bare statement:`);
  for (const r of report) console.error(`  ${r.file}:${r.line}  ${r.name}()  ${r.text}`);
  console.error(`  消费它(if/const/return)或写明 ${OK_MARK}: <理由>`);
  process.exit(1);
}
console.log(`PERSIST-VERDICT: PASS (${FILES.length} files, ${total} script blocks, ${VERDICT_CALLS.size} verdict primitives, 0 discarded)`);
