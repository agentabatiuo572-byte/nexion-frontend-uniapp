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
const enKeys = new Set(collectObjectKeys(readExportedObject("src/i18n/messages/en.ts", "en")));
const LOCALES = [
  ["zh", "src/i18n/messages/zh.ts"],
  ["vi", "src/i18n/messages/vi.ts"],
];

let failed = false;
for (const [name, file] of LOCALES) {
  const keys = new Set(collectObjectKeys(readExportedObject(file, name)));
  const missing = [...enKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !enKeys.has(key));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`uniapp i18n mirror FAIL (${name} vs en)`);
    if (missing.length) console.error(`missing in ${name}:\n${missing.join("\n")}`);
    if (extra.length) console.error(`extra in ${name}:\n${extra.join("\n")}`);
  }
}

if (failed) process.exit(1);

console.log(`uniapp i18n mirror PASS: en/zh/vi ${enKeys.size} keys`);
