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
  dataCenter: "Singapore DC" | "Frankfurt DC";
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
  // NexionRack lives in Frankfurt, everything else in Singapore.
  return productId === "stellarrack-p1" ? "Frankfurt DC" : "Singapore DC";
}

function statusNote(next: OrderStatus, dc: Order["dataCenter"]): string | undefined {
  switch (next) {
    case "provisioning":
      return `Allocating rack slot in ${dc}…`;
    case "activated":
      return "Device live · joined Nexion network";
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
  activateDevice?: (id: string) => void;
  devices: { id: string }[];
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
        { status: "placed", ts: now, note: "Order received" },
        { status: "paid", ts: now + 1000, note: `Settled via ${paymentMethod}` },
      ],
    };
    orders.value = [order, ...orders.value];
    persist();
    return order;
  }

  function advanceOrder(id: string) {
    const cur = orders.value.find((o) => o.id === id);
    if (!cur || cur.status === "activated" || cur.status === "cancelled") return;
    const idx = TIMELINE.indexOf(cur.status);
    if (idx < 0 || idx >= TIMELINE.length - 1) return;
    const next = TIMELINE[idx + 1];

    // When advancing INTO "activated", spawn the device synchronously so the
    // deviceId can land in the same update — every caller converges on the same
    // wire-into-Earn behaviour. (No-ops cleanly until device CRUD is on useApp.)
    let spawnedDeviceId: string | undefined;
    if (next === "activated") {
      const app = useApp() as unknown as DeviceSpawnApp;
      if (typeof app.addDevice === "function") {
        spawnedDeviceId = app.addDevice(cur.productId);
        spawnedDeviceId = spawnedDeviceId ?? app.devices.slice(-1)[0]?.id;
        if (spawnedDeviceId && typeof app.activateDevice === "function") {
          app.activateDevice(spawnedDeviceId);
        }
      }
    }

    orders.value = orders.value.map((o) =>
      o.id !== id
        ? o
        : {
            ...o,
            status: next,
            deviceId: spawnedDeviceId ?? o.deviceId,
            activatedAt: next === "activated" ? Date.now() : o.activatedAt,
            timeline: [
              ...o.timeline,
              { status: next, ts: Date.now(), note: statusNote(next, o.dataCenter) },
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
                note: "Device live · joined Nexion network",
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
                note: "Order cancelled · refund queued",
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
export function tickOrders() {
  const store = useOrders();
  store.orders.forEach((o) => {
    if (o.status === "cancelled" || o.status === "activated") return;
    if (Math.random() < 0.45) {
      store.advanceOrder(o.id);
    }
  });
}
