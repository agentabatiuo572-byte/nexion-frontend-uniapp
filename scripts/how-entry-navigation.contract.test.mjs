import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("tab navigation uses the transient-overlay-safe route gate", () => {
  const chassis = read("src/components/app-chassis.vue");
  assert.match(chassis, /navBack as navBackTo, navTo/);
  assert.match(chassis, /navTo\(tab\.route\)/);
  assert.match(chassis, /navTo\("\/pages\/search\/search"\)/);
  assert.doesNotMatch(chassis, /uni\.reLaunch\(\{ url: tab\.route/);
});

test("an empty first-user notification surface exposes the repurchase How entry", () => {
  const drawer = read("src/components/message-drawer.vue");
  assert.match(drawer, /data-how-entry="wallet-repurchase-how"/);
  assert.match(drawer, /goRepurchaseHow/);
  assert.match(drawer, /navTo\("\/pages\/me\/wallet-repurchase-how"\)/);
});

test("team keeps both How entries as direct visible navigation targets", () => {
  const team = read("src/pages/team/team.vue");
  assert.match(team, /data-how-entry="team-binary-how"[\s\S]*?role="button"[\s\S]*?tabindex="0"[\s\S]*?navTo\('\/pages\/team\/binary-how'\)/);
  assert.match(team, /data-how-entry="team-unilevel-how"[\s\S]*?role="button"[\s\S]*?tabindex="0"[\s\S]*?navTo\('\/pages\/team\/unilevel-how'\)/);
});

test("back navigation also closes transient overlays before popping the stack", () => {
  const route = read("src/lib/route.ts");
  const navBackStart = route.indexOf("export function navBack");
  const navToStart = route.indexOf("/** Navigate to", navBackStart);
  assert.ok(navBackStart >= 0 && navToStart > navBackStart);
  const navBackBody = route.slice(navBackStart, navToStart);
  assert.match(navBackBody, /useTrialClaimSheet\(\)\.closeTransient\(\)/);
  assert.match(navBackBody, /useVoucherClaimSheet\(\)\.closeTransient\(\)/);
});
