import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const app = read("src/store/app.ts");
const badge = read("src/components/me/funds-sandbox-badge.vue");
const runtime = read("src/api/runtime.ts");
const runtimeConfig = read("src/api/runtime-config.ts");
const completeSignIn = read("src/auth/complete-sign-in.ts");
const surfaces = [
  "src/pages/me/wallet.vue",
  "src/pages/me/wallet-topup.vue",
  "src/pages/me/wallet-withdraw.vue",
  "src/pages/me/wallet-withdraw-tracking.vue",
  "src/pages/me/wallet-bills.vue",
  "src/components/me/deposit-usdt-pane.vue",
  "src/components/me/deposit-bank-pane.vue",
  "src/components/me/topup-card-form.vue",
];

assert.match(app, /const fundsSandboxEvidence = ref<FundsSandboxEvidence \| null>\(null\)/,
  "a visible sandbox claim must start unproven");
assert.match(app, /fundsSandboxEvidence\.value = null[\s\S]{0,600}const overview = await fundsSandboxApi\.overview\(\)[\s\S]{0,800}fundsSandboxEvidence\.value = sandboxEvidenceFromOverview\(overview\)/,
  "only a parsed server overview may establish the sandbox evidence");
assert.match(app, /catch \(cause\) \{[\s\S]{0,1000}fundsSandboxEvidence\.value = null/,
  "a failed, missing, or contradictory overview must clear the claim");
assert.match(app, /fundsSandboxEvidence,/, "the badge must read the store's authoritative evidence");
assert.match(app, /function refreshFundsSandboxForAccount[\s\S]{0,1600}sessionVault\.read\(\)[\s\S]{0,600}tokenType\.toLowerCase\(\) === "bearer"[\s\S]{0,800}refreshFundsSandbox\(\)/,
  "a sandbox refresh must require the current server Bearer session before it can make the GET");
assert.match(app, /if \(fundsSandboxEnabled\) void refreshFundsSandboxForAccount\(key\)/,
  "every account bind must refresh the newly-bound sandbox facts");
assert.match(completeSignIn, /app\.refreshFundsSandboxForAccount\(options\.identity\)/,
  "a completed server login must reassert the server wallet read after its Bearer session is saved");
assert.match(runtimeConfig, /const modeExplicit = rawMode === "mock" \|\| rawMode === "sandbox" \|\| rawMode === "remote"/,
  "a missing runtime mode cannot implicitly opt into money sandbox behavior");
assert.match(runtime, /fundsSandboxEnabled = apiRuntimeConfig\.mode === "sandbox" && apiRuntimeConfig\.modeExplicit/,
  "only an explicit runtime sandbox can display the server evidence");

assert.match(badge, /fundsSandboxEnabled[\s\S]{0,600}fundsSandboxStatus === "ready"[\s\S]{0,600}source === "mock"[\s\S]{0,600}sourceEnvironment === "SANDBOX"[\s\S]{0,600}mode === "LOCAL_SANDBOX"/,
  "the DOM badge must require both explicit sandbox runtime and validated server evidence");
assert.match(badge, /Acceptance Sandbox · source=mock · SANDBOX/,
  "the first-user warning must name the server source and environment");
assert.match(badge, /data-testid="funds-sandbox-badge"/,
  "the visible DOM witness needs a stable selector");

for (const surface of surfaces) {
  assert.match(read(surface), /<FundsSandboxBadge\b/,
    `${surface} must retain a prominent sandbox disclosure`);
}

console.log("funds sandbox visible label contract: PASS");
