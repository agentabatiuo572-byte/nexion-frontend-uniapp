import { randomUUID } from 'node:crypto';
import { demoWithdrawalPolicy, seedDemoConfirmedWithdrawal, submitDemoWithdrawal } from './prototype-demo-finance.mjs';
import { demoWithdrawalFacts, demoWithdrawalUser } from './prototype-demo-secondary.mjs';

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
const money = amount => Number(amount.toFixed(6));

function saveAttempt(state, user, attempt) {
  const accounts = state.withdrawRecoveryDemo ??= {};
  (accounts[user] ??= Object.create(null))[attempt.frozen.key] = attempt;
}

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

// Older preview handoffs embedded the current order in the original-key record.
export function restoreDemoWithdrawalOrders(state) {
  for (const [user, attempts] of Object.entries(state.withdrawRecoveryDemo ?? {})) {
    for (const attempt of Object.values(attempts)) {
      if (!attempt.order) continue;
      const accounts = state.withdrawalOrders ??= {};
      (accounts[user] ??= {})[attempt.withdrawalNo] = attempt.order;
      delete attempt.order;
    }
  }
}

export function seedWithdrawalRecovery(state, selection) {
  const user = demoWithdrawalUser(state);
  if (selection === 'off') return { accountKey: 'user:' + user, attempt: null };

  const id = randomUUID();
  const now = Date.now();
  const policy = demoWithdrawalPolicy(state, demoWithdrawalFacts(state, now));
  const frozen = {
    key: demoAttemptPrefix + id, amount: 100, network: 'USDT-BEP20',
    address: '0x' + '1'.repeat(40), policyVersion: policy.policyVersion, offset: false,
  };
  const attempt = { frozen, state: selection };
  if (selection === 'COMMITTED') {
    attempt.withdrawalNo = 'WD-B34-DEMO-' + id;
    attempt.receipt = seedDemoConfirmedWithdrawal(state, user, frozen, policy, now, attempt.withdrawalNo);
  }
  saveAttempt(state, user, attempt);
  return { accountKey: 'user:' + user, attempt: frozen };
}

export function handlesWithdrawalRequest(path, method) {
  const route = attemptRoute.exec(path);
  if (route) return method === (route[2] ? 'POST' : 'GET');
  return method === 'POST' && path === '/api/withdrawals';
}

export function withdrawalRecoveryResponse(state, path, method, headers, body) {
  const user = demoWithdrawalUser(state, headers);
  if (user === null) return fail(401, 'USER_AUTH_REQUIRED');

  const route = attemptRoute.exec(path);
  const key = route ? readKey(route[1]) : headers['idempotency-key']?.trim();
  if (!key || key.length > 128) return fail(400, 'IDEMPOTENCY_KEY_REQUIRED');

  const attempts = state.withdrawRecoveryDemo?.[user] ?? {};
  const attempt = Object.hasOwn(attempts, key) ? attempts[key] : undefined;
  const order = state.withdrawalOrders?.[user]?.[attempt?.withdrawalNo];
  if (method === 'GET') {
    if (!attempt || attempt.state === 'NOT_SEEN') return unseenWithdrawalAttempt(path, method);
    if (order) return ok({ state: 'COMMITTED', withdrawalNo: attempt.withdrawalNo, withdrawal: order, canRetrySameKey: false });
    if (attempt.state === 'ABANDONED' || attempt.state === 'REJECTED') {
      const { code, message } = attempt.rejection?.body ?? {
        code: 409, message: attempt.state === 'ABANDONED' ? 'WITHDRAWAL_ATTEMPT_ABANDONED' : 'WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH',
      };
      return ok({ state: 'REJECTED', reasonCode: code, reason: message, canRetrySameKey: false });
    }
    return ok({ state: attempt.state, canRetrySameKey: false });
  }

  if (body?.amount == null) return fail(422, 'WITHDRAWAL_AMOUNT_REQUIRED');
  const amount = Number(body.amount);
  if (!['number', 'string'].includes(typeof body.amount) || !Number.isFinite(amount) || money(amount) !== amount) {
    return fail(422, 'WITHDRAWAL_AMOUNT_SCALE_INVALID');
  }
  const network = typeof body.chain === 'string' ? body.chain.trim().toUpperCase() : '';
  if (!['USDT-BEP20', 'USDT-ERC20', 'USDT-TRC20'].includes(network)) return fail(422, 'WITHDRAWAL_CHAIN_INVALID');
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!/^[A-Za-z0-9:_-]{11,128}$/.test(address)) return fail(422, 'WITHDRAWAL_ADDRESS_INVALID');
  const policyVersion = typeof body.policyVersion === 'string' ? body.policyVersion.trim() : '';
  const offset = body.useNexFeeOffset === true;
  const frozen = { key, amount, network, address, policyVersion, offset };
  if (attempt && Object.keys(frozen).some(field => frozen[field] !== attempt.frozen[field])) {
    return fail(409, 'WITHDRAWAL_ATTEMPT_PAYLOAD_CONFLICT');
  }
  if (route?.[2]) {
    if (order) return ok({ state: 'COMMITTED', withdrawalNo: attempt.withdrawalNo, withdrawal: order });
    saveAttempt(state, user, { frozen, state: 'ABANDONED' });
    return ok({ state: 'ABANDONED', withdrawal: null });
  }

  if (attempt?.receipt) return ok(attempt.receipt);
  if (attempt?.state === 'ABANDONED') return fail(409, 'WITHDRAWAL_ATTEMPT_ABANDONED');
  if (attempt?.state === 'REJECTED') return attempt.rejection ?? fail(409, 'WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH');
  if (attempt && attempt.state !== 'NOT_SEEN') return fail(409, 'WITHDRAWAL_DEMO_ATTEMPT_UNRESOLVED');

  const result = submitDemoWithdrawal(state, user, frozen);
  if (result.receipt) {
    saveAttempt(state, user, {
      frozen, state: 'COMMITTED', withdrawalNo: result.receipt.withdrawalNo, receipt: result.receipt,
    });
    return ok(result.receipt);
  }
  const rejection = fail(result.status, result.message, result.data);
  saveAttempt(state, user, { frozen, state: 'REJECTED', rejection });
  return rejection;
}
