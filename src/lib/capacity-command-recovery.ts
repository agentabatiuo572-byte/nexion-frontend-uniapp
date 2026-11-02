import type { CanonicalCapacityReplaceQuote } from '@/api/device-e3-api';
import { readAccountRow } from '@/store/account-scoped-storage';
import { CAPACITY_COMMAND_TABLE, readPendingKeepCommand, type PendingKeepCommand } from './keep-command-recovery';

export const CAPACITY_RECOVERY_TABLE = "nexgrid-e3-capacity-payment-accounts-v1";
export type CapacityPending = {operation:"replace"|"keep";intent:string;key:string;quote:CanonicalCapacityReplaceQuote}
  | (PendingKeepCommand & {operation:"keep";quote:null});

export function capacityIntent(operation: "replace" | "keep", quote: CanonicalCapacityReplaceQuote): string {
  return [operation, quote.sourceDeviceId ?? "none", quote.targetProductNo, quote.targetProductId,
    quote.targetPriceUsdt, quote.payableUsdt, quote.maxActiveDevices].join("|");
}

export function readCapacityPending(accountKey:string,targetProductNo?:string):CapacityPending|null {
  const row=readAccountRow<{pending?:unknown}>(CAPACITY_RECOVERY_TABLE,accountKey,true);
  if (!row?.pending) {
    const commands=readAccountRow<{commands?:Record<string,string>}>(CAPACITY_COMMAND_TABLE,accountKey,true)?.commands??{};
    if (Object.keys(commands).length>1) throw new Error('CAPACITY_ORIGINAL_UNRESOLVED');
    const legacy=readPendingKeepCommand(accountKey,targetProductNo);
    return legacy?{...legacy,operation:'keep',quote:null}:null;
  }
  const value=row.pending as Partial<CapacityPending>,q=value.quote;
  if (q===null) {
    const legacy=readPendingKeepCommand(accountKey);
    if (value.operation!=='keep'||!legacy||legacy.intent!==value.intent||legacy.key!==value.key
        ||legacy.targetProductNo!==value.targetProductNo||legacy.payableUsdt!==value.payableUsdt) throw new Error('CAPACITY_RECOVERY_INVALID');
    return targetProductNo&&legacy.targetProductNo!==targetProductNo?null:value as CapacityPending;
  }
  if (!['replace','keep'].includes(value.operation??'') || typeof value.key!=='string' || !value.key
      || typeof value.intent!=='string' || !q || !['REPLACE_REQUIRED','CAPACITY_AVAILABLE'].includes(q.decision) || q.decisionSource!=='server'
      || typeof q.targetProductNo!=='string' || !q.targetProductNo || typeof q.targetProductName!=='string'
      || !Number.isSafeInteger(q.targetProductId) || q.targetProductId<1
      || (value.operation==='replace'&&(q.decision!=='REPLACE_REQUIRED'||!Number.isSafeInteger(q.sourceDeviceId)||!q.sourceDeviceId))
      || !Number.isFinite(q.payableUsdt) || q.payableUsdt<0
      || capacityIntent(value.operation as 'replace'|'keep',q)!==value.intent) throw new Error('CAPACITY_RECOVERY_INVALID');
  return targetProductNo&&q.targetProductNo!==targetProductNo?null:value as CapacityPending;
}

