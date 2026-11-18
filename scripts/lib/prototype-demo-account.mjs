// Loopback demonstration only; never imported into the production application.
import { randomUUID } from 'node:crypto';
import { previewInterfaceLanguages } from './design-review-fixture.mjs';
import { demoH4Account } from './prototype-demo-events.mjs';

const pendingWithdrawalAmount = 100;

// One wallet fact for every read used by the account-deletion journey.
export function accountDeletionWallet(state) {
  if (!state.accountDeletionState || state.accountDeletionState === 'follow') return null;
  state.walletBalance ??= state.accountDeletionState === 'usdt' ? 12.34 : 0;
  state.walletNexBalance ??= state.accountDeletionState === 'nex' ? 0.000001 : 0;
  return { usdtAvailable: state.walletBalance, nexAvailable: state.walletNexBalance,
    pendingWithdraw: state.accountDeletionState === 'withdrawal' ? pendingWithdrawalAmount : 0 };
}
// Retained accounts share the spent funds that explain their small closing balances.
export function demoDeletionHistory(state) {
  if (!state.accountDeletionState || state.accountDeletionState === 'follow') return null;
  const hasHistory = state.dataState !== 'empty' && state.accountDeletionState !== 'clear';
  const at = state.previewFactsAt;
  const swap = hasHistory ? { exchangeNo: 'EX-DEMO-HISTORY', fromAsset: 'UVT', toAsset: 'USDT',
    fromAmount: 128, toAmount: 15.9, rate: .125, status: 'COMPLETED', at } : null;
  const withdrawals = [];
  const pending = state.accountDeletionState === 'withdrawal';
  if (pending) withdrawals.push({
    withdrawalNo: 'WD-DEMO-1', amount: pendingWithdrawalAmount, netReceive: pendingWithdrawalAmount - 1,
    fee: 1, status: 'PROCESSING', at,
  });
  if (hasHistory) withdrawals.push({
    withdrawalNo: pending ? 'WD-DEMO-2' : 'WD-DEMO-1', amount: 250, netReceive: 249, fee: 1, status: 'CONFIRMED', at,
  });
  return { swap, withdrawals };
}
export function accountDemo(url, locale, state, request) {
  const path = url.pathname;
  const method = request.method();
  const body = () => request.postDataJSON() || {};
  const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
  const interval = 7 * 86400000;
  const nextChange = (changedAt) => changedAt && changedAt + interval > Date.now() ? changedAt + interval : null;
  if (path === '/auth/users/login' && method === 'POST') {
    const input = body();
    if (input.countryCode !== '+86' || input.phone !== '13800000000' || input.password !== 'Local404Pass!') reject('USER_CREDENTIAL_INVALID', 401);
    return { accessToken: 'formal-probe-access-token', refreshToken: null, tokenType: 'Bearer',
      user: { userId: 900001, countryCode: '+86', phone: '13800000000', nickname: 'Formal Probe', onboardingComplete: true } };
  }
  if (path === '/auth/users/logout' && method === 'POST') return null;
  if (path === '/api/app/security/account-deletion' || path === '/api/app/security/account-deletion/cancel') {
    const history = state.accountDeletionDemo ??= { requests: [], commands: {} };
    const blockedReason = { 'blocked-funds': 'UNSETTLED_FUNDS_OR_ORDERS',
      'blocked-unavailable': 'UNSETTLED_STATE_UNAVAILABLE', 'blocked-unknown': 'DEMO_UNKNOWN_BLOCK_REASON',
      'blocked-operator': 'HD-C2D-04 工单资料尚未核齐，由运营拒绝申请' }[state.accountDeletionState];
    if (blockedReason && history.blockedScene !== state.accountDeletionState) {
      history.requests.push({ requestNo: 'ADR-' + randomUUID().replaceAll('-', ''), status: 'BLOCKED', version: 2,
        requestedAt: new Date(Date.now() - 60000).toISOString(), reviewedAt: new Date().toISOString(),
        completedAt: null, cancelledAt: null, reason: blockedReason, blockReason: blockedReason, originalReason: null });
    }
    history.blockedScene = state.accountDeletionState;
    const current = history.requests.at(-1);
    if (method === 'GET' && path.endsWith('/account-deletion')) return current ?? { status: 'NONE' };
    if (method !== 'POST') reject('METHOD_NOT_ALLOWED', 405);
    const key = request.headers()['idempotency-key'];
    if (!key) reject('IDEMPOTENCY_KEY_INVALID', 422);
    const input = body();
    if (path.endsWith('/cancel')) {
      if (!current) reject('ACCOUNT_DELETION_REQUEST_NOT_FOUND', 404);
      if (current.status === 'CANCELLED') return { ...current, userId: 900001, reviewedBy: null };
      if (input.expectedVersion !== current.version) reject('ACCOUNT_DELETION_VERSION_CONFLICT');
      if (!['REQUESTED', 'IN_REVIEW', 'BLOCKED'].includes(current.status)) reject('ACCOUNT_DELETION_TRANSITION_INVALID');
      Object.assign(current, { status: 'CANCELLED', version: current.version + 1,
        cancelledAt: new Date().toISOString(), reason: input.reason || 'USER_REQUESTED_CANCEL' });
      // The backend cancel endpoint returns the full row, including management fields.
      const response = { ...current, userId: 900001, reviewedBy: null };
      return response;
    }
    if (input.confirmation !== 'DELETE') reject('ACCOUNT_DELETION_CONFIRMATION_REQUIRED', 422);
    if (input.currentPassword !== 'Local404Pass!') reject('USER_CURRENT_PASSWORD_INVALID', 422);
    const retained = history.requests.find(row => row.requestNo === history.commands[key]);
    if (retained) return retained;
    if (current && ['REQUESTED', 'IN_REVIEW', 'BLOCKED', 'COMPLETED'].includes(current.status)) return current;
    const row = { requestNo: 'ADR-' + randomUUID().replaceAll('-', ''), status: 'REQUESTED', version: 0,
      requestedAt: new Date().toISOString(), reviewedAt: null, completedAt: null, cancelledAt: null,
      reason: null, blockReason: null, originalReason: input.reason ?? null };
    history.requests.push(row);
    history.commands[key] = row.requestNo;
    return row;
  }
  if (path === '/api/app/profile') {
    state.profile ??= { nickname: 'Alex', avatarUrl: new URL('/static/img/demo/profile-woman.jpg', url).href, avatarRevision: 'demo-profile-woman', language: locale, nicknameChangedAt: null };
    if (method === 'PUT') {
      const update = body();
      if (!/^[A-Za-z]+ [A-Za-z]+ (?=[A-Z2-9]*[A-Z])(?=[A-Z2-9]*[2-9])[A-HJ-NP-Z2-9]{2,3}$/.test(update.nickname || '')) reject('PROFILE_NICKNAME_INVALID', 400);
      if (state.profile.nickname === update.nickname) return { status: 'UNCHANGED', nickname: update.nickname };
      if (state.profile.nickname !== update.expectedNickname) reject('PROFILE_NICKNAME_CONFLICT');
      if (nextChange(state.profile.nicknameChangedAt)) reject('USER_NICKNAME_CHANGE_TOO_SOON');
      state.profile.nickname = update.nickname;
      state.profile.nicknameChangedAt = Date.now();
      return { status: 'UPDATED', nickname: update.nickname };
    }
    const { nicknameChangedAt, ...profile } = state.profile;
    return { ...profile, createdAt: new Date(demoH4Account(state).createdAt).toISOString(), profileChangeIntervalDays: 7,
      nicknameChangeAvailableAt: nextChange(nicknameChangedAt), avatarChangeAvailableAt: null };
  }
  if (path === '/api/app/profile/language' && method === 'PUT') {
    const requested = body().language;
    if (!previewInterfaceLanguages().includes(requested)) reject('PROFILE_LANGUAGE_INVALID', 422);
    const language = previewInterfaceLanguages(state.interfaceLanguagesState).includes(requested) ? requested : 'en';
    state.profile ??= { nickname: 'Alex', avatarUrl: new URL('/static/img/demo/profile-woman.jpg', url).href, avatarRevision: 'demo-profile-woman', language: locale, nicknameChangedAt: null };
    state.profile.language = language;
    return { status: 'UPDATED', language };
  }
}
