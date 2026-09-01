import { describe, expect, it } from "vitest";

const page = (import.meta.glob("./login.vue", { query: "?raw", import: "default", eager: true })["./login.vue"] ?? "") as string;
const messages = import.meta.glob("../../i18n/messages/{en,zh,vi}.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("password reset session and error contract", () => {
  it("returns to sign-in after reset and never claims a session was issued", () => {
    expect(page).toContain('mode.value = "password"');
    expect(page).toContain("t.value.login.resetSuccess");
    for (const source of Object.values(messages)) {
      expect(source).not.toMatch(/resetSuccess:\s*["'][^"']*(已登录|signed in|đã đăng nhập)/i);
      expect(source).not.toMatch(/finishReset:\s*["'][^"']*(并登录|and sign in|và đăng nhập)/i);
    }
  });

  it("uses a dedicated same-password message instead of reporting password strength", () => {
    expect(page).toContain("t.value.login.errorPasswordUnchanged");
    expect(page).not.toMatch(/USER_NEW_PASSWORD_MUST_DIFFER[\s\S]{0,100}errorWeakPassword/);
    for (const source of Object.values(messages)) expect(source).toContain("errorPasswordUnchanged:");
  });
});
