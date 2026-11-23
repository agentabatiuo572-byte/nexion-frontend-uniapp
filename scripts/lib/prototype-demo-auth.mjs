// Loopback-only fixtures for sign-in, recovery and the current session.
import { randomBytes } from 'node:crypto';
import { clearPreviewAccessToken, demoPhoneAccessToken, issuePreviewAccessToken, previewAccountId } from './prototype-demo-identity.mjs';
import { demoAccountPasswordMatches } from './prototype-demo-account.mjs';

export const savedAttemptOptions = ['none', 'registration', 'registration-retry', 'oauth-existing'].map(value => [value, value]);
const otpSendPath = /^\/auth\/users\/(login|register)\/otp\/send$/;
const recoverPath = /^\/auth\/users\/login\/attempts\/([^/]+)\/recover$/;
const existing = { userId: 900001, countryCode: '+86', phone: '13800000000', nickname: 'Alex', onboardingComplete: true };
const registrationReceipt = {
  sponsorCode: null, sponsorDisplayName: null, sourceEnvironment: 'PRODUCTION',
  giftStatus: 'PENDING_REVIEW', giftUsdt: 5, giftNex: 20,
};
const success = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
const failure = (status, message) => ({ status, body: { code: status, message, data: null } });
const session = user => ({ refreshToken: null, tokenType: 'Bearer', user });

export function createAuthDemo(state) {
  let saved = null;
  const otps = new Map();

  function issue(data) {
    state.sessionState = 'signed-in';
    state.authUser = data.user;
    const accessToken = issuePreviewAccessToken(state, data.user.userId, data.accessToken);
    return success({...data, accessToken});
  }

  function issueLogin(data, deviceName) {
    state.loginDeviceName = deviceName || 'UVEL H5';
    return issue(data);
  }

  return {
    reset() {
      saved = null;
      otps.clear();
      delete state.authUser;
      delete state.loginDeviceName;
      clearPreviewAccessToken(state);
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
      return recoverPath.test(path) || otpSendPath.test(path) || ['/auth/users/login', '/auth/users/refresh',
        '/auth/users/logout', '/auth/users/login/otp/verify', '/auth/users/register/otp/verify', '/auth/users/register'].includes(path);
    },
    handle(path, headers, body) {
      if (path === '/auth/users/login') {
        if (body.countryCode !== existing.countryCode || body.phone !== existing.phone || !demoAccountPasswordMatches(state, body.password)) {
          return failure(401, 'USER_CREDENTIAL_INVALID');
        }
        return issueLogin({
          ...session({ ...existing, nickname: 'Formal Probe' }),
          accessToken: demoPhoneAccessToken,
        }, body.deviceName);
      }
      if (path === '/auth/users/logout') {
        state.sessionState = 'signed-out';
        delete state.authUser;
        delete state.loginDeviceName;
        clearPreviewAccessToken(state);
        state.savedAttemptState = 'none';
        saved = null;
        return success(null);
      }
      if (path === '/auth/users/refresh') {
        return state.sessionState === 'signed-out' || headers.authorization && !previewAccountId(state, headers)
          ? failure(401, 'AUTH_REQUIRED')
          : issue(session(state.authUser ?? existing));
      }
      const send = otpSendPath.exec(path);
      if (send) {
        const prefix = send[1] === 'login' ? 'LOGIN' : 'REG';
        const challengeNo = prefix + '-' + randomBytes(16).toString('hex');
        otps.set(challengeNo, { countryCode: body.countryCode, phone: body.phone });
        return success({ challengeNo, resendAfterSec: 1, deliveryHint: '***' + body.phone.slice(-4) });
      }
      if (path.endsWith('/otp/verify') || (path === '/auth/users/register' && !saved)) {
        const login = path === '/auth/users/login/otp/verify';
        const challenge = otps.get(body.challengeNo);
        if (!challenge || !body.challengeNo.startsWith(login ? 'LOGIN-' : 'REG-')
            || challenge.countryCode !== body.countryCode || challenge.phone !== body.phone || body.code !== '123456') {
          return failure(422, login ? 'USER_LOGIN_OTP_INVALID' : 'USER_REGISTRATION_OTP_INVALID');
        }
        const knownAccount = body.countryCode === existing.countryCode && body.phone === existing.phone;
        if (login) {
          if (!knownAccount) return failure(401, 'USER_CREDENTIAL_INVALID');
          otps.delete(body.challengeNo);
          return issueLogin(session(existing), body.deviceName);
        }
        if (knownAccount) return failure(409, 'USER_REGISTRATION_ACCOUNT_EXISTS');
        if (path.endsWith('/otp/verify')) return success({ status: 'REGISTRATION_OTP_VERIFIED' });
        otps.delete(body.challengeNo);
        return issueLogin({
          ...session({ ...existing, userId: 900002, countryCode: body.countryCode, phone: body.phone, onboardingComplete: false }),
          registrationReceipt,
        }, body.deviceName);
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
      return issueLogin(saved.response, attempt.deviceName);
    },
  };
}
