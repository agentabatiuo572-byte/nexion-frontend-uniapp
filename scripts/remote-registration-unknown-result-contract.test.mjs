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
  // 🔴 语言面必须三语齐点(门的门 ① 判据):只点一种语言时,另两种可以随意漂移而本门全绿。
  // 实测过的失败形态:语言豁免表不带语言维 → vi 真丢了占位符照样绿。
  // 中文钉**原文**(话术是产品决定),英/越只钉**键存在** —— 措辞由翻译定,但键不许缺。
  for (const [loc, src] of [["en", read("src/i18n/messages/en.ts")], ["vi", read("src/i18n/messages/vi.ts")]]) {
    assert.match(src, /registrationOutcomeUnknown:/,
      `${loc}.ts 缺 registrationOutcomeUnknown —— 该语言下这条恢复指引不存在`);
  }
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
  // 同上:三语齐点。中文钉原文,英/越钉键存在。
  for (const [loc, src] of [["en", read("src/i18n/messages/en.ts")], ["vi", read("src/i18n/messages/vi.ts")]]) {
    for (const key of ["sandboxSponsorRequired", "sandboxSponsorEnvironmentMismatch"]) {
      assert.match(src, new RegExp(`${key}:`), `${loc}.ts 缺 ${key}`);
    }
  }
});
