// Preview presets share the same order, task and withdrawal fixtures as the individual controls.
import { createHash } from 'node:crypto';
import { demoPaymentScenario } from './prototype-demo-payment-mode.mjs';

export const contentOptions = [
  ['normal', '普通长度'],
  ['long', '长单号账单、长作业及大额提现（切换会重置场景）'],
];
export const demoLongContentAvailable = state => state.dataState !== 'empty' && state.fleetState !== 'none'
  && (state.accountDeletionState ?? 'follow') === 'follow'
  && !['low-balance', 'reward-clawback-debt'].includes(demoPaymentScenario(state));
const longTaskAvailable = state => demoLongContentAvailable(state)
  && ['app', 'cycles'].includes(state.computeState ?? 'app');
const longPresetAvailable = state => longTaskAvailable(state) && state.withdrawLimitState !== 'used';
export const demoHasLongContent = state => longPresetAvailable(state) && state.contentState === 'long';
export const demoHasLongBillRefs = state => demoHasLongContent(state)
  || (demoLongContentAvailable(state) && state.billRefsState === 'long-refs');
export const demoHasLongTasks = state => demoHasLongContent(state)
  || (longTaskAvailable(state) && state.deviceTaskSampleState === 'long');

export function disabledLongOptions(state) {
  return Object.entries({
    contentState: longPresetAvailable(state),
    billRefsState: demoLongContentAvailable(state),
    deviceTaskSampleState: longTaskAvailable(state),
  }).filter(([,available])=>!available).map(([key])=>key);
}

export function normalizeDemoLongContent(state) {
  const defaults = {contentState:'normal', billRefsState:'normal', deviceTaskSampleState:'default'};
  let changed = false;
  for (const key of disabledLongOptions(state)) {
    if (state[key] !== defaults[key]) changed = true;
    state[key] = defaults[key];
  }
  return changed;
}

// Reproduce the audit's direct links while keeping the formal WD- plus 32 hex shape.
export const demoLongWithdrawalNo = sample => 'WD-' + createHash('md5').update(sample).digest('hex').toUpperCase();
export const longBankOrderNo = demoLongWithdrawalNo('WD-DEMO-LONG');
// D2's effective default in the formal backend applies at or above 1,000 USDT.
export const demoLongBankStrongReview = row => row.withdrawalNo === longBankOrderNo && row.bank?.amountUsdt >= 1000;
