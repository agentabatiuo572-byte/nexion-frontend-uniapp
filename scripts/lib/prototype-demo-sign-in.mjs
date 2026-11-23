// Loopback fixtures for password, passwordless SMS, and the separate second factor.
import { randomBytes } from 'node:crypto';
import { demoAccountPasswordMatches, demoSecurityAccount, demoTwoFactorAccountId } from './prototype-demo-account.mjs';
import { demoAccountId } from './prototype-demo-identity.mjs';

export const demoExistingUser = {
  userId: Number(demoAccountId), countryCode: '+86', phone: '13800000000', nickname: 'Alex', onboardingComplete: true,
};
const twoFactorUser = { ...demoExistingUser, userId: demoTwoFactorAccountId, phone: '13800000004' };
export function findDemoSignInUser(countryCode, phone) {
  return [demoExistingUser, twoFactorUser].find(row => row.countryCode === countryCode && row.phone === phone);
}

const signInPaths = ['/auth/users/login', '/auth/users/login/otp/send', '/auth/users/login/otp/verify', '/auth/users/login/2fa'];
const response = (status, message, data = null) => ({ status, body: { code: status === 200 ? 0 : status, message, data } });

export function createSignInDemo(state, issue) {
  const challenges = new Map();

  function challenge(prefix) {
    return prefix + randomBytes(16).toString('hex');
  }

  return {
    handles: path => signInPaths.includes(path),
    reset: () => challenges.clear(),
    handle(path, body) {
      const user = findDemoSignInUser(body.countryCode, body.phone);
      const twoFactor = user && demoSecurityAccount(state, user.userId).twoFactorEnabled;
      if (path === '/auth/users/login/otp/send') {
        const challengeNo = challenge('LOGIN-');
        if (user && !twoFactor) challenges.set(user.userId, challengeNo);
        return response(200, 'OK', { challengeNo, resendAfterSec: 1, deliveryHint: '***' + body.phone.slice(-4) });
      }
      if (path === '/auth/users/login/otp/verify') {
        if (!user || twoFactor || !/^LOGIN-[a-f0-9]{32}$/.test(body.challengeNo ?? '')
            || challenges.get(user.userId) !== body.challengeNo || body.code !== '123456') {
          return response(422, 'USER_OTP_LOGIN_CHALLENGE_INVALID');
        }
        challenges.delete(user.userId);
        return issue(user, body.deviceName, path);
      }
      if (!user || !demoAccountPasswordMatches(state, body.password, user.userId)) {
        return response(401, 'USER_CREDENTIAL_INVALID');
      }
      if (path === '/auth/users/login/2fa') {
        if (!twoFactor) return response(409, 'USER_TWO_FACTOR_NOT_REQUIRED');
        if (!/^OTP-[a-f0-9]{32}$/.test(body.challengeNo ?? '') || challenges.get(user.userId) !== body.challengeNo || body.code !== '123456') {
          return response(422, 'USER_TWO_FACTOR_CHALLENGE_INVALID');
        }
        challenges.delete(user.userId);
        return issue(user, body.deviceName, path);
      }
      if (!twoFactor) return issue(user, body.deviceName, path);
      const challengeNo = challenge('OTP-');
      const deliveryHint = '****' + user.phone.slice(-4);
      challenges.set(user.userId, challengeNo);
      return response(428, 'USER_TWO_FACTOR_VERIFICATION_REQUIRED', {
        accessToken: null, refreshToken: null, tokenType: 'Challenge',
        user: { ...user, phone: deliveryHint }, challengeNo, deliveryHint,
      });
    },
  };
}
