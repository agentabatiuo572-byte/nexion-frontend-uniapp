import { computed, getCurrentInstance, inject, onUnmounted, ref, watch, type ComponentInternalInstance, type Ref } from "vue";
import { onHide as pageHide, onShow as pageShow } from "@dcloudio/uni-app";
import { onHide, onShow, TAB_LIFECYCLE } from "./use-tab-page-lifecycle";
import { useScrollGrowProgress } from "./use-scroll-grow-progress";

// uni-app stores a child component's page hooks on the page instance and never removes them. Outside a tab host,
// children share one visibility flag per page, so remounting stage components cannot pile up callbacks.
const pageVisibility = new WeakMap<object, Ref<boolean>>();
function usePageVisible(): Ref<boolean> {
  if (inject(TAB_LIFECYCLE, null)) {
    // The tab host drops these hooks when the child unmounts.
    const visible = ref(true);
    onShow(() => { visible.value = true; });
    onHide(() => { visible.value = false; });
    return visible;
  }
  const instance = getCurrentInstance();
  // H5 exposes the page as $pageInstance; the App runtime keeps it at instance.root.
  const page = (instance as (ComponentInternalInstance & { $pageInstance?: ComponentInternalInstance }) | null)?.$pageInstance ?? instance?.root ?? instance;
  if (!page) return ref(true);
  let visible = pageVisibility.get(page);
  if (!visible) {
    const shared = ref(true);
    pageShow(() => { shared.value = true; }, page);
    pageHide(() => { shared.value = false; }, page);
    pageVisibility.set(page, shared);
    visible = shared;
  }
  return visible;
}

/**
 * Continuous decorative loops (online dots, job equalizer, provisioning spinner, gauge comet, rocket) run only while
 * their element is on screen and the page is shown. Bind `elRef` to the owning element and add a paused class when
 * `running` is false. H5 observes the DOM node (clipping by scroll containers counts as off-screen); the App logic
 * layer has no IntersectionObserver, so it observes `selector` on this instance through uni.createIntersectionObserver.
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
  const pageVisible = usePageVisible();
  const running = computed(() => pageVisible.value && (domObserver ? inView.value : nativeInView.value));
  return { elRef, running };
}
