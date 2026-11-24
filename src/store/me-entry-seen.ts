import { defineStore } from "pinia";
import { shallowRef } from "vue";
import type { RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

const STORAGE_KEY = "nexgrid-me-entry-seen-accounts-v1";

export interface SeenOrders {
  latestAt: number | null;
  orderIds: string[];
}

export interface SeenMissions {
  participating: string[];
  claimable: string[];
}

interface EntryFacts {
  orders: SeenOrders;
  missions: SeenMissions;
  receipts: number | null;
  inventory: string[];
}

export type MeEntry = keyof EntryFacts;

type SeenEntries = {
  [K in MeEntry]?: { facts: EntryFacts[K]; localDay?: string };
};

export function meEntryLocalDay(now: number): string {
  const date = new Date(now);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}

function union(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])];
}

function mergeOrders(previous: SeenOrders | undefined, next: SeenOrders): SeenOrders {
  if (!previous || previous.latestAt === null) return next;
  if (next.latestAt === null || next.latestAt < previous.latestAt) return previous;
  if (next.latestAt > previous.latestAt) return next;
  return { latestAt: next.latestAt, orderIds: union(previous.orderIds, next.orderIds) };
}

const merge: { [K in MeEntry]: (previous: EntryFacts[K] | undefined, next: EntryFacts[K]) => EntryFacts[K] } = {
  orders: mergeOrders,
  missions: (previous, next) => ({
    participating: union(previous?.participating ?? [], next.participating),
    claimable: union(previous?.claimable ?? [], next.claimable),
  }),
  receipts: (previous, next) => next === null || (previous != null && previous > next) ? previous ?? null : next,
  inventory: (previous, next) => union(previous ?? [], next),
};

export const useMeEntrySeen = defineStore("me-entry-seen", () => {
  const entries = shallowRef<SeenEntries>({});
  let accountKey = "default";

  function bindAccount(key: string): void {
    accountKey = key;
    entries.value = key === "default" ? {} : readAccountRow<SeenEntries>(STORAGE_KEY, key) ?? {};
  }

  function record<K extends MeEntry>(entry: K, facts: EntryFacts[K], scope: RemoteAccountRequest, viewed: boolean): void {
    if (accountKey === "default" || accountKey !== scope.accountKey || !remoteAccountScope.isCurrent(scope)) return;
    const previous = entries.value[entry];
    if (!viewed && previous) return;
    const updated: SeenEntries = {
      ...entries.value,
      [entry]: {
        facts: merge[entry](previous?.facts, facts),
        localDay: viewed ? meEntryLocalDay(Date.now()) : undefined,
      },
    };
    writeAccountRow(STORAGE_KEY, accountKey, updated);
    entries.value = updated;
  }

  return { entries, bindAccount, record };
});
