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

test("six How-it-works pages use published Java content in the formal runtime", () => {
  for (const [file, key] of Object.entries(cases)) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /HowPublishedContent/);
    assert.match(source, new RegExp(`content-key=\\"${key}\\"`));
    assert.match(source, /v-if="remoteApiEnabled(?: && !publishedContentUnavailable)?"/);
    assert.doesNotMatch(source, /apiRuntimeConfig\.mode/);
  }
});

test("team How pages fall back to their bundled 5174 explanation when publication is unavailable", () => {
  const teamPages = {
    "src/pages/team/binary-how.vue": "teamBinary",
    "src/pages/team/commissions-how.vue": "teamCommissions",
    "src/pages/team/unilevel-how.vue": "teamUnilevel",
  };

  for (const [file, headerKey] of Object.entries(teamPages)) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /@unavailable="publishedContentUnavailable = true"/);
    assert.match(source, /v-if="!remoteApiEnabled \|\| publishedContentUnavailable"/);
    assert.match(source, /publishedContentUnavailable = ref\(false\)/);
    assert.match(
      source,
      new RegExp(`:title="t\\.headerTitles\\.${headerKey} \\+ t\\.headerTitles\\.howItWorksSuffix"`),
    );
  }

  const consumer = fs.readFileSync(path.join(root, "src/components/how/how-published-content.vue"), "utf8");
  assert.match(consumer, /defineEmits<\{ unavailable: \[\] \}>\(\)/);
  assert.match(consumer, /emit\("unavailable"\)/);
});
