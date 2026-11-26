import type { TrialConversionQuote } from "@/api/trial-api";
import type { TrialConfig } from "@/store/trial-config";
import { formatAmount, formatGroupedAmount } from "./amount-display";

type TrialDiscountTerms = Pick<TrialConversionQuote, "discountRate" | "discountCapUSD">;

export function hasTrialDiscountTerms(quote: TrialDiscountTerms | null | undefined): quote is Required<TrialDiscountTerms> {
  return quote?.discountRate !== undefined && quote.discountCapUSD !== undefined;
}

export function trialDiscountTerms(quote: TrialDiscountTerms | null | undefined, config: TrialConfig) {
  return hasTrialDiscountTerms(quote) ? quote : config;
}

export function formatTrialDiscountCap(cap: number) {
  return Number.isInteger(cap) ? `$${cap}` : `$${formatGroupedAmount(cap, "full")}`;
}

/** Keep the displayed discount rows equal to the difference between the two displayed prices. */
export function trialDiscountDisplay(quote: Pick<TrialConversionQuote,
  "priceUSD" | "amountUSD" | "promoDiscountUSD" | "offsetUSD" | "earlyDiscountUSD">) {
  const cents = (amount: number) => Number(formatAmount(amount, 2).replace(".", ""));
  const total = cents(quote.priceUSD) - cents(quote.amountUSD);
  const early = quote.promoDiscountUSD === 0 && quote.offsetUSD === 0 ? total : cents(quote.earlyDiscountUSD);
  const promo = quote.promoDiscountUSD === 0 ? 0 : quote.offsetUSD > 0 ? cents(quote.promoDiscountUSD) : total - early;
  return { promo: promo / 100, early: early / 100, offset: (total - promo - early) / 100, total: total / 100 };
}
