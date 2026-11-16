import { computed, onUnmounted, ref, watch } from "vue";
import { onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { derivedRegisteredUsers, publicStatsHealth } from "@/lib/platform-stats";
import { useConfig } from "@/store/config";

/**
 * The estimated registered users on the published tick boundaries, or null while unavailable. Every surface that shows
 * this figure uses this clock, so they all cross a display band at the same moment.
 */
export function useRegisteredUsersEstimate() {
  const cfg = useConfig(), now = ref(Date.now());
  let timer: ReturnType<typeof setTimeout> | undefined, visible = true;
  const cadenceAvailable = computed(() => publicStatsHealth(cfg.config.publicStats).membersOk);
  const estimate = computed(() => {
    const ps = cfg.config.publicStats;
    if (cadenceAvailable.value) return derivedRegisteredUsers(ps, now.value);
    // Legacy monthly growth stays private; only an entirely omitted input group uses the public projection.
    return ps.registeredUsersEstimateProvided === false
      ? cfg.config.networkPulse?.registeredUsers ?? Number.NaN : Number.NaN;
  });
  const available = computed(() => !cfg.syncFailed && Number.isSafeInteger(estimate.value) && estimate.value >= 0);
  function stop() { if (timer) clearTimeout(timer); timer = undefined; }
  function tick() {
    stop(); now.value = Date.now();
    if (!visible || !available.value || !cadenceAvailable.value) return;
    const ps = cfg.config.publicStats, period = ps.registeredUsersTickIntervalSec! * 1000;
    const delay = period - Math.max(0, now.value - ps.registeredUsersAnchorAt) % period;
    timer = setTimeout(tick, delay);
  }
  watch(() => [cfg.config.publicStats, cfg.config.networkPulse, cfg.loading, cfg.syncFailed], tick, { immediate: true, deep: true });
  onShow(() => { visible = true; tick(); });
  onHide(() => { visible = false; stop(); });
  onUnmounted(stop);
  return computed(() => available.value ? estimate.value : null);
}
