import { useLocaleStore } from "@/store/locale";
import { computed } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import { formatGroupedAmount } from "@/lib/amount-display";
import { useHomeDisplay } from "@/composables/use-home-display";
import { networkPopulationBand } from "@/lib/platform-stats";
import { useRegisteredUsersEstimate } from "@/composables/use-registered-users-estimate";
import { useConfig } from "@/store/config";

/** Published network figures in the trust page's existing display format. */
export function usePublishedNetworkStats() {
  const locale = useLocaleStore();
  const cfg = useConfig();
  const registeredCount = useRegisteredUsersEstimate();
  const display = useHomeDisplay();
  const registered = computed(() => registeredCount.value === null ? "-" : networkPopulationBand(registeredCount.value, locale.code));
  const online = computed(() => {
    const value = remoteApiEnabled ? display.value?.online : cfg.syncFailed ? null : cfg.config.networkPulse?.onlineDevices;
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? networkPopulationBand(value, locale.code) : "-";
  });
  const paidOut = computed(() => display.value ? `$${formatGroupedAmount(display.value.paid)}` : "-");
  return { registered, online, paidOut };
}
