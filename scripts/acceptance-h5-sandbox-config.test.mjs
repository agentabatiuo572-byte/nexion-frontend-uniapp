import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const env = read(".env.example");
const vite = read("vite.config.ts");
const runtime = read("src/api/runtime-config.ts");
const appShell = read("src/App.vue");

assert.match(env, /^VITE_NEXGRID_API_MODE=sandbox$/m,
  "the checked-in H5 acceptance profile must select the explicit server sandbox");
assert.doesNotMatch(env, /^VITE_NEXGRID_API_(?:BASE_URL|DEV_BASE_URL)=/m,
  "acceptance H5 must use its same-origin gateway rather than split localhost identities");
assert.match(env, /^VITE_NEXGRID_API_PREVIEW_TARGET=http:\/\/127\.0\.0\.1:8110$/m,
  "the local backend target must stay a dev-server-only value");
assert.match(vite, /loadEnv\(/,
  "Vite must load the H5 acceptance target without embedding it in a production bundle");
assert.match(vite, /proxy:[\s\S]*"\/api"[\s\S]*target:\s*apiPreviewTarget/,
  "H5 /api calls must be proxied through the browser origin to avoid CORS and host split");
assert.match(runtime, /baseUrl:\s*mode === "mock" \? "" : configured \|\| developmentFallback \|\| browserOrigin/,
  "sandbox mode must resolve to the browser-origin gateway when no explicit remote URL is supplied");
assert.match(runtime, /import\.meta\.env\.DEV \? "sandbox" : "remote"/,
  "an unconfigured development H5 must choose the acceptance sandbox, not a provider candidate");
assert.doesNotMatch(runtime, /localhost:8110|127\.0\.0\.1:8110/,
  "runtime client code must not embed a loopback production fallback");
assert.match(appShell, /remoteApiEnabled[\s\S]{0,1000}sessionVault\.read\(\)[\s\S]{0,400}auth\.signOut\(\)/,
  "server modes must evict a legacy local identity when no matching authoritative session exists");
assert.match(appShell, /setRemoteUnauthorizedHandler\([\s\S]{0,500}sessionVault\.clear\(\)[\s\S]{0,500}auth\.signOut\(\)/,
  "an expired server session must route through the safe sign-in boundary instead of rendering SESSION_EXPIRED");

console.log("acceptance H5 sandbox config: PASS");
