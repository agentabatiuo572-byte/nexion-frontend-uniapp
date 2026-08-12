import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("unknown remote registration results preserve no token and return safely to login", () => {
  const api = read("src/api/auth-api.ts");
  const page = read("src/pages/register/register.vue");
  const zh = read("src/i18n/messages/zh.ts");

  assert.match(api, /function isRegistrationOutcomeUnknown\(error: unknown\)/);
  assert.match(api, /apiError\.kind === "network"\s*\|\| apiError\.kind === "protocol"/);
  assert.match(api, /apiError\.kind === "http" && \(apiError\.status \?\? 0\) >= 500/);
  assert.match(page, /if \(isRegistrationOutcomeUnknown\(cause\)\)\s*\{[\s\S]*?registrationOutcomeUnknown[\s\S]*?goLogin\(\);/);
  assert.match(zh, /registrationOutcomeUnknown:\s*"结果可能已提交，请用刚设置的手机号\/密码登录恢复"/);
});

test("authoritative remote 4xx registration errors stay on the form for correction", () => {
  const page = read("src/pages/register/register.vue");

  assert.match(page, /if \(isRegistrationOutcomeUnknown\(cause\)\)[\s\S]*?return;[\s\S]*?error\.value = registrationErrorText\(cause\)/);
});

test("sandbox registration sponsor rejections give an actionable recovery path", () => {
  const page = read("src/pages/register/register.vue");
  const zh = read("src/i18n/messages/zh.ts");

  assert.match(page, /function registrationErrorText\(cause: unknown\)/);
  assert.match(page, /USER_REGISTRATION_SANDBOX_SPONSOR_REQUIRED/);
  assert.match(page, /USER_REGISTRATION_SPONSOR_ENVIRONMENT_MISMATCH/);
  assert.match(page, /error\.value = registrationErrorText\(cause\)/);
  assert.match(zh, /sandboxSponsorRequired:\s*"沙箱注册需要使用预置的沙箱邀请码，请返回上一步填写有效邀请码"/);
  assert.match(zh, /sandboxSponsorEnvironmentMismatch:\s*"邀请码所属环境不匹配，请使用当前环境的有效邀请码后重试"/);
});
