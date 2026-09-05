import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const runtime = vi.hoisted(() => ({
  remoteApiEnabled: true,
  supportApi: {
    authorityRevision: vi.fn(async () => "run-1"),
    commandResult: vi.fn(async () => null),
    conversations: vi.fn(),
    conversation: vi.fn(),
    markConversationRead: vi.fn(),
    startConversation: vi.fn(),
    replyConversation: vi.fn(),
    convertConversationToTicket: vi.fn(),
    conversationCategories: vi.fn(),
  },
}));

vi.mock("@/api/runtime", () => runtime);

const { useConversations } = await import("./conversations");

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  runtime.supportApi.authorityRevision.mockResolvedValue("run-1");
  runtime.supportApi.commandResult.mockResolvedValue(null);
  runtime.supportApi.conversationCategories.mockResolvedValue({ advisor: true, support: true, ai: true });
});

describe("conversation list refresh generation fence", () => {
  it("does not let an older failure overwrite a newer successful refresh", async () => {
    const older = deferred<{ items: [] }>();
    const newer = deferred<{ items: [] }>();
    runtime.supportApi.conversations
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const store = useConversations();

    const first = store.refresh();
    await vi.waitFor(() => expect(runtime.supportApi.conversations).toHaveBeenCalledTimes(1));
    const second = store.refresh();
    await vi.waitFor(() => expect(runtime.supportApi.conversations).toHaveBeenCalledTimes(2));

    newer.resolve({ items: [] });
    await expect(second).resolves.toBeUndefined();
    older.reject(new Error("older request failed"));
    await expect(first).rejects.toThrow("older request failed");

    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("rejects a create result that belongs to the previously signed-in account", async () => {
    const created = deferred<any>();
    runtime.supportApi.startConversation.mockReturnValue(created.promise);
    const store = useConversations();
    const pending = store.startConversation("support", "hello");
    await vi.waitFor(() => expect(runtime.supportApi.startConversation).toHaveBeenCalledTimes(1));

    store.bindAccount("account-b");
    created.resolve({ id: "account-a-conversation", type: "support", version: 1, lastTs: 1, messages: [] });

    await expect(pending).rejects.toThrow("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    expect(store.conversations).toEqual([]);
  });

  it("reports an overtaken category request as stale without overwriting the newer PC truth", async () => {
    const older = deferred<any>();
    const newer = deferred<any>();
    runtime.supportApi.conversationCategories
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const store = useConversations();

    const first = store.refreshCategories();
    const second = store.refreshCategories();
    newer.resolve({ advisor: true, support: true, ai: false });
    await expect(second).resolves.toBe("applied");
    older.resolve({ advisor: false, support: false, ai: true });
    await expect(first).resolves.toBe("stale");

    expect(store.categoryAvailability).toEqual({ advisor: true, support: true, ai: false });
  });

  it.each(["reply", "ticket"] as const)("never submits a stale opened conversation after an account switch (%s)", async (operation) => {
    const opened = deferred<any>();
    runtime.supportApi.conversation.mockReturnValue(opened.promise);
    const store = useConversations();
    store.bindAccount("account-a");

    const pending = operation === "reply"
      ? store.sendUser("account-a-conversation", "hello")
      : store.convertToTicket("account-a-conversation", "technical", "Need help");
    await vi.waitFor(() => expect(runtime.supportApi.conversation).toHaveBeenCalledTimes(1));

    store.bindAccount("account-b");
    opened.resolve({
      id: "account-a-conversation", type: "support", status: "open", version: 1,
      lastTs: 1, messages: [], unread: 0, agentName: "Agent", roleKey: "roleSupport",
      avatarTint: "blue", lastMessage: "", sessionStatus: "active",
    });

    await expect(pending).rejects.toThrow("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    expect(runtime.supportApi.replyConversation).not.toHaveBeenCalled();
    expect(runtime.supportApi.convertConversationToTicket).not.toHaveBeenCalled();
  });
});
