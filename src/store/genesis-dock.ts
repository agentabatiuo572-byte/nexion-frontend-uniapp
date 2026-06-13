import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Genesis sticky-dock visibility store. Ported from
 * Nexion-prototype/lib/store/genesis-dock.ts (zustand → Pinia).
 *
 * The /genesis page calls show() on mount and hide() on unmount; the
 * chassis-mounted <GenesisDockHost> reads `visible` and renders the gold
 * Liquid-Glass CTA dock pinned to the chassis viewport bottom (decoupled from
 * page scroll). Setup store with NO explicit return annotation so Pinia infers
 * the unwrapped shape (P-017).
 */
export const useGenesisDock = defineStore("genesisDock", () => {
  const visible = ref(false);

  function show() {
    visible.value = true;
  }
  function hide() {
    visible.value = false;
  }

  return { visible, show, hide };
});
