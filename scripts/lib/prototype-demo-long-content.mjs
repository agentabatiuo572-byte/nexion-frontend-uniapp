// Preview presets share the same order, task and withdrawal fixtures as the individual controls.
import { createHash } from 'node:crypto';

export const contentOptions = [
  ['normal', '普通长度'],
  ['long', '长单号账单、长作业及大额提现（切换会重置场景）'],
];
export const demoLongContentAvailable = state => state.dataState !== 'empty' && state.fleetState !== 'none'
  && (state.accountDeletionState ?? 'follow') === 'follow'
  && !['low-balance', 'reward-clawback-debt'].includes(state.paymentState === 'read-error'
    ? state.paymentBeforeReadError : state.paymentState);
export const demoHasLongContent = state => demoLongContentAvailable(state) && state.contentState === 'long';
export const demoHasLongBillRefs = state => demoLongContentAvailable(state)
  && (state.contentState === 'long' || state.billRefsState === 'long-refs');
export const demoHasLongTasks = state => demoLongContentAvailable(state)
  && (state.contentState === 'long' || state.deviceTaskSampleState === 'long');

export function normalizeDemoLongContent(state) {
  if (demoLongContentAvailable(state)) return false;
  const changed = state.contentState === 'long' || state.billRefsState === 'long-refs' || state.deviceTaskSampleState === 'long';
  Object.assign(state, {contentState:'normal', billRefsState:'normal', deviceTaskSampleState:'default'});
  return changed;
}

// Reproduce the audit's direct links while keeping the formal WD- plus 32 hex shape.
export const demoLongWithdrawalNo = sample => 'WD-' + createHash('md5').update(sample).digest('hex').toUpperCase();
export const longBankOrderNo = demoLongWithdrawalNo('WD-DEMO-LONG');
// D2's effective default in the formal backend applies at or above 1,000 USDT.
export const demoLongBankStrongReview = row => row.withdrawalNo === longBankOrderNo && row.bank?.amountUsdt >= 1000;
