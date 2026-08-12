import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const backend = resolve(root, "..", "backend");
const appApi = readFileSync(resolve(root, "src/api/referral-reward-api.ts"), "utf8");
const card = readFileSync(resolve(root, "src/components/team/invite-earn-card.vue"), "utf8");
const service = readFileSync(resolve(backend, "src/main/java/ffdd/opsconsole/growth/application/AppReferralRewardService.java"), "utf8");
const mapper = readFileSync(resolve(backend, "src/main/java/ffdd/opsconsole/growth/mapper/ReferralRewardMapper.java"), "utf8");
const pc = readFileSync(resolve(root, "..", "pc/lib/admin/h-client.ts"), "utf8");

test("H8 sandbox referral snapshot is a current-RunID ledger projection, never a cumulative wallet projection", () => {
  assert.match(service, /NEXION_ACCEPTANCE_RUN_ID/);
  assert.match(service, /H8AcceptanceSandboxProfileCondition\.isStrictIsolatedProfile/);
  assert.match(service, /appSandboxInvitedCount\(userId, effectiveAt, runId\)/);
  assert.match(service, /appSandboxPendingCount\(userId, effectiveAt, runId\)/);
  assert.match(service, /appSandboxPositiveSettlementCount\(userId, runId\)/);
  assert.match(service, /appSandboxSettlementCount\(userId, runId\)/);
  assert.match(service, /appVerifiedSandboxRewardSummary\(userId, runId\)/);
  assert.match(service, /appRecentVerifiedSandboxRewards\(userId, runId, limit\)/);
  assert.match(service, /sandbox \? lifetime : nz\(account\.walletNexAvailable\(\)\)/);
  assert.match(service, /sandbox \? runId : null/);
  assert.doesNotMatch(service, /SANDBOX_FACT_SOURCES = List\.of\([\s\S]*?nx_user_wallet/);
});

test("every App sandbox count, summary and history query is RunID-filtered", () => {
  for (const method of [
    "appSandboxInvitedCount", "appSandboxPendingCount", "appSandboxPositiveSettlementCount",
    "appSandboxSettlementCount", "appVerifiedSandboxRewardSummary", "appRecentVerifiedSandboxRewards",
  ]) assert.match(mapper, new RegExp(`${method}[\\s\\S]{0,170}@Param\\(\\\"runId\\\"\\)`));
  assert.match(mapper, /s\.run_id = #\{runId\}/);
  assert.match(mapper, /sandbox_ledger\.run_id = #\{runId\}/);
  assert.match(mapper, /PARTITION BY sandbox_ledger\.user_id, sandbox_ledger\.run_id/);
});

test("App validates and visibly labels the server-owned RunID, while PC rejects a mismatched overview", () => {
  assert.match(appApi, /runId: string \| null/);
  assert.match(appApi, /SANDBOX_FACTS = \["nx_h8_sandbox_referral_settlement", "nx_h8_sandbox_referral_ledger"\]/);
  assert.match(appApi, /sourceEnvironment === "SANDBOX"[\s\S]{0,700}runId/);
  assert.match(card, /RunID \{\{ sandboxRunId \}\}/);
  assert.match(pc, /overview\.runId !== runId/);
});
