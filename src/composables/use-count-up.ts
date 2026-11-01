import { computed, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useDataVisibility } from "@/store/data-visibility";

/**
 * One-time entrance count (07 首页收益入场): the first time `source` holds a number, the returned
 * value runs from 0 to it over 900 ms with an ease-out cubic, then shows `source` exactly. Later
 * changes (polls, refreshes, period switches, a read error) stop a running count and show directly.
 * Skipped while the data-visibility mask is on or for reduced motion; cancelled on unmount, so it
 * runs once per mount.
 */
export function useCountUp(source: MaybeRefOrGetter<number | null>) {
  const visibility = useDataVisibility();
  const counting = ref<number | null>(null);
  let countFrame = 0;
  let counted = false;
  watch(() => toValue(source), (value) => {
    if (counted) {
      if (countFrame) cancelAnimationFrame(countFrame);
      counting.value = null;
      return;
    }
    if (value === null) return;
    counted = true;
    if (visibility.hidden || typeof requestAnimationFrame === "undefined" || typeof window === "undefined"
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const start = Date.now();
    const step = () => {
      const progress = Math.min(1, (Date.now() - start) / 900);
      counting.value = progress < 1 ? value * (1 - Math.pow(1 - progress, 3)) : null;
      if (progress < 1) countFrame = requestAnimationFrame(step);
    };
    countFrame = requestAnimationFrame(step);
  }, { immediate: true });
  onUnmounted(() => { if (countFrame) cancelAnimationFrame(countFrame); });
  return computed(() => counting.value ?? toValue(source));
}
