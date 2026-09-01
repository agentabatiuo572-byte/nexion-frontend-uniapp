import { describe, expect, it } from "vitest";

const source = (import.meta.glob("./messages.vue", { query: "?raw", import: "default", eager: true })["./messages.vue"] ?? "") as string;

describe("conversation-center refresh failure contract", () => {
  it("shows a retryable failure before the true empty state", () => {
    expect(source).toContain("convStore.error");
    expect(source).toContain("retryConversations");
    expect(source).toContain("t.conversations.loadError");
    expect(source).toContain("t.conversations.retry");
    expect(source.indexOf("convStore.error")).toBeLessThan(source.indexOf("rows.length === 0"));
  });

  it("keeps rows visible when a later refresh fails", () => {
    expect(source).toMatch(/v-if="selectedType !== 'ai' && convStore\.error && rows\.length === 0"/);
    expect(source).toMatch(/v-else-if="rows\.length === 0"/);
  });

  it("loads Nova history on first entry so the AI row has a remote preview", () => {
    expect(source).toContain('import { novaAiApi, remoteApiEnabled } from "@/api/runtime"');
    expect(source).toContain("nova.ensureRemoteHistory(app.accountKey, () => novaAiApi.history())");
  });
});
