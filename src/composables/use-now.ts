import { ref } from "vue";
import { useVisibleInterval } from "./use-tab-page-lifecycle";

/**
 * Current Unix time in seconds, refreshed once per second. Re-reading the
 * clock instead of incrementing a counter prevents timer throttling from
 * making eligibility countdowns drift while the App is backgrounded.
 */
export function useNow(active?: () => boolean) {
  const n = ref(Math.floor(Date.now() / 1000));
  useVisibleInterval(() => {
    n.value = Math.floor(Date.now() / 1000);
  }, 1000, active);
  return n;
}
