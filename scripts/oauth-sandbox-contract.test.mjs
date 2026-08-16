import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

// 兄弟仓解析沿用本仓 idiom(funds-run-scoped-isolation-contract.test.mjs):NEXGRID_BACKEND_ROOT 显式指定,
// 否则退标准兄弟位 ../nexion-backend。原先写死 `D:/workspace/nexion-backend/...` 只在作者那台机器成立,
// 换一台机器就是 ENOENT —— 绝对路径还绕开了一切解析器,把仓克隆到标准兄弟位也救不回来。
const appRoot = path.resolve(import.meta.dirname, "..");
const configuredBackend = process.env.NEXGRID_BACKEND_ROOT?.trim();
if (configuredBackend && !fs.existsSync(path.resolve(configuredBackend))) {
  // 显式配了却指向空气 = 配置错,必须炸。降级成 skip 会让「我明明配了仓」的人拿到假绿。
  throw new Error(`NEXGRID_BACKEND_ROOT 指向的兄弟仓不存在: ${path.resolve(configuredBackend)}`);
}
const backendRoot = configuredBackend ? path.resolve(configuredBackend) : path.join(appRoot, "..", "nexion-backend");
// 缺仓 → 只让跨仓断言 skip,本仓断言照跑(不连坐);skip 理由写进文案,套件会统计并大声打印,
// 跨仓那几条「没验」在结果行上是看得见的,不会被读成全绿。
const backendMissing = fs.existsSync(backendRoot)
  ? false
  : `跨仓断言未运行 —— 兄弟仓 nexion-backend 不在 ${backendRoot}(设 NEXGRID_BACKEND_ROOT 或克隆到兄弟位后才真跑)`;
const readBackend = (relative) => fs.readFileSync(path.join(backendRoot, relative), "utf8");

test("OAuth exchange is a server call and the App rejects loose mock provenance", () => {
  const api = read("src/api/auth-api.ts");
  assert.match(api, /path: "\/auth\/users\/oauth\/exchange"/);
  assert.match(api, /data\.source !== "mock" \|\| data\.sandbox !== true/);
});

test("OAuth sandbox backend keeps the explicit exchange endpoint and strict mock provenance", { skip: backendMissing }, () => {
  const backendController = readBackend("src/main/java/ffdd/opsconsole/auth/web/AppUserAuthController.java");
  const backendService = readBackend("src/main/java/ffdd/opsconsole/auth/application/AppUserOAuthService.java");
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
