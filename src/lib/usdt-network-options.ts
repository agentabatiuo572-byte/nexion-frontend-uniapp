// New USDT selections only. Keep parsing and displaying original records with their own network.
const HIDDEN_USDT_NETWORK_OPTIONS: readonly string[] = [
  "usdt-trc20",        // Deposit, payout address and local checkout
  "USDT-TRC20",        // Withdrawal
  "CREGIS_USDT_TRC20", // External purchase payment
];

export function canSelectNewUsdtNetwork(option: string): boolean {
  return !HIDDEN_USDT_NETWORK_OPTIONS.includes(option);
}
