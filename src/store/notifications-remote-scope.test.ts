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
  it("keeps the last good snapshot when a refresh fails", async () => {
    remote.notificationApi.page
      .mockResolvedValueOnce({
        items: [{
          id: 7, kind: "system", priority: "normal", title: "Last good", body: "",
          ctaLabel: "", ctaHref: "", createdAt: 7, readAt: null,
        }],
        unread: 1,
        nextCursor: "next-7",
      })
      .mockRejectedValueOnce(new Error("refresh unavailable"));
    const store = useNotifications();
    await store.refreshRemote();

    await store.refreshRemote();

    expect(store.items.map((item) => item.id)).toEqual(["7"]);
    expect(store.unread).toBe(1);
    expect(store.nextCursor).toBe("next-7");
    expect(store.error).toBe("refresh unavailable");
  });

  it("keeps the newest refresh when an older same-account request finishes last", async () => {
    let resolveFirst!: (page: CanonicalNotificationPage) => void;
    let resolveSecond!: (page: CanonicalNotificationPage) => void;
    const first = new Promise<CanonicalNotificationPage>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<CanonicalNotificationPage>((resolve) => { resolveSecond = resolve; });
    remote.notificationApi.page
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => second);
    const store = useNotifications();

    const older = store.refreshRemote();
    const newer = store.refreshRemote();
    resolveSecond({
      items: [{ id: 2, kind: "system", priority: "normal", title: "new", body: "", ctaLabel: "", ctaHref: "", createdAt: 2, readAt: null }],
      unread: 1,
      nextCursor: null,
    });
    await newer;
    resolveFirst({
      items: [{ id: 1, kind: "system", priority: "normal", title: "old", body: "", ctaLabel: "", ctaHref: "", createdAt: 1, readAt: null }],
      unread: 1,
      nextCursor: null,
    });
    await older;

    expect(store.items.map((item) => item.id)).toEqual(["2"]);
    expect(store.loading).toBe(false);
  });

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

  it("does not let a stale load-more snapshot undo a confirmed read", async () => {
    let resolveLoadMore!: (page: CanonicalNotificationPage) => void;
    remote.notificationApi.page
      .mockResolvedValueOnce({
        items: [{
          id: 51, kind: "system", priority: "normal", title: "Unread", body: "",
          ctaLabel: "", ctaHref: "", createdAt: 1, readAt: null,
        }],
        unread: 1,
        nextCursor: "next-1",
      })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLoadMore = resolve; }));
    remote.notificationApi.markRead.mockResolvedValue(undefined);
    const store = useNotifications();
    await store.refreshRemote();

    const staleLoadMore = store.loadMoreRemote();
    await store.markRead("51");
    resolveLoadMore({
      items: [{
        id: 52, kind: "system", priority: "normal", title: "Stale", body: "",
        ctaLabel: "", ctaHref: "", createdAt: 2, readAt: null,
      }],
      unread: 2,
      nextCursor: null,
    });
    await staleLoadMore;

    expect(store.items.map((item) => item.id)).toEqual(["51"]);
    expect(store.items[0]?.readAt).not.toBeNull();
    expect(store.unread).toBe(0);
    expect(store.loading).toBe(false);
  });

  it("does not let a stale refresh undo confirmed mark-all or clear-read writes", async () => {
    let resolveMarkAllRefresh!: (page: CanonicalNotificationPage) => void;
    let resolveClearRefresh!: (page: CanonicalNotificationPage) => void;
    remote.notificationApi.page
      .mockResolvedValueOnce({
        items: [{
          id: 61, kind: "system", priority: "normal", title: "Unread", body: "",
          ctaLabel: "", ctaHref: "", createdAt: 1, readAt: null,
        }],
        unread: 1,
        nextCursor: null,
      })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveMarkAllRefresh = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveClearRefresh = resolve; }));
    remote.notificationApi.markAllRead.mockResolvedValue(undefined);
    remote.notificationApi.clearRead.mockResolvedValue(undefined);
    const store = useNotifications();
    await store.refreshRemote();

    const staleMarkAllRefresh = store.refreshRemote();
    await store.markAllRead();
    resolveMarkAllRefresh({
      items: [{
        id: 61, kind: "system", priority: "normal", title: "Stale unread", body: "",
        ctaLabel: "", ctaHref: "", createdAt: 1, readAt: null,
      }],
      unread: 1,
      nextCursor: null,
    });
    await staleMarkAllRefresh;
    expect(store.unread).toBe(0);
    expect(store.loading).toBe(false);

    const staleClearRefresh = store.refreshRemote();
    await store.clearRead();
    resolveClearRefresh({
      items: [{
        id: 61, kind: "system", priority: "normal", title: "Stale read", body: "",
        ctaLabel: "", ctaHref: "", createdAt: 1, readAt: 2,
      }],
      unread: 0,
      nextCursor: null,
    });
    await staleClearRefresh;
    expect(store.items).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it("queues a refresh started after mark-read until the write has settled", async () => {
    let resolveMarkRead!: () => void;
    const markReadPending = new Promise<void>((resolve) => { resolveMarkRead = resolve; });
    remote.notificationApi.page
      .mockResolvedValueOnce({
        items: [{
          id: 71, kind: "system", priority: "normal", title: "Unread", body: "",
          ctaLabel: "", ctaHref: "", createdAt: 1, readAt: null,
        }],
        unread: 1,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [{
          id: 71, kind: "system", priority: "normal", title: "Read", body: "",
          ctaLabel: "", ctaHref: "", createdAt: 1, readAt: 2,
        }],
        unread: 0,
        nextCursor: null,
      });
    remote.notificationApi.markRead.mockImplementationOnce(() => markReadPending);
    const store = useNotifications();
    await store.refreshRemote();

    const mutation = store.markRead("71");
    const refresh = store.refreshRemote();
    await Promise.resolve();
    expect(remote.notificationApi.page).toHaveBeenCalledTimes(1);

    resolveMarkRead();
    await mutation;
    await refresh;
    expect(store.items[0]?.readAt).toBe(2);
    expect(store.unread).toBe(0);
  });

  it("serializes mark-all and clear-read writes in user intent order", async () => {
    let resolveMarkAll!: () => void;
    const markAllPending = new Promise<void>((resolve) => { resolveMarkAll = resolve; });
    remote.notificationApi.page.mockResolvedValueOnce({
      items: [
        { id: 81, kind: "system", priority: "normal", title: "Unread", body: "", ctaLabel: "", ctaHref: "", createdAt: 1, readAt: null },
        { id: 82, kind: "system", priority: "normal", title: "Read", body: "", ctaLabel: "", ctaHref: "", createdAt: 2, readAt: 2 },
      ],
      unread: 1,
      nextCursor: null,
    });
    remote.notificationApi.markAllRead.mockImplementationOnce(() => markAllPending);
    remote.notificationApi.clearRead.mockResolvedValueOnce(undefined);
    const store = useNotifications();
    await store.refreshRemote();

    const markAll = store.markAllRead();
    const clear = store.clearRead();
    await Promise.resolve();
    expect(remote.notificationApi.markAllRead).toHaveBeenCalledTimes(1);
    expect(remote.notificationApi.clearRead).not.toHaveBeenCalled();

    resolveMarkAll();
    await markAll;
    await clear;
    expect(remote.notificationApi.clearRead).toHaveBeenCalledTimes(1);
    expect(store.items).toEqual([]);
    expect(store.unread).toBe(0);
  });

  it("queues CTA recording and its read acknowledgement before a later refresh", async () => {
    let resolveAction!: (value: { notificationId: number; action: "cta"; route: string; recorded: boolean }) => void;
    const actionPending = new Promise<{ notificationId: number; action: "cta"; route: string; recorded: boolean }>((resolve) => { resolveAction = resolve; });
    remote.notificationApi.page
      .mockResolvedValueOnce({
        items: [{
          id: 91, kind: "system", priority: "normal", title: "CTA", body: "",
          ctaLabel: "Open", ctaHref: "/pages/store/store", createdAt: 1, readAt: null,
        }],
        unread: 1,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [{
          id: 91, kind: "system", priority: "normal", title: "CTA", body: "",
          ctaLabel: "Open", ctaHref: "/pages/store/store", createdAt: 1, readAt: 2,
        }],
        unread: 0,
        nextCursor: null,
      });
    remote.notificationApi.recordAction.mockImplementationOnce(() => actionPending);
    remote.notificationApi.markRead.mockResolvedValueOnce(undefined);
    const store = useNotifications();
    await store.refreshRemote();

    const action = store.recordCta("91");
    const refresh = store.refreshRemote();
    await Promise.resolve();
    expect(remote.notificationApi.page).toHaveBeenCalledTimes(1);

    resolveAction({ notificationId: 91, action: "cta", route: "/pages/store/store", recorded: true });
    await expect(action).resolves.toBe("/pages/store/store");
    await refresh;
    expect(remote.notificationApi.markRead).toHaveBeenCalledWith(91);
    expect(store.items[0]?.readAt).toBe(2);
    expect(store.unread).toBe(0);
  });
});
