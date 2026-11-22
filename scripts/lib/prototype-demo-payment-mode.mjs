// Recovery selectors overlay the current payment and account scenario.
const isOverlay = mode => mode === 'intent-missing' || mode === 'read-error';

export function demoPaymentScenario(state) {
  const mode = state.paymentState ?? 'delivered';
  if (!isOverlay(mode)) return mode;
  const prior = state.paymentScenario ?? state.paymentBeforeReadError;
  return !prior || isOverlay(prior) ? 'delivered' : prior;
}

export function demoPaymentIntentMissing(state) {
  return state.paymentState === 'intent-missing'
    || state.paymentState === 'read-error' && state.paymentBeforeReadError === 'intent-missing';
}

export function selectDemoPaymentState(state, previousScenario, wasMissing) {
  if (isOverlay(state.paymentState)) state.paymentScenario = previousScenario;
  else delete state.paymentScenario;
  if (state.paymentState === 'read-error' && wasMissing) state.paymentBeforeReadError = 'intent-missing';
  else delete state.paymentBeforeReadError;
}
