import { expect, test } from "vitest";
import { createAuthApi } from "./auth-api";
import { createSessionVault } from "./session-vault";

const response = (overrides: Record<string, unknown> = {}) => ({
  accessToken: "access", refreshToken: "refresh", tokenType: "Bearer",
  user: { userId: 8101, countryCode: "+1", phone: "900123456789", nickname: "Google Sandbox" },
  source: "mock", sandbox: true, ...overrides,
});

test("OAuth exchange posts an explicit sandbox subject and consumes server provenance", async () => {
  let request: unknown;
  const api = createAuthApi({
    request: async (value: unknown) => { request = value; return response(); },
  } as never, createSessionVault());

  await expect(api.oauthExchange({
    provider: "GOOGLE", mode: "SANDBOX_MOCK", externalSubject: "app-google-sandbox",
  })).resolves.toMatchObject({ source: "mock", sandbox: true, user: { userId: 8101 } });
  expect(request).toMatchObject({
    path: "/auth/users/oauth/exchange", method: "POST", authenticated: false,
    body: { provider: "GOOGLE", mode: "SANDBOX_MOCK", externalSubject: "app-google-sandbox" },
  });
});

test.each(["PASSKEY", "TELEGRAM"] as const)("%s uses the same explicit isolated sandbox exchange", async (provider) => {
  let request: any;
  const api = createAuthApi({ request: async (value: unknown) => { request = value; return response(); } } as never,
    createSessionVault());

  await expect(api.oauthExchange({
    provider, mode: "SANDBOX_MOCK", externalSubject: `app-${provider.toLowerCase()}-sandbox`,
  })).resolves.toMatchObject({ source: "mock", sandbox: true });
  expect(request.body.provider).toBe(provider);
});

test("OAuth exchange rejects a response that attempts to masquerade as a provider session", async () => {
  const api = createAuthApi({ request: async () => response({ source: "provider", sandbox: false }) } as never, createSessionVault());
  await expect(api.oauthExchange({
    provider: "APPLE", mode: "PROVIDER", externalSubject: "provider-subject",
  })).rejects.toThrow("OAUTH_RESPONSE_INVALID");
});

test("a late OAuth response cannot overwrite a newer session epoch", async () => {
  let resolve: ((value: unknown) => void) | undefined;
  const vault = createSessionVault();
  const api = createAuthApi({ request: async () => new Promise((done) => { resolve = done; }) } as never, vault);
  const pending = api.oauthExchange({
    provider: "GOOGLE", mode: "SANDBOX_MOCK", externalSubject: "app-google-sandbox",
  });
  vault.save({
    accessToken: "new-access", refreshToken: "new-refresh", tokenType: "Bearer",
    user: { userId: 8102, countryCode: "+1", phone: "900999999999", nickname: "New" },
  });
  resolve?.(response());
  await expect(pending).rejects.toThrow("SESSION_CHANGED_DURING_AUTH");
  expect(vault.read()?.user.userId).toBe(8102);
});
