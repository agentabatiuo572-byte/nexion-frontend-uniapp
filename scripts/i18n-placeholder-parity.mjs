#!/usr/bin/env node
// Placeholder parity gate: every locale value must carry the SAME set of
// {placeholder} tokens as its English source. Translators reorder words freely
// but must never drop/rename a {usd}/{n}/{amount} — a missing token silently
// breaks fmt() interpolation and the key/mirror gate can't see inside values.
// Added 2026-07-21 alongside the Vietnamese locale.
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

function collectLeaves(node, sf, prefix = "", out = {}) {
  if (!ts.isObjectLiteralExpression(node)) return out;
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = propName(prop.name);
    if (!name) continue;
    const key = prefix ? `${prefix}.${name}` : name;
    if (ts.isObjectLiteralExpression(prop.initializer)) collectLeaves(prop.initializer, sf, key, out);
    else out[key] = prop.initializer.getText(sf);
  }
  return out;
}

function readLeaves(file, exportName) {
  const sourcePath = path.join(ROOT, file);
  const src = fs.readFileSync(sourcePath, "utf8");
  const sf = ts.createSourceFile(sourcePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = null;
  sf.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === exportName && decl.initializer) found = decl.initializer;
    }
  });
  if (!found || !ts.isObjectLiteralExpression(found)) throw new Error(`Could not find exported object ${exportName} in ${file}`);
  return collectLeaves(found, sf);
}

// {s} is an English pluralization suffix ("" | "s"), not a data placeholder —
// call sites pass `s: n === 1 ? "" : "s"`. Vietnamese and Chinese have no
// grammatical plural, so they legitimately drop it (keeping it renders "V3s").
// Exempt it so parity flags only data-bearing tokens ({n}/{usd}/…).
const SUFFIX_ONLY = new Set(["{s}"]);
function placeholders(text) {
  const m = (text.match(/\{(\w+)\}/g) || []).filter((t) => !SUFFIX_ONLY.has(t));
  return [...new Set(m)].sort();
}

const en = readLeaves("src/i18n/messages/en.ts", "en");
const vi = readLeaves("src/i18n/messages/vi.ts", "vi");

const mismatches = [];
for (const key of Object.keys(en)) {
  if (!(key in vi)) continue; // key-completeness is the mirror gate's job
  const a = placeholders(en[key]);
  const b = placeholders(vi[key]);
  if (a.join("|") !== b.join("|")) mismatches.push(`${key}\n    en: ${a.join(" ") || "(none)"}\n    vi: ${b.join(" ") || "(none)"}`);
}

if (mismatches.length) {
  console.error(`uniapp i18n placeholder parity FAIL (vi): ${mismatches.length} key(s)`);
  console.error(mismatches.join("\n"));
  process.exit(1);
}

console.log(`uniapp i18n placeholder parity PASS: vi matches en across ${Object.keys(en).length} leaves`);
