import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  notificationApi: {
    page: vi.fn(async () => ({ items: [], unread: 0, nextCursor: null })),
  },
}));
const storage = vi.hoisted(() => ({
  readAccountRow: vi.fn(() => ({
    items: [{
      id: "local-only", kind: "system", priority: "normal", title: "local",
      ts: 1, readAt: null,
    }],
  })),
  writeAccountRow: vi.fn(),
}));

vi.mock("@/api/runtime", () => remote);
vi.mock("./account-scoped-storage", () => storage);

const { useNotifications } = await import("./notifications");

beforeEach(() => {
  setActivePinia(createPinia());
  storage.readAccountRow.mockClear();
  storage.writeAccountRow.mockClear();
  remote.notificationApi.page.mockClear();
});

describe("notifications remote authority", () => {
  it("does not hydrate local notification rows before the server snapshot", async () => {
    const store = useNotifications();

    expect(storage.readAccountRow).not.toHaveBeenCalled();
    expect(store.items).toEqual([]);
    expect(store.unread).toBe(0);

    store.bindAccount("remote-account");
    await Promise.resolve();

    expect(storage.readAccountRow).not.toHaveBeenCalled();
    expect(store.items).toEqual([]);
    expect(store.unread).toBe(0);
  });
});
