import { nextTick, onMounted, onUnmounted, watch, type Ref } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";

import { attachManualScrollLoadMore, type ManualScrollLoadMoreOptions } from "@/lib/manual-scroll-load-more";
export { attachManualScrollLoadMore, type ManualScrollLoadMoreOptions } from "@/lib/manual-scroll-load-more";

/**
 * A page-level wrapper for conditional template anchors. It reattaches after
 * Vue has rendered the anchor, detaches while hidden, and leaves a returned
 * manual action for platforms without a DOM scroll container.
 */
export function useManualScrollLoadMore(anchor: Ref<unknown>, options: ManualScrollLoadMoreOptions) {
  let detach: () => void = () => {};
  let revision = 0;
  let active = true;

  const rebind = () => {
    const currentRevision = ++revision;
    detach();
    void nextTick(() => {
      if (!active || currentRevision !== revision) return;
      detach = attachManualScrollLoadMore(anchor.value, options);
    });
  };
  const activate = () => { active = true; rebind(); };
  const deactivate = () => { active = false; revision++; detach(); };

  onMounted(activate);
  onShow(activate);
  onHide(deactivate);
  onUnmounted(deactivate);
  watch(anchor, () => { if (active) rebind(); });

  async function loadMoreManually() {
    if (!active || !options.enabled() || !options.hasMore() || options.loading()) return;
    await options.loadMore();
  }

  return { loadMoreManually, rebind };
}
