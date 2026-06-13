import { computed, type ComputedRef } from "vue";
import { useApp } from "@/store/app";
import {
  PHASES,
  type PhaseParams,
  getMonthsSince,
  getPhaseForMonth,
  useProductPhaseOverride,
} from "@/store/product-phase";

/**
 * Ported from Nexion-prototype/lib/hooks/use-product-phase.ts.
 *
 * Returns a reactive ComputedRef of the active platform phase + its params.
 * Combines user.joinedAt with the PM demo override (pinned phase) — override
 * wins when set, otherwise fall back to time-based phase.
 *
 * Usage in <script setup>: `const phase = useProductPhase()` then read
 * `phase.value`; in templates `phase.id`.
 */
export function useProductPhase(): ComputedRef<PhaseParams> {
  const app = useApp();
  const override = useProductPhaseOverride();
  return computed(() => {
    if (override.pinned) {
      const p = PHASES.find((x) => x.id === override.pinned);
      if (p) return p;
    }
    const months = getMonthsSince(app.user.joinedAt);
    return getPhaseForMonth(months);
  });
}
