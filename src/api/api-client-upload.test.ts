import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client";
import { createSessionVault } from "./session-vault";

describe("API multipart upload", () => {
  it("sends the in-memory bearer and idempotency key and decodes uni.uploadFile JSON", async () => {
    const vault = createSessionVault();
    vault.save({
      accessToken: "access",
      refreshToken: "refresh",
      tokenType: "Bearer",
      user: { userId: 42, countryCode: "+84", phone: "912345678", nickname: "NexGrid 5678", onboardingComplete: true },
    });
    const upload = vi.fn().mockResolvedValue({
      status: 200,
      data: JSON.stringify({ code: 0, message: "OK", data: { status: "UPDATED" } }),
      headers: {},
    });
    const api = createApiClient({
      baseUrl: "http://127.0.0.1:8110",
      vault,
      transport: { request: vi.fn(), upload },
    });

    await expect(api.upload({
      path: "/api/app/profile/avatar",
      filePath: "blob:avatar",
      idempotencyKey: "avatar-key",
      formData: { clientUploadId: "upload-12345678" },
    })).resolves.toEqual({ status: "UPDATED" });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({
      url: "http://127.0.0.1:8110/api/app/profile/avatar",
      filePath: "blob:avatar",
      name: "file",
      headers: { Authorization: "Bearer access", "Idempotency-Key": "avatar-key" },
      formData: { clientUploadId: "upload-12345678" },
    }));
  });
  it("downloads private bytes with bearer and rejects stale account results", async () => {
    const vault = createSessionVault();
    const identity = { userId: 42, countryCode: "+84", phone: "912345678", nickname: "Client", onboardingComplete: true };
    vault.save({ accessToken: "access", refreshToken: "refresh", tokenType: "Bearer", user: identity });
    let finish!: (value: { status: number; filePath: string }) => void;
    const download = vi.fn(() => new Promise<{ status: number; filePath: string }>(resolve => { finish = resolve; }));
    const api = createApiClient({ baseUrl: "http://127.0.0.1:8110", vault, transport: { request: vi.fn(), download } });
    const pending = api.download!({ path: "/api/app/support/attachments/private-1/content" });
    expect(download).toHaveBeenCalledWith(expect.objectContaining({
      url: "http://127.0.0.1:8110/api/app/support/attachments/private-1/content",
      headers: { Authorization: "Bearer access", "Cache-Control": "no-store" },
    }));
    vault.clear();
    finish({ status: 200, filePath: "private-temp-file" });
    await expect(pending).rejects.toThrow("SESSION_CHANGED_DURING_REQUEST");
  });
});
