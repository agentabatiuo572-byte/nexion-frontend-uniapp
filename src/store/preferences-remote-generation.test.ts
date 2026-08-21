import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { NotificationPreferences } from "@/api/notification-preferences-api";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  notificationPreferencesApi: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("@/api/runtime", () => remote);

const { usePreferences } = await import("./preferences");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function canonical(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    commission: true, team: true, staking: true, market: true, genesis: true, system: true,
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  remote.notificationPreferencesApi.get.mockReset();
  remote.notificationPreferencesApi.patch.mockReset();
});

describe("notification preference remote generation", () => {
  it("drops an old GET response after a same-account PATCH starts", async () => {
    const get = deferred<NotificationPreferences>();
    const patch = deferred<NotificationPreferences>();
    remote.notificationPreferencesApi.get.mockReturnValueOnce(get.promise);
    remote.notificationPreferencesApi.patch.mockReturnValueOnce(patch.promise);
    const store = usePreferences();

    store.bindAccount("account-A");
    const pendingPatch = store.toggleNotifKind("commission");
    patch.resolve(canonical({ commission: false }));
    await pendingPatch;
    get.resolve(canonical({ commission: true }));
    await Promise.resolve();

    expect(store.notifPrefs.commission).toBe(false);
    expect(store.loading).toBe(false);
  });

  it("drops an old PATCH response after a newer same-account mutation", async () => {
    const first = deferred<NotificationPreferences>();
    const second = deferred<NotificationPreferences>();
    remote.notificationPreferencesApi.get.mockResolvedValue(canonical());
    remote.notificationPreferencesApi.patch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const store = usePreferences();
    store.bindAccount("account-A");

    const pendingFirst = store.toggleNotifKind("commission");
    const pendingSecond = store.toggleNotifKind("team");
    second.resolve(canonical({ team: false }));
    await pendingSecond;
    first.resolve(canonical({ commission: false }));
    await pendingFirst;

    expect(store.notifPrefs.commission).toBe(true);
    expect(store.notifPrefs.team).toBe(false);
  });
});
