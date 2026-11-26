import type { TrialConversionQuote } from "@/api/trial-api";
import type { TrialConfig } from "@/store/trial-config";
import { formatAmount } from "./amount-display";

export function hasTrialDiscountTerms(quote: TrialConversionQuote | null | undefined):
  quote is TrialConversionQuote & { discountRate: number; discountCapUSD: number } {
  return quote?.discountRate !== undefined && quote.discountCapUSD !== undefined;
}

export function trialDiscountTerms(quote: TrialConversionQuote | null | undefined, config: TrialConfig) {
  return hasTrialDiscountTerms(quote) ? quote : config;
}

/** Keep the displayed discount rows equal to the difference between the two displayed prices. */
export function trialDiscountDisplay(quote: TrialConversionQuote) {
  const cents = (amount: number) => Number(formatAmount(amount, 2).replace(".", ""));
  const total = cents(quote.priceUSD) - cents(quote.amountUSD);
  const early = quote.promoDiscountUSD === 0 && quote.offsetUSD === 0 ? total : cents(quote.earlyDiscountUSD);
  const promo = quote.promoDiscountUSD === 0 ? 0 : quote.offsetUSD > 0 ? cents(quote.promoDiscountUSD) : total - early;
  return { promo: promo / 100, early: early / 100, offset: (total - promo - early) / 100, total: total / 100 };
}
