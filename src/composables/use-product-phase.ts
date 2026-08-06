import { computed, type ComputedRef } from "vue";
import { useApp } from "@/store/app";
import { resolveActivePhase, type PhaseParams } from "@/store/product-phase";

/**
 * Ported from Nexion-prototype/lib/hooks/use-product-phase.ts.
 *
 * Returns a reactive ComputedRef of the active platform phase + its params.
 * Combines user.joinedAt with the PM demo override (pinned phase) — override
 * wins when set, otherwise fall back to time-based phase. 解析逻辑收口在
 * resolveActivePhase(store/product-phase)—— 与 app.submitWithdrawal 的费用
 * 复验同一条路径,pin 态下两侧不再分叉。
 *
 * Usage in <script setup>: `const phase = useProductPhase()` then read
 * `phase.value`; in templates `phase.id`.
 */
export function useProductPhase(): ComputedRef<PhaseParams> {
  const app = useApp();
  return computed(() => resolveActivePhase(app.user.joinedAt));
}
