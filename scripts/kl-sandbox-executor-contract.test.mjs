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
  const executor = createJanusExecutor({
    mode: "remote",
    production: true,
    allowedSubjects: ["42"],
    allowedTargetKeys: ["review-h5"],
    now: () => 1_723_000_000_000,
  });
  await assert.rejects(() => executor.apply(command), /JANUS_REMOTE_EXECUTOR_REQUIRED/);
});
