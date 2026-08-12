import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

test("all funds sandbox facts are RunID scoped from mapper through App parser", () => {
  const mapper = read("backend/src/main/java/ffdd/opsconsole/finance/mapper/FundsSandboxMapper.java");
  const service = read("backend/src/main/java/ffdd/opsconsole/finance/application/FundsSandboxService.java");
  const api = read("app/src/api/funds-sandbox-api.ts");
  for (const table of ["wallet", "order", "ledger", "callback_inbox"]) {
    assert.match(mapper, new RegExp(`nx_funds_sandbox_${table}[\\s\\S]{0,400}run_id`));
  }
  assert.match(service, /runScope\.requireRunId\(\)/);
  assert.match(mapper, /isSandboxUser/);
  assert.match(service, /requireSandboxUser\(userId\)/);
  assert.match(service, /mapper\.insertLedger\(runId,/);
  assert.match(service, /mapper\.insertCallback\(runId,/);
  assert.match(service, /mapper\.findCallback\(runId,/);
  assert.match(service, /A racing request can read before the winning inbox insert commits/);
  assert.match(service, /CallbackRow winner = mapper\.findCallback\(runId, normalizedEventId\)/);
  assert.match(service, /winner\.requestHash\(\)\.equals\(requestHash\)/);
  assert.match(service, /catch \(DuplicateKeyException duplicate\)/,
    "a MySQL duplicate-key exception must enter the authoritative callback replay path");
  assert.match(api, /FUNDS_SANDBOX_RUN_ID_MISMATCH/);
  assert.match(api, /runId: string/);
});

test("baseline, forward migration and guarded runner preserve RunID uniqueness", () => {
  const baseline = read("backend/scripts/migrations/20260811_funds_persistent_sandbox.sql");
  const forward = read("backend/scripts/migrations/20260812_funds_sandbox_run_scope.sql");
  const runner = read("backend/scripts/apply_startup_schema_migrations.ps1");
  for (const unique of [
    "(run_id,user_id)", "(run_id,order_no)", "(run_id,user_id,idempotency_key)",
    "(run_id,ledger_no)", "(run_id,order_no,entry_role)", "(run_id,event_id)",
  ]) assert.ok(baseline.includes(unique) && forward.includes(unique), unique);
  assert.match(forward, /information_schema\.statistics/);
  assert.match(forward, /information_schema\.columns/);
  assert.doesNotMatch(forward, /ADD COLUMN IF NOT EXISTS|CREATE INDEX IF NOT EXISTS/);
  assert.match(forward, /PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;/);
  assert.doesNotMatch(forward, /(?<!')\b(?:ADD COLUMN|CREATE INDEX|DROP INDEX|ADD UNIQUE KEY)\b(?![^']*')/,
    "all forward DDL must be generated behind INFORMATION_SCHEMA guards");
  const prepared = (forward.match(/PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;/g) ?? []).length;
  assert.ok(prepared >= 19, "every column/index migration must be replay-safe");
  assert.match(runner, /20260812_funds_sandbox_run_scope\.sql/);
});
