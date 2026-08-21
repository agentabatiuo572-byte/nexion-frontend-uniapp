import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProductNotificationApi } from "./product-notification-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

beforeEach(() => setCurrentCommerceSandboxRun(null));

describe("product notification API", () => {
  it("uses account-authenticated server endpoints and parses canonical response", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true,
      source: "nx_product",
      subscribed: true,
      revision: "2026-08-16T01:02:03",
      productNo: "stellarbox-pro-v2",
      releaseState: "E1_PHASE_NOT_REACHED",
      releasePhaseId: "P3",
      sourceEnvironment: "PRODUCTION",
      runId: "",
    });
    const api = createProductNotificationApi({ request } as never);

    await expect(api.subscribe("stellarbox-pro-v2")).resolves.toMatchObject({ serverCanonical: true, subscribed: true });
    expect(request).toHaveBeenCalledWith({ method: "POST", path: "/api/store/notifications/stellarbox-pro-v2" });
  });

  it("accepts only a run-scoped server sandbox response in sandbox mode", async () => {
    setCurrentCommerceSandboxRun("sandbox-run-20260816");
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true,
      source: "nx_product",
      subscribed: true,
      revision: "2026-08-16T01:02:03",
      productNo: "stellarbox-pro-v2",
      sourceEnvironment: "SANDBOX",
      runId: "sandbox-run-20260816",
    });
    const api = createProductNotificationApi({ request } as never, "dev");

    await expect(api.status("stellarbox-pro-v2")).resolves.toMatchObject({
      sourceEnvironment: "SANDBOX",
      runId: "sandbox-run-20260816",
    });
  });

  it("rejects a syntactically valid response from a previous sandbox run", async () => {
    setCurrentCommerceSandboxRun("sandbox-run-20260817");
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true,
      source: "nx_product",
      subscribed: true,
      revision: "2026-08-16T01:02:03",
      productNo: "stellarbox-pro-v2",
      sourceEnvironment: "SANDBOX",
      runId: "sandbox-run-20260816",
    });
    const api = createProductNotificationApi({ request } as never, "dev");

    await expect(api.status("stellarbox-pro-v2")).rejects.toMatchObject({
      message: "PRODUCT_NOTIFICATION_RESPONSE_INVALID",
    });
  });

  it("rejects a production or malformed scope while running in sandbox", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true,
      source: "nx_product",
      subscribed: true,
      revision: "1",
      productNo: "stellarbox-pro-v2",
      sourceEnvironment: "PRODUCTION",
      runId: "",
    });
    const api = createProductNotificationApi({ request } as never, "dev");

    await expect(api.status("stellarbox-pro-v2")).rejects.toMatchObject({
      message: "PRODUCT_NOTIFICATION_RESPONSE_INVALID",
    });
  });

  it("does not accept a non-canonical success payload", async () => {
    const request = vi.fn().mockResolvedValue({ source: "mock", subscribed: true });
    const api = createProductNotificationApi({ request } as never);

    await expect(api.subscribe("stellarbox-pro-v2")).rejects.toMatchObject({
      message: "PRODUCT_NOTIFICATION_RESPONSE_INVALID",
    });
  });
});
