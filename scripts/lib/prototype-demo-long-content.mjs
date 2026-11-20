// Preview presets share the same order, task and withdrawal fixtures as the individual controls.
import { createHash } from 'node:crypto';

export const contentOptions = [
  ['normal', '普通长度'],
  ['long', '长单号账单、长作业及大额提现（切换会重置场景）'],
];
export const demoHasLongContent = state => state.contentState === 'long';
export const demoHasLongBillRefs = state => demoHasLongContent(state) || state.billRefsState === 'long-refs';
export const demoHasLongTasks = state => demoHasLongContent(state) || state.deviceTaskSampleState === 'long';

// Reproduce the audit's direct links while keeping the formal WD- plus 32 hex shape.
export const demoLongWithdrawalNo = sample => 'WD-' + createHash('md5').update(sample).digest('hex').toUpperCase();
export const longBankOrderNo = demoLongWithdrawalNo('WD-DEMO-LONG');
