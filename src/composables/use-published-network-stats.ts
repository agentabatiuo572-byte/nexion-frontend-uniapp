import { useLocaleStore } from "@/store/locale";
import { computed } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import { useHomeDisplay } from "@/composables/use-home-display";
import { networkPopulationBand, platformAmountBand } from "@/lib/platform-stats";
import { useRegisteredUsersEstimate } from "@/composables/use-registered-users-estimate";
import { useConfig } from "@/store/config";

/** Published platform figures, all as 06 §6.4 bands; "—" while unknown. */
export function usePublishedNetworkStats() {
  const locale = useLocaleStore();
  const cfg = useConfig();
  const registeredCount = useRegisteredUsersEstimate();
  const display = useHomeDisplay();
  const registered = computed(() => registeredCount.value === null ? "—" : networkPopulationBand(registeredCount.value, locale.code));
  const online = computed(() => {
    const value = remoteApiEnabled ? display.value?.online : cfg.syncFailed ? null : cfg.config.networkPulse?.onlineDevices;
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? networkPopulationBand(value, locale.code) : "—";
  });
  const paidOut = computed(() => display.value ? platformAmountBand(display.value.paid) : "—");
  return { registered, online, paidOut };
}
