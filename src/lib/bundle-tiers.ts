import type { BundleDiscountTier } from "@/store/cart";
import { fmt } from "@/i18n/format";

/** Bundle tier copy shared by the store entry card and the bundle page (same words, same rules). */
export type BundleTierCopy = { tierCount: string; tierCountOpen: string; entryNote: string; hintFirst: string; hintNext: string; hintTop: string };

/** Tiers by size; a tier with the same rate as the one before it adds nothing, so it merges into that one. */
export function bundleSteps(tiers: ReadonlyArray<BundleDiscountTier> | null | undefined): BundleDiscountTier[] {
  const sorted = [...(tiers ?? [])].sort((left, right) => left.minItems - right.minItems);
  return sorted.filter((tier, index) => index === 0 || tier.pct > sorted[index - 1].pct);
}

/** A rate as written after the minus sign: 0.04 → "4", 0.075 → "7.5". */
export function bundlePct(pct: number): string {
  return String(Math.round(pct * 1000) / 10);
}

/** "2 款", "3 款" … and "4 款+" for the last tier, which also covers every larger bundle. */
export function bundleTierLabel(steps: ReadonlyArray<BundleDiscountTier>, index: number, copy: BundleTierCopy): string {
  return fmt(index === steps.length - 1 ? copy.tierCountOpen : copy.tierCount, { n: steps[index].minItems });
}

export function bundleCurrentStep(steps: ReadonlyArray<BundleDiscountTier>, count: number): BundleDiscountTier | null {
  return [...steps].reverse().find((step) => count >= step.minItems) ?? null;
}

/** The one sentence about the next model: where tiers start, what one more model reaches, or that the best price is in. */
export function bundleTierHint(steps: ReadonlyArray<BundleDiscountTier>, count: number, copy: BundleTierCopy): string {
  if (!steps.length) return "";
  if (count === 0) return fmt(copy.entryNote, { n: steps[0].minItems });
  const current = bundleCurrentStep(steps, count);
  const next = steps.find((step) => step.minItems > count);
  if (!next) return current ? fmt(copy.hintTop, { pct: bundlePct(current.pct) }) : "";
  const k = next.minItems - count;
  return current
    ? fmt(copy.hintNext, { k, a: bundlePct(current.pct), b: bundlePct(next.pct) })
    : fmt(copy.hintFirst, { k, pct: bundlePct(next.pct) });
}
