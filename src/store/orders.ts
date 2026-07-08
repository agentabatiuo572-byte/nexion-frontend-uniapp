/**
 * Ported from Nexion-prototype/lib/store/orders.ts
 * (zustand persist → Pinia + uni storage).
 *
 * Unified 4-stage flow for every product (NexionBox tiers + Cloud Share).
 * No shipping fiction — every device is platform-hosted in our DC, so the
 * only meaningful states are: order placed → paid → DC provisioning → live.
 *
 * ⚠️ MOCK STATE MACHINE — INCOMPLETE FOR PRODUCTION
 * Missing terminal states a real platform needs (payment_failed / expired /
 * refunded / chargeback / provisioning_failed) collapse into `cancelled` here.
 * Production: state machine + transitions live on server; client receives
 * canonical state via `GET /api/orders/:id` (no client state inference).
 */

import { defineStore } from "pinia";
import { ref } from "vue";
import { useApp } from "./app";
import type { DeviceKind } from "./types";

export type OrderStatus =
  | "placed"
  | "paid"
  | "provisioning"
  | "activated"
  | "cancelled";

export interface OrderTimelineEvent {
  status: OrderStatus;
  ts: number;
  note?: string;
}

export interface Order {
  id: string;               // ORD-20260516-1234
  productId: Exclude<DeviceKind, "phone">;
  productName: string;
  quantity: number;
  unitPrice: number;        // USDT
  discount: number;         // USDT
  total: number;            // USDT
  paymentMethod: string;    // "usdt-trc20" etc
  status: OrderStatus;
  placedAt: number;
  paidAt?: number;
  activatedAt?: number;
  timeline: OrderTimelineEvent[];
  deviceId?: string;        // the spawned device id once activated
  // Data-center the unit was provisioned in (Singapore / Frankfurt)
  dataCenter: "新加坡数据中心" | "法兰克福数据中心";
}

export interface CreateOrderInput {
  productId: Order["productId"];
  productName: string;
  unitPrice: number;
  paymentMethod: string;
  discount?: number;
}

const STORAGE_KEY = "nexion-orders-v4";

function genOrderId(): string {
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${yyyymmdd}-${seq}`;
}

const TIMELINE: OrderStatus[] = ["placed", "paid", "provisioning", "activated"];

export function timelineFor(_productId: Order["productId"]): OrderStatus[] {
  return TIMELINE;
}

function pickDataCenter(productId: Order["productId"]): Order["dataCenter"] {
  // NexionRack (P1/P2) lives in Frankfurt, everything else in Singapore.
  return productId === "stellarrack-p1" || productId === "stellarrack-p2"
    ? "法兰克福数据中心"
    : "新加坡数据中心";
}

function statusNote(next: OrderStatus, dc: Order["dataCenter"]): string | undefined {
  switch (next) {
    case "provisioning":
      return `正在 ${dc} 分配机架槽位…`;
    case "activated":
      return "设备已上线 · 已加入 Nexion 网络";
    default:
      return undefined;
  }
}

function hydrate(): Order[] {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { orders?: Order[] } | Order[] | "";
    if (Array.isArray(s)) return s;
    if (s && typeof s === "object" && Array.isArray(s.orders)) return s.orders;
  } catch {
    // first run
  }
  return [];
}

// app store optional device-CRUD surface — these actions land on useApp when the
// store/me/devices pages are ported (PORT-LEDGER app store block step 4). Until
// then this typed view lets advanceOrder() compile and degrade gracefully: the
// order still advances to "activated", just without spawning a Device.
type DeviceSpawnApp = {
  addDevice?: (kind: DeviceKind) => string;
  activateDevice?: (id: string, reservedSlots?: number) => boolean;
  devices: { id: string; activatedAt?: number | null }[];
};

export const useOrders = defineStore("orders", () => {
  const orders = ref<Order[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { orders: orders.value });
    } catch {
      // storage unavailable
    }
  }

  function createOrder(input: CreateOrderInput): Order {
    const { productId, productName, unitPrice, paymentMethod, discount = 0 } = input;
    const id = genOrderId();
    const now = Date.now();
    const order: Order = {
      id,
      productId,
      productName,
      quantity: 1,
      unitPrice,
      discount,
      total: unitPrice - discount,
      paymentMethod,
      // Resting state right after checkout is "paid"
      status: "paid",
      placedAt: now,
      paidAt: now,
      dataCenter: pickDataCenter(productId),
      timeline: [
        { status: "placed", ts: now, note: "订单已接收" },
        { status: "paid", ts: now + 1000, note: `已通过 ${paymentMethod} 结算` },
      ],
    };
    orders.value = [order, ...orders.value];
    persist();
    return order;
  }

  function advanceOrder(id: string, reservedSlots = 0) {
    const cur = orders.value.find((o) => o.id === id);
    if (!cur || cur.status === "activated" || cur.status === "cancelled") return;
    const idx = TIMELINE.indexOf(cur.status);
    if (idx < 0 || idx >= TIMELINE.length - 1) return;
    const next = TIMELINE[idx + 1];

    // When advancing INTO "activated", spawn the device synchronously so the
    // deviceId can land in the same update — every caller converges on the same
    // wire-into-Earn behaviour. (No-ops cleanly until device CRUD is on useApp.)
    let spawnedDeviceId: string | undefined = cur.deviceId;
    let activationBlocked = false;
    if (next === "activated") {
      const app = useApp() as unknown as DeviceSpawnApp;
      if (!spawnedDeviceId && typeof app.addDevice === "function") {
        spawnedDeviceId = app.addDevice(cur.productId);
        spawnedDeviceId = spawnedDeviceId ?? app.devices.slice(-1)[0]?.id;
      }
      if (spawnedDeviceId && typeof app.activateDevice === "function") {
        const alreadyActive = app.devices.some((d) => d.id === spawnedDeviceId && d.activatedAt !== null);
        activationBlocked = alreadyActive ? false : !app.activateDevice(spawnedDeviceId, reservedSlots);
      }
    }
    const targetStatus = next === "activated" && activationBlocked ? cur.status : next;
    const targetNote = activationBlocked
      ? "等待空闲设备槽位"
      : statusNote(next, cur.dataCenter);

    orders.value = orders.value.map((o) =>
      o.id !== id
        ? o
        : {
            ...o,
            status: targetStatus,
            deviceId: spawnedDeviceId ?? o.deviceId,
            activatedAt: targetStatus === "activated" ? Date.now() : o.activatedAt,
            timeline: [
              ...o.timeline,
              { status: targetStatus, ts: Date.now(), note: targetNote },
            ],
          },
    );
    persist();
  }

  function markActivated(id: string, deviceId: string) {
    orders.value = orders.value.map((o) =>
      o.id === id
        ? {
            ...o,
            status: "activated",
            activatedAt: Date.now(),
            deviceId,
            timeline: [
              ...o.timeline.filter((e) => e.status !== "activated"),
              {
                status: "activated",
                ts: Date.now(),
                note: "设备已上线 · 已加入 Nexion 网络",
              },
            ],
          }
        : o,
    );
    persist();
  }

  // Cancel is allowed ONLY pre-payment ("placed"). Once paid, DC provisioning
  // carries financial + capacity commitments → no self-cancel (server-canonical
  // refund/support flow). No-op on any non-"placed" status.
  function cancelOrder(id: string) {
    orders.value = orders.value.map((o) =>
      o.id === id && o.status === "placed"
        ? {
            ...o,
            status: "cancelled",
            timeline: [
              ...o.timeline,
              {
                status: "cancelled",
                ts: Date.now(),
                note: "订单已取消 · 退款已排队",
              },
            ],
          }
        : o,
    );
    persist();
  }

  function getById(id: string): Order | undefined {
    return orders.value.find((o) => o.id === id);
  }

  return { orders, createOrder, advanceOrder, markActivated, cancelOrder, getById };
});

// ⚠️ MOCK-ONLY: client unilaterally progresses orders through provisioning with
// a Math.random()<0.45 gate. PRODUCTION: server pushes order status changes;
// client only reflects server state. `advanceOrder` spawns the device when it
// reaches "activated", so callers don't handle device wiring separately.
export function tickOrders(reservedSlots = 0) {
  const store = useOrders();
  store.orders.forEach((o) => {
    if (o.status === "cancelled" || o.status === "activated") return;
    if (Math.random() < 0.45) {
      store.advanceOrder(o.id, reservedSlots);
    }
  });
}
