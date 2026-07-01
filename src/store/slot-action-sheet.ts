import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Slot-action sheet — triggered by tapping an empty slot in /earn. Sheet
 * content branches on inventory: if there are inactive devices, list them for
 * activation; otherwise, show a CTA to go to /store.
 * Ported from Nexion-prototype/lib/store/slot-action-sheet.ts (zustand → Pinia).
 *
 * Setup-style store with NO return-type annotation (P-017). Plain open/show/hide
 * toggle — no persistence (session-scoped overlay state).
 */
export const useSlotActionSheet = defineStore("slotActionSheet", () => {
  const open = ref(false);

  function show() {
    open.value = true;
  }

  function hide() {
    open.value = false;
  }

  return { open, show, hide };
});
