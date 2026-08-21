import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { createShareEventApi, type ShareEventRequest } from "./share-event-api";
import type { ApiClient } from "./api-client";

const request: ShareEventRequest = {
  eventId: "share-evt-001", channel: "telegram", surface: "share_sheet",
  sourceEnvironment: "PRODUCTION", runId: "",
};

function client(data: unknown): ApiClient {
  return { request: vi.fn().mockResolvedValue(data), upload: vi.fn(), refreshSession: vi.fn() } as unknown as ApiClient;
}

describe("share event API", () => {
  it("POSTs the authenticated share proof with a stable idempotency key", async () => {
    const apiClient = client({ eventId: request.eventId, questCode: "invite_friend", status: "COMPLETED",
      replay: false, serverCanonical: true, source: "nx_growth_quest_completion_fact",
      sourceEnvironment: "PRODUCTION", runId: "" });
    const result = await createShareEventApi(apiClient).record(request, "share-key-001");
    expect(result.questCode).toBe("invite_friend");
    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST", path: "/api/share/event", body: request, idempotencyKey: "share-key-001",
    }));
  });

  it("accepts the code-copy channel used by the invite card", async () => {
    const codeRequest: ShareEventRequest = { ...request, channel: "code" };
    const apiClient = client({ eventId: request.eventId, questCode: "invite_friend", status: "COMPLETED",
      replay: false, serverCanonical: true, source: "nx_growth_quest_completion_fact",
      sourceEnvironment: "PRODUCTION", runId: "" });
    await expect(createShareEventApi(apiClient).record(codeRequest, "share-key-code")).resolves.toMatchObject({
      eventId: request.eventId,
    });
  });

  it("rejects a production response carrying a sandbox RunID", async () => {
    const apiClient = client({ eventId: request.eventId, questCode: "invite_friend", status: "COMPLETED",
      replay: false, serverCanonical: true, source: "nx_growth_quest_completion_fact",
      sourceEnvironment: "SANDBOX", runId: "RUN-20260817-01" });
    await expect(createShareEventApi(apiClient).record(request, "share-key-002"))
      .rejects.toMatchObject({ kind: "protocol", message: "SHARE_EVENT_RESPONSE_INVALID" } satisfies Partial<ApiError>);
  });

  it("fails before transport when idempotency key is absent", async () => {
    const apiClient = client({});
    await expect(createShareEventApi(apiClient).record(request, ""))
      .rejects.toMatchObject({ kind: "protocol", message: "SHARE_IDEMPOTENCY_KEY_REQUIRED" });
    expect(apiClient.request).not.toHaveBeenCalled();
  });

  it("propagates a server failure so the share flow cannot claim success", async () => {
    const apiClient = {
      request: vi.fn().mockRejectedValue(new ApiError({ kind: "http", status: 503, message: "SHARE_EVENT_UNAVAILABLE" })),
      upload: vi.fn(), refreshSession: vi.fn(),
    } as unknown as ApiClient;
    await expect(createShareEventApi(apiClient).record(request, "share-key-003"))
      .rejects.toMatchObject({ kind: "http", status: 503 });
  });
});
