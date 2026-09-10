import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const harness = vi.hoisted(() => {
  class FakeRealtime {
    readonly start = vi.fn();
    readonly stop = vi.fn();
    readonly watch = vi.fn();
    readonly typing = vi.fn();
    constructor(readonly options: any) { harness.instances.push(this); }
  }
  return { instances: [] as FakeRealtime[], FakeRealtime, setCurrent: vi.fn(), socket: vi.fn() };
});
const runtime = vi.hoisted(() => ({
  remoteApiEnabled: true,
  apiRuntimeConfig: { baseUrl: "http://127.0.0.1:8110" },
  apiClient: { request: vi.fn(async () => ({ ticket: "once" })) },
  supportApi: {
    authorityRevision: vi.fn(async () => "run-1"), commandResult: vi.fn(async () => null),
    conversations: vi.fn(async () => ({ items: [] as any[] })), conversation: vi.fn(), markConversationRead: vi.fn(),
    startConversation: vi.fn(), replyConversation: vi.fn(), convertConversationToTicket: vi.fn(), conversationCategories: vi.fn(),
  },
}));
vi.mock("@/api/runtime", () => runtime);
vi.mock("@/api/conversation-realtime", () => ({ ConversationRealtime: harness.FakeRealtime }));
vi.mock("@/api/app-conversation-realtime", () => ({ createUniRealtimeSocket: harness.socket, setAppConversationRealtime: harness.setCurrent }));
const { useConversations } = await import("./conversations");
const row = (unread = 0) => ({
  id: "CV-1", type: "support", status: "open", version: 1, lastTs: 2, unread,
  messages: [{ id: "2", sender: "agent", text: "hello", ts: 2, status: "sent" }],
  historyTruncated: false, historyNextCursor: null, agentName: "Agent", roleKey: "roleSupport",
  avatarTint: "blue", lastMessage: "hello", sessionStatus: "active",
});
beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks(); harness.instances.splice(0);
  runtime.supportApi.conversations.mockResolvedValue({ items: [row()] });
  runtime.supportApi.conversation.mockResolvedValue(row());
  runtime.supportApi.markConversationRead.mockResolvedValue(row(0));
});

describe("conversation realtime lifecycle", () => {
  it("singleflights the user transport and fences callbacks from a stopped same-account instance", async () => {
    const store = useConversations();
    store.bindAccount("user:1");
    store.startRealtime();
    store.startRealtime();
    expect(harness.instances).toHaveLength(1);
    const old = harness.instances[0];
    await old.options.ticket();
    expect(runtime.apiClient.request).toHaveBeenCalledWith({ method: "POST", path: "/api/app/support/realtime-ticket" });

    store.stopRealtime();
    store.startRealtime();
    const fresh = harness.instances[1];
    fresh.options.state(true);
    fresh.options.presence({ conversationNo: "CV-1", online: true, typing: true, expiresIn: 1000 });
    old.options.state(false);
    old.options.presence({ conversationNo: "CV-1", online: false, typing: false, expiresIn: 1000 });
    await old.options.reconcile({ aborted: false });

    expect(old.stop).toHaveBeenCalledOnce();
    expect(store.realtimeReady).toBe(true);
    expect(store.onlineIds["CV-1"]).toBe(true);
    expect(store.typingIds["CV-1"]).toBe(true);
    expect(runtime.supportApi.conversations).not.toHaveBeenCalled();
  });

  it("destroys the old instance when the account epoch changes", () => {
    const store = useConversations();
    store.bindAccount("user:1");
    store.startRealtime();
    const old = harness.instances[0];
    store.bindAccount("user:2");
    expect(old.stop).toHaveBeenCalledOnce();
    store.startRealtime();
    expect(harness.instances).toHaveLength(2);
  });

  it("reconciles watched snapshots without duplicate rows and retains read authority", async () => {
    const store = useConversations();
    store.bindAccount("user:1");
    store.startRealtime();
    const socket = harness.instances[0];
    store.watchRealtime("CV-1");
    await socket.options.reconcile({ aborted: false });
    await socket.options.reconcile({ aborted: false });
    expect(store.conversations).toHaveLength(1);
    runtime.supportApi.conversation.mockResolvedValueOnce(row(1));
    await store.open("CV-1");
    expect(runtime.supportApi.markConversationRead).toHaveBeenCalledWith(expect.objectContaining({ id: "CV-1" }), 2);
  });

  it("routes typing and clears current presence on stop", () => {
    const store = useConversations();
    store.bindAccount("user:1");
    store.startRealtime();
    const socket = harness.instances[0];
    store.watchRealtime("CV-1");
    store.setTyping(true);
    expect(socket.typing).toHaveBeenCalledWith(true);
    socket.options.presence({ conversationNo: "CV-1", online: true, typing: true, expiresIn: 1000 });
    expect(store.onlineIds["CV-1"]).toBe(true);
    store.stopRealtime();
    expect(store.onlineIds).toEqual({});
    expect(store.typingIds).toEqual({});
  });
  it("keeps loading clear when a stopped same-account reconcile resumes", async () => {
    const store = useConversations();
    store.bindAccount("user:1");
    await Promise.resolve();

    let release!: (runId: string) => void;
    runtime.supportApi.authorityRevision.mockImplementationOnce(
      () => new Promise(resolve => { release = resolve; }),
    );
    store.startRealtime();
    const old = harness.instances[0];
    const reconciling = old.options.reconcile({ aborted: false });

    await Promise.resolve();
    expect(store.loading).toBe(true);
    store.stopRealtime();
    store.startRealtime();
    release("run-1");
    await reconciling;

    expect(store.loading).toBe(false);
  });

  it("does not let an old read failure overwrite a same-account restart", async () => {
    const store = useConversations();
    store.bindAccount("user:1");
    await Promise.resolve();

    let rejectRead!: (cause: Error) => void;
    runtime.supportApi.conversation.mockResolvedValueOnce(row(1));
    runtime.supportApi.markConversationRead.mockImplementationOnce(
      () => new Promise((_, reject) => { rejectRead = reject; }),
    );
    store.startRealtime();
    const old = harness.instances[0];
    store.watchRealtime("CV-1");
    const reconciling = old.options.reconcile({ aborted: false });

    await vi.waitFor(() => expect(runtime.supportApi.markConversationRead).toHaveBeenCalledOnce());
    store.stopRealtime();
    store.startRealtime();
    rejectRead(new Error("READ_STALE"));
    await reconciling;

    expect(store.error).toBe(null);
    expect(runtime.supportApi.conversation).toHaveBeenCalledTimes(1);
  });
  it("keeps new refresh loading owned by the newer realtime instance", async () => {
    const store = useConversations();
    store.bindAccount("user:1");
    await Promise.resolve();

    let releaseOld!: (runId: string) => void;
    let releaseFresh!: (runId: string) => void;
    runtime.supportApi.authorityRevision
      .mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { releaseFresh = resolve; }));

    store.startRealtime();
    const old = harness.instances[0];
    const oldReconciling = old.options.reconcile({ aborted: false });
    await Promise.resolve();
    store.stopRealtime();
    store.startRealtime();
    const fresh = harness.instances[1];
    const freshReconciling = fresh.options.reconcile({ aborted: false });
    await Promise.resolve();

    releaseOld("run-old");
    await oldReconciling;
    expect(store.loading).toBe(true);
    releaseFresh("run-fresh");
    await freshReconciling;
    expect(store.loading).toBe(false);
  });
  it("does not publish an old error after a fallback read settles post-restart", async () => {
    const store = useConversations();
    store.bindAccount("user:1");
    await Promise.resolve();

    let releaseFallback!: (value: ReturnType<typeof row>) => void;
    const fallback = new Promise<ReturnType<typeof row>>(resolve => { releaseFallback = resolve; });
    runtime.supportApi.conversation
      .mockResolvedValueOnce(row(1))
      .mockImplementationOnce(() => fallback);
    runtime.supportApi.markConversationRead.mockRejectedValueOnce(new Error("READ_TIMEOUT"));

    store.startRealtime();
    const old = harness.instances[0];
    store.watchRealtime("CV-1");
    const reconciling = old.options.reconcile({ aborted: false });

    await vi.waitFor(() => expect(runtime.supportApi.conversation).toHaveBeenCalledTimes(2));
    store.stopRealtime();
    store.startRealtime();
    releaseFallback(row(0));
    await reconciling;

    expect(store.error).toBe(null);
  });
});
