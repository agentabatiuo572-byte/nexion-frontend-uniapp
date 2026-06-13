import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Trial unbind retention sheet — Sprint #146-2 MVP-C.
 * Ported from Nexion-prototype/lib/store/trial-unbind-sheet.ts
 * (zustand create → Pinia setup store, no return annotation per P-017).
 *
 * Surfaces when the user tries to remove a bound card that is the active
 * trial card. Carries the attempted `tokenId` so the confirm handler knows
 * which card to remove after cancelling the trial.
 *
 * Flow (orchestrated by the page that owns the card list — e.g. /me cards):
 *   delete tapped → if card.tokenId === useFreeTrial.cardTokenId
 *     && status in {active,grace,extended} → show(tokenId) (do NOT remove yet)
 *   → "Keep this card"   → hide(), do nothing
 *   → "Remove anyway"    → useFreeTrial.cancel("unbind")
 *                          + useCards().remove(tokenId) + toast + hide()
 *
 * In-memory only (no persist).
 *
 * Real backend: atomic POST /api/trial/cancel { reason:"unbind" }
 * (PRD §9.11a.2) + DELETE /api/cards/:tokenId (PRD §9.10). One server tx —
 * server enforces ordering (cancel trial first, then unbind card) to prevent
 * a "trial active with no bound card" state.
 */
export const useTrialUnbindSheet = defineStore("trialUnbindSheet", () => {
  const open = ref(false);
  /** The tokenId the user attempted to remove. Set when the sheet opens. */
  const tokenId = ref<string | null>(null);

  function show(id: string) {
    tokenId.value = id;
    open.value = true;
  }
  function hide() {
    open.value = false;
    tokenId.value = null;
  }

  return { open, tokenId, show, hide };
});
