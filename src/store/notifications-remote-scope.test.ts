import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { CanonicalNotificationPage } from "@/api/notification-api";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  notificationApi: {
    page: vi.fn(async (): Promise<CanonicalNotificationPage> => ({ items: [], unread: 0, nextCursor: null })),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearRead: vi.fn(),
    recordAction: vi.fn(),
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
  remote.notificationApi.markRead.mockReset();
  remote.notificationApi.markAllRead.mockReset();
  remote.notificationApi.clearRead.mockReset();
  remote.notificationApi.recordAction.mockReset();
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

  it("keeps a successful CTA route when its secondary read acknowledgement fails", async () => {
    remote.notificationApi.page.mockResolvedValue({
      items: [{
        id: 41, kind: "system", priority: "normal", title: "Canonical CTA", body: "",
        ctaLabel: "Open", ctaHref: "/pages/store/store", createdAt: 1, readAt: null,
      }],
      unread: 1,
      nextCursor: null,
    });
    remote.notificationApi.recordAction.mockResolvedValue({
      notificationId: 41,
      action: "cta",
      route: "/pages/store/store",
      recorded: true,
    });
    remote.notificationApi.markRead.mockRejectedValue(new Error("read acknowledgement unavailable"));
    const store = useNotifications();
    await store.refreshRemote();

    await expect(store.recordCta("41")).resolves.toBe("/pages/store/store");

    expect(store.error).toBe("read acknowledgement unavailable");
    expect(store.unread).toBe(1);
    expect(remote.notificationApi.recordAction).toHaveBeenCalledWith(41, "cta", "notification-cta-41");
  });

  it("surfaces a read failure without changing the local canonical snapshot", async () => {
    remote.notificationApi.page.mockResolvedValue({
      items: [{
        id: 42, kind: "system", priority: "normal", title: "Unread", body: "",
        ctaLabel: "", ctaHref: "", createdAt: 1, readAt: null,
      }],
      unread: 1,
      nextCursor: null,
    });
    remote.notificationApi.markRead.mockRejectedValue(new Error("write unavailable"));
    const store = useNotifications();
    await store.refreshRemote();

    await expect(store.markRead("42")).resolves.toBe(false);

    expect(store.items[0]?.readAt).toBeNull();
    expect(store.unread).toBe(1);
    expect(store.error).toBe("write unavailable");
  });
});
