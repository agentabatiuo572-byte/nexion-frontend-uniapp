import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client";
import { createSessionVault } from "./session-vault";

describe("API client session lifecycle", () => {
  it("fails a protected prefetch locally when no session exists without evicting a later login", async () => {
    const request = vi.fn();
    const onUnauthorized = vi.fn();
    const api = createApiClient({
      baseUrl: "http://127.0.0.1:8110",
      vault: createSessionVault(),
      transport: { request },
      onUnauthorized,
    });

    await expect(api.request({ path: "/api/payout-addresses" }))
      .rejects.toThrow("AUTH_SESSION_REQUIRED");
    expect(request).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("rotates an expired H5 access token through the HttpOnly cookie without a JavaScript refresh token", async () => {
    const vault = createSessionVault();
    vault.save({
      accessToken: "expired-access",
      refreshToken: "",
      tokenType: "Bearer",
      user: { userId: 3775, countryCode: "+86", phone: "18708173775", nickname: "NexGrid 3775", onboardingComplete: true },
      refreshCredentialMode: "cookie",
    });
    const request = vi.fn()
      .mockResolvedValueOnce({
        status: 401,
        data: { code: 401, message: "TOKEN_EXPIRED", data: null },
        headers: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          message: "success",
          data: {
            accessToken: "rotated-access",
            refreshToken: null,
            tokenType: "Bearer",
            user: { userId: 3775, countryCode: "+86", phone: "18708173775", nickname: "NexGrid 3775", onboardingComplete: true },
          },
        },
        headers: {},
      })
      .mockResolvedValueOnce({ status: 200, data: { code: 0, message: "success", data: { ok: true } }, headers: {} });
    const api = createApiClient({
      baseUrl: "http://127.0.0.1:8110",
      vault,
      transport: { request },
      refreshCredentialMode: "cookie",
    });

    await expect(api.request({ path: "/api/app/home/overview" })).resolves.toEqual({ ok: true });
    const refreshRequest = request.mock.calls[1]?.[0];
    expect(refreshRequest).toMatchObject({
      url: "http://127.0.0.1:8110/auth/users/refresh",
      method: "POST",
      withCredentials: true,
      headers: expect.objectContaining({ "X-Nexion-Refresh-Mode": "cookie" }),
    });
    expect(refreshRequest).not.toHaveProperty("body");
    expect(vault.read()).toMatchObject({
      accessToken: "rotated-access",
      refreshToken: "",
      refreshCredentialMode: "cookie",
    });
  });
});
