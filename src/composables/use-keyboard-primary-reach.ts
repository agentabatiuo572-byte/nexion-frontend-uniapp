import { computed, getCurrentInstance, nextTick, onScopeDispose, ref, watch } from "vue";

const GAP = 12;

/**
 * Keeps a primary button and its optional description reachable while the system keyboard is up (07 §7.2).
 *
 * App: on focus the system pans the page until the focused input clears the keyboard (adjustPan); an input's
 * cursor-spacing stretches that region down to the target's bottom + 12px. The logic layer has no DOM, so the
 * distance is read from the page whenever `layout` (what can change between the inputs and the target) changes. An
 * input focused as it mounts (OTP digits) reads its spacing before that read returns, so each input starts from its
 * `seed`: the distance measured on the default layout.
 *
 * H5: the fixed page does not shrink with the keyboard and is no taller than the screen, so nothing scrolls. While an
 * input inside `form` is focused and the keyboard is up, `inset` (a spacer after the form) makes the page as much
 * taller as the keyboard hides, and the page scrolls the target to 12px above the keyboard on focus, on keyboard
 * changes (the visual viewport resizing or panning) and on `layout` changes. With no keyboard nothing scrolls, and the
 * spacer goes when the keyboard does, so the closed page is unchanged.
 */
export function useKeyboardPrimaryReach(options: {
  root: string;
  form: string;
  primary: string;
  primaryDescription?: string;
  inputs: Record<string, { selector: string; seed: number }>;
  layout: () => unknown;
}) {
  const { primary, primaryDescription } = options;
  const measured = ref<Record<string, number>>({});
  const inset = ref(0);
  // #ifdef APP-PLUS
  const instance = getCurrentInstance();
  watch(options.layout, async () => {
    await nextTick();
    const keys = Object.keys(options.inputs);
    const query = uni.createSelectorQuery().in(instance?.proxy);
    query.select(primary).boundingClientRect();
    if (primaryDescription) query.select(primaryDescription).boundingClientRect();
    for (const key of keys) query.select(options.inputs[key].selector).boundingClientRect();
    query.exec((rects: (UniApp.NodeInfo | null)[]) => {
      const descriptionBottom = primaryDescription ? rects[1]?.bottom : undefined;
      const targetBottom = descriptionBottom ?? rects[0]?.bottom;
      if (targetBottom === undefined) return;
      const inputStart = primaryDescription ? 2 : 1;
      const next: Record<string, number> = {};
      keys.forEach((key, i) => {
        const bottom = rects[i + inputStart]?.bottom;
        if (bottom !== undefined) next[key] = Math.max(0, Math.ceil(targetBottom - bottom) + GAP);
      });
      measured.value = next;
    });
  }, { immediate: true, flush: "post" });
  // #endif
  const spacing = computed<Record<string, number | undefined>>(() => {
    // #ifdef APP-PLUS
    return Object.fromEntries(Object.entries(options.inputs).map(([key, input]) => [key, measured.value[key] ?? input.seed]));
    // #endif
    return {};
  });
  // #ifdef H5
  function reach() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const hidden = Math.max(0, Math.round(document.documentElement.clientHeight - viewport.offsetTop - viewport.height));
    if (!hidden) { inset.value = 0; return; }
    const field = document.activeElement;
    if (!(field instanceof HTMLInputElement)) return;
    const form = field.closest<HTMLElement>(options.form);
    const scroller = form?.closest<HTMLElement>(options.root);
    if (!form || !scroller) return;
    inset.value = hidden;
    void nextTick(() => {
      const description = primaryDescription ? form.querySelector(primaryDescription) : null;
      const target = (description ?? form.querySelector(primary))?.getBoundingClientRect();
      if (!target) return;
      const top = viewport.offsetTop + (parseFloat(getComputedStyle(scroller).paddingTop) || 0);
      // Never scroll the focused input out of view to reach the target.
      const shift = Math.min(target.bottom + GAP - (viewport.offsetTop + viewport.height), field.getBoundingClientRect().top - GAP - top);
      if (shift > 0) scroller.scrollTop += shift;
    });
  }
  const viewport = window.visualViewport;
  document.addEventListener("focusin", reach);
  window.addEventListener("resize", reach);
  viewport?.addEventListener("resize", reach);
  viewport?.addEventListener("scroll", reach);
  watch(options.layout, reach, { flush: "post" });
  onScopeDispose(() => {
    document.removeEventListener("focusin", reach);
    window.removeEventListener("resize", reach);
    viewport?.removeEventListener("resize", reach);
    viewport?.removeEventListener("scroll", reach);
  });
  // #endif
  return { spacing, inset };
}
