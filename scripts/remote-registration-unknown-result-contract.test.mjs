import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("unknown remote registration results attempt one password-login recovery", () => {
  const api = read("src/api/auth-api.ts");
  const page = read("src/pages/register/register.vue");
  const recovery = read("src/auth/registration-auto-login.ts");
  const zh = read("src/i18n/messages/zh.ts");

  assert.match(api, /function isRegistrationOutcomeUnknown\(error: unknown\)/);
  assert.match(api, /apiError\.kind === "network"\s*\|\| apiError\.kind === "protocol"/);
  assert.match(api, /apiError\.kind === "http" && \(apiError\.status \?\? 0\) >= 500/);
  assert.match(page, /registerAndLogin\(authApi/);
  assert.match(recovery, /if \(!isRegistrationOutcomeUnknown\(error\)\)[\s\S]*?kind: "registration_error"/);
  assert.match(recovery, /authApi\.login\(/);
  assert.match(zh, /registrationOutcomeUnknown:\s*"账号可能已创建，但自动登录结果未确认。请使用刚设置的手机号和密码登录"/);
});

test("authoritative remote 4xx registration errors stay on the form for correction", () => {
  const page = read("src/pages/register/register.vue");

  assert.match(page, /registration\.kind === "registration_error"[\s\S]*?registrationErrorText\(registration\.error\)/);
});

test("an optional sponsor is rejected only when it crosses environments", () => {
  const page = read("src/pages/register/register.vue");
  const zh = read("src/i18n/messages/zh.ts");

  assert.match(page, /function registrationErrorText\(cause: unknown\)/);
  assert.doesNotMatch(page, /USER_REGISTRATION_SANDBOX_SPONSOR_REQUIRED/);
  assert.match(page, /USER_REGISTRATION_SPONSOR_ENVIRONMENT_MISMATCH/);
  assert.match(page, /error\.value = registrationErrorText\(registration\.error\)/);
  assert.match(zh, /sandboxSponsorEnvironmentMismatch:\s*"邀请码所属环境不匹配，请使用当前环境的有效邀请码后重试"/);
});
