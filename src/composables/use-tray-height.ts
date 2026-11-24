import { ref, watch, onUnmounted, type Ref } from "vue";

/**
 * Follow the rendered tray height as its contents wrap, so the page keeps
 * enough room to scroll past it (04 §4.0). The height is 0 without a tray.
 */
export function useTrayHeight(tray: Ref<unknown>): Ref<number> {
  const height = ref(0);
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
  return height;
}
