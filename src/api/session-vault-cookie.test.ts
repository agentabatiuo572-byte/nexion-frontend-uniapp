import { describe, expect, it, vi } from "vitest";
import { createSessionVault } from "./session-vault";

describe("HttpOnly cookie session vault", () => {
  it("keeps the access token in memory and persists no cookie credential marker", () => {
    const storage = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
    const vault = createSessionVault(storage);

    vault.save({
      accessToken: "memory-only-access",
      refreshToken: "",
      tokenType: "Bearer",
      user: { userId: 3775, countryCode: "+86", phone: "18708173775", nickname: "Nexion 3775" },
      refreshCredentialMode: "cookie",
    });

    expect(vault.read()?.accessToken).toBe("memory-only-access");
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledOnce();
  });
});
