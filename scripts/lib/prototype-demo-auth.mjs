// Loopback-only fixtures for sign-in, recovery and the current session.
import { randomBytes } from 'node:crypto';
import { issuePreviewAccessToken } from './prototype-demo-identity.mjs';

export const savedAttemptOptions = ['none', 'registration', 'registration-retry', 'oauth-existing'].map(value => [value, value]);
const recoverPath = /^\/auth\/users\/login\/attempts\/([^/]+)\/recover$/;
const existing = { userId: 900001, countryCode: '+86', phone: '13800000000', nickname: 'Alex', onboardingComplete: true };
const registrationReceipt = {
  sponsorCode: null, sponsorDisplayName: null, sourceEnvironment: 'PRODUCTION',
  giftStatus: 'PENDING_REVIEW', giftUsdt: 5, giftNex: 20,
};
const success = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
const failure = (status, message) => ({ status, body: { code: status, message, data: null } });

export function createAuthDemo(state) {
  let saved = null;
  const session = user => ({ accessToken: issuePreviewAccessToken(state, user.userId), refreshToken: null, tokenType: 'Bearer', user });

  function issue(data) {
    state.sessionState = 'signed-in';
    state.authUser = data.user;
    return success(data);
  }

  return {
    reset() {
      saved = null;
      delete state.authUser;
    },
    savedAttempt() {
      if (saved || state.savedAttemptState === 'none') return null;
      const oauth = state.savedAttemptState === 'oauth-existing';
      const countryCode = '+86', phone = '13800000001';
      const attempt = {
        loginAttemptId: randomBytes(16).toString('hex'),
        recoveryProof: randomBytes(32).toString('base64url'),
        installationId: '', executionSupported: false, pending: true,
        authMethod: oauth ? 'OAUTH' : 'REGISTRATION',
        authReference: oauth ? 'GOOGLE:OIDC-' + randomBytes(16).toString('hex') : countryCode + ':' + phone,
        context: oauth ? { provider: 'GOOGLE' } : {
          countryCode, phone, language: 'zh', sponsorCode: null, challengeNo: 'REG-' + randomBytes(16).toString('hex'),
        },
      };
      const response = oauth ? session(existing) : {
        ...session({ ...existing, userId: 900002, phone, onboardingComplete: false }),
        registrationReceipt,
      };
      saved = { attempt, response, recoverUnavailable: state.savedAttemptState === 'registration-retry' };
      return attempt;
    },
    handles(path) {
      return recoverPath.test(path) || ['/auth/users/login', '/auth/users/refresh', '/auth/users/logout'].includes(path)
        || (saved && path === '/auth/users/register');
    },
    handle(path, headers, body) {
      if (path === '/auth/users/login') {
        if (body.countryCode !== existing.countryCode || body.phone !== existing.phone || body.password !== 'Local404Pass!') {
          return failure(401, 'USER_CREDENTIAL_INVALID');
        }
        return issue({
          ...session({ ...existing, nickname: 'Formal Probe' }),
          accessToken: 'formal-probe-access-token',
        });
      }
      if (path === '/auth/users/logout') {
        state.sessionState = 'signed-out';
        delete state.authUser;
        state.savedAttemptState = 'none';
        saved = null;
        return success(null);
      }
      if (path === '/auth/users/refresh') {
        return state.sessionState === 'signed-out'
          ? failure(401, 'AUTH_REQUIRED')
          : success(session(state.authUser ?? existing));
      }
      const recovery = recoverPath.exec(path);
      const id = recovery?.[1] ?? headers['x-nexgrid-login-attempt-id'];
      const attempt = saved?.attempt;
      if (!attempt || id !== attempt.loginAttemptId
          || headers['x-nexgrid-login-recovery-key'] !== attempt.recoveryProof
          || (recovery && body.recoveryProof !== attempt.recoveryProof)) {
        return failure(401, 'LOGIN_ATTEMPT_RECOVERY_INVALID');
      }
      const method = recovery ? body.authMethod : 'REGISTRATION';
      const reference = recovery ? body.authReference : body.countryCode + ':' + body.phone;
      if ((headers['x-nexgrid-installation-id'] ?? '') !== attempt.installationId
          || headers['x-nexgrid-execution-supported'] !== String(attempt.executionSupported)
          || (recovery && (body.installationId !== attempt.installationId || body.executionSupported !== attempt.executionSupported))
          || method !== attempt.authMethod || reference !== attempt.authReference) {
        return failure(409, 'LOGIN_ATTEMPT_CONTEXT_MISMATCH');
      }
      if (recovery && saved.recoverUnavailable) return failure(503, 'PREVIEW_RECOVERY_UNAVAILABLE');
      saved.recoverUnavailable = false;
      return issue(saved.response);
    },
  };
}
