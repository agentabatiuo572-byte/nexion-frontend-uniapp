// Preview credentials are local to this process and belong to their issuing account.
import { randomUUID } from 'node:crypto';

export const demoAccountId = '900001';

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
  return sessions.get(state)?.accountId ?? String(state.authUser?.userId ?? demoAccountId);
}

export function previewAccountId(state, headers) {
  if (state.sessionState === 'signed-out' || state.authState === 'signed-out') return null;
  const session = sessions.get(state);
  if (session) return headers.authorization === 'Bearer ' + session.accessToken ? session.accountId : null;
  // Keep the pre-sign-in fixture account available to the local preview drivers.
  return !state.authUser && headers.authorization === 'Bearer local-demo-token' ? demoAccountId : null;
}
