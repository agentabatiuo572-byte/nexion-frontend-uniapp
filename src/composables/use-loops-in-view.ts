import { computed, getCurrentInstance, onUnmounted, ref, watch } from "vue";
import { onHide, onShow } from "./use-tab-page-lifecycle";
import { useScrollGrowProgress } from "./use-scroll-grow-progress";

/**
 * Continuous decorative loops (online dots, job equalizer, provisioning spinner, gauge comet) run only while
 * their element is on screen and the page is shown. Bind `elRef` to the component's root and add a paused
 * class when `running` is false. H5 observes the DOM node; the App logic layer has no IntersectionObserver,
 * so it observes `selector` on this component instance through uni.createIntersectionObserver.
 */
export function useLoopsInView(selector: string) {
  const { elRef, inView } = useScrollGrowProgress({ threshold: 0, fallbackInView: false });
  const domObserver = typeof IntersectionObserver !== "undefined";
  const nativeInView = ref(false);
  let nativeObserver: UniNamespace.IntersectionObserver | null = null;
  const instance = getCurrentInstance();
  if (!domObserver) watch(elRef, (element) => {
    nativeObserver?.disconnect();
    nativeObserver = null;
    nativeInView.value = false;
    if (!element || !instance) return;
    nativeObserver = uni.createIntersectionObserver(instance.proxy, { thresholds: [0] }).relativeToViewport();
    nativeObserver.observe(selector, (result) => { nativeInView.value = result.intersectionRatio > 0; });
  }, { flush: "post" });
  onUnmounted(() => { nativeObserver?.disconnect(); nativeObserver = null; });
  const pageVisible = ref(true);
  onShow(() => { pageVisible.value = true; });
  onHide(() => { pageVisible.value = false; });
  const running = computed(() => pageVisible.value && (domObserver ? inView.value : nativeInView.value));
  return { elRef, running };
}
