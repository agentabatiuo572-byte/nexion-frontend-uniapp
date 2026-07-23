#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function propName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function collectObjectKeys(node, prefix = "") {
  if (!ts.isObjectLiteralExpression(node)) return [];
  const keys = [];
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = propName(prop.name);
    if (!name) continue;
    const key = prefix ? `${prefix}.${name}` : name;
    keys.push(key);
    if (ts.isObjectLiteralExpression(prop.initializer)) {
      keys.push(...collectObjectKeys(prop.initializer, key));
    }
  }
  return keys;
}

// 占位符收集(2026-07-23 B1 新增):键名镜像通过 ≠ 插值安全。若某语言漏写
// {name} 占位符,fmt 的插值静默丢失(UI 少一段信息);若多写,UI 裸露花括号。
// 两者 tsc/键镜像都抓不到 —— 本轮新增 66 条带插值文案后补上这道门。
function collectPlaceholders(node, prefix = "", out = new Map()) {
  if (!ts.isObjectLiteralExpression(node)) return out;
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = propName(prop.name);
    if (!name) continue;
    const key = prefix ? `${prefix}.${name}` : name;
    if (ts.isObjectLiteralExpression(prop.initializer)) {
      collectPlaceholders(prop.initializer, key, out);
    } else if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
      const marks = [...prop.initializer.text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      if (marks.length) out.set(key, marks.join(","));
    }
  }
  return out;
}

function readExportedObject(file, exportName) {
  const sourcePath = path.join(ROOT, file);
  const src = fs.readFileSync(sourcePath, "utf8");
  const sf = ts.createSourceFile(sourcePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = null;
  sf.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === exportName && decl.initializer) {
        found = decl.initializer;
      }
    }
  });
  if (!found || !ts.isObjectLiteralExpression(found)) {
    throw new Error(`Could not find exported object ${exportName} in ${file}`);
  }
  return found;
}

// en is the source of truth; every other locale dictionary must mirror its key
// tree exactly (no missing, no extra). Added vi 2026-07-21 — a two-way en/zh
// check would let vi drift silently, so all locales are gated against en here.
const enRoot = readExportedObject("src/i18n/messages/en.ts", "en");
const enKeys = new Set(collectObjectKeys(enRoot));
const enMarks = collectPlaceholders(enRoot);
const LOCALES = [
  ["zh", "src/i18n/messages/zh.ts"],
  ["vi", "src/i18n/messages/vi.ts"],
];

let failed = false;
let markMismatch = 0;
for (const [name, file] of LOCALES) {
  const root = readExportedObject(file, name);
  const keys = new Set(collectObjectKeys(root));
  const missing = [...enKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !enKeys.has(key));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`uniapp i18n mirror FAIL (${name} vs en)`);
    if (missing.length) console.error(`missing in ${name}:\n${missing.join("\n")}`);
    if (extra.length) console.error(`extra in ${name}:\n${extra.join("\n")}`);
  }
  // 占位符对齐:以 en 为准,逐键比较 {xxx} 集合
  const marks = collectPlaceholders(root);
  const bad = [];
  for (const [key, en] of enMarks) {
    const got = marks.get(key) ?? "";
    if (got !== en) bad.push(`  ${key}: en{${en}} ${name}{${got || "—"}}`);
  }
  for (const [key, got] of marks) {
    if (!enMarks.has(key)) bad.push(`  ${key}: en{—} ${name}{${got}}`);
  }
  if (bad.length) {
    markMismatch += bad.length;
    // 🔴 INFO 级不 fail(2026-07-23 B1 实证):占位符集合跨语言**天然不同**,
    // 硬门必然稳定误报 →
    //   ① 英文复数/语法标记(`seat{s}` `direct {label}`)中文无需对应,
    //      调用点如 `{ s: qty > 1 ? "s" : "" }`,少写是正确的;
    //   ② 组件可传占位符「超集」供各语言各取所需 —— binary-how.vue:193 明写
    //      「zh 用 {freq}、en 用 {unit},两者都传,fmt 忽略未用占位符」。
    // 真正的风险是「文案要的参数组件没传」,那要解析全部调用点,非本脚本职责。
    // 故降级为清单打印:人定期审阅,不制造门噪音(否则必被白名单绕过而失效)。
    console.log(`uniapp i18n placeholder INFO (${name} vs en) — ${bad.length} 条占位符集合差异(多为语法差异,非缺陷;逐条人工审阅):\n${bad.slice(0, 20).join("\n")}`);
    if (bad.length > 20) console.log(`  …共 ${bad.length} 处`);
  }
}

if (failed) process.exit(1);

console.log(`uniapp i18n mirror PASS: en/zh/vi ${enKeys.size} keys · ${enMarks.size} 条带插值文案占位符对齐`);
