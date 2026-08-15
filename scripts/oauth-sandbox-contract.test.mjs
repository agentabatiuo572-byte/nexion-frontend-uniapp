import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("OAuth sandbox is an explicit server exchange with strict mock provenance", () => {
  const api = read("src/api/auth-api.ts");
  const backendController = readFileSync("D:/workspace/nexion-backend/src/main/java/ffdd/opsconsole/auth/web/AppUserAuthController.java", "utf8");
  const backendService = readFileSync("D:/workspace/nexion-backend/src/main/java/ffdd/opsconsole/auth/application/AppUserOAuthService.java", "utf8");
  assert.match(api, /path: "\/auth\/users\/oauth\/exchange"/);
  assert.match(api, /data\.source !== "mock" \|\| data\.sandbox !== true/);
  assert.match(backendController, /@PostMapping\("\/oauth\/exchange"\)/);
  assert.match(backendService, /SANDBOX_MOCK/);
  assert.match(backendService, /OAUTH_PROVIDER_NOT_CONFIGURED/);
  assert.match(backendService, /OAUTH_PROVIDER_UNAVAILABLE/);
  assert.match(backendService, /userMapper\.ensureRegisteredUserWallet/);
  assert.match(backendService, /auth\.oauth_sandbox_(account_created|login)/);
});

test("OAuth UI buttons invoke the server API and never persist provider subjects", () => {
  for (const file of ["src/pages/login/login.vue", "src/pages/register/register.vue"]) {
    const page = read(file);
    assert.match(page, /@click="startOauth\(o\.label\)"/);
    assert.match(page, /authApi\.oauthExchange/);
    assert.match(page, /externalSubject: oauthSubject\(provider\)/);
    assert.doesNotMatch(page, /localStorage|sessionStorage/);
  }
});
