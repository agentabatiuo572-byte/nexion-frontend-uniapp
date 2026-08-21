import { describe, expect, it, beforeEach, vi } from "vitest";
import { createHowContentApi, HOW_CONTENT_KEYS, type HowContentDocument } from "./how-content-api";

const base = (contentKey: HowContentDocument["contentKey"], locale = "en"): HowContentDocument => ({
  contentKey,
  version: "2026.08.17.1",
  locale,
  status: "PUBLISHED",
  blocks: [
    { id: "intro", kind: "text", title: "Intro", body: "Server-owned explanation" },
    { id: "period", kind: "ruleRef", title: "Settlement", body: "{value}", ref: { source: "canonical", key: "team.ui.F.binary.settlePeriod", version: "F3.2026.08.17" } },
  ],
  source: "server",
  sourceEnvironment: "PRODUCTION",
  runId: "",
});

describe("how content API", () => {
  beforeEach(() => {});

  it("supports the six published content keys", async () => {
    expect(HOW_CONTENT_KEYS).toHaveLength(6);
    for (const contentKey of HOW_CONTENT_KEYS) {
      const request = vi.fn().mockResolvedValue(base(contentKey));
      const value = await createHowContentApi({ request } as never, "prod").published(contentKey, "en");
      expect(value.contentKey).toBe(contentKey);
      expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: `/api/content/how-it-works/${contentKey}?locale=en` }));
    }
  });

  it("fails closed on drafts, malformed blocks, or provenance mismatch", async () => {
    const draft = { ...base("genesis-how"), status: "DRAFT" };
    await expect(createHowContentApi({ request: vi.fn().mockResolvedValue(draft) } as never, "prod").published("genesis-how", "en"))
      .rejects.toThrow("HOW_CONTENT_RESPONSE_INVALID");
    const malformed = { ...base("genesis-how"), blocks: [{ id: "x", kind: "ruleRef", title: "x", body: "x" }] };
    await expect(createHowContentApi({ request: vi.fn().mockResolvedValue(malformed) } as never, "prod").published("genesis-how", "en"))
      .rejects.toThrow("HOW_CONTENT_RESPONSE_INVALID");
    const wrongEnv = { ...base("genesis-how"), sourceEnvironment: "SANDBOX", runId: "other-run" };
    await expect(createHowContentApi({ request: vi.fn().mockResolvedValue(wrongEnv) } as never, "prod").published("genesis-how", "en"))
      .rejects.toThrow("HOW_CONTENT_RESPONSE_INVALID");
  });

  it("accepts the production authority in development and rejects non-empty run ids", async () => {
    const request = vi.fn().mockResolvedValue(base("team-binary-how"));
    await expect(createHowContentApi({ request } as never, "dev").published("team-binary-how", "zh-CN")).resolves.toMatchObject({ sourceEnvironment: "PRODUCTION" });
    await expect(createHowContentApi({ request: vi.fn().mockResolvedValue({ ...base("team-binary-how"), runId: "development-run-stale" }) } as never, "dev").published("team-binary-how", "en"))
      .rejects.toThrow("HOW_CONTENT_RESPONSE_INVALID");
  });
});
