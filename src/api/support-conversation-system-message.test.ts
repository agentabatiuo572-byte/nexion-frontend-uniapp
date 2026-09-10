import { describe, expect, it, vi } from "vitest";
import { createSupportApi } from "./support-api";

const notice = "会话已因用户闲置 5 分钟自动结束,可重新发起会话。";
function detail(type: string, senderType = "system", receiptStatus: unknown = null) {
  return {
    conversation: { conversationNo: "CV-ended", conversationType: type, status: "CLOSED", version: 2,
      ownerAgentName: "", unreadCount: 0, lastMessage: notice, lastMessageAt: "2026-09-01T00:00:00Z" },
    messages: [{ id: 1, senderType: "user", content: "Hello", createdAt: "2026-09-01T00:00:00Z", receiptStatus: null },
      { id: 2, senderType, content: notice, createdAt: "2026-09-01T00:05:00Z", receiptStatus }],
    historyTruncated: false, nextCursor: null,
  };
}

// Current App history excludes internal SYSTEM bodies. These synthetic SYSTEM
// fixtures test parser forward compatibility only, not backend visibility.
describe("conversation message parser compatibility", () => {
  it.each(["advisor", "support"])("accepts the first user message when creating a new %s conversation", async type => {
    const response = detail(type);
    response.conversation.status = "OPEN";
    response.messages = response.messages.slice(0, 1);
    const request = vi.fn(async () => response);
    const result = await createSupportApi({ request } as never).startConversation(type as "advisor" | "support", "Hello", "create-conversation-key");
    expect(result.messages[0]).toMatchObject({ sender: "user", text: "Hello", status: undefined });
    expect(result.sessionStatus).toBe("active");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", path: "/api/app/support/conversations",
      body: { conversationType: type.toUpperCase(), openingText: "Hello", clientMessageId: "create-conversation-key" } }));
  });

  it.each(["agent", "user"])("accepts sent and read receipts for %s messages", async sender => {
    for (const receipt of [undefined, null, "sent", "READ"]) {
      const response = detail("support", sender);
      response.messages[1].receiptStatus = receipt;
      const api = createSupportApi({ request: async () => response } as never);
      expect((await api.conversation("CV-ended")).messages[1].status).toBe(receipt == null ? undefined : receipt.toLowerCase());
    }
  });

  it.each([123, false, {}, "", "delivered"])("rejects malformed receipt %j", async receipt => {
    const api = createSupportApi({ request: async () => detail("support", "agent", receipt) } as never);
    await expect(api.conversation("CV-ended")).rejects.toThrow("SUPPORT_CONVERSATION_RESPONSE_INVALID");
  });
  it.each(["advisor", "support"])("parses a synthetic ended %s payload including a system notice", async type => {
    const api = createSupportApi({ request: vi.fn(async () => detail(type)) } as never);
    const conversation = await api.conversation("CV-ended");
    expect(conversation).toMatchObject({ type, status: "closed", sessionStatus: "closed", agentName: "Unassigned" });
    expect(conversation.messages).toEqual([
      expect.objectContaining({ sender: "user", text: "Hello" }),
      expect.objectContaining({ sender: "system", text: notice, status: undefined }),
    ]);
  });

  it("normalizes uppercase SYSTEM from the server", async () => {
    const api = createSupportApi({ request: async () => detail("advisor", "SYSTEM") } as never);
    expect((await api.conversation("CV-ended")).messages[1].sender).toBe("system");
  });

  it.each([["unknown", null], ["system", "read"]])("rejects unsupported sender/receipt %s %s", async (sender, receipt) => {
    const api = createSupportApi({ request: async () => detail("support", sender!, receipt) } as never);
    await expect(api.conversation("CV-ended")).rejects.toThrow("SUPPORT_CONVERSATION_RESPONSE_INVALID");
  });
});
