import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const coordinator = readFileSync(new URL("../src/services/janus-c2.ts", import.meta.url), "utf8");

test("H5 without a native Janus executor is visibly held and never starts malformed reports", () => {
  assert.match(coordinator, /export type JanusSyncAvailability[\s\S]*HOLD/);
  assert.match(coordinator, /JANUS_NATIVE_EXECUTOR_REQUIRED/);
  assert.match(coordinator, /function janusSyncAvailability\(\): JanusSyncAvailability/);
  assert.match(coordinator, /uni\.getSystemInfoSync\(\)\.uniPlatform/);
  assert.match(coordinator, /if \(!remoteApiEnabled \|\| janusSyncAvailability\(\)\.state !== "READY"\) return;/);
  assert.match(coordinator, /export function currentJanusSyncAvailability\(\): JanusSyncAvailability/);
});
