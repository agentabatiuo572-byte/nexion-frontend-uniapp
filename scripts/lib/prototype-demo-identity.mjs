import { randomBytes } from 'node:crypto';

export const demoAccountId = '900001';
const defaultAccessToken = 'local-demo-token';
const issuedTokens = new WeakMap();

export function issuePreviewAccessToken(state, userId) {
  const accountId = String(userId);
  if (accountId === demoAccountId) return defaultAccessToken;
  if (!issuedTokens.has(state)) issuedTokens.set(state, new Map());
  const tokens = issuedTokens.get(state);
  if (!tokens.has(accountId)) tokens.set(accountId, randomBytes(32).toString('base64url'));
  return tokens.get(accountId);
}

export function previewAccountId(state, headers) {
  if (state.sessionState === 'signed-out' || state.authState === 'signed-out') return null;
  const authorization = headers?.authorization;
  if (authorization === 'Bearer ' + defaultAccessToken || authorization === 'Bearer formal-probe-access-token') return demoAccountId;
  for (const [accountId, token] of issuedTokens.get(state) ?? []) {
    if (authorization === 'Bearer ' + token) return accountId;
  }
  return null;
}
