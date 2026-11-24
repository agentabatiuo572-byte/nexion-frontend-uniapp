import { ref, watch, onMounted, onUpdated, onUnmounted, type Ref } from "vue";

/**
 * A page's bottom tray as rendered (04 §4.0: the content clears the tray's height + 38). Its note, its buttons and a long
 * language's wrap change that height, so it is read from the screen: H5 follows the element with a ResizeObserver; the
 * App's logic layer has no DOM and asks the page for the tray's box after each render. 0 while there is no tray.
 */
export function useTrayHeight(tray: Ref<unknown>, selector: string): Ref<number> {
  const height = ref(0);
  // #ifdef H5
  let observer: ResizeObserver | undefined;
  watch(tray, (value) => {
    observer?.disconnect(); observer = undefined;
    const el = (value as { $el?: HTMLElement } | null)?.$el ?? value as HTMLElement | null;
    if (!el?.getBoundingClientRect) { height.value = 0; return; }
    const apply = () => { height.value = Math.round(el.getBoundingClientRect().height); };
    apply();
    if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(apply); observer.observe(el); }
  }, { flush: "post" });
  onUnmounted(() => observer?.disconnect());
  // #endif
  // #ifndef H5
  const read = () => {
    if (!tray.value) { height.value = 0; return; }
    uni.createSelectorQuery().select(selector).boundingClientRect((rect) => {
      height.value = Math.round((rect as UniApp.NodeInfo | null)?.height ?? 0);
    }).exec();
  };
  onMounted(read);
  onUpdated(read);
  // #endif
  return height;
}
