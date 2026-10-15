import { describe, expect, it, vi } from "vitest";
import { createRepurchaseApi } from "./repurchase-api";
import type { ApiClient } from "./api-client";

const response = (status: unknown) => ({ status, repurchaseCommandProtocol: 1, sourceEnvironment: "PRODUCTION", runId: "" });

describe("repurchase status read", () => {
  it.each(["SUCCEEDED", "FAILED", "PROCESSING", "UNKNOWN", "NOT_FOUND", "MISMATCH"])("reads %s using only authenticated GET and an existing key header", async (status) => {
    const request = vi.fn().mockResolvedValue(response(status));
    await expect(createRepurchaseApi({ request } as unknown as ApiClient).openStatus(100, "original-key")).resolves.toBe(status);
    expect(request).toHaveBeenCalledExactlyOnceWith({ method: "GET", authenticated: true,
      path: "/api/repurchase/orders/open-status?amountUsdt=100.000000", idempotencyKey: "original-key" });
  });

  it.each([{}, response("PENDING"), response({ toString: () => "FAILED" }),
    { ...response("FAILED"), repurchaseCommandProtocol: 2 },
    { ...response("FAILED"), sourceEnvironment: "SANDBOX" },
    { ...response("SUCCEEDED"), runId: "other-run" }])("rejects an invalid or foreign projection", async (value) => {
    const request = vi.fn().mockResolvedValue(value);
    await expect(createRepurchaseApi({ request } as unknown as ApiClient).openStatus(100, "original-key")).rejects.toThrow("REPURCHASE_RESPONSE_INVALID");
  });

  it("preserves a read failure and never dispatches malformed amount/key", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    const api = createRepurchaseApi({ request } as unknown as ApiClient);
    await expect(api.openStatus(100, "original-key")).rejects.toThrow("offline");
    request.mockClear();
    for (const amount of [NaN, Infinity, 0, -1]) await expect(api.openStatus(amount, "original-key")).rejects.toThrow();
    await expect(api.openStatus(100, "")).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
