import assert from "node:assert/strict";
import test from "node:test";

import { createJanusExecutor } from "../src/services/janus-sandbox-executor.ts";

const command = {
  subject: "42",
  targetKey: "review-h5",
  targetUrl: "https://sandbox.example.test/review",
  targetVersion: 3,
  targetCatalogVersion: 9,
  commandVersion: 7,
};

test("sandbox executor is explicit and isolates account plus target", async () => {
  const executor = createJanusExecutor({
    mode: "sandbox",
    production: false,
    profile: "acceptance",
    authorization: "Bearer acceptance-only",
    allowedSubjects: ["42"],
    allowedTargetKeys: ["review-h5"],
    now: () => 1_723_000_000_000,
  });
  const first = await executor.apply(command);
  const replay = await executor.apply(command);
  assert.equal(first.handoffReceipt, replay.handoffReceipt);
  assert.match(first.handoffReceipt, /^sandbox:v1:/);

  await assert.rejects(() => executor.apply({ ...command, subject: "43" }), /JANUS_SANDBOX_ACCOUNT_FORBIDDEN/);
  await assert.rejects(() => executor.apply({ ...command, targetKey: "prod-h5" }), /JANUS_SANDBOX_TARGET_FORBIDDEN/);
});
test("production remote mode never falls back to sandbox", async () => {
  assert.throws(() => createJanusExecutor({
    mode: "remote",
    production: true,
    profile: "production",
    authorization: "Bearer must-not-be-used",
    allowedSubjects: ["42"],
    allowedTargetKeys: ["review-h5"],
    now: () => 1_723_000_000_000,
  }), /JANUS_REMOTE_EXECUTOR_REQUIRED/);
});

test("sandbox executor requires an allowed profile and a non-empty Bearer authorization", async () => {
  const base = {
    mode: "sandbox",
    production: false,
    allowedSubjects: ["42"],
    allowedTargetKeys: ["review-h5"],
    now: () => 1_723_000_000_000,
  };
  assert.throws(() => createJanusExecutor({ ...base, profile: "development", authorization: "Bearer qa" }), /JANUS_SANDBOX_PROFILE_FORBIDDEN/);
  assert.throws(() => createJanusExecutor({ ...base, profile: "test", authorization: "Bearer " }), /JANUS_SANDBOX_AUTHORIZATION_REQUIRED/);
  assert.throws(() => createJanusExecutor({ ...base, profile: "local-sandbox", authorization: "qa" }), /JANUS_SANDBOX_AUTHORIZATION_REQUIRED/);
});
