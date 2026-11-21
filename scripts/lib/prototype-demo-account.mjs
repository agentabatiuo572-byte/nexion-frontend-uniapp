// Loopback demonstration only; never imported into the production application.
import { createHash, randomUUID } from 'node:crypto';
import { isPasswordOk } from '../../src/auth/password-rules.ts';
import { previewInterfaceLanguages } from './design-review-fixture.mjs';
import { demoH4Account } from './prototype-demo-events.mjs';

const pendingWithdrawalAmount = 100;
const passwordDigest = password => createHash('sha256').update(password).digest('hex');
const initialPasswordDigest = passwordDigest('Local404Pass!');
// The public scenario snapshot contains the change date and session facts only.
const securityCredentials = new WeakMap();

export function demoAccountPasswordMatches(state, password) {
  return typeof password === 'string'
    && passwordDigest(password) === (securityCredentials.get(state.securityDemo)?.digest ?? initialPasswordDigest);
}

function activeOtherSecuritySessions(state, security) {
  if (state.securitySessionState !== 'paginated' || security.otherSessionsRevoked) return [];
  return Array.from({ length: 23 }, (_, index) => {
    const rowId = 3023 - index;
    return {
      rowId,
      session: {
        id: 'demo-h5-session-' + rowId,
        deviceName: index < 20 ? ['Android · Chrome', 'iPad · Safari', 'Mac · Safari'][index % 3] : 'Windows · Chrome',
        ipMasked: index < 20 ? '198.51.100.*' : '203.0.113.*',
        lastActiveAt: new Date(state.previewFactsAt - (index + 1) * 60000).toISOString(),
        current: false,
      },
    };
  });
}

// Java StringUtils.hasText and String.trim use different whitespace sets.
const javaHasText = value => typeof value === 'string'
  && /[^\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/.test(value);
const javaTrim = value => value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');

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
  if (method === 'GET' && path === '/api/app/security') {
    const cursor = url.searchParams.get('cursor');
    if (cursor !== null && (!/^[1-9][0-9]{0,18}$/.test(cursor) || BigInt(cursor) > 9223372036854775807n)) {
      reject('SECURITY_CURSOR_INVALID', 422);
    }
    if (state.securityReadFailure === (cursor === null ? 'overview' : 'next-page')) reject('DEMO_SECURITY_READ_UNAVAILABLE', 503);
    const security = state.securityDemo ??= { passwordChangedAt: new Date(state.previewFactsAt).toISOString() };
    const other = activeOtherSecuritySessions(state, security).filter(row => cursor === null || row.rowId < Number(cursor));
    const sessions = other.slice(0, 20).map(row => row.session);
    if (cursor === null) sessions.unshift({
      id: 'demo-session', deviceName: 'iPhone · Safari', ipMasked: '192.0.2.*',
      lastActiveAt: new Date().toISOString(), current: true,
    });
    return { twoFactorEnabled: true, passwordChangedAt: security.passwordChangedAt, sessions,
      nextCursor: other.length > 20 ? String(other[19].rowId) : null };
  }
  if (method === 'GET' && path === '/api/app/security/phone-number') {
    if (state.securityReadFailure === 'phone-policy') reject('DEMO_SECURITY_READ_UNAVAILABLE', 503);
    return { windowDays: 30, maxChanges: 2, usedChanges: 0, remainingChanges: 2, nextAvailableAt: '' };
  }
  const passwordReceipt = method === 'GET' && path.match(/^\/api\/app\/security\/password\/commands\/([^/]+)$/);
  if (passwordReceipt || (method === 'POST' && path === '/api/app/security/password')) {
    let key;
    try {
      key = passwordReceipt ? decodeURIComponent(passwordReceipt[1]) : request.headers()['idempotency-key'];
    } catch {
      reject('PASSWORD_COMMAND_KEY_INVALID', 422);
    }
    if (typeof key !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(key)) reject('PASSWORD_COMMAND_KEY_INVALID', 422);
    const security = state.securityDemo ??= { passwordChangedAt: new Date(state.previewFactsAt).toISOString() };
    let credentials = securityCredentials.get(security);
    const previous = credentials?.receipts.get(key);
    if (passwordReceipt) return previous ?? null;
    const { currentPassword, newPassword } = body();
    if (previous) {
      if (!demoAccountPasswordMatches(state, newPassword)) reject('PASSWORD_COMMAND_INPUT_CHANGED');
      return previous;
    }
    if (typeof newPassword !== 'string' || !isPasswordOk(newPassword)) reject('USER_NEW_PASSWORD_POLICY_REJECTED', 422);
    if (!demoAccountPasswordMatches(state, currentPassword)) reject('CURRENT_PASSWORD_INVALID', 401);
    if (demoAccountPasswordMatches(state, newPassword)) reject('USER_NEW_PASSWORD_MUST_DIFFER', 422);
    const revokedSessionCount = activeOtherSecuritySessions(state, security).length;
    security.passwordChangedAt = new Date().toISOString();
    security.otherSessionsRevoked = true;
    if (!credentials) {
      credentials = { digest: initialPasswordDigest, receipts: new Map() };
      securityCredentials.set(security, credentials);
    }
    credentials.digest = passwordDigest(newPassword);
    const receipt = { passwordChangedAt: security.passwordChangedAt, revokedSessionCount };
    credentials.receipts.set(key, receipt);
    return receipt;
  }
  if (path === '/api/app/security/account-deletion' || path === '/api/app/security/account-deletion/cancel') {
    if (method === 'GET' && state.securityReadFailure === 'deletion') reject('DEMO_SECURITY_READ_UNAVAILABLE', 503);
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
    const rawKey = request.headers()['idempotency-key'];
    if (!javaHasText(rawKey) || javaTrim(rawKey).length > 160) reject('IDEMPOTENCY_KEY_INVALID', 422);
    const key = javaTrim(rawKey);
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
    const originalReason = javaHasText(input.reason) ? javaTrim(input.reason) : null;
    if (originalReason !== null && originalReason.length > 255) reject('ACCOUNT_DELETION_REASON_INVALID', 422);
    if (!demoAccountPasswordMatches(state, input.currentPassword)) reject('CURRENT_PASSWORD_INVALID', 401);
    const retained = history.requests.find(row => row.requestNo === history.commands[key]);
    if (retained) return retained;
    if (current && ['REQUESTED', 'IN_REVIEW', 'BLOCKED', 'COMPLETED'].includes(current.status)) return current;
    const row = { requestNo: 'ADR-' + randomUUID().replaceAll('-', ''), status: 'REQUESTED', version: 0,
      requestedAt: new Date().toISOString(), reviewedAt: null, completedAt: null, cancelledAt: null,
      reason: null, blockReason: null, originalReason };
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
