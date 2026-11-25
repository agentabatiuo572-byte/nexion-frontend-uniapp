import type { ApiClient } from './api-client';
import { ApiError } from './errors';

export type PaymentCommandKind = 'order-pay' | 'trial-convert' | 'trade-in' | 'capacity-replace' | 'capacity-keep';
export type PaymentCommandReceipt = {
  status: 'SUCCEEDED' | 'REJECTED' | 'PROCESSING' | 'NOT_SEEN' | 'INDETERMINATE';
  canResumeSameKey: boolean;
  receipt?: unknown;
  code?: number;
  message?: string;
  claimNo?: string;
  productNo?: string;
  paymentMethod?: string;
};
export async function readPaymentCommand(client: ApiClient, kind: PaymentCommandKind, commandKey: string): Promise<PaymentCommandReceipt> {
  const value = await client.request<unknown>({path:`/api/app/payment-commands/${kind}/${encodeURIComponent(commandKey)}`});
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError({kind:'protocol',message:'PAYMENT_COMMAND_RESPONSE_INVALID'});
  const row = value as Record<string, unknown>;
  if (row.kind !== kind || row.commandKey !== commandKey || !['SUCCEEDED','REJECTED','PROCESSING','NOT_SEEN','INDETERMINATE'].includes(row.status as string)
    || typeof row.canResumeSameKey !== 'boolean' || (row.status === 'SUCCEEDED' && row.receipt == null)
    || (row.message != null && typeof row.message !== 'string') || (row.code != null && !Number.isSafeInteger(row.code))
    || (row.claimNo != null && typeof row.claimNo !== 'string') || (row.productNo != null && typeof row.productNo !== 'string')
    || (row.paymentMethod != null && typeof row.paymentMethod !== 'string'))
    throw new ApiError({kind:'protocol',message:'PAYMENT_COMMAND_RESPONSE_INVALID'});
  return {status:row.status as PaymentCommandReceipt['status'],canResumeSameKey:row.canResumeSameKey,receipt:row.receipt,
    message:row.message as string|undefined,code:row.code as number|undefined,
    claimNo:row.claimNo as string|undefined,productNo:row.productNo as string|undefined,paymentMethod:row.paymentMethod as string|undefined};
}
