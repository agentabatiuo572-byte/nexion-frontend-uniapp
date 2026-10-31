import { onBeforeUnmount, onMounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
export { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app';

/** Lite uses ordinary H5 pages; clocks follow the visible page and are released on unmount. */
export function useVisibleInterval(tick: () => void, delay: number) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => { if (timer !== undefined) clearInterval(timer); timer = undefined; };
  const start = () => { tick(); if (timer === undefined) timer = setInterval(tick, delay); };
  onShow(start); onHide(stop); onMounted(start); onBeforeUnmount(stop);
}
