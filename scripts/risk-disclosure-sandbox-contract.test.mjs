import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const backend = "D:/workspace/nexion-backend/src/main/java/ffdd/opsconsole/content";
const service = fs.readFileSync(`${backend}/application/AppRiskDisclosureService.java`, "utf8");
const view = fs.readFileSync(`${backend}/domain/AppRiskDisclosureView.java`, "utf8");
const initializer = fs.readFileSync(`${backend}/application/RiskDisclosureLocalSandboxInitializer.java`, "utf8");
const appApi = fs.readFileSync("D:/workspace/NX1.0-UniApp/src/api/risk-disclosure-api.ts", "utf8");

test("risk disclosure exposes explicit provenance and only local-sandbox may use mock", () => {
  assert.match(service, /getActiveProfiles\(\)[\s\S]*length == 1[\s\S]*local-sandbox/);
  assert.match(service, /localSandbox \? "SANDBOX"/);
  assert.match(service, /localSandbox \? "mock"/);
  assert.match(initializer, /@Profile\("local-sandbox"\)/);
  assert.match(initializer, /active\.length == 1 && "local-sandbox"\.equals\(active\[0\]\)/);
  assert.match(service, /RISK_DISCLOSURE_JURISDICTION_NOT_CONFIGURED/);
  assert.match(view, /String source,/);
  assert.match(view, /String sourceEnvironment,/);
});

test("App parser accepts only server/production or explicit mock/sandbox provenance", () => {
  assert.match(appApi, /source: "server" \| "mock"/);
  assert.match(appApi, /sourceEnvironment: "PRODUCTION" \| "SANDBOX"/);
  assert.match(appApi, /source !== "server" && source !== "mock"/);
  assert.match(appApi, /source === "mock" && sourceEnvironment !== "SANDBOX"/);
  assert.match(appApi, /source === "server" && sourceEnvironment !== "PRODUCTION"/);
});

test("production/default remains fail-closed and App has no local disclosure fallback", () => {
  assert.match(service, /RISK_DISCLOSURE_JURISDICTION_NOT_CONFIGURED/);
  assert.match(appApi, /GET/);
  assert.doesNotMatch(appApi, /localStorage|mock.*fallback|fallback.*mock/i);
});
