import { readonly, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { apiClient } from "@/api/runtime";
import { appReadForeground, documentReadVisible } from "@/lib/foreground-read";
import { createHomeDisplayPlayer, parseHomeDisplayBatch, type homeDisplayAt } from "@/lib/home-display-player";
import { usePageVisible } from "./use-loops-in-view";

const sample = ref<ReturnType<typeof homeDisplayAt>>(null);
const consumers = ref(0);
const player = createHomeDisplayPlayer({
  fetch: async () => parseHomeDisplayBatch(await apiClient.request({ path: "/api/config/home-display", authenticated: false })),
  now: () => typeof performance !== "undefined" ? performance.now() : Date.now(),
  render: value => {
    const current = sample.value;
    if (value?.online !== current?.online || value?.paid !== current?.paid
      || value?.activeJobs !== current?.activeJobs || value?.paidPerSec !== current?.paidPerSec) {
      sample.value = value;
    }
  },
});

watch(() => consumers.value > 0 && appReadForeground.value && documentReadVisible.value, active => {
  if (active) player.start();
  else player.stop();
}, { flush: "sync" });

export const homeDisplay = readonly(sample);
export const refreshHomeDisplay = player.refresh;

export function useHomeDisplay(enabled: () => boolean = () => true) {
  const visible = usePageVisible();
  let release: (() => void) | undefined;
  onMounted(() => {
    release = watch(() => visible.value && enabled(), (active, _, onCleanup) => {
      if (!active) return;
      consumers.value += 1;
      onCleanup(() => { consumers.value -= 1; });
    }, { immediate: true, flush: "sync" });
  });
  onBeforeUnmount(() => release?.());
  return homeDisplay;
}
