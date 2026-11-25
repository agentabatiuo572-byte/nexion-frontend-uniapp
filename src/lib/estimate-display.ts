import type { EstimateRange } from "@/api/estimate-range";

/** Two significant figures for estimates. Prices, balances, credited earnings and fees use exact amounts. */
type Rounding = "floor" | "ceil" | "round";

function twoFigures(value: number, rounding: Rounding): string {
  if (value <= 0 || !Number.isFinite(value)) return "0";

  const [mantissa, exponent] = value.toExponential().split("e");
  const digits = mantissa.replace(".", "").padEnd(2, "0");
  const rest = digits.slice(2);
  const increment = rounding === "ceil" ? /[1-9]/.test(rest) : rounding === "round" && rest >= "5";
  const figures = String(Number(digits.slice(0, 2)) + Number(increment));

  const places = 1 - Number(exponent);
  const padded = places > 0 ? figures.padStart(places + 1, "0") : figures + "0".repeat(-places);
  const whole = places > 0 ? padded.slice(0, -places) : padded;
  const fraction = places > 0 ? padded.slice(-places).replace(/0+$/, "") : "";
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
}

export function formatEstimate(value: number, range?: EstimateRange | null): string {
  return range ? formatEstimateRange(range.low, range.high) : twoFigures(value, "round");
}

// Only computed totals can have arithmetic noise. Preserve every digit of a server-supplied endpoint.
function normalizeCalculatedAmount(value: number): number {
  const decimal = Number(value.toPrecision(15));
  return Math.abs(value - decimal) <= Number.EPSILON * Math.abs(value) ? decimal : value;
}

/** One part for a single value, two for a range; callers join them with an en dash or let a line break there. */
export function estimateRangeParts(low: number, high: number, calculated = false): string[] {
  if (calculated) {
    low = normalizeCalculatedAmount(low);
    high = normalizeCalculatedAmount(high);
  }
  if (low === high) return [formatEstimate(low)];
  const lowText = twoFigures(low, "floor"), highText = twoFigures(high, "ceil");
  return lowText === highText ? [lowText] : [lowText, highText];
}

/** A range as one string never breaks at its dash (03 §3.6.1): word joiners hold both sides. */
export function formatEstimateRange(low: number, high: number, calculated = false): string {
  return estimateRangeParts(low, high, calculated).join("\u2060–\u2060");
}
