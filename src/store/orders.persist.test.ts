/**
 * orders.createOrder —— 建单落盘失败不许留下一条只活在内存里的「已付」订单(审计 R4 P1):
 * 调用方此前已扣款 / 下架旧机,必须拿到 null 才能按原路退回。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@/api/runtime", () => ({
  fundsServerEnabled: false, remoteApiEnabled: false, fundsSandboxEnabled: false,
  orderApi: {}, accountApi: {}, walletApi: {},
}));

const memory = new Map<string, unknown>();
let storageBroken = false;
(globalThis as unknown as { uni: unknown }).uni = {
  getStorageSync: (k: string) => (memory.has(k) ? JSON.parse(JSON.stringify(memory.get(k))) : ""),
  setStorageSync: (k: string, v: unknown) => {
    if (storageBroken) throw new Error("QuotaExceededError");
    memory.set(k, JSON.parse(JSON.stringify(v)));
  },
  removeStorageSync: (k: string) => { memory.delete(k); },
  getStorageInfoSync: () => ({ keys: [...memory.keys()] }),
};

const { useOrders } = await import("./orders");

const INPUT = { productId: "stellarbox-s1" as const, productName: "StellarBox S1", unitPrice: 649, paymentMethod: "usdt-trc20" as const };

describe("useOrders.createOrder persistence contract", () => {
  beforeEach(() => { memory.clear(); storageBroken = false; setActivePinia(createPinia()); });

  it("returns the order and it survives a fresh hydrate when storage works", () => {
    const store = useOrders();
    store.bindAccount("acct-a");
    const ord = store.createOrder(INPUT);
    expect(ord).not.toBeNull();
    expect(store.orders.map((o) => o.id)).toEqual([ord!.id]);
    setActivePinia(createPinia());
    const again = useOrders();
    again.bindAccount("acct-a");
    expect(again.orders.map((o) => o.id)).toEqual([ord!.id]);
  });

  it("returns null and leaves NO memory-only order when the write fails", () => {
    const store = useOrders();
    store.bindAccount("acct-a");
    storageBroken = true;
    const ord = store.createOrder(INPUT);
    expect(ord).toBeNull();
    expect(store.orders).toHaveLength(0);
    storageBroken = false;
    setActivePinia(createPinia());
    const again = useOrders();
    again.bindAccount("acct-a");
    expect(again.orders).toHaveLength(0);
  });
});
