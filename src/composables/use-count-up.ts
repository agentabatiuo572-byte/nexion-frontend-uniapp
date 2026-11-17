import { computed, getCurrentInstance, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { CountUpConfig, CountUpKind } from "@/lib/count-up-view";
import { useDataVisibility } from "@/store/data-visibility";

let viewCountHosts = 0;
/**
 * One-time entrance count (07 首页收益入场), played in the view layer by `countUpView`
 * (src/lib/count-up-view.ts) so App's logic layer does not re-render every frame. The template keeps
 * rendering the final text; bind the returned config to the figure's host (`:id="hostId"
 * :count-up="config" :change:count-up="countUp.update"`) and mark its parts `nx-count--prefix|int|frac`.
 * This layer only decides that a mount counts: its first known value, with the mask off. The view
 * runs 0 → value over 900 ms (ease-out cubic), skips reduced motion, and ends the count when the mask
 * turns on or the value turns null. A new value mid-count converges from what is shown; `follow`
 * (a ticking accrual, a quote re-read) shows the current value × the eased progress instead.
 */
export function useViewCountUp(source: MaybeRefOrGetter<number | null>, kind: CountUpKind, options: { follow?: boolean } = {}) {
  const visibility = useDataVisibility();
  const hostId = `nx-count-${getCurrentInstance()!.uid}-${++viewCountHosts}`;
  const phase = ref<"pending" | "count" | "off">("pending");
  watch(() => [toValue(source), visibility.hidden] as const, ([value, hidden]) => {
    if (phase.value === "pending" && value !== null) phase.value = hidden ? "off" : "count";
    else if (phase.value === "count" && (value === null || hidden)) phase.value = "off";
  }, { immediate: true });
  const config = computed<CountUpConfig>(() => ({ hostId, kind, follow: options.follow === true, value: toValue(source), count: phase.value === "count" }));
  return { hostId, config };
}
