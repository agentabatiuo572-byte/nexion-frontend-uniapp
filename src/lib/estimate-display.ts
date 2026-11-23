/**
 * Estimated earnings only: never prices, balances, credited earnings or fees, which keep their exact amounts.
 * Two significant figures, no trailing zeros, thousands grouped (user 2026-11-23: an estimate to the cent reads false).
 * A range rounds its low end down and its high end up; ends that meet show one value. A single estimate rounds to nearest.
 */
type Rounding = "floor" | "ceil" | "round";

function exponent(value: number): number {
  return Number(value.toExponential().split("e")[1]);
}

function twoFigures(value: number, rounding: Rounding): number {
  if (!(value > 0)) return 0;
  const step = 10 ** (exponent(value) - 1);
  const units = value / step;
  // The epsilon keeps binary fractions (0.57 / 0.01 = 56.999…) on the figure they print as.
  const rounded = rounding === "floor" ? Math.floor(units + 1e-9) : rounding === "ceil" ? Math.ceil(units - 1e-9) : Math.round(units);
  return rounded * step;
}

function estimateText(value: number): string {
  if (value === 0) return "0";
  const [whole, fraction = ""] = value.toFixed(Math.max(0, 1 - exponent(value))).split(".");
  const kept = fraction.replace(/0+$/, "");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (kept ? `.${kept}` : "");
}

export function formatEstimate(value: number): string {
  return estimateText(twoFigures(value, "round"));
}

/** One part for a single value, two for a range; callers join them with an en dash or let a line break there. */
export function estimateRangeParts(low: number, high: number): string[] {
  if (low === high) return [formatEstimate(low)];
  const lowText = estimateText(twoFigures(low, "floor")), highText = estimateText(twoFigures(high, "ceil"));
  return lowText === highText ? [lowText] : [lowText, highText];
}

export function formatEstimateRange(low: number, high: number): string {
  return estimateRangeParts(low, high).join("–");
}
