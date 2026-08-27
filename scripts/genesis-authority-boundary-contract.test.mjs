import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("only a run-fenced Sandbox account projection may overlay its isolated supply", () => {
  const source = fs.readFileSync(path.join(root, "src/store/genesis.ts"), "utf8");
  const start = source.indexOf("function applyAccountState(");
  const end = source.indexOf("function clearRemoteAccountFacts(", start);
  assert.ok(start >= 0 && end > start, "applyAccountState boundary is unavailable");
  const accountProjection = source.slice(start, end);
  assert.match(accountProjection,
    /if \(state\.sourceEnvironment === "SANDBOX"\) \{[\s\S]*?totalSlots\.value\s*=\s*state\.series\.totalSupply;[\s\S]*?soldSlots\.value\s*=\s*state\.series\.soldSupply;[\s\S]*?\}/);
  assert.doesNotMatch(accountProjection, /\b(?:nexListed|remoteHalted)\.value\s*=/);
  assert.doesNotMatch(accountProjection, /sourceEnvironment\s*===\s*"PRODUCTION"/);
});

test("eligibility projection cannot overwrite the public Genesis halt state", () => {
  const source = fs.readFileSync(path.join(root, "src/store/genesis.ts"), "utf8");
  const start = source.indexOf("async function syncRemote(");
  const end = source.indexOf("function persist()", start);
  assert.ok(start >= 0 && end > start, "syncRemote boundary is unavailable");
  const syncProjection = source.slice(start, end);
  const eligibilityStart = syncProjection.indexOf("applyEligibility:");
  const eligibilityEnd = syncProjection.indexOf("},", eligibilityStart);
  assert.ok(eligibilityStart >= 0 && eligibilityEnd > eligibilityStart, "eligibility projection is unavailable");
  assert.doesNotMatch(syncProjection.slice(eligibilityStart, eligibilityEnd), /remoteHalted\.value\s*=/);
  assert.doesNotMatch(syncProjection, /remoteEligibility\.value\?\.halted/);
});

test("H5 launcher passes one validated dev RunID into the Genesis parser", () => {
  const runtime = fs.readFileSync(path.join(root, "src/api/runtime.ts"), "utf8");
  const launcher = fs.readFileSync(path.join(root, "scripts/start-dev-h5.ps1"), "utf8");
  assert.match(runtime, /VITE_NEXGRID_ACCEPTANCE_RUN_ID/);
  assert.match(runtime, /createGenesisApi\(apiClient, expectedApiEnvironment, expectedGenesisSandboxRunId\)/);
  assert.match(launcher, /AcceptanceRunId must contain 8-96 safe characters/);
  assert.match(launcher, /VITE_NEXGRID_ACCEPTANCE_RUN_ID\s*=\s*\$acceptanceRunIdValue/);
});
