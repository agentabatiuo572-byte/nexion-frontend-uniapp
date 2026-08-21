import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("team How entries stay visible while projections are unavailable", () => {
  const source = read("src/pages/team/team.vue");
  assert.match(source, /data-how-entry="team-binary-how"/);
  assert.match(source, /data-how-entry="team-unilevel-how"/);
  assert.match(source, /navTo\(['"]\/pages\/team\/binary-how['"]\)/);
  assert.match(source, /navTo\(['"]\/pages\/team\/unilevel-how['"]\)/);
});
test("Me exposes the repurchase parent for first-user discovery", () => {
  const source = read("src/pages/me/me.vue");
  assert.match(source, /href: \"\/me\/wallet-repurchase\"/);
  assert.match(source, /meWalletRepurchase/);
});

test("logical navigation closes transient offer sheets before routing", () => {
  const source = read("src/lib/route.ts");
  assert.match(source, /useTrialClaimSheet/);
  assert.match(source, /useVoucherClaimSheet/);
  assert.match(source, /closeTransient/);
});
