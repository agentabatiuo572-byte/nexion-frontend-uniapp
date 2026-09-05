import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireAccountCommandKey, releaseAccountCommandKey } from "./account-scoped-storage";

describe("account-scoped durable command keys", () => {
  let storage: Map<string, unknown>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("uni", {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reuses the persisted key after the in-memory page state is lost", () => {
    const first = acquireAccountCommandKey("pending-orders", "user:a", "sku|wallet", "order", () => "uuid-1");
    const replay = acquireAccountCommandKey("pending-orders", "user:a", "sku|wallet", "order", () => "uuid-2");

    expect(first).toBe("order:uuid-1");
    expect(replay).toBe(first);
  });

  it("preserves other pending intents in the same account row", () => {
    acquireAccountCommandKey("pending-orders", "user:a", "sku-a", "order", () => "uuid-a");
    acquireAccountCommandKey("pending-orders", "user:a", "sku-b", "order", () => "uuid-b");

    expect(storage.get("pending-orders")).toEqual({
      "user:a": { commands: { "sku-a": "order:uuid-a", "sku-b": "order:uuid-b" } },
    });
  });

  it("fails closed before a remote mutation when the key cannot be persisted", () => {
    vi.stubGlobal("uni", {
      getStorageSync: () => undefined,
      setStorageSync: () => { throw new Error("quota exceeded"); },
    });

    expect(() => acquireAccountCommandKey("pending-orders", "user:a", "sku", "order", () => "uuid"))
      .toThrow("ACCOUNT_COMMAND_STORAGE_UNAVAILABLE");
  });

  it("fails closed instead of falling back to a weak random command id", () => {
    expect(() => acquireAccountCommandKey("pending-orders", "user:a", "sku", "order", () => ""))
      .toThrow("ACCOUNT_COMMAND_ID_UNAVAILABLE");
    expect(storage.size).toBe(0);
  });

  it("releases only the completed key and preserves other pending intents", () => {
    const completed = acquireAccountCommandKey("pending-orders", "user:a", "sku-a", "order", () => "uuid-a");
    acquireAccountCommandKey("pending-orders", "user:a", "sku-b", "order", () => "uuid-b");

    expect(releaseAccountCommandKey("pending-orders", "user:a", "sku-a", completed)).toBe(true);
    expect(storage.get("pending-orders")).toEqual({
      "user:a": { commands: { "sku-b": "order:uuid-b" } },
    });
  });

  it("does not delete a command when the completion key is stale", () => {
    acquireAccountCommandKey("pending-orders", "user:a", "sku-a", "order", () => "current");

    expect(releaseAccountCommandKey("pending-orders", "user:a", "sku-a", "order:stale")).toBe(false);
    expect(acquireAccountCommandKey("pending-orders", "user:a", "sku-a", "order", () => "replacement"))
      .toBe("order:current");
  });
});
