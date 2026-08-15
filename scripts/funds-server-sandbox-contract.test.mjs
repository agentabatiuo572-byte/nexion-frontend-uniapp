import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const backendRoot = process.env.NEXGRID_BACKEND_ROOT?.trim()
  ? path.resolve(process.env.NEXGRID_BACKEND_ROOT.trim())
  : path.resolve(root, "..", "nexion-backend");
const readBackend = (relative) => fs.readFileSync(path.join(backendRoot, relative), "utf8");

const runtimeConfig = read("src/api/runtime-config.ts");
const runtime = read("src/api/runtime.ts");
const appStore = read("src/store/app.ts");
const api = read("src/api/funds-sandbox-api.ts");
const withdrawalService = readBackend("src/main/java/ffdd/opsconsole/finance/application/AppWithdrawalService.java");
const withdrawalMapper = readBackend("src/main/java/ffdd/opsconsole/finance/mapper/AppWithdrawalMapper.java");

assert.match(runtimeConfig, /"mock"\s*\|\s*"sandbox"\s*\|\s*"remote"/);
assert.match(runtime, /fundsSandboxEnabled\s*=\s*apiRuntimeConfig\.mode\s*===\s*["']sandbox["']\s*&&\s*apiRuntimeConfig\.modeExplicit/);
assert.match(api, /sourceEnvironment:\s*["']SANDBOX["']/);
assert.match(api, /source:\s*["']mock["']/);
assert.match(api, /Idempotency-Key|idempotencyKey/);
assert.match(api, /expectedVersion/);
assert.match(appStore, /if\s*\(fundsServerEnabled\)\s*return\s*\[\]/,
  "server funds modes must never let the client ETA promote withdrawals to confirmed");
assert.doesNotMatch(api, /localStorage|uni\.setStorage|setTimeout/,
  "sandbox API must not persist or finalize funds in the browser");
assert.match(withdrawalMapper, /Integer isSandboxUser/);
assert.match(withdrawalMapper, /COALESCE\(sandbox,0\)=1/);
const productionGuard = withdrawalService.slice(
  withdrawalService.indexOf("requireProductionWithdrawalSubject(userId);"),
  withdrawalService.indexOf("if (userId == null || mapper.lockActiveUser(userId)"),
);
assert.match(productionGuard, /requireProductionWithdrawalSubject\(userId\)/);
assert.match(withdrawalService, /WITHDRAWAL_PRODUCTION_PROFILE_REQUIRED/);
assert.match(withdrawalService, /WITHDRAWAL_SANDBOX_USER_FORBIDDEN/);
assert.match(withdrawalService, /profiles\.length == 0[\s\S]*"production"\.equals\(profiles\[0\]\)/,
  "only default or an exact production profile can reach a real withdrawal");

console.log("funds server sandbox contract: PASS");
