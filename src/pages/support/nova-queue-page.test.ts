// @ts-expect-error Node-only test harness; App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as vue from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNova } from "@/store/nova";
import { zh } from "@/i18n/messages/zh";
import * as thinking from "@/lib/nova-thinking";
import * as failure from "@/lib/nova-failure";
import * as limiter from "@/lib/send-limiter";
import * as secureId from "@/lib/secure-command-id";
import * as format from "@/i18n/format";
import { ApiError } from "@/api/errors";

// Execute the actual SFC script with transport/lifecycle boundaries substituted.
// This tests the page worker, not a second implementation of its algorithm.
const source = readFileSync(new URL("./chat.vue", import.meta.url), "utf8").split('<script setup lang="ts">')[1].split("</script>")[0];
const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function mount() {
  const hooks: Record<string, (...args: any[]) => any> = {};
  const app = vue.reactive({ accountKey: "account-a", visibleDevices: [], earnings: { today: 0 } });
  const api = { status: vi.fn(async () => ({ available: true })),
    history: vi.fn(async () => ({ conversationId: null, messages: [] })), chat: vi.fn() };
  const modules: Record<string, unknown> = {
    vue: { ...vue, onUnmounted: (fn: () => void) => { hooks.unmount = fn; } },
    "@dcloudio/uni-app": Object.fromEntries(["onLoad", "onUnload", "onShow", "onHide"].map(name => [name, (fn: () => void) => { hooks[name] = fn; }])),
    "@/i18n/use-t": { useT: () => vue.ref(zh) },
    "@/i18n/format": format,
    "@/lib/route": { navTo: vi.fn(), navBack: vi.fn() },
    "@/lib/send-limiter": limiter,
    "@/lib/device-preview": { h5DevicePreviewStatusBarHeight: () => 0 },
    "@/lib/hashpower": { isDeviceOnline: () => false },
    "@/store/conversations": { useConversations: () => ({
      get: () => undefined,
      refreshCategories: async () => "applied",
      categoryEnabled: () => true,
    }) },
    "@/store/nova": { useNova },
    "@/store/app": { useApp: () => app },
    "@/store/ui": { toast: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }, confirm: async () => true,
      useUI: () => ({ clearConfirmsBy: vi.fn() }) },
    "@/mock/nova-templates": {},
    "@/api/runtime": { novaAiApi: api, remoteApiEnabled: true },
    "@/lib/nova-failure": failure,
    "@/store/locale": { useLocaleStore: () => ({ code: "zh" }) },
    "@/lib/secure-command-id": secureId,
    "@/lib/nova-thinking": thinking,
  };
  const page = new Function("require", "exports", script + "; return { onSend, onQueueAction, onQueueSave, onStartNewConversation, threadMessages, cleanup };")(
    (name: string) => {
      if (name.endsWith(".vue")) return {};
      if (!(name in modules)) throw new Error(`Unmocked dependency: ${name}`);
      return modules[name];
    }, {},
  );
  hooks.onLoad({ type: "ai" });
  return { page, hooks, app, api, nova: useNova() };
}

beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("real Nova page queue worker", () => {
  it("waits for canonical history before sending the first question", async () => {
    const { page, hooks, api, nova } = mount();
    const history = deferred<{ conversationId: string; messages: Array<{ id: string; sender: "nova"; text: string; ts: number }> }>();
    api.history.mockReturnValue(history.promise as never);
    api.chat.mockResolvedValue({ reply: "new answer" });

    const showing = hooks.onShow();
    const sending = page.onSend("new question");
    expect(api.chat).not.toHaveBeenCalled();
    expect(nova.messages).toEqual([]);

    history.resolve({
      conversationId: "8c12eaf3-744d-405e-b2fb-64b3d81267be",
      messages: [{ id: "old:nova", sender: "nova", text: "old answer", ts: 100 }],
    });
    await showing;
    await sending;

    expect(api.chat).toHaveBeenCalledTimes(1);
    expect(api.chat.mock.calls[0][0].conversationId)
      .toBe("8c12eaf3-744d-405e-b2fb-64b3d81267be");
    expect(nova.messages.map(message => message.text)).toEqual(["old answer", "new question"]);
    page.cleanup();
  });

  it("does not move a draft into a new conversation while history is loading", async () => {
    const { page, hooks, api, nova } = mount();
    const history = deferred<{ conversationId: string; messages: Array<{ id: string; sender: "nova"; text: string; ts: number }> }>();
    api.history.mockReturnValue(history.promise as never);
    api.chat.mockResolvedValue({ reply: "new answer" });
    const restore = vi.fn();

    const showing = hooks.onShow();
    const sending = page.onSend("old-conversation draft", restore);
    await page.onStartNewConversation();
    history.resolve({
      conversationId: "8c12eaf3-744d-405e-b2fb-64b3d81267be",
      messages: [{ id: "old:nova", sender: "nova", text: "old answer", ts: 100 }],
    });
    await showing;
    await sending;

    expect(restore).toHaveBeenCalledOnce();
    expect(api.chat).not.toHaveBeenCalled();
    expect(nova.messages).toEqual([]);
    page.cleanup();
  });

  it("limits actual dispatch while keeping input, and does not inherit another account's quota", async () => {
    const { page, hooks, api, nova, app } = mount();
    await hooks.onShow(); api.chat.mockResolvedValue({ reply: "answer" });
    for (let n = 0; n < 5; n++) {
      await page.onSend(`question-${n}`);
      await vi.advanceTimersByTimeAsync(1800);
    }
    await page.onSend("sixth");
    expect(api.chat).toHaveBeenCalledTimes(5);
    expect(nova.pendingRemote[0].delivery).toBe("queued");
    app.accountKey = "account-b";
    await vi.advanceTimersByTimeAsync(0);
    await page.onSend("first-b");
    expect(api.chat).toHaveBeenCalledTimes(6);
    expect(api.chat.mock.calls[5][0].message).toBe("first-b");
    page.cleanup();
    await vi.advanceTimersByTimeAsync(15000);
    expect(api.chat).toHaveBeenCalledTimes(6);
  });
  it("serializes two immediate questions, keeps the response floor and anchors answers", async () => {
    const { page, hooks, api, nova } = mount();
    await hooks.onShow();
    api.chat.mockImplementation(async (request) => ({ reply: `answer:${request.message}` }));
    await page.onSend("one"); await page.onSend("two");
    expect(api.chat).toHaveBeenCalledTimes(1);
    expect(nova.messages.map(m => m.text)).toEqual(["one", "two"]);
    expect(page.threadMessages.value[1].queue.label).toContain("1");
    await vi.advanceTimersByTimeAsync(1799);
    expect(api.chat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.chat).toHaveBeenCalledTimes(2);
    expect(nova.messages.map(m => m.text)).toEqual(["one", "answer:one", "two"]);
    await vi.advanceTimersByTimeAsync(1800);
    expect(nova.messages.map(m => m.text)).toEqual(["one", "answer:one", "two", "answer:two"]);
    page.cleanup();
  });

  it("pauses on error; retry keeps turn ID and resumes the waiting question", async () => {
    const { page, hooks, api, nova } = mount();
    await hooks.onShow();
    const first = deferred(); api.chat.mockReturnValueOnce(first.promise).mockResolvedValue({ reply: "answer" });
    await page.onSend("one"); await page.onSend("two");
    first.reject(new ApiError({ kind: "http", message: "NOVA_AI_BUSY", status: 429 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(nova.pendingRemote[0].failure).toBe("busy");
    expect(api.chat).toHaveBeenCalledTimes(1);
    page.onQueueAction(nova.pendingRemote[0].turnId, "retry");
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.chat.mock.calls[1][0].turnId).toBe(api.chat.mock.calls[0][0].turnId);
    await vi.advanceTimersByTimeAsync(3600);
    expect(api.chat).toHaveBeenCalledTimes(3);
    expect(nova.pendingRemote).toHaveLength(0);
    page.cleanup();
  });

  it("retains interrupted work, aborts the old call, and rejects a late answer after retry", async () => {
    const { page, hooks, api, nova } = mount();
    await hooks.onShow();
    const old = deferred(); api.chat.mockReturnValueOnce(old.promise).mockResolvedValue({ reply: "retried" });
    await page.onSend("one"); await page.onSend("two");
    hooks.onHide();
    expect(api.chat.mock.calls[0][1].aborted).toBe(true);
    await hooks.onShow();
    expect(nova.pendingRemote).toHaveLength(2);
    page.onQueueAction(nova.pendingRemote[0].turnId, "retry");
    await vi.advanceTimersByTimeAsync(1000);
    old.resolve({ reply: "stale" });
    await vi.advanceTimersByTimeAsync(3600);
    expect(nova.messages.some(m => m.text === "stale")).toBe(false);
    expect(api.chat.mock.calls[1][0].turnId).toBe(api.chat.mock.calls[0][0].turnId);
    page.cleanup();
  });

  it("editing blocks dispatch until saved, cancellation removes a waiting bubble, overflow restores draft", async () => {
    const { page, hooks, api, nova } = mount();
    await hooks.onShow(); api.chat.mockResolvedValue({ reply: "answer" });
    for (const text of ["one", "two", "three", "four"]) await page.onSend(text);
    const restore = vi.fn(); await page.onSend("five", restore);
    expect(restore).toHaveBeenCalledOnce();
    const second = nova.pendingRemote[1].turnId;
    page.onQueueAction(second, "edit");
    page.onQueueAction(nova.pendingRemote[2].turnId, "cancel");
    await vi.advanceTimersByTimeAsync(1800);
    expect(api.chat).toHaveBeenCalledTimes(1);
    page.onQueueSave(second, "changed");
    expect(api.chat.mock.calls[1][0].message).toBe("changed");
    expect(nova.messages.some(m => m.text === "three")).toBe(false);
    page.cleanup();
  });

  it("discards old responses and pending text across account and new-conversation boundaries", async () => {
    const { page, hooks, api, nova, app } = mount();
    await hooks.onShow(); const old = deferred(); api.chat.mockReturnValue(old.promise);
    await page.onSend("account-a-question");
    app.accountKey = "account-b";
    await vi.advanceTimersByTimeAsync(0);
    old.resolve({ reply: "account-a-reply" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(nova.messages).toHaveLength(0);
    api.chat.mockResolvedValue({ reply: "new" });
    await page.onSend("account-b-question");
    await page.onStartNewConversation();
    await vi.advanceTimersByTimeAsync(2000);
    expect(nova.messages).toHaveLength(0);
    page.cleanup();
  });
});
