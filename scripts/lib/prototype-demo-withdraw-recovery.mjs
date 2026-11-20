import { randomUUID } from 'node:crypto';
import { demoWithdrawalEligibility, demoWithdrawalPolicy, demoWithdrawalRisk } from './prototype-demo-finance.mjs';
import { demoWithdrawalFacts, demoWithdrawalUser } from './prototype-demo-secondary.mjs';
import { demoWalletNex, postDemoWalletEntries } from './prototype-demo-wallet.mjs';

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
const day = 86400000;
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

function createReceipt(attempt, policy, createdAt, nexAvailable) {
  const { amount, network: chain, policyVersion, offset: useNexFeeOffset } = attempt.frozen;
  const feeKey = chain.split('-')[1].toLowerCase();
  const networkFee = policy.networkConfirmFeeUsd[feeKey];
  const nexBurned = useNexFeeOffset ? Math.min(nexAvailable, Math.ceil(networkFee / policy.nexFeeOffsetRate)) : 0;
  const feeWaived = Math.floor(nexBurned * policy.nexFeeOffsetRate * 1e6) / 1e6;
  const actualFee = money(networkFee - feeWaived);
  const { fastLaneApplied, strongReview, ...risk } = demoWithdrawalRisk(policy, chain, amount);
  const holdDays = chain === 'USDT-TRC20' ? policy.cooldownDays : risk.complianceHoldDays;
  const holdAt = createdAt + holdDays * day;
  return {
    withdrawalNo: attempt.withdrawalNo, amount, chain,
    status: fastLaneApplied || risk.complianceHoldApplies ? 'EXTENDED_HOLD' : 'REVIEW_PENDING',
    holdUntil: new Date(holdAt).toISOString(),
    payoutDueAt: new Date(holdAt + policy.payoutSlaHours * 3600000).toISOString(),
    networkConfirmUsd: networkFee, networkFee, penaltyFeeRate: 0, penaltyFee: 0, grossFee: networkFee,
    nexBurned, feeWaived, penaltyFeeWaived: 0, networkFeeWaived: feeWaived,
    actualPenaltyFee: 0, actualNetworkFee: actualFee, actualFee, netReceive: money(amount - actualFee),
    policyVersion, useNexFeeOffset, ...risk, strongReview, strongReviewRequired: strongReview,
    riskRoute: fastLaneApplied ? 'fast-pass' : strongReview ? 'strong-review' : 'manual',
    k3RiskRoute: 'pass', k4Priority: 'low', riskRuleId: null, idSource: 'server',
  };
}

function commit(attempt, receipt, createdAt, confirmedAt = null) {
  attempt.receipt = receipt;
  attempt.order = {
    ...receipt, targetAddress: attempt.frozen.address, createdAt: new Date(createdAt).toISOString(), confirmedAt,
    status: confirmedAt ? 'CONFIRMED' : receipt.status,
  };
  attempt.state = 'COMMITTED';
}

function reserve(state, receipt, at) {
  const { withdrawalNo, netReceive, actualNetworkFee, nexBurned } = receipt;
  const debit = { direction: 'OUT', at, category: 'withdraw' };
  postDemoWalletEntries(state,
    { ...debit, bizNo: withdrawalNo + ':USDT:PRINCIPAL', bizType: 'WITHDRAW_NET_PRINCIPAL', asset: 'USDT', amount: netReceive },
    ...(actualNetworkFee > 0 ? [{ ...debit, bizNo: withdrawalNo + ':USDT:NETWORK_FEE',
      bizType: 'WITHDRAW_NETWORK_FEE', asset: 'USDT', amount: actualNetworkFee }] : []),
    ...(nexBurned > 0 ? [{ ...debit, bizNo: withdrawalNo + ':NEX:OFFSET',
      bizType: 'WITHDRAW_FEE_OFFSET', asset: 'UVT', amount: nexBurned }] : []));
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
  const attempt = { frozen, state: selection, withdrawalNo: 'WD-B34-DEMO-' + id };
  if (selection === 'COMMITTED') {
    const createdAt = now - 2 * day;
    const receipt = createReceipt(attempt, policy, createdAt, 0);
    commit(attempt, receipt, createdAt, new Date(Date.parse(receipt.holdUntil) + 3600000).toISOString());
  }
  saveAttempt(state, user, attempt);
  return { accountKey: 'user:' + user, attempt: frozen };
}

export function handlesWithdrawalRecovery(state, path, method, headers) {
  const route = attemptRoute.exec(path);
  if (route) return method === (route[2] ? 'POST' : 'GET');
  return method === 'POST' && path === '/api/withdrawals'
    && Object.hasOwn(state.withdrawRecoveryDemo?.[demoWithdrawalUser(state)] ?? {}, headers['idempotency-key']?.trim());
}

export function withdrawalRecoveryResponse(state, path, method, headers, body) {
  const user = demoWithdrawalUser(state, headers);
  if (user === null) return fail(401, 'USER_AUTH_REQUIRED');

  const route = attemptRoute.exec(path);
  const key = route ? readKey(route[1]) : headers['idempotency-key']?.trim();
  if (!key || key.length > 128) return fail(400, 'IDEMPOTENCY_KEY_REQUIRED');

  const attempts = state.withdrawRecoveryDemo?.[user] ?? {};
  const attempt = Object.hasOwn(attempts, key) ? attempts[key] : undefined;
  if (method === 'GET') {
    if (!attempt || attempt.state === 'NOT_SEEN') return unseenWithdrawalAttempt(path, method);
    if (attempt.order) return ok({ state: 'COMMITTED', withdrawalNo: attempt.withdrawalNo, withdrawal: attempt.order, canRetrySameKey: false });
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
    if (attempt?.order) return ok({ state: 'COMMITTED', withdrawalNo: attempt.withdrawalNo, withdrawal: attempt.order });
    saveAttempt(state, user, { frozen, state: 'ABANDONED' });
    return ok({ state: 'ABANDONED', withdrawal: null });
  }

  if (attempt.receipt) return ok(attempt.receipt);
  if (attempt.state === 'ABANDONED') return fail(409, 'WITHDRAWAL_ATTEMPT_ABANDONED');
  if (attempt.state === 'REJECTED') return attempt.rejection ?? fail(409, 'WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH');
  if (attempt.state !== 'NOT_SEEN') return fail(409, 'WITHDRAWAL_DEMO_ATTEMPT_UNRESOLVED');

  const now = Date.now();
  const facts = demoWithdrawalFacts(state, now);
  const policy = demoWithdrawalPolicy(state, facts);
  const reject = (status, message, data) => {
    attempt.state = 'REJECTED';
    return attempt.rejection = fail(status, message, data);
  };
  if (!policy.withdrawalEnabled) return reject(409, 'WITHDRAWAL_KILL_SWITCH_DISABLED');
  if (!policy.enabledNetworks.includes(network)) return fail(409, 'WITHDRAWAL_NETWORK_DISABLED');
  if (policyVersion !== policy.policyVersion) {
    return reject(409, 'WITHDRAWAL_POLICY_VERSION_CONFLICT', { policyVersion: policy.policyVersion });
  }
  const { rejection } = demoWithdrawalEligibility(state, body, now, facts, policy);
  if (rejection) return reject(rejection === 'WITHDRAWAL_MIN_AMOUNT_NOT_MET' ? 422 : 409, rejection);
  const receipt = createReceipt(attempt, policy, now, demoWalletNex(state, now));
  if (receipt.netReceive <= 0) return reject(422, 'WITHDRAWAL_NET_AMOUNT_INVALID');
  reserve(state, receipt, now);
  commit(attempt, receipt, now);
  return ok(receipt);
}
