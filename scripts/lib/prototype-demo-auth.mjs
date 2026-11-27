// Loopback-only fixtures for sign-in, recovery and the current session.
import { randomBytes } from 'node:crypto';
import { isResetPasswordOk } from '../../src/auth/password-rules.ts';
import { clearPreviewAccessToken, demoReferralBuyer, demoPhoneAccessToken, issuePreviewAccessToken, previewAccountId, previewSelectedAccountId } from './prototype-demo-identity.mjs';
import { changeDemoPassword, demoAccountPasswordMatches, demoSecurityAccount } from './prototype-demo-account.mjs';
import { createSignInDemo, demoExistingUser as existing, findDemoSignInUser } from './prototype-demo-sign-in.mjs';

export const savedAttemptOptions = ['none', 'registration', 'registration-retry', 'oauth-existing'].map(value => [value, value]);
const recoverPath = /^\/auth\/users\/login\/attempts\/([^/]+)\/recover$/;
const registrationReceipt = {
  sponsorCode: null, sponsorDisplayName: null, sourceEnvironment: 'PRODUCTION',
  giftStatus: 'PENDING_REVIEW', giftUsdt: 5, giftNex: 20,
};
const success = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
const failure = (status, message, data = null) => ({ status, body: { code: status, message, data } });
const session = user => ({ refreshToken: null, tokenType: 'Bearer', user });

const resetRoot = '/auth/users/password-reset/otp';
const providerRoot = '/auth/users/oauth/provider';
const resetPaths = [resetRoot + '/send', resetRoot + '/verify', resetRoot + '/complete'];
export const demoAuthorizePrefix = 'https://127.0.0.1/auth/users/oauth/provider/authorize/';
const loginIdentities = { GOOGLE: existing, TELEGRAM: demoReferralBuyer.user };
const linkableProviders = ['GOOGLE', 'APPLE', 'TELEGRAM'];

export function createAuthDemo(state) {
  let saved = null;
  const otps = new Map();

  const resetChallenges = new Map();
  const providerFlows = new Map();

  function linksFor(accountId) {
    const accounts = state.oauthDemoLinksByAccount ??= {};
    return accounts[accountId] ??= Object.entries(loginIdentities)
      .filter(([, user]) => String(user.userId) === accountId)
      .map(([provider]) => provider);
  }

  function passwordReset(path, body) {
    const user = findDemoSignInUser(body.countryCode, body.phone);
    if (path === resetRoot + '/send') {
      const challengeNo = 'RESET-' + randomBytes(16).toString('hex');
      if (user) resetChallenges.set(user.userId, challengeNo);
      return success({ challengeNo, resendAfterSec: 1, deliveryHint: '***' + body.phone.slice(-4) });
    }
    if (!user || !body.challengeNo || resetChallenges.get(user.userId) !== body.challengeNo || body.code !== '123456') {
      return failure(422, 'USER_PASSWORD_RESET_CHALLENGE_INVALID');
    }
    if (path === resetRoot + '/verify') return success({ status: 'PASSWORD_RESET_OTP_VERIFIED' });
    if (typeof body.newPassword !== 'string' || !isResetPasswordOk(body.newPassword, { phone: user.phone })) {
      return failure(422, 'USER_PASSWORD_RESET_CHALLENGE_INVALID');
    }
    if (demoAccountPasswordMatches(state, body.newPassword, user.userId)) return failure(422, 'USER_NEW_PASSWORD_MUST_DIFFER');
    resetChallenges.delete(user.userId);
    const accountId = String(user.userId);
    let { revokedSessionCount } = changeDemoPassword(state, accountId, body.newPassword);
    if (previewSelectedAccountId(state) === accountId) {
      state.sessionState = 'signed-out';
      delete state.authUser;
      clearPreviewAccessToken(state);
      revokedSessionCount++;
    }
    return success({ status: 'PASSWORD_RESET', revokedSessionCount });
  }

  function startProvider(body, headers) {
    const { intent, provider } = body;
    const accountId = intent === 'LINK' ? previewAccountId(state, headers) : null;
    const user = Object.hasOwn(loginIdentities, provider) ? loginIdentities[provider] : null;
    if (intent === 'LINK') {
      if (!accountId) return failure(401, 'AUTH_REQUIRED');
      if (!linkableProviders.includes(provider)) return failure(503, 'OAUTH_PROVIDER_UNAVAILABLE');
      if (linksFor(accountId).includes(provider)) return failure(409, 'OAUTH_PROVIDER_ALREADY_LINKED');
    } else if (intent !== 'LOGIN' || !user) return failure(503, 'OAUTH_PROVIDER_UNAVAILABLE');

    const now = Date.now();
    for (const [id, flow] of providerFlows) if (flow.expiresAt <= now) providerFlows.delete(id);
    const expiresInSec = 120;
    const flowId = 'OIDC-' + randomBytes(16).toString('hex');
    const flowKey = randomBytes(32).toString('base64url');
    const authorizeKey = randomBytes(32).toString('base64url');
    const displayName = intent === 'LINK' ? state.authUser?.nickname ?? 'Alex' : user.nickname;
    providerFlows.set(flowId, { flowId, flowKey, authorizeKey, intent, provider, accountId, user, displayName,
      expiresAt: now + expiresInSec * 1000 });
    return success({ flowId, flowKey, expiresInSec, authorizationUrl: demoAuthorizePrefix + authorizeKey });
  }

  function handleProvider(path, body, headers) {
    if (path === providerRoot + '/start') return startProvider(body, headers);
    const flow = providerFlows.get(body.flowId);
    if (!flow || body.flowKey !== flow.flowKey || Date.now() >= flow.expiresAt)
      return failure(410, 'OAUTH_FLOW_EXPIRED');
    if (path === providerRoot + '/status') {
      return success({ provider: flow.provider, status: flow.consumed ? 'CONSUMED' : flow.receipt ? 'VERIFIED' : 'PENDING',
        displayName: flow.receipt ? flow.displayName : null });
    }
    if (flow.consumed || !flow.receipt || body.receipt !== flow.receipt) return failure(410, 'OAUTH_FLOW_EXPIRED');

    if (path === providerRoot + '/link') {
      const accountId = previewAccountId(state, headers);
      if (flow.intent !== 'LINK' || !accountId || accountId !== flow.accountId) return failure(403, 'AUTH_REQUIRED');
      if (!demoAccountPasswordMatches(state, body.password, accountId)) return failure(403, 'OAUTH_LINK_PASSWORD_INVALID');
      const linked = linksFor(accountId);
      if (linked.includes(flow.provider)) return failure(409, 'OAUTH_PROVIDER_ALREADY_LINKED');
      linked.push(flow.provider);
      flow.consumed = true;
      return success(null);
    }

    if (flow.intent !== 'LOGIN' || body.provider !== flow.provider) return failure(403, 'OAUTH_ACCOUNT_LINK_REQUIRED');
    const { user } = flow;
    if (!linksFor(String(user.userId)).includes(flow.provider)) return failure(403, 'OAUTH_ACCOUNT_LINK_REQUIRED');
    if (!body.challengeNo && !body.code) {
      const deliveryHint = '****' + user.phone.slice(-4);
      flow.challengeNo ??= 'OTP-' + randomBytes(16).toString('hex');
      return failure(428, 'USER_TWO_FACTOR_VERIFICATION_REQUIRED', {
        accessToken: null, refreshToken: null, tokenType: 'Challenge',
        user: { ...user, phone: deliveryHint }, challengeNo: flow.challengeNo, deliveryHint,
      });
    }
    if (!flow.challengeNo || body.challengeNo !== flow.challengeNo || body.code !== '123456')
      return failure(422, 'USER_TWO_FACTOR_CHALLENGE_INVALID');
    flow.consumed = true;
    return issueLogin(session(user), body.deviceName);
  }

  function issue(data) {
    state.sessionState = 'signed-in';
    state.authUser = data.user;
    const accessToken = issuePreviewAccessToken(state, data.user.userId, data.accessToken);
    return success({...data, accessToken});
  }

  function issueLogin(data, deviceName) {
    demoSecurityAccount(state, data.user.userId).deviceName = deviceName || 'UVEL H5';
    return issue(data);
  }

  const signIn = createSignInDemo(state, (user, deviceName, path) => issueLogin(
    path === '/auth/users/login' && user === existing ? { ...session({ ...user, nickname: 'Formal Probe' }), accessToken: demoPhoneAccessToken } : session(user),
    deviceName,
  ));

  return {
    reset() {
      saved = null;
      otps.clear();
      resetChallenges.clear();
      providerFlows.clear();
      signIn.reset();
      delete state.authUser;
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
        ...session({ ...existing, userId: 583920417, phone, onboardingComplete: false }),
        registrationReceipt,
      };
      saved = { attempt, response, recoverUnavailable: state.savedAttemptState === 'registration-retry' };
      return attempt;
    },
    linkedProviders(headers) {
      const accountId = previewAccountId(state, headers);
      return accountId ? success(linksFor(accountId)) : failure(401, 'AUTH_REQUIRED');
    },
    authorizeProvider(key) {
      const flow = [...providerFlows.values()].find(row => row.authorizeKey === key);
      if (!flow || flow.consumed || Date.now() >= flow.expiresAt) return null;
      flow.receipt ??= randomBytes(32).toString('base64url');
      return { type: 'uvel-oauth', flowId: flow.flowId, receipt: flow.receipt };
    },
    handles(path) {
      return signIn.handles(path) || recoverPath.test(path) || resetPaths.includes(path)
        || ['/start', '/status', '/link', '/complete'].some(suffix => path === providerRoot + suffix) || [
        '/auth/users/refresh', '/auth/users/logout',
        '/auth/users/register/otp/send', '/auth/users/register/otp/verify', '/auth/users/register'].includes(path);
    },
    handle(path, headers, body) {
      if (signIn.handles(path)) return signIn.handle(path, body);
      if (resetPaths.includes(path)) return passwordReset(path, body);
      if (path.startsWith(providerRoot + '/')) return handleProvider(path, body, headers);
      if (path === '/auth/users/logout') {
        state.sessionState = 'signed-out';
        delete state.authUser;
        clearPreviewAccessToken(state);
        state.savedAttemptState = 'none';
        saved = null;
        providerFlows.clear();
        return success(null);
      }
      if (path === '/auth/users/refresh') {
        return state.sessionState === 'signed-out' || headers.authorization && !previewAccountId(state, headers)
          ? failure(401, 'AUTH_REQUIRED')
          : issue(session(state.authUser ?? (state.promotionBuyer === 'sponsored-new' ? demoReferralBuyer.user : existing)));
      }
      if (path === '/auth/users/register/otp/send') {
        const challengeNo = 'REG-' + randomBytes(16).toString('hex');
        otps.set(challengeNo, { countryCode: body.countryCode, phone: body.phone,
          installationId: headers['x-nexgrid-installation-id'] ?? '' });
        return success({ challengeNo, resendAfterSec: 1, deliveryHint: '***' + body.phone.slice(-4) });
      }
      if (path === '/auth/users/register/otp/verify'
          || (path === '/auth/users/register' && (!saved || headers['x-nexgrid-login-attempt-id'] !== saved.attempt.loginAttemptId))) {
        const challenge = otps.get(body.challengeNo);
        if (!challenge || challenge.countryCode !== body.countryCode || challenge.phone !== body.phone || body.code !== '123456') {
          return failure(422, 'USER_REGISTRATION_OTP_INVALID');
        }
        if (findDemoSignInUser(body.countryCode, body.phone)) {
          return failure(409, 'USER_REGISTRATION_ACCOUNT_EXISTS');
        }
        if (path.endsWith('/otp/verify')) return success({ status: 'REGISTRATION_OTP_VERIFIED' });
        otps.delete(body.challengeNo);
        if (!challenge.installationId || challenge.installationId !== (headers['x-nexgrid-installation-id'] ?? '')) {
          return failure(428, 'USER_CAPTCHA_REQUIRED');
        }
        if (state.registrationState === 'device-limit') return failure(409, 'USER_REGISTRATION_DEVICE_LIMIT');
        return issueLogin({
          ...session({ ...existing, userId: 583920417, countryCode: body.countryCode, phone: body.phone, onboardingComplete: false }),
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
