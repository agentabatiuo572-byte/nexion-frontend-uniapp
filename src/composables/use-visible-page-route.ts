import { onMounted, onUnmounted, ref } from "vue";
import { onHide, onShow, onUnload } from "./use-tab-page-lifecycle";
import { logicalNativePage, onNativeTabChange } from "@/lib/native-tab-navigation";

/** Overlay hosts follow page activation and in-place tab navigation, without polling. */
export function useVisiblePageRoute() {
  const route = ref("");
  const visible = ref(false);
  let unloaded = false;
  function update() {
    if (unloaded || !visible.value) return;
    const pages = getCurrentPages();
    let current = pages[pages.length - 1]?.route ?? "";
    // #ifdef APP-PLUS
    current = logicalNativePage(pages[pages.length - 1]).route;
    // #endif
    // #ifdef H5
    current = window.location.hash.replace(/^#\/?/, "").replace(/^\//, "").split("?")[0] || current;
    // #endif
    route.value = current;
  }
  function show() { if (unloaded) return; visible.value = true; update(); }
  const unsubscribe = onNativeTabChange(update);
  function dispose() {
    if (unloaded) return;
    unloaded = true;
    visible.value = false;
    unsubscribe();
    // #ifdef H5
    window.removeEventListener("hashchange", update);
    window.removeEventListener("popstate", update);
    // #endif
  }
  onShow(show);
  onHide(() => { visible.value = false; });
  onUnload(dispose);
  onMounted(() => {
    if (unloaded) return;
    show();
    // #ifdef H5
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    // #endif
  });
  onUnmounted(dispose);
  return { route, visible };
}
