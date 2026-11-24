// Shared Lite preview state for wallet deposits and direct purchase payments.
import { demoPaymentScenario } from './prototype-demo-payment-mode.mjs';

export function demoDepositNetworkDisabledReason(state, network) {
  if (state.topupChannels === 'usdt-off' || state.topupChannels === 'erc20-off' && network === 'ERC20') return 'NOT_CONFIGURED';
  const paymentMode = demoPaymentScenario(state);
  if (paymentMode === 'usdt-off' || paymentMode === 'erc20-off' && network === 'ERC20') return 'NETWORK_SWITCH_OFF';
  return null;
}

export function demoChainDepositDisabledReason(state, network, scene = state.orderTopupState) {
  return demoDepositNetworkDisabledReason(state, network)
    ?? (scene === 'erc20-only' && network === 'BEP20' ? 'NETWORK_SWITCH_OFF' : null);
}
