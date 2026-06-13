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

const enKeys = new Set(collectObjectKeys(readExportedObject("src/i18n/messages/en.ts", "en")));
const zhKeys = new Set(collectObjectKeys(readExportedObject("src/i18n/messages/zh.ts", "zh")));

const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key));
const extraInZh = [...zhKeys].filter((key) => !enKeys.has(key));

if (missingInZh.length || extraInZh.length) {
  console.error("uniapp i18n mirror FAIL");
  if (missingInZh.length) console.error(`missing in zh:\n${missingInZh.join("\n")}`);
  if (extraInZh.length) console.error(`extra in zh:\n${extraInZh.join("\n")}`);
  process.exit(1);
}

console.log(`uniapp i18n mirror PASS: ${enKeys.size} keys`);
