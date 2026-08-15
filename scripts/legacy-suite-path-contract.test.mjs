import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const PC_ROOT = path.resolve(ROOT, "..", "nexion-ops-console");
const verify = fs.readFileSync(path.join(ROOT, "scripts", "verify.sh"), "utf8");
const audit = fs.readFileSync(path.join(PC_ROOT, "scripts", "uniapp-port-coverage-audit.mjs"), "utf8");
const parity = fs.readFileSync(path.join(PC_ROOT, "scripts", "platform-config-contract-parity.mjs"), "utf8");
const ledger = fs.readFileSync(path.join(ROOT, "docs", "changes", "2026-08-10-legacy-suite-adjudication.md"), "utf8");

test("legacy suite resolves the declared real App and PC worktrees", () => {
  assert.match(verify, /ADMIN_ROOT="\$PROJECT_DIR\/\.\.\/nexion-ops-console"/);
  assert.doesNotMatch(verify, /Nexion-admin-prototype|\.\.\/Nexion-uniapp/);
  assert.match(audit, /NX1\.0-UniApp/);
  assert.doesNotMatch(audit, /Nexion-admin-prototype|Nexion-uniapp/);
  assert.match(ledger, /D:\\workspace\\NX1\.0-UniApp/);
  assert.match(ledger, /D:\\workspace\\nexion-ops-console/);
});

test("SPEC-7 parity delegates to the current server platform-config contracts", () => {
  assert.match(verify, /platform-config-contract-parity\.mjs/);
  assert.doesNotMatch(verify, /lib\/mock\/admin\/compute-config\.ts/);
  for (const token of [
    "src/api/platform-config-api.ts",
    "lib/admin/e6-client.ts",
    "/api/config/platform",
    "/api/admin/devices/compute-config",
    "h5BaseFactor",
    "continuityFullHours",
    "homeNewcomerTasksEnabled",
    "homeWeeklyPromoEnabled",
  ]) assert.match(parity, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")), token);
});
