import { ref, watch, onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from "vue";

/**
 * useTicker — a number that drifts upward on an interval, re-syncing to `start`
 * when it jumps materially (ported from mission-control.tsx useTicker;
 * React useState/useEffect → Vue ref/watch/onMounted).
 *
 * `start` may be a number, ref, or getter (reactive). The ticker adds a small
 * randomized increment every `interval` ms so live "earnings"/counters feel
 * alive. A large upstream jump in `start` (> ~100× the natural tick increment,
 * e.g. a new commission event or day rollover) snaps the displayed value to the
 * new `start`; small drift does NOT resync (keeps the local animation smooth).
 */
export function useTicker(
  start: MaybeRefOrGetter<number>,
  increment: number,
  interval = 1500,
) {
  const v = ref(toValue(start));
  let id: ReturnType<typeof setInterval> | null = null;

  watch(
    () => toValue(start),
    (s) => {
      if (Math.abs(v.value - s) > increment * 100) v.value = s;
    },
  );

  onMounted(() => {
    id = setInterval(() => {
      v.value += increment * (0.6 + Math.random() * 0.9);
    }, interval);
  });
  onUnmounted(() => {
    if (id) clearInterval(id);
  });

  return v;
}
