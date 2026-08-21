import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cases = {
  "src/pages/genesis/how-it-works.vue": "genesis-how",
  "src/pages/me/wallet-exchange-how.vue": "wallet-exchange-how",
  "src/pages/me/wallet-repurchase-how.vue": "wallet-repurchase-how",
  "src/pages/team/binary-how.vue": "team-binary-how",
  "src/pages/team/commissions-how.vue": "team-commissions-how",
  "src/pages/team/unilevel-how.vue": "team-unilevel-how",
};

test("six How-it-works pages are server-authoritative outside explicit mock", () => {
  for (const [file, key] of Object.entries(cases)) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /HowPublishedContent/);
    assert.match(source, new RegExp(`content-key=\\"${key}\\"`));
    assert.match(source, /apiRuntimeConfig\.mode !== 'mock'/);
    assert.match(source, /apiRuntimeConfig\.mode === 'mock'/);
  }
});
