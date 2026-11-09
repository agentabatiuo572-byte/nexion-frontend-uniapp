// Loopback demonstration only; never imported into the production application.
import { randomUUID } from 'node:crypto';

// One wallet fact for every read used by the account-deletion journey.
export function accountDeletionWallet(state) {
  if (!state.accountDeletionState || state.accountDeletionState === 'follow') return null;
  state.walletBalance ??= state.accountDeletionState === 'usdt' ? 12.34 : 0;
  state.walletNexBalance ??= state.accountDeletionState === 'nex' ? 0.000001 : 0;
  return { usdtAvailable: state.walletBalance, nexAvailable: state.walletNexBalance,
    pendingWithdraw: state.accountDeletionState === 'withdrawal' ? 100 : 0 };
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
    if (input.phone !== '13800000000' || input.password !== 'Local404Pass!') reject('USER_PASSWORD_INVALID', 422);
    return { accessToken: 'formal-probe-access-token', refreshToken: null, tokenType: 'Bearer',
      user: { userId: 900001, countryCode: '+86', phone: '13800000000', nickname: 'Formal Probe', onboardingComplete: true } };
  }
  if (path === '/auth/users/logout' && method === 'POST') return null;
  if (path === '/api/app/security/account-deletion' || path === '/api/app/security/account-deletion/cancel') {
    const history = state.accountDeletionDemo ??= { requests: [], commands: {} };
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
      if (!/^[A-Za-z]+ [A-Za-z]+ [1-9][0-9]$/.test(update.nickname || '')) reject('PROFILE_NICKNAME_INVALID', 400);
      if (state.profile.nickname === update.nickname) return { status: 'UNCHANGED', nickname: update.nickname };
      if (state.profile.nickname !== update.expectedNickname) reject('PROFILE_NICKNAME_CONFLICT');
      if (nextChange(state.profile.nicknameChangedAt)) reject('USER_NICKNAME_CHANGE_TOO_SOON');
      state.profile.nickname = update.nickname;
      state.profile.nicknameChangedAt = Date.now();
      return { status: 'UPDATED', nickname: update.nickname };
    }
    const { nicknameChangedAt, ...profile } = state.profile;
    return { ...profile, profileChangeIntervalDays: 7,
      nicknameChangeAvailableAt: nextChange(nicknameChangedAt), avatarChangeAvailableAt: null };
  }
  if (path === '/api/app/profile/language' && method === 'PUT') {
    const language = body().language;
    if (!['en','vi','zh','ja','ko','ru','es','pt','ar','de','fr'].includes(language)) reject('PROFILE_LANGUAGE_INVALID', 400);
    state.profile ??= { nickname: 'Alex', avatarUrl: new URL('/static/img/demo/profile-woman.jpg', url).href, avatarRevision: 'demo-profile-woman', language: locale, nicknameChangedAt: null };
    state.profile.language = language;
    return { status: 'UPDATED', language };
  }
}
