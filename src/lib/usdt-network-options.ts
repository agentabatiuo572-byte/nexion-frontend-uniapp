// Apply the same policy to new options and to records after their API contract has been parsed.
const HIDDEN_USDT_NETWORKS: readonly string[] = ["TRC20", "USDT-TRC20", "CREGIS_USDT_TRC20"];

export function isVisibleUsdtNetwork(value?: string | null): boolean {
  return value == null || !HIDDEN_USDT_NETWORKS.includes(value.toUpperCase());
}

export const canSelectNewUsdtNetwork = isVisibleUsdtNetwork;
