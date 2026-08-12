import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const login = readFileSync(new URL("../src/pages/login/login.vue", import.meta.url), "utf8");
const withdrawal = readFileSync(new URL("../src/pages/me/wallet-withdraw.vue", import.meta.url), "utf8");

test("password login establishes the real backend session before entering protected flows", () => {
  assert.match(login, /import \{[^}]*\bauthApi\b[^}]*\} from "@\/api\/runtime"/);
  assert.match(login, /await authApi\.login/);
  assert.doesNotMatch(login, /`\$\{country\.value\}\$\{phoneClean\.value\}@demo\.nexgrid\.ai`/);
});

test("a closed withdrawal switch does not masquerade as a fee-policy fetch failure", () => {
  assert.doesNotMatch(withdrawal, /policy !== null\s*&& policy\.withdrawalEnabled\s*&& policy\.enabledNetworks/);
  assert.match(withdrawal, /submitReasonWithdrawalClosed/);
});
