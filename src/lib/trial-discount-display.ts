import type { TrialConversionQuote } from "@/api/trial-api";
import { formatAmount } from "./amount-display";

/** Keep the displayed discount rows equal to the difference between the two displayed prices. */
export function trialDiscountDisplay(quote: TrialConversionQuote) {
  const cents = (amount: number) => Number(formatAmount(amount, 2).replace(".", ""));
  const total = cents(quote.priceUSD) - cents(quote.amountUSD);
  const early = cents(quote.earlyDiscountUSD);
  const promo = quote.offsetUSD > 0 ? cents(quote.promoDiscountUSD) : total - early;
  return { promo: promo / 100, early: early / 100, offset: (total - promo - early) / 100, total: total / 100 };
}
