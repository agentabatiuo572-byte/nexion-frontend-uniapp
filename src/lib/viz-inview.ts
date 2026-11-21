import type { Directive } from "vue";

/**
 * v-viz-inview — data-visual entrance (design system 07 · DS-29) that starts when its mark
 * scrolls into view, for long pages such as Home where bars and rings sit below the fold.
 *
 * Put it on the element that carries the entrance animation (nx-viz-grow / nx-viz-sweep or a
 * local keyframe). Until a quarter of it is visible the animation waits at its first keyframe
 * (empty bar, ring at 0) through `[data-viz-wait]` in tokens.css; then it plays once. A data
 * attribute, not a class, so Vue re-renders (live progress updates) never clear it.
 * Without IntersectionObserver (App logic layer) the attribute is never set and it plays on mount.
 */
let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.removeAttribute("data-viz-wait");
      observer?.unobserve(entry.target);
    }
  }, { threshold: 0.25 });
  return observer;
}

export const vVizInview: Directive<Element> = {
  mounted(el) {
    if (typeof IntersectionObserver === "undefined" || typeof Element === "undefined" || !(el instanceof Element)) return;
    el.setAttribute("data-viz-wait", "");
    sharedObserver().observe(el);
  },
  beforeUnmount(el) {
    if (observer && typeof Element !== "undefined" && el instanceof Element) observer.unobserve(el);
  },
};
