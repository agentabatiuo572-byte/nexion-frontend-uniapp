// The preview issues this bearer only for its simulated signed-in session.
export const demoAccountId = '900001';

export function previewAccountId(state, headers) {
  if (headers.authorization !== 'Bearer local-demo-token'
      || state.sessionState === 'signed-out' || state.authState === 'signed-out') return null;
  return String(state.authUser?.userId ?? demoAccountId);
}
