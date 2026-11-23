// Preview credentials are local to this process and belong to their issuing account.
import { randomUUID } from 'node:crypto';

export const demoAccountId = '900001';
export const demoReferralBuyer = {
  user: {userId:900010,countryCode:'+86',phone:'13800000010',nickname:'Referral Preview',onboardingComplete:true},
  sponsorUserId: demoAccountId,
};

export function demoPurchasingAccountId(state) {
  return state.promotionBuyer === 'sponsored-new' ? String(demoReferralBuyer.user.userId) : demoAccountId;
}
export const demoPhoneAccessToken = 'formal-probe-access-token';

const sessions = new WeakMap();

export function issuePreviewAccessToken(state, userId, preferredToken) {
  const accountId = String(userId);
  const previous = sessions.get(state);
  const accessToken = preferredToken ?? (previous?.accountId === accountId ? previous.accessToken : 'preview-' + randomUUID());
  sessions.set(state, {accountId, accessToken});
  return accessToken;
}

export function clearPreviewAccessToken(state) {
  sessions.delete(state);
}

export function previewSelectedAccountId(state) {
  if (state.sessionState === 'signed-out' || state.authState === 'signed-out') return null;
  return sessions.get(state)?.accountId ?? (state.authUser ? String(state.authUser.userId) : demoPurchasingAccountId(state));
}

export function previewAccountId(state, headers) {
  if (state.sessionState === 'signed-out' || state.authState === 'signed-out') return null;
  const session = sessions.get(state);
  if (session) return headers.authorization === 'Bearer ' + session.accessToken ? session.accountId : null;
  // Bootstrap credentials belong to the purchasing account selected in the preview.
  return !state.authUser && ['Bearer local-demo-token', 'Bearer ' + demoPhoneAccessToken].includes(headers.authorization)
    ? demoPurchasingAccountId(state) : null;
}
