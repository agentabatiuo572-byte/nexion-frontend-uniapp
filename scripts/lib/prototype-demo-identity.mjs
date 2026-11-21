// The preview issues this bearer only for its simulated signed-in session.
export const demoAccountId = '900001';
export const demoPhoneAccessToken = 'formal-probe-access-token';

export function previewAccountId(state, headers) {
  if (state.sessionState === 'signed-out' || state.authState === 'signed-out') return null;
  const accountId = String(state.authUser?.userId ?? demoAccountId);
  if (headers.authorization === 'Bearer local-demo-token'
      || headers.authorization === 'Bearer ' + demoPhoneAccessToken && state.phoneSessionAccountId === accountId) return accountId;
  return null;
}
