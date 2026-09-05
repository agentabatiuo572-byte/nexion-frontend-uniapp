import { defineStore } from "pinia";
import { ref } from "vue";
import { createRemoteAccountEpoch, type RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { notificationApi, remoteApiEnabled } from "@/api/runtime";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

export type NotifKind = "commission" | "team" | "staking" | "market" | "genesis" | "system";
export type NotifPriority = "critical" | "high" | "normal" | "low";
export interface Notification {
  id: string;
  kind: NotifKind;
  priority: NotifPriority;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ts: number;
  readAt: number | null;
}
export interface PushInput { id?: string; kind: NotifKind; priority?: NotifPriority; title: string; body?: string; ctaLabel?: string; ctaHref?: string; }

const KEY = "nexgrid-notifications-accounts-v1";
const knownKind = (value: string): NotifKind => ["commission", "team", "staking", "market", "genesis", "system"].includes(value) ? value as NotifKind : "system";
function hydrate(accountKey: string): Notification[] {
  return readAccountRow<{ items?: Notification[] }>(KEY, accountKey)?.items ?? [];
}
let counter = 0;

export const useNotifications = defineStore("notifications", () => {
  let boundKey = "default";
  const remoteAccountEpoch = createRemoteAccountEpoch(boundKey);
  const items = ref<Notification[]>(remoteApiEnabled ? [] : hydrate(boundKey));
  const unread = ref(items.value.filter((item) => !item.readAt).length);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const nextCursor = ref<string | null>(null);
  const seenIds = new Set<string>();
  let refreshGeneration = 0;
  let pendingRemoteMutations = 0;
  let remoteMutationQueue: Promise<void> = Promise.resolve();

  function persist() {
    if (remoteApiEnabled) return;
    // Client simulations and local timers are retained only for explicit mock mode.
    writeAccountRow(KEY, boundKey, { items: items.value });
  }
  function recount() { unread.value = items.value.filter((item) => !item.readAt).length; }
  function appendRemote(page: Awaited<ReturnType<typeof notificationApi.page>>, replace: boolean) {
    if (replace) seenIds.clear();
    const next = page.items.filter((item) => !seenIds.has(String(item.id))).map((item) => {
      seenIds.add(String(item.id));
      return {
        id: String(item.id), kind: knownKind(item.kind), priority: item.priority, title: item.title,
        body: item.body || undefined, ctaLabel: item.ctaLabel || undefined, ctaHref: item.ctaHref || undefined,
        ts: item.createdAt, readAt: item.readAt,
      };
    });
    items.value = replace ? next : [...items.value, ...next];
    unread.value = page.unread;
    nextCursor.value = page.nextCursor;
  }
  async function refreshRemote(request: RemoteAccountRequest = remoteAccountEpoch.snapshot()) {
    if (!remoteApiEnabled) return;
    if (!remoteAccountEpoch.isCurrent(request)) return;
    while (pendingRemoteMutations > 0) {
      await remoteMutationQueue;
      if (!remoteAccountEpoch.isCurrent(request)) return;
    }
    const generation = ++refreshGeneration;
    const isCurrent = () => generation === refreshGeneration && remoteAccountEpoch.isCurrent(request);
    loading.value = true;
    error.value = null;
    try {
      const page = await notificationApi.page();
      if (!isCurrent()) return;
      appendRemote(page, true);
    } catch (cause) {
      if (!isCurrent()) return;
      error.value = cause instanceof Error ? cause.message : "NOTIFICATION_UNAVAILABLE";
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }
  async function loadMoreRemote() {
    if (!remoteApiEnabled || !nextCursor.value || loading.value) return;
    const request = remoteAccountEpoch.snapshot();
    while (pendingRemoteMutations > 0) {
      await remoteMutationQueue;
      if (!remoteAccountEpoch.isCurrent(request)) return;
    }
    if (!nextCursor.value || loading.value) return;
    const requestedCursor = nextCursor.value;
    const generation = ++refreshGeneration;
    const isCurrent = () => generation === refreshGeneration && remoteAccountEpoch.isCurrent(request);
    loading.value = true;
    error.value = null;
    try {
      const page = await notificationApi.page(requestedCursor);
      if (!isCurrent()) return;
      if (page.nextCursor === requestedCursor) {
        nextCursor.value = null;
        error.value = "NOTIFICATION_PAGE_CURSOR_OVERLAP";
        return;
      }
      appendRemote(page, false);
    }
    catch (cause) {
      if (isCurrent()) error.value = cause instanceof Error ? cause.message : "NOTIFICATION_UNAVAILABLE";
    }
    finally {
      if (isCurrent()) loading.value = false;
    }
  }
  async function retryRemote() { await refreshRemote(); }
  function enqueueRemoteMutation<T>(request: RemoteAccountRequest, operation: () => Promise<T>): Promise<T | undefined> {
    pendingRemoteMutations += 1;
    // The queued command represents a newer intent than any read already in flight.
    // Later reads wait for the queue; earlier reads lose ownership immediately.
    refreshGeneration += 1;
    loading.value = false;
    const queued = remoteMutationQueue.then(async () => {
      if (!remoteAccountEpoch.isCurrent(request)) return undefined;
      return operation();
    });
    const settled = queued.finally(() => { pendingRemoteMutations -= 1; });
    remoteMutationQueue = settled.then(() => undefined, () => undefined);
    return settled;
  }
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    remoteAccountEpoch.bind(boundKey);
    refreshGeneration += 1;
    if (remoteApiEnabled) {
      items.value = [];
      unread.value = 0;
      nextCursor.value = null;
      seenIds.clear();
      loading.value = false;
      error.value = null;
      void refreshRemote(remoteAccountEpoch.snapshot());
      return;
    }
    items.value = hydrate(boundKey); recount();
  }
  function push(input: PushInput) {
    if (remoteApiEnabled) return;
    const id = input.id ?? `n${++counter}-${Date.now().toString(36)}`;
    if (items.value.some((item) => item.id === id)) return;
    items.value = [{ id, kind: input.kind, priority: input.priority ?? "normal", title: input.title, body: input.body, ctaLabel: input.ctaLabel, ctaHref: input.ctaHref, ts: Date.now(), readAt: null }, ...items.value];
    recount(); persist();
  }
  async function markRead(id: string, request: RemoteAccountRequest = remoteAccountEpoch.snapshot()) {
    if (remoteApiEnabled) {
      return enqueueRemoteMutation(request, async () => {
        const item = items.value.find((value) => value.id === id);
        if (!item || item.readAt) return;
        try {
          await notificationApi.markRead(Number(id));
        } catch (cause) {
          if (!remoteAccountEpoch.isCurrent(request)) return;
          error.value = cause instanceof Error ? cause.message : "NOTIFICATION_UPDATE_FAILED";
          return false;
        }
        if (!remoteAccountEpoch.isCurrent(request)) return;
        error.value = null;
        items.value = items.value.map((value) => value.id === id ? { ...value, readAt: Date.now() } : value);
        recount();
      });
    }
    const item = items.value.find((value) => value.id === id);
    if (!item || item.readAt || !remoteAccountEpoch.isCurrent(request)) return;
    items.value = items.value.map((value) => value.id === id ? { ...value, readAt: Date.now() } : value); recount(); persist();
  }
  async function markAllRead() {
    const request = remoteAccountEpoch.snapshot();
    if (remoteApiEnabled) {
      return enqueueRemoteMutation(request, async () => {
        try {
          await notificationApi.markAllRead();
        } catch (cause) {
          if (!remoteAccountEpoch.isCurrent(request)) return;
          error.value = cause instanceof Error ? cause.message : "NOTIFICATION_UPDATE_FAILED";
          return false;
        }
        if (!remoteAccountEpoch.isCurrent(request)) return;
        error.value = null;
        items.value = items.value.map((item) => item.readAt ? item : { ...item, readAt: Date.now() });
        recount();
      });
    }
    items.value = items.value.map((item) => item.readAt ? item : { ...item, readAt: Date.now() }); recount(); persist();
  }
  async function clearRead() {
    const request = remoteAccountEpoch.snapshot();
    if (remoteApiEnabled) {
      return enqueueRemoteMutation(request, async () => {
        try {
          await notificationApi.clearRead();
        } catch (cause) {
          if (!remoteAccountEpoch.isCurrent(request)) return;
          error.value = cause instanceof Error ? cause.message : "NOTIFICATION_UPDATE_FAILED";
          return false;
        }
        if (!remoteAccountEpoch.isCurrent(request)) return;
        error.value = null;
        items.value = items.value.filter((item) => !item.readAt);
        recount();
      });
    }
    items.value = items.value.filter((item) => !item.readAt); recount(); persist();
  }
  async function recordRemoteAction(id: string, action: "cta" | "swipe_conversion"): Promise<string | null> {
    if (!remoteApiEnabled) return null;
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;
    const request = remoteAccountEpoch.snapshot();
    type ActionResult =
      | { kind: "done"; route: string | null }
      | { kind: "uncertain"; cause: unknown };
    const queued = await enqueueRemoteMutation(request, async (): Promise<ActionResult> => {
      try {
        const result = await notificationApi.recordAction(numericId, action, `notification-${action}-${numericId}`);
        if (!remoteAccountEpoch.isCurrent(request)) return { kind: "done", route: null };
        try {
          await notificationApi.markRead(numericId);
        } catch (cause) {
          if (remoteAccountEpoch.isCurrent(request)) {
            error.value = cause instanceof Error ? cause.message : "NOTIFICATION_UPDATE_FAILED";
          }
          // The primary action is already confirmed. Keep its route even when the
          // secondary read acknowledgement needs a later retry.
          return { kind: "done", route: remoteAccountEpoch.isCurrent(request) ? result.route : null };
        }
        if (!remoteAccountEpoch.isCurrent(request)) return { kind: "done", route: null };
        error.value = null;
        items.value = items.value.map((value) => value.id === id ? { ...value, readAt: Date.now() } : value);
        recount();
        return { kind: "done", route: result.route };
      } catch (cause) {
        return { kind: "uncertain", cause };
      }
    });
    if (!queued || !remoteAccountEpoch.isCurrent(request)) return null;
    if (queued.kind === "uncertain") {
      await refreshRemote(request);
      if (!remoteAccountEpoch.isCurrent(request)) return null;
      error.value = queued.cause instanceof Error ? queued.cause.message : "NOTIFICATION_ACTION_UNCERTAIN";
      return null;
    }
    return queued.route;
  }
  async function recordCta(id: string) { return recordRemoteAction(id, "cta"); }
  async function recordSwipeConversion(id: string) { return recordRemoteAction(id, "swipe_conversion"); }
  function clearAll() { if (remoteApiEnabled) { void refreshRemote(); return; } items.value = []; recount(); persist(); }
  function removeOne(id: string) { if (remoteApiEnabled) return; items.value = items.value.filter((item) => item.id !== id); recount(); persist(); }
  return { items, unread, loading, error, nextCursor, push, markRead, markAllRead, clearRead, clearAll, removeOne, bindAccount, refreshRemote, loadMoreRemote, retryRemote, recordCta, recordSwipeConversion };
});
