import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useFreeTrial, type TrialStartFailure } from "./free-trial";
import { useApp } from "./app";
import { toast } from "./ui";
import { getT } from "@/i18n/use-t";
import { useTrialLifecycleCopy } from "@/i18n/trial-lifecycle";
import { mockServerNow } from "./server-time";

/**
 * Trial claim sheet — shown when user is eligible (idle + cooldown clear +
 * phase open). Surfaced from Home auto-push on mount + manual entry CTAs.
 * Ported from Nexion-prototype/lib/store/trial-claim-sheet.ts.
 *
 * Persistence: `lastClosedAt` survives across sessions so the 24h cooldown is
 * honored. `sessionShownCount` is non-persisted — resets every reload.
 * Real backend: autoPush* fields are TrialConfig (PRD §9.11b).
 */
export const useTrialClaimSheet = defineStore("trialClaimSheet", () => {
  // Only lastClosedAt is persisted; sessionShownCount is session-scoped.
  function hydrateLastClosedAt(): number {
    try {
      const s = uni.getStorageSync("nexgrid-trial-claim-sheet-v1") as { lastClosedAt?: number } | "";
      if (s && typeof s === "object" && typeof s.lastClosedAt === "number") return s.lastClosedAt;
    } catch {
      // first run
    }
    return 0;
  }

  const open = ref(false);
  const activated = ref(false);
  const trial = useFreeTrial();
  const copy = useTrialLifecycleCopy();
  // Both the immediate and the delayed state read confirm the same claim here,
  // even if its original page or sheet has since been closed.
  watch(() => trial.confirmedStartClaimNo, claimNo => {
    if (!claimNo) return;
    void useApp().refreshRemoteFleet();
    if (open.value) activated.value = true;
    else toast.success(copy.value.activationSuccessTitle);
  });
  // Refused at once or only by a later read, the reason reaches the user even with the sheet closed.
  watch(() => trial.confirmedStartDenial, reason => {
    if (reason && !open.value) toast.error(failureText(reason));
  });
  function failureText(reason: TrialStartFailure | undefined): string {
    const t = getT();
    if (reason === "rejected") return t.weeklyQuest.claimFailed;
    if (reason === "capacity-full") return copy.value.capacityFull;
    if (reason === "converted") return t.trial.eligReasonConverted;
    if (reason === "used") return t.trial.eligReasonUsed;
    if (reason === "in-progress") return t.trial.eligReasonInProgress;
    if (reason === "quota-exhausted") return t.trial.eligReasonQuota;
    if (reason === "risk") return t.trial.eligReasonRisk;
    if (reason === "product-unavailable") return t.store.trialProductUnavailable;
    if (reason === "unknown") return t.trial.eligReasonUnknown;
    return t.trial.eligReasonClosed;
  }
  const lastClosedAt = ref(hydrateLastClosedAt());
  const sessionShownCount = ref(0);

  function persist() {
    try {
      uni.setStorageSync("nexgrid-trial-claim-sheet-v1", { lastClosedAt: lastClosedAt.value });
    } catch {
      // storage unavailable
    }
  }

  // Manual show MUST NOT bump sessionShownCount (reserved for auto-push throttle).
  function show() {
    open.value = true;
  }

  function tryAutoPush(opts: { cooldownHours: number; maxPerSession: number }): boolean {
    const now = mockServerNow();
    const cooldownMs = opts.cooldownHours * 3_600_000;
    const inCooldown = lastClosedAt.value > 0 && now - lastClosedAt.value < cooldownMs;
    const sessionCapHit = sessionShownCount.value >= opts.maxPerSession;
    if (inCooldown || sessionCapHit) return false;
    open.value = true;
    sessionShownCount.value += 1;
    return true;
  }

  function hide() {
    open.value = false;
    lastClosedAt.value = mockServerNow();
    persist();
  }

  function closeTransient() {
    open.value = false;
  }

  function resetCooldown() {
    lastClosedAt.value = 0;
    sessionShownCount.value = 0;
    persist();
  }

  return { open, activated, lastClosedAt, sessionShownCount, failureText, show, tryAutoPush, hide, closeTransient, resetCooldown };
});
