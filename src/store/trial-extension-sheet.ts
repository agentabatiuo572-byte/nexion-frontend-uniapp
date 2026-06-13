import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Trial extension retention sheet — Sprint #146-2 MVP-D.
 * Ported from Nexion-prototype/lib/store/trial-extension-sheet.ts
 * (zustand create → Pinia setup store, no return annotation per P-017).
 *
 * Surfaces once when the trial reaches the grace boundary AND the user
 * qualifies as high-quality (shadowFrozenAtUSD >= highQualityThresholdUSD).
 * The poll() in free-trial.ts holds the state in `grace` (does NOT
 * auto-charge) so this sheet has time to surface.
 *
 * Open trigger lives at the simulation/grace boundary (see orchestrator note);
 * accept → useFreeTrial.acceptExtension(), decline/dismiss →
 * useFreeTrial.declineExtension() so the offer is marked resolved and the
 * 4s poll doesn't immediately re-open it.
 *
 * In-memory only (no persist): the resolved/decided state is tracked on the
 * underlying useFreeTrial.extensionGranted flag, not here.
 *
 * Real backend: server cron detects qualification + pushes via SSE
 * /api/trial/state; POST /api/trial/extension { accept } mutates atomically.
 */
export const useTrialExtensionSheet = defineStore("trialExtensionSheet", () => {
  const open = ref(false);

  function show() {
    open.value = true;
  }
  function hide() {
    open.value = false;
  }

  return { open, show, hide };
});
