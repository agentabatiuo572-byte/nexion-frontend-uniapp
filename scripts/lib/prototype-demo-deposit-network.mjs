// Shared Lite preview state for wallet deposits and direct purchase payments.
export function demoDepositNetworkDisabledReason(state, network) {
  if (state.topupChannels === 'usdt-off' || state.topupChannels === 'erc20-off' && network === 'ERC20') return 'NOT_CONFIGURED';
  if (state.paymentState === 'usdt-off' || state.paymentState === 'erc20-off' && network === 'ERC20') return 'NETWORK_SWITCH_OFF';
  return null;
}
