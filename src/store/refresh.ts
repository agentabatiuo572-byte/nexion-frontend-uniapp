import { defineStore } from "pinia";
import { ref } from "vue";
import { useApp } from "./app";
import { tickOrders } from "./orders";
import { useExchange } from "./exchange";

/**
 * Pull-to-refresh store. Ported from Nexion-prototype/lib/store/refresh.ts
 * (zustand → Pinia). The prototype drove a custom document-touch gesture +
 * pullY/dragging tracking because it ran in a plain web H5; on uni the
 * `<scroll-view refresher-enabled>` owns the gesture + indicator natively on
 * BOTH H5 and App, so this store only needs `isRefreshing` + `refresh()`.
 *
 * `refresh()` advances the same mock simulators the prototype ticked: the app
 * earnings/devices sim, order incubation, and the $NEX exchange rate. A
 * synthetic ~900ms latency gives the native spinner time to feel like a real
 * network fetch. Safe to call concurrently — a second call while one is in
 * flight is a no-op.
 */

const REFRESH_LATENCY_MS = 900;

export const useRefresh = defineStore("refresh", () => {
  const isRefreshing = ref(false);

  async function refresh(): Promise<void> {
    if (isRefreshing.value) return;
    isRefreshing.value = true;
    try {
      await new Promise<void>((r) => setTimeout(r, REFRESH_LATENCY_MS));
      useApp().tick(3500);
      tickOrders();
      useExchange().refreshRate();
    } finally {
      isRefreshing.value = false;
    }
  }

  return { isRefreshing, refresh };
});
