import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Notification Center store. Ported from Nexion-prototype/lib/v3/notifications.ts
 * (zustand persist → Pinia + uni storage). Durable feed of routed events with
 * priority-aware retention. Seeds empty (events are pushed by the simulation /
 * channels in the full app; this port surfaces the read + management UI).
 */

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

const CAP_HIGH = 50;
const CAP_NORMAL = 200;
const CAP_LOW = 30;

const PRIORITY_RANK: Record<NotifPriority, number> = { low: 0, normal: 1, high: 2, critical: 3 };
function priorityRank(p: NotifPriority): number {
  return PRIORITY_RANK[p];
}

function applyPriorityRetention(items: Notification[]): Notification[] {
  const buckets: Record<NotifPriority, Notification[]> = { critical: [], high: [], normal: [], low: [] };
  for (const it of items) {
    const p: NotifPriority = it.priority && buckets[it.priority] ? it.priority : "normal";
    buckets[p].push(it);
  }
  const trimmed = [
    ...buckets.critical,
    ...buckets.high.slice(0, CAP_HIGH),
    ...buckets.normal.slice(0, CAP_NORMAL),
    ...buckets.low.slice(0, CAP_LOW),
  ];
  return trimmed.sort((a, b) => b.ts - a.ts);
}

const STORAGE_KEY = "nexion-notifications-v1";

function hydrate(): { items: Notification[]; unread: number } {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { items?: Notification[]; unread?: number } | "";
    if (s && typeof s === "object" && Array.isArray(s.items)) {
      const items = s.items.map((it) =>
        it.priority ? it : { ...it, priority: "normal" as NotifPriority },
      );
      return { items, unread: typeof s.unread === "number" ? s.unread : items.filter((i) => !i.readAt).length };
    }
  } catch {
    // first run
  }
  return { items: [], unread: 0 };
}

let counter = 1;
function nextId(): string {
  counter += 1;
  return `n${counter}-${Date.now().toString(36)}`;
}

export interface PushInput {
  id?: string;
  kind: NotifKind;
  priority?: NotifPriority;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export const useNotifications = defineStore("notifications", () => {
  const init = hydrate();
  const items = ref<Notification[]>(init.items);
  const unread = ref<number>(init.unread);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { items: items.value, unread: unread.value });
    } catch {
      // storage unavailable
    }
  }

  function push(n: PushInput) {
    const id = n.id ?? nextId();
    const newPriority: NotifPriority = n.priority ?? "normal";
    const existing = items.value.find((x) => x.id === id);
    if (existing) {
      if (priorityRank(newPriority) > priorityRank(existing.priority)) {
        const wasRead = existing.readAt !== null;
        items.value = applyPriorityRetention(
          items.value.map((x) =>
            x.id === id
              ? {
                  ...x,
                  priority: newPriority,
                  title: n.title,
                  body: n.body,
                  ctaLabel: n.ctaLabel,
                  ctaHref: n.ctaHref,
                  readAt: null,
                  ts: Date.now(),
                }
              : x,
          ),
        );
        if (wasRead) unread.value += 1;
        persist();
      }
      return;
    }
    const item: Notification = {
      id,
      kind: n.kind,
      priority: newPriority,
      title: n.title,
      body: n.body,
      ctaLabel: n.ctaLabel,
      ctaHref: n.ctaHref,
      ts: Date.now(),
      readAt: null,
    };
    items.value = applyPriorityRetention([item, ...items.value]);
    unread.value += 1;
    persist();
  }

  function markRead(id: string) {
    const it = items.value.find((x) => x.id === id);
    if (!it || it.readAt) return;
    items.value = items.value.map((x) => (x.id === id ? { ...x, readAt: Date.now() } : x));
    unread.value = Math.max(0, unread.value - 1);
    persist();
  }

  function markAllRead() {
    const now = Date.now();
    items.value = items.value.map((x) => (x.readAt ? x : { ...x, readAt: now }));
    unread.value = 0;
    persist();
  }

  function clearRead() {
    items.value = items.value.filter((x) => !x.readAt);
    persist();
  }

  function clearAll() {
    items.value = [];
    unread.value = 0;
    persist();
  }

  function removeOne(id: string) {
    const it = items.value.find((x) => x.id === id);
    if (!it) return;
    items.value = items.value.filter((x) => x.id !== id);
    if (!it.readAt) unread.value = Math.max(0, unread.value - 1);
    persist();
  }

  return { items, unread, push, markRead, markAllRead, clearRead, clearAll, removeOne };
});
