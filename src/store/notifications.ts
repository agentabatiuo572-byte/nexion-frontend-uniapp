import { invalidateBeforePassiveTabRead, invalidatePassiveTabRead, rememberPassiveTabRead } from "@/lib/passive-tab-read";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { createRemoteAccountEpoch, type RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { notificationPreferenceKind, notificationCategory, type NotificationCategory } from "@/lib/notification-category";
import { notificationApi, remoteApiEnabled } from "@/api/runtime";
import { ApiError } from "@/api/errors";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { isReadAuthorizationDenial, isTransientReadFailure } from "@/lib/remote-read-failure";
import { nexGridBrandText } from "@/lib/brand-copy";
import type { NotificationEarning, NotificationFilter } from "@/api/notification-api";

export type NotifKind = "commission" | "team" | "staking" | "market" | "genesis" | "system";
export type NotifPriority = "critical" | "high" | "normal" | "low";
export interface Notification {
  id: string;
  kind: NotifKind;
  /** Original server kind; preference keys retain their existing six-key contract. */
  rawKind?: string;
  priority: NotifPriority;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ts: number;
  readAt: number | null;
  earning?: NotificationEarning;
}
export interface PushInput { id?: string; kind: NotifKind; priority?: NotifPriority; title: string; body?: string; ctaLabel?: string; ctaHref?: string; }

const KEY = "nexgrid-notifications-accounts-v1";
const knownKind = notificationPreferenceKind;
export const EARNING_NOTIFICATION_REMOVED = "EARNING_NOTIFICATION_REMOVED";

function matchesEarningReceiptRoute(route: string, receiptNo: string): boolean {
  const match = /^\/pages\/me\/receipts\?receiptNo=([^&#]+)$/.exec(route);
  if (!match) return false;
  try { return decodeURIComponent(match[1].replace(/\+/g, " ")) === receiptNo; }
  catch { return false; }
}

function notificationCursorId(cursor: string | null, unbounded: number): number {
  if (cursor === null) return unbounded;
  const id = Number(cursor);
  return /^\d+$/.test(cursor) && Number.isSafeInteger(id) && id > 0 ? id : NaN;
}
function hydrate(accountKey: string): Notification[] {
  const rows = readAccountRow<{ items?: Notification[] }>(KEY, accountKey)?.items ?? [];
  // 历史通知按原文显示，品牌修正在发布源完成。
  return rows.map((row) => ({ ...row, title: nexGridBrandText(row.title), body: row.body ? nexGridBrandText(row.body) : row.body }));
}
let counter = 0;

function emptyRemotePage() {
  return { items: [] as Notification[], loading: false, loadingMore: false, readError: null as string | null, pageError: null as string | null,
    hasRemoteSnapshot: false, nextCursor: null as string | null, historyLoaded: false };
}
function emptyRemotePages() {
  return { all: emptyRemotePage(), finance: emptyRemotePage(), device: emptyRemotePage(),
    team: emptyRemotePage(), rewards: emptyRemotePage(), system: emptyRemotePage() };
}

export const useNotifications = defineStore("notifications", () => {
  let boundKey = "default";
  const remoteAccountEpoch = createRemoteAccountEpoch(boundKey);
  const category = ref<NotificationFilter>("all");
  const pages = ref(emptyRemotePages());
  const pageState = computed(() => pages.value[category.value]);
  const localItems = ref<Notification[]>(remoteApiEnabled ? [] : hydrate(boundKey));
  const items = computed({ get: () => remoteApiEnabled ? pageState.value.items : localItems.value,
    set: (value: Notification[]) => { if (remoteApiEnabled) pageState.value.items = value; else localItems.value = value; } });
  const unread = ref(items.value.filter((item) => !item.readAt).length);
  const unreadAvailable = ref(!remoteApiEnabled);
  const lastRemoteUnread = ref<number | null>(null);
  const earningsReadConfirmed = computed(() => lastRemoteUnread.value === 0);
  const actionableUnread = ref<number | null>(null);
  function invalidateUnread() {
    actionableUnread.value = null;
    unreadAvailable.value = !remoteApiEnabled;
  }
  const unreadByKind = ref<Record<string, number> | null>(null);
  const unreadByCategoryExact = computed(() => !remoteApiEnabled || unread.value === 0 || unreadByKind.value !== null);
  // Without a server summary, positive counts describe only the loaded rows and
  // may power unread dots; they must not be presented as exact category totals.
  const unreadByCategory = computed<Record<NotificationCategory, number>>(() => {
    const counts = { finance: 0, device: 0, team: 0, rewards: 0, system: 0 };
    if (unread.value === 0) return counts;
    if (remoteApiEnabled && unreadByKind.value !== null) {
      for (const [rawKind, count] of Object.entries(unreadByKind.value)) {
        counts[notificationCategory({ kind: knownKind(rawKind), rawKind })] += count;
      }
    } else {
      // A filter must not erase known dots in other categories on summary-optional servers.
      const known = remoteApiEnabled ? [...Object.values(pages.value).flatMap(page => page.items), ...items.value] : items.value;
      for (const item of new Map(known.map(item => [item.id, item])).values()) {
        if (item.readAt === null) counts[notificationCategory(item)] += 1;
      }
    }
    return counts;
  });
  const loading = computed({ get: () => pageState.value.loading, set: value => { pageState.value.loading = value; } });
  const loadingMore = computed(() => pageState.value.loadingMore);
  const readError = computed(() => pageState.value.readError);
  const pageError = computed(() => pageState.value.pageError);
  const commandError = ref<string | null>(null);
  const readFailedWithoutData = computed(() => !!readError.value && !hasRemoteSnapshot.value && items.value.length === 0);
  const hasRemoteSnapshot = computed({ get: () => pageState.value.hasRemoteSnapshot, set: value => { pageState.value.hasRemoteSnapshot = value; } });
  const nextCursor = computed({ get: () => pageState.value.nextCursor, set: value => { pageState.value.nextCursor = value; } });
  let refreshGeneration = 0;
  let cancelGeneration = 0;
  let foregroundGeneration = 0;
  let mutations = { pending: 0, tail: Promise.resolve() };

  function persist() {
    if (remoteApiEnabled) return;
    // Client simulations and local timers are retained only for explicit mock mode.
    writeAccountRow(KEY, boundKey, { items: items.value });
  }
  function recount() { unread.value = items.value.filter((item) => !item.readAt).length; }
  function removeCachedEarnings(remove: (id: string) => boolean) {
    for (const key of ["all", "finance"] as const) {
      const cached = pages.value[key];
      cached.items = cached.items.filter(item => item.rawKind !== "earning_credited" || !remove(item.id));
    }
  }
  function appendRemote(page: Awaited<ReturnType<typeof notificationApi.page>>, requestedCategory: NotificationFilter, requestedCursor: string | null) {
    const head = requestedCursor === null;
    const next = page.items.map((item) => {
      return {
        id: String(item.id), kind: knownKind(item.kind), rawKind: item.kind, priority: item.priority, title: item.title,
        body: item.body || undefined, ctaLabel: item.ctaLabel || undefined, ctaHref: item.ctaHref || undefined,
        ts: item.createdAt, readAt: item.readAt,
        ...(item.earning && { earning: item.earning }),
      };
    });
    const ids = new Set(next.map(item => item.id));
    if (requestedCategory === "all" || requestedCategory === "finance") {
      const lower = notificationCursorId(page.nextCursor, -Infinity);
      const upper = notificationCursorId(requestedCursor, Infinity);
      // Only a successful read of a category that includes earnings can prove absence.
      removeCachedEarnings(id => Number(id) >= lower && Number(id) < upper && !ids.has(id));
    }
    const updated = new Map(next.map(item => [item.id, item]));
    for (const cached of Object.values(pages.value)) {
      if (cached !== pageState.value) cached.items = cached.items.map(item => updated.get(item.id) ?? item);
    }
    const overlaps = items.value.some(item => ids.has(item.id));
    if (head) {
      items.value = page.nextCursor && pageState.value.historyLoaded
        ? [...next, ...items.value.filter(item => !ids.has(item.id))]
        : next;
    } else {
      const rows = new Map(next.map(item => [item.id, item]));
      const existing = new Set(items.value.map(item => item.id));
      // A refreshed head can be separated from loaded history by an offline gap.
      // Match the server's descending ID order while those pages are filled.
      items.value = [...items.value.map(item => rows.get(item.id) ?? item), ...next.filter(item => !existing.has(item.id))]
        .sort((a, b) => Number(b.id) - Number(a.id));
    }
    unread.value = page.unread;
    lastRemoteUnread.value = page.unread;
    actionableUnread.value = page.actionableUnread ?? null;
    unreadAvailable.value = true;
    unreadByKind.value = page.unreadByKind ? { ...page.unreadByKind } : null;
    if (!head || !pageState.value.historyLoaded || !page.nextCursor || !overlaps) nextCursor.value = page.nextCursor;
    pageState.value.historyLoaded = true;
  }
  function refreshRemote(request: RemoteAccountRequest = remoteAccountEpoch.snapshot(), active: () => boolean = () => true): Promise<void> {
    invalidateBeforePassiveTabRead("notifications");
    if (!remoteApiEnabled || !remoteAccountEpoch.isCurrent(request)) return Promise.resolve();
    let confirmed = false, resolve!: () => void, reject!: (cause: unknown) => void;
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    // Register before loading notifies synchronous page watchers. Polls and page
    // activations then consume the same actual dispatch, including absent summaries.
    rememberPassiveTabRead("notifications", promise, undefined, undefined,
      () => confirmed && hasRemoteSnapshot.value && remoteAccountEpoch.isCurrent(request) && !loading.value && !readError.value);
    void readRemote(request, active).then(success => { confirmed = success; resolve(); }, reject);
    return promise;
  }
  async function readRemote(request: RemoteAccountRequest, active: () => boolean): Promise<boolean> {
    const cancellation = cancelGeneration;
    const stillActive = () => cancellation === cancelGeneration && active();
    if (!remoteAccountEpoch.isCurrent(request)) return false;
    while (mutations.pending > 0) {
      await mutations.tail;
      if (!remoteAccountEpoch.isCurrent(request) || !stillActive()) return false;
    }
    if (!stillActive()) return false;
    const generation = ++refreshGeneration;
    const requestedCategory = category.value;
    const isCurrent = () => generation === refreshGeneration && remoteAccountEpoch.isCurrent(request) && stillActive();
    loading.value = true;
    pageState.value.loadingMore = false;
    try {
      const page = await notificationApi.page(undefined, undefined, requestedCategory);
      if (!isCurrent()) return false;
      appendRemote(page, requestedCategory, null);
      if (!isCurrent()) return false;
      hasRemoteSnapshot.value = true;
      pageState.value.readError = null;
      return isCurrent();
    } catch (cause) {
      if (!isCurrent()) return false;
      if (!isTransientReadFailure(cause)) invalidateUnread();
      pageState.value.readError = cause instanceof Error ? cause.message : "NOTIFICATION_UNAVAILABLE";
      return false;
    } finally {
      if (generation === refreshGeneration && remoteAccountEpoch.isCurrent(request)) loading.value = false;
    }
  }
  async function loadMoreRemote() {
    if (!remoteApiEnabled || !nextCursor.value || loading.value) return;
    const cancellation = cancelGeneration;
    const request = remoteAccountEpoch.snapshot();
    while (mutations.pending > 0) {
      await mutations.tail;
      if (!remoteAccountEpoch.isCurrent(request) || cancellation !== cancelGeneration) return;
    }
    if (!nextCursor.value || loading.value) return;
    const requestedCursor = nextCursor.value;
    const requestedCategory = category.value;
    const generation = ++refreshGeneration;
    const isCurrent = () => generation === refreshGeneration && remoteAccountEpoch.isCurrent(request);
    loading.value = true;
    pageState.value.loadingMore = true;
    pageState.value.pageError = null;
    try {
      const page = await notificationApi.page(requestedCursor, undefined, requestedCategory);
      if (!isCurrent()) return;
      if (page.nextCursor === requestedCursor) {
        pageState.value.pageError = "NOTIFICATION_PAGE_CURSOR_OVERLAP";
        return false;
      }
      appendRemote(page, requestedCategory, requestedCursor);
      return true;
    }
    catch (cause) {
      if (isCurrent()) {
        if (isReadAuthorizationDenial(cause)) invalidateUnread();
        pageState.value.pageError = cause instanceof Error ? cause.message : "NOTIFICATION_UNAVAILABLE";
        return false;
      }
    }
    finally {
      if (isCurrent()) { loading.value = false; pageState.value.loadingMore = false; }
    }
  }
  function invalidateReads() {
    invalidatePassiveTabRead("notifications");
    cancelGeneration += 1;
    refreshGeneration += 1;
    loading.value = false;
    pageState.value.loadingMore = false;
  }
  function cancelRefresh() {
    foregroundGeneration += 1;
    invalidateReads();
  }
  async function selectCategory(value: NotificationFilter) {
    if (category.value !== value) {
      invalidateReads();
      category.value = value;
    }
    if (remoteApiEnabled && boundKey !== "default" && !hasRemoteSnapshot.value && !loading.value) await refreshRemote();
  }
  function enqueueRemoteMutation<T>(request: RemoteAccountRequest, operation: () => Promise<T>): Promise<T | undefined> {
    const queue = mutations;
    queue.pending += 1;
    // The queued command represents a newer intent than any read already in flight.
    // Later reads wait for the queue; earlier reads lose ownership immediately.
    refreshGeneration += 1;
    loading.value = false;
    pageState.value.loadingMore = false;
    const queued = queue.tail.then(async () => {
      if (!remoteAccountEpoch.isCurrent(request)) return undefined;
      commandError.value = null;
      return operation();
    });
    const settled = queued.finally(() => { queue.pending -= 1; });
    queue.tail = settled.then(() => undefined, () => undefined);
    return settled;
  }
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    remoteAccountEpoch.bind(boundKey);
    cancelGeneration += 1;
    refreshGeneration += 1;
    mutations = { pending: 0, tail: Promise.resolve() };
    unreadByKind.value = null;
    lastRemoteUnread.value = null;
    invalidateUnread();
    hasRemoteSnapshot.value = false;
    if (remoteApiEnabled) {
      items.value = [];
      unread.value = 0;
      nextCursor.value = null;
      pages.value = emptyRemotePages();
      category.value = "all";
      loading.value = false;
      commandError.value = null;
      if (boundKey !== "default") void refreshRemote(remoteAccountEpoch.snapshot());
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
  function confirmRead(id: string) {
    const item = Object.values(pages.value).flatMap(page => page.items).find(value => value.id === id);
    if (!item || item.readAt !== null) return;
    for (const page of Object.values(pages.value)) {
      page.items = page.items.map(value => value.id === id ? { ...value, readAt: Date.now() } : value);
    }
    // A successful acknowledgement may be an idempotent replay after another
    // device read this row. Never subtract from an authoritative group locally.
    if (unreadByKind.value !== null || item.rawKind === "earning_credited") return;
    unread.value = Math.max(0, unread.value - 1);
  }
  async function markRead(id: string, request: RemoteAccountRequest = remoteAccountEpoch.snapshot(), fromAction = false) {
    if (remoteApiEnabled) {
      const origin = pageState.value;
      const cancellation = cancelGeneration;
      const shouldRefresh = await enqueueRemoteMutation(request, async () => {
        const item = origin.items.find((value) => value.id === id);
        if (!fromAction && (!item || item.readAt)) return;
        try {
          await notificationApi.markRead(Number(id));
        } catch (cause) {
          if (!remoteAccountEpoch.isCurrent(request)) return;
          commandError.value = cause instanceof Error ? cause.message : "NOTIFICATION_UPDATE_FAILED";
          return;
        }
        if (!remoteAccountEpoch.isCurrent(request)) return;
        const hasSummary = unreadByKind.value !== null || actionableUnread.value !== null;
        actionableUnread.value = null;
        confirmRead(id);
        return fromAction || hasSummary;
      });
      if (shouldRefresh && remoteAccountEpoch.isCurrent(request) && cancellation === cancelGeneration) {
        void refreshRemote(request, () => cancellation === cancelGeneration);
      }
      return;
    }
    const item = items.value.find((value) => value.id === id);
    if (!item || item.readAt || !remoteAccountEpoch.isCurrent(request)) return;
    items.value = items.value.map((value) => value.id === id ? { ...value, readAt: Date.now() } : value); recount(); persist();
  }
  async function markAllRead() {
    const request = remoteAccountEpoch.snapshot();
    const cancellation = cancelGeneration;
    if (remoteApiEnabled) {
      const changed = await enqueueRemoteMutation(request, async () => {
        try {
          await notificationApi.markAllRead();
        } catch (cause) {
          if (!remoteAccountEpoch.isCurrent(request)) return;
          commandError.value = cause instanceof Error ? cause.message : "NOTIFICATION_UPDATE_FAILED";
          return false;
        }
        if (!remoteAccountEpoch.isCurrent(request)) return;
        commandError.value = null;
        for (const page of Object.values(pages.value)) {
          page.items = page.items.map((item) => item.readAt ? item : { ...item, readAt: Date.now() });
        }
        unread.value = 0;
        actionableUnread.value = null;
        unreadByKind.value = {};
        return true;
      });
      // Reconcile only after leaving the queue: refresh waits for queued writes.
      if (changed && remoteAccountEpoch.isCurrent(request) && cancellation === cancelGeneration) {
        await refreshRemote(request, () => cancellation === cancelGeneration);
      }
      return changed;
    }
    items.value = items.value.map((item) => item.readAt ? item : { ...item, readAt: Date.now() }); recount(); persist();
  }
  async function clearRead() {
    const request = remoteAccountEpoch.snapshot();
    const foreground = foregroundGeneration;
    if (remoteApiEnabled) {
      const changed = await enqueueRemoteMutation(request, async () => {
        try {
          await notificationApi.clearRead();
        } catch (cause) {
          if (!remoteAccountEpoch.isCurrent(request)) return;
          commandError.value = cause instanceof Error ? cause.message : "NOTIFICATION_UPDATE_FAILED";
          return false;
        }
        if (!remoteAccountEpoch.isCurrent(request)) return;
        commandError.value = null;
        // Deletion eligibility belongs to the server (critical/locked rows may remain).
        // Unread rows cannot be deleted. Keep their dots while invalidating every
        // category's read cache, even if the user switched filters during the write.
        for (const key of Object.keys(pages.value) as NotificationFilter[]) {
          pages.value[key] = { ...emptyRemotePage(), items: pages.value[key].items.filter(item => item.readAt === null || item.priority === "critical") };
        }
        return true;
      });
      if (changed && remoteAccountEpoch.isCurrent(request) && foreground === foregroundGeneration && !loading.value) {
        await refreshRemote(request, () => foreground === foregroundGeneration);
      }
      return changed;
    }
    items.value = items.value.filter((item) => !item.readAt); recount(); persist();
  }
  async function recordRemoteAction(id: string, action: "cta" | "swipe_conversion", earningReceiptNo?: string): Promise<string | null> {
    if (!remoteApiEnabled) return null;
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;
    const request = remoteAccountEpoch.snapshot();
    const cancellation = cancelGeneration;
    const receipt = await enqueueRemoteMutation(request, async () => {
      try {
        const result = await notificationApi.recordAction(numericId, action, `notification-${action}-${numericId}`);
        if (earningReceiptNo && !matchesEarningReceiptRoute(result.route, earningReceiptNo)) {
          throw new ApiError({ kind: "protocol", message: "NOTIFICATION_ACTION_RESPONSE_MISMATCH" });
        }
        return result;
      } catch (cause) {
        if (!remoteAccountEpoch.isCurrent(request)) return;
        if (earningReceiptNo && cause instanceof ApiError && cause.message === "NOTIFICATION_NOT_FOUND") {
          removeCachedEarnings(cachedId => cachedId === id);
          if (cancellation === cancelGeneration) commandError.value = EARNING_NOTIFICATION_REMOVED;
          return false as const;
        }
        if (cancellation !== cancelGeneration) return;
        commandError.value = cause instanceof Error ? cause.message : "NOTIFICATION_ACTION_UNCERTAIN";
        return false as const;
      }
    });
    if (receipt === undefined || !remoteAccountEpoch.isCurrent(request)) return null;
    if (receipt === false) {
      void refreshRemote(request, () => cancellation === cancelGeneration);
      return null;
    }
    // The action receipt owns the route. A separate acknowledgement and head
    // read can settle afterward, even if navigation has already begun.
    void markRead(id, request, true);
    return receipt.route;
  }

  async function recordCta(id: string, earningReceiptNo?: string) { return recordRemoteAction(id, "cta", earningReceiptNo); }
  async function recordSwipeConversion(id: string, earningReceiptNo?: string) { return recordRemoteAction(id, "swipe_conversion", earningReceiptNo); }
  function clearAll() { if (remoteApiEnabled) { void refreshRemote(); return; } items.value = []; recount(); persist(); }
  function removeOne(id: string) { if (remoteApiEnabled) return; items.value = items.value.filter((item) => item.id !== id); recount(); persist(); }
  return { items, category, unread, unreadAvailable, earningsReadConfirmed, actionableUnread, unreadByKind, unreadByCategory, unreadByCategoryExact, loading, loadingMore, readError, pageError, commandError, readFailedWithoutData, hasRemoteSnapshot, nextCursor, push, markRead, markAllRead, clearRead, clearAll, removeOne, bindAccount, refreshRemote, cancelRefresh, selectCategory, loadMoreRemote, recordCta, recordSwipeConversion };
});
