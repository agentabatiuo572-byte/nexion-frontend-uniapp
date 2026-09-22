import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const parser = fs.readFileSync(path.join(root, "src/api/platform-config-api.ts"), "utf8");
const types = fs.readFileSync(path.join(root, "src/store/config-types.ts"), "utf8");
const card = fs.readFileSync(path.join(root, "src/components/home/network-pulse-card.vue"), "utf8");
const trust = fs.readFileSync(path.join(root, "src/pages/trust/trust.vue"), "utf8");
const globe = fs.readFileSync(path.join(root, "src/pages/globe/globe.vue"), "utf8");
const appStore = fs.readFileSync(path.join(root, "src/store/app.ts"), "utf8");

test("H9 runtime parser matches the admin/backend percentile contract", () => {
  assert.match(parser, /const tops = finiteNumber\(row\.tops\)/);
  assert.match(parser, /tops < 0 \|\| tops <= previousTops/);
  assert.match(parser, /cumPct < previousPct/);
  assert.doesNotMatch(parser, /previousPct !== 100/);
});

test("H9 rank denominator uses the real server user count, not the marketing display base", () => {
  assert.match(types, /realUserCount: number/);
  assert.match(parser, /const realUserCount = finiteNumber\(projection\.realUserCount\)/);
  assert.match(card, /realPopulation: ps\.realUserCount/);
  assert.doesNotMatch(card, /realPopulation: registered\.value/);
});

test("Trust uses measured online devices while globe retains its independent remote projection", () => {
  assert.doesNotMatch(trust, /:value="global\.activeDevices\.toLocaleString\(\)"/);
  assert.match(trust, /verified\.value\?\.onlineDevices\.value/);
  assert.doesNotMatch(trust, /trustFieldValue\([^\n]*"devicesOnlineValue"/);
  assert.match(globe, /cfg\.syncFailed \|\| !health\.devicesOk/);
  assert.match(globe, /t\.value\.home\.networkStatUpdating/);
});

test("remote verified aggregate rebases the long-lived global snapshot after async load", () => {
  assert.match(appStore, /import \{[^}]*\bwatch\b[^}]*\} from "vue"/);
  assert.match(appStore, /watch\(\s*\(\) => \[\s*cfg\.syncFailed,[\s\S]*?cfg\.config\.verifiedStats\?\.onlineDevices\.value/);
  assert.match(appStore, /const activeDevices = cfg\.syncFailed\s*\?\s*0\s*:\s*pulseOnlineBaseline\(\)/);
  assert.match(appStore, /global\.value = \{ \.\.\.global\.value, activeDevices \}/);
});
