import { computed, ref, onMounted, onUnmounted } from "vue";
import { apiClient } from "@/api/runtime";
import { onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { formatGroupedAmount } from "@/lib/amount-display";
import { createHomeDisplayPlayer, parseHomeDisplayBatch } from "@/lib/home-display-player";
import { networkPopulationBand } from "@/lib/platform-stats";
import { useRegisteredUsersEstimate } from "@/composables/use-registered-users-estimate";
import { useConfig } from "@/store/config";

/**
 * Published network figures for user-facing pages, from the same sources and in the
 * same format as the home network snapshot card: estimated registered users and the
 * network-pulse online devices as population bands, and the published home-display
 * paid-out total. Each value is "-" while unavailable, never a real aggregate.
 */
export function usePublishedNetworkStats() {
  const cfg = useConfig();
  const registeredCount = useRegisteredUsersEstimate();
  const paid = ref<number | null>(null);
  const player = createHomeDisplayPlayer({
    fetch: async () => parseHomeDisplayBatch(await apiClient.request({ path: "/api/config/home-display", authenticated: false })),
    now: () => typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now(),
    render: next => { paid.value = next?.paid ?? null; },
  });
  let visible = false;
  function syncVisibility() {
    if (visible && (typeof document === "undefined" || !document.hidden)) player.start();
    else player.stop();
  }
  onShow(() => { visible = true; syncVisibility(); });
  onHide(() => { visible = false; syncVisibility(); });
  onMounted(() => { if (typeof document !== "undefined") document.addEventListener("visibilitychange", syncVisibility); });
  onUnmounted(() => {
    player.stop();
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", syncVisibility);
  });

  const registered = computed(() => registeredCount.value === null ? "-" : networkPopulationBand(registeredCount.value));
  const online = computed(() => {
    const value = cfg.config.networkPulse?.onlineDevices;
    return !cfg.syncFailed && typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? networkPopulationBand(value) : "-";
  });
  const paidOut = computed(() => paid.value === null ? "-" : `$${formatGroupedAmount(paid.value)}`);
  return { registered, online, paidOut };
}
