import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createDeveloperResourcesApi } from "./developer-resources-api";

describe("developer resources API", () => {
  it("lists server API keys and passes idempotency on create", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce([{ id: 1, keyId: "key-1", name: "build", prefix: "sk_live_abc", last4: "wxyz", status: "ACTIVE", source: "server", sourceEnvironment: "PRODUCTION", runId: "", createdAt: "2026-08-16T00:00:00Z" }])
      .mockResolvedValueOnce({ id: 1, keyId: "key-1", name: "build", prefix: "sk_live_abc", last4: "wxyz", status: "ACTIVE", source: "server", sourceEnvironment: "PRODUCTION", runId: "", createdAt: "2026-08-16T00:00:00Z", secret: "sk_live_secret" });
    const api = createDeveloperResourcesApi({ request } as unknown as ApiClient);
    await expect(api.listKeys()).resolves.toHaveLength(1);
    await expect(api.createKey("build", "idem-1")).resolves.toMatchObject({ secret: "sk_live_secret" });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ idempotencyKey: "idem-1" }));
  });

  it("rejects malformed webhook response instead of showing success", async () => {
    const request = vi.fn().mockResolvedValue([{ id: 1, name: "hook", url: "http://127.0.0.1", events: ["order.updated"], status: "ACTIVE", deliveryStatus: "NOT_DELIVERED", deliveryEnabled: false, source: "local" }]);
    await expect(createDeveloperResourcesApi({ request } as unknown as ApiClient).listWebhooks()).rejects.toMatchObject({ message: "DEVELOPER_WEBHOOK_RESPONSE_INVALID" });
  });

  it("carries stable idempotency keys on every remote mutation", async () => {
    const key = { id: 1, keyId: "key-1", name: "build", prefix: "sk_live_abc", last4: "wxyz", status: "REVOKED", source: "server", sourceEnvironment: "PRODUCTION", runId: "", createdAt: "2026-08-16T00:00:00Z" };
    const hook = { id: 2, name: "hook", url: "http://127.0.0.1", events: ["order.updated"], status: "ACTIVE", deliveryStatus: "NOT_DELIVERED", deliveryEnabled: false, source: "server", sourceEnvironment: "PRODUCTION", runId: "", createdAt: "2026-08-16T00:00:00Z" };
    const request = vi.fn().mockResolvedValueOnce(key).mockResolvedValueOnce(hook).mockResolvedValueOnce(undefined);
    const api = createDeveloperResourcesApi({ request } as unknown as ApiClient);
    await api.revokeKey(1, "idem-revoke");
    await api.updateWebhook(2, { name: "hook", url: hook.url, events: hook.events, rotateSecret: true }, "idem-rotate");
    await api.deleteWebhook(2, "idem-delete");
    expect(request.mock.calls.map(([input]) => input.idempotencyKey)).toEqual(["idem-revoke", "idem-rotate", "idem-delete"]);
  });

  it("accepts server delivery states instead of treating every endpoint as NOT_DELIVERED", async () => {
    const request = vi.fn().mockResolvedValue([{ id: 2, name: "hook", url: "https://hooks.example.com", events: ["order.updated"], status: "ACTIVE", deliveryStatus: "SUCCEEDED", deliveryEnabled: true, source: "server", sourceEnvironment: "PRODUCTION", runId: "", createdAt: "2026-08-17T00:00:00Z" }]);
    await expect(createDeveloperResourcesApi({ request } as unknown as ApiClient).listWebhooks()).resolves.toMatchObject([{ deliveryStatus: "SUCCEEDED", deliveryEnabled: true }]);
  });
});
