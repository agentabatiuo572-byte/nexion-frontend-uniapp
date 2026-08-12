import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const runtimeConfig = read("src/api/runtime-config.ts");
const runtime = read("src/api/runtime.ts");
const appStore = read("src/store/app.ts");
const api = read("src/api/funds-sandbox-api.ts");

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

console.log("funds server sandbox contract: PASS");
