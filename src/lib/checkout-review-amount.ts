import { formatGroupedAmount } from './amount-display';

export type CheckoutReviewCurrency = 'USD' | 'USDT';
type Amount = Parameters<typeof formatGroupedAmount>[0];

/** Prices read as dollars at 1 USD = 1 USDT. Subtotal/total rows carry the unit; discount rows read
 * −$50.00 like the bundle builder, so a deduction sits beside $4,999.00 in the same form; item rows show
 * the bare number. An unknown amount stays a bare 「—」. */
export function formatCheckoutReviewAmount(amount: Amount, currency: CheckoutReviewCurrency, {
  discount = false, unit = false, precision = 2,
}: { discount?: boolean; unit?: boolean; precision?: Parameters<typeof formatGroupedAmount>[1] } = {}): string {
  const formatted = formatGroupedAmount(amount, precision);
  const value = formatted === '-' ? '—' : formatted;
  const sign = discount && value !== '—' && !value.startsWith('-') && /[1-9]/.test(value) ? '−' : '';
  if (discount && currency === 'USD' && value !== '—') return sign + '$' + value;
  if (!unit) return sign + value;
  return sign + (currency === 'USD' ? '$' + value : value + ' USDT');
}
