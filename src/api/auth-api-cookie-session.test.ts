import { describe, expect, it, vi } from "vitest";
import { createAuthApi } from "./auth-api";
import { createSessionVault } from "./session-vault";

const user = { userId: 3775, countryCode: "+86", phone: "18708173775", nickname: "Nexion 3775" };
const cookieSession = { accessToken: "access", refreshToken: null, tokenType: "Bearer", user };

describe("H5 HttpOnly refresh-cookie session", () => {
  it("accepts a login response without exposing the refresh credential to JavaScript", async () => {
    const request = vi.fn().mockResolvedValue(cookieSession);
    const vault = createSessionVault();
    const auth = createAuthApi({ request } as never, vault, { refreshCredentialMode: "cookie" });

    await expect(auth.login({ countryCode: "+86", phone: user.phone, password: "secret" }))
      .resolves.toMatchObject({ kind: "authenticated", user });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      path: "/auth/users/login",
      headers: { "X-Nexion-Refresh-Mode": "cookie" },
    }));
    expect(vault.read()).toMatchObject({ refreshCredentialMode: "cookie", refreshToken: "", user });
  });

  it("restores an empty in-memory vault from the HttpOnly cookie", async () => {
    const request = vi.fn().mockResolvedValue(cookieSession);
    const vault = createSessionVault();
    const auth = createAuthApi({ request } as never, vault, { refreshCredentialMode: "cookie" });

    await expect(auth.restore()).resolves.toMatchObject({ accessToken: "access", user });
    expect(request).toHaveBeenCalledWith({
      path: "/auth/users/refresh",
      method: "POST",
      authenticated: false,
      headers: { "X-Nexion-Refresh-Mode": "cookie" },
    });
    expect(vault.read()?.accessToken).toBe("access");
  });

  it("logs out through the cookie and never copies a refresh token into the request body", async () => {
    const request = vi.fn().mockResolvedValue(cookieSession);
    const vault = createSessionVault();
    const auth = createAuthApi({ request } as never, vault, { refreshCredentialMode: "cookie" });
    await auth.restore();
    request.mockClear();

    await auth.logout();

    expect(request).toHaveBeenCalledWith({
      path: "/auth/users/logout",
      method: "POST",
      authenticated: false,
      headers: { "X-Nexion-Refresh-Mode": "cookie" },
    });
    expect(vault.read()).toBeNull();
  });
});
