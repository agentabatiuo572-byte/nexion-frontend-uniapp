/** Display only: keep API, ledger and command amounts at their original precision. */
export function formatGroupedAmount(value: number | string | null | undefined, precision: 2 | 4 | 6 | "full" = 2): string {
  const fixed = formatAmount(value, precision), [whole, fraction] = fixed.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction);
}
/** One line per asset that was actually credited, USDT first; a zero credit still reads "0 USDT". Display only. */
export function creditedAmounts(usdt: number | string | null | undefined, uvt: number | string | null | undefined) {
  const lines = ([[usdt, "USDT"], [uvt, "UVT"]] as const)
    .filter(([value]) => /[1-9]/.test(formatAmount(value, "full")))
    .map(([value, unit]) => ({ sign: "+", value: formatGroupedAmount(value, "full"), unit }));
  return lines.length ? lines : [{ sign: "", value: "0", unit: "USDT" as const }];
}
/** Display only: two decimals, the rest cut off rather than rounded (111.115101 → 111.11, 109.9989 → 109.99), grouped.
 *  Settled to six places first (the money contract's maximum), so float noise from client arithmetic such as
 *  64.1 − 1 = 63.0999… does not lose a cent. API, quote and request values keep their original precision. */
export function formatTruncatedAmount(value: number | string | null | undefined): string {
  const settled = formatAmount(value, 6);
  if (settled === "-") return settled;
  const [whole, fraction = ""] = settled.split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + fraction.slice(0, 2).padEnd(2, "0");
}
export function formatAmount(value: number | string | null | undefined, precision: 2 | 4 | 6 | "full" = 2): string {
  if (typeof value === "number" && !Number.isFinite(value)) return "-";
  const match = String(value ?? "").trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return "-";
  const [, sign, integer, fraction = "", exponent = "0"] = match;
  const shift = Number(exponent);
  if (shift < -324 || shift > 308) return "-";
  const digits = integer + fraction;
  const point = integer.length + shift;
  const whole = point > 0 ? digits.slice(0, point).padEnd(point, "0") : "0";
  const tail = (point < 0 ? "0".repeat(-point) : "") + digits.slice(Math.max(point, 0));
  if (precision === "full") {
    const decimals = tail.replace(/0+$/, "");
    return (sign === "-" && /[1-9]/.test(digits) ? "-" : "")
      + whole.replace(/^0+(?=\d)/, "") + (decimals ? "." + decimals : "");
  }
  const units = BigInt(whole + tail.slice(0, precision).padEnd(precision, "0")) + (tail[precision] >= "5" ? BigInt(1) : BigInt(0));
  const fixed = units.toString().padStart(precision + 1, "0");
  const decimals = fixed.slice(-precision).replace(/(\d{2}\d*?)0+$/, "$1");
  return (sign === "-" && /[1-9]/.test(digits) ? "-" : "") + fixed.slice(0, -precision) + "." + decimals;
}
