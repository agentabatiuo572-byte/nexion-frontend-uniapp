import { randomUUID } from 'node:crypto';

export const withdrawRecoveryOptions = [
  ['off', '未载入尝试'],
  ['NOT_SEEN', '默认 · NOT_SEEN'],
  ['PROCESSING', 'PROCESSING'],
  ['UNKNOWN', 'UNKNOWN'],
  ['REJECTED', 'REJECTED'],
  ['COMMITTED', 'COMMITTED'],
];

const demoAttemptPrefix = 'withdrawal:b34-demo-';
const attemptRoute = /^\/api\/withdrawals\/attempts\/([^/]+)(\/abandon)?$/;
const ok = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
const fail = (status, message, data = null) => ({ status, body: { code: status, message, data } });
const demoUser = state => state.authUser?.userId ?? 900001;
const authorizedUser = (state, headers) =>
  state.sessionState !== 'signed-out' && state.authState !== 'signed-out'
    && ['Bearer local-demo-token', 'Bearer formal-probe-access-token'].includes(headers.authorization)
    ? demoUser(state) : null;

export function unseenWithdrawalAttempt(path, method) {
  const match = attemptRoute.exec(path);
  if (method !== 'GET' || !match || match[2]) return undefined;
  const key = readKey(match[1]);
  return !key || key.length > 128
    ? fail(400, 'IDEMPOTENCY_KEY_REQUIRED')
    : fail(404, 'WITHDRAWAL_ATTEMPT_NOT_FOUND', { state: 'NOT_SEEN', canRetrySameKey: true });
}

function readKey(segment) {
  try {
    return decodeURIComponent(segment).trim();
  } catch {
    return '';
  }
}

function commit(attempt, createdAt, confirmedAt = null) {
  const { amount, network, address, policyVersion, offset } = attempt.frozen;
  attempt.order = {
    withdrawalNo: attempt.withdrawalNo, amount, chain: network, targetAddress: address,
    createdAt: new Date(createdAt).toISOString(), confirmedAt,
    holdUntil: new Date(confirmedAt ?? createdAt + 7 * 86400000).toISOString(),
    status: confirmedAt ? 'CONFIRMED' : 'EXTENDED_HOLD', riskRoute: 'fast-pass', idSource: 'server',
    networkConfirmUsd: 1, networkFee: 1, penaltyFee: 0, grossFee: 1, nexBurned: 0,
    feeWaived: 0, actualFee: 1, netReceive: amount - 1, policyVersion, useNexFeeOffset: offset,
  };
  attempt.state = 'COMMITTED';
  return attempt.order;
}

export function seedWithdrawalRecovery(state, selection) {
  if (selection === 'off') return { accountKey: 'user:' + demoUser(state), attempt: null };

  const id = randomUUID();
  const user = demoUser(state);
  const frozen = {
    key: demoAttemptPrefix + id, amount: 100, network: 'USDT-BEP20',
    address: '0x' + '1'.repeat(40), policyVersion: 'money-policy', offset: false,
  };
  const attempt = { user, frozen, state: selection, withdrawalNo: 'WD-B34-DEMO-' + id };
  (state.withdrawRecoveryDemo ??= {})[frozen.key] = attempt;
  if (selection === 'COMMITTED') {
    const now = Date.now();
    commit(attempt, now - 8 * 86400000, now - 86400000);
  }
  return { accountKey: 'user:' + user, attempt: frozen };
}

export function demoRecoveryOrders(state, headers) {
  const user = authorizedUser(state, headers);
  return Object.values(state.withdrawRecoveryDemo ?? {})
    .filter(attempt => attempt.user === user && attempt.order)
    .map(attempt => attempt.order);
}

export function handlesWithdrawalRecovery(state, path, method, headers) {
  const route = attemptRoute.exec(path);
  if (route) return method === (route[2] ? 'POST' : 'GET');
  return method === 'POST' && path === '/api/withdrawals'
    && Object.hasOwn(state.withdrawRecoveryDemo ?? {}, headers['idempotency-key']);
}

export function withdrawalRecoveryResponse(state, path, method, headers, body) {
  const user = authorizedUser(state, headers);
  if (user === null) return fail(401, 'USER_AUTH_REQUIRED');

  const route = attemptRoute.exec(path);
  const key = route ? readKey(route[1]) : headers['idempotency-key'];
  if (!key || key.length > 128) return fail(400, 'IDEMPOTENCY_KEY_REQUIRED');

  const candidate = state.withdrawRecoveryDemo?.[key];
  const attempt = candidate?.user === user ? candidate : undefined;
  if (method === 'GET') {
    if (!attempt || attempt.state === 'NOT_SEEN') return unseenWithdrawalAttempt(path, method);
    if (attempt.order) return ok({ state: 'COMMITTED', withdrawalNo: attempt.withdrawalNo, withdrawal: attempt.order, canRetrySameKey: false });
    if (attempt.state === 'ABANDONED' || attempt.state === 'REJECTED') {
      const reason = attempt.state === 'ABANDONED' ? 'WITHDRAWAL_ATTEMPT_ABANDONED' : 'WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH';
      return ok({ state: 'REJECTED', reasonCode: 409, reason, canRetrySameKey: false });
    }
    return ok({ state: attempt.state, canRetrySameKey: false });
  }

  if (!attempt) return fail(409, 'WITHDRAWAL_DEMO_ATTEMPT_REQUIRED');
  const { amount, network, address, policyVersion, offset } = attempt.frozen;
  if (body.amount !== amount || body.chain !== network || body.address !== address
      || body.policyVersion !== policyVersion || body.useNexFeeOffset !== offset) {
    return fail(409, 'WITHDRAWAL_ATTEMPT_PAYLOAD_CONFLICT');
  }
  if (route?.[2]) {
    if (attempt.order) return ok({ state: 'COMMITTED', withdrawalNo: attempt.withdrawalNo, withdrawal: attempt.order });
    attempt.state = 'ABANDONED';
    return ok({ state: 'ABANDONED', withdrawal: null });
  }
  if (attempt.order) return ok(attempt.order);
  if (attempt.state === 'ABANDONED') return fail(409, 'WITHDRAWAL_ATTEMPT_ABANDONED');
  if (attempt.state === 'REJECTED') return fail(409, 'WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH');
  if (attempt.state !== 'NOT_SEEN') return fail(409, 'WITHDRAWAL_DEMO_ATTEMPT_UNRESOLVED');
  return ok(commit(attempt, Date.now()));
}
