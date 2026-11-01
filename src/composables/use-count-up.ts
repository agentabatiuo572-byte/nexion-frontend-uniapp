import { computed, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useDataVisibility } from "@/store/data-visibility";

/**
 * One-time entrance count (07 首页收益入场): the first time `source` holds a number, the returned
 * value runs from 0 to it over 900 ms with an ease-out cubic, then shows `source` exactly. Later
 * changes (polls, refreshes, period switches, a read error) stop a running count and show directly.
 * Skipped while the data-visibility mask is on or for reduced motion; cancelled on unmount, so it
 * runs once per mount.
 *
 * `follow: true` is for live figures that change while the count runs (a ticking accrual, a quote
 * re-read): for those 900 ms the value is the current source × the eased progress, so a change does
 * not cut the count short; afterwards it is the source. A source that turns null still shows null
 * at once and ends the count.
 */
export function useCountUp(source: MaybeRefOrGetter<number | null>, options: { follow?: boolean } = {}) {
  const visibility = useDataVisibility();
  const counting = ref<number | null>(null);
  const progress = ref<number | null>(null);
  let countFrame = 0;
  let counted = false;
  watch(() => toValue(source), (value) => {
    if (counted) {
      if (options.follow && value !== null) return;
      if (countFrame) cancelAnimationFrame(countFrame);
      counting.value = null;
      progress.value = null;
      return;
    }
    if (value === null) return;
    counted = true;
    if (visibility.hidden || typeof requestAnimationFrame === "undefined" || typeof window === "undefined"
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const start = Date.now();
    if (options.follow) progress.value = 0; // start from 0 on this render, not one frame of the final value
    const step = () => {
      const elapsed = Math.min(1, (Date.now() - start) / 900);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      if (options.follow) progress.value = elapsed < 1 ? eased : null;
      else counting.value = elapsed < 1 ? value * eased : null;
      if (elapsed < 1) countFrame = requestAnimationFrame(step);
    };
    countFrame = requestAnimationFrame(step);
  }, { immediate: true });
  onUnmounted(() => { if (countFrame) cancelAnimationFrame(countFrame); });
  return computed(() => {
    const value = toValue(source);
    if (options.follow) return value !== null && progress.value !== null ? value * progress.value : value;
    return counting.value ?? value;
  });
}
