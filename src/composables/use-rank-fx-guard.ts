import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import { useLoopsInView } from "./use-loops-in-view";

/**
 * 我的等级 V7、V8 身份区持续循环的守护（team-rank DESIGN 10.4 P6–P9，判定同画板 src/fx-guard.js）。
 *
 * 用法：const fx = useRankFxGuard(".rank-stage");  <view ref="fx.elRef" class="rank-stage" :class="fx.classes" />
 * 循环层的 CSS 写成：.rank-stage.is-looping .layer { animation: …; will-change: transform; }
 *                    .rank-stage.is-paused .layer { animation-play-state: paused; }
 * - 离屏或页面隐藏：暂停（useLoopsInView，H5 用 IntersectionObserver）。
 * - 系统减少动态：still 为 true，循环和一次性动画都不播，直接显示终态。
 * - 低端兜底：设备内存 <4GB（deviceMemory 只报 2 的幂），
 *   或循环运行时连续两个 2 秒窗口里 ≥25% 的帧超过 34ms（>1 秒的停顿不计，最多看 5 个窗口）：lite 为 true，
 *   关掉持续循环、只留静态光效；本次会话记住。
 * 一次性动画（入场、点选 ≤320ms）只看 still：const { still } = useRankFxMotion()。
 */

const LITE_KEY = "nx-fx-lite";
const reducedMotion = ref(false);
const lite = ref(false);
let environmentRead = false;
let monitorDecided = false;

function readEnvironment() {
  if (environmentRead) return;
  environmentRead = true;
  const memory = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
  if (typeof memory === "number" && memory < 4) lite.value = true;
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(LITE_KEY) === "1") lite.value = true;
  } catch {
    // Storage can be unavailable in private modes; the guard then decides afresh each session.
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.value = query.matches;
    const update = () => { reducedMotion.value = query.matches; };
    if (query.addEventListener) query.addEventListener("change", update);
    else query.addListener(update);
  }
}

function markLite() {
  lite.value = true;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(LITE_KEY, "1");
  } catch {
    // Remembering is best effort; the loops are already off for this page.
  }
}

/** 一次性动画（入场、横条点选、领取）用：still 时不播放，直接显示终态。 */
export function useRankFxMotion() {
  readEnvironment();
  return { still: computed(() => reducedMotion.value), lite: computed(() => lite.value) };
}

// 帧监测：循环运行时按 2 秒一个窗口数帧，帧间隔 >34ms 的占 ≥25% 记为掉帧窗口，连续 2 个掉帧窗口就降级。
function monitorFrames(looping: Ref<boolean>) {
  if (monitorDecided || typeof requestAnimationFrame !== "function") return;
  let bad = 0, windows = 0, frames = 0, slow = 0, last = 0, start = 0;
  const step = (time: number) => {
    if (!looping.value) return;
    if (last && time - last > 1000) { frames = 0; slow = 0; start = time; }
    else if (last) { frames++; if (time - last > 34) slow++; }
    else start = time;
    last = time;
    if (time - start >= 2000) {
      windows++;
      bad = frames && slow / frames >= 0.25 ? bad + 1 : 0;
      frames = 0; slow = 0; start = time;
      if (bad >= 2) { monitorDecided = true; markLite(); return; }
      if (windows >= 5) { monitorDecided = true; return; }
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** V7、V8 身份区的持续循环守护。 */
export function useRankFxGuard(selector: string) {
  readEnvironment();
  const { elRef, running } = useLoopsInView(selector);
  const still = computed(() => reducedMotion.value);
  const looping = computed(() => running.value && !still.value && !lite.value);
  const stop = watch(looping, (on) => { if (on) monitorFrames(looping); }, { immediate: true });
  onUnmounted(stop);
  return {
    elRef,
    /** 循环可以跑：可见、页面显示、未减少动态、未降级。 */
    looping,
    still,
    lite: computed(() => lite.value),
    /** 绑到身份区根元素：is-looping 时循环层才有 animation 和 will-change，否则 is-paused。 */
    classes: computed(() => ({ "is-looping": looping.value, "is-paused": !looping.value })),
  };
}
