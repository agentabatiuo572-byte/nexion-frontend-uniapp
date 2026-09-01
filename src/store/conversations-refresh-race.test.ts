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
  },
}));

vi.mock("@/api/runtime", () => runtime);

const { useConversations } = await import("./conversations");

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  runtime.supportApi.authorityRevision.mockResolvedValue("run-1");
  runtime.supportApi.commandResult.mockResolvedValue(null);
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
});
