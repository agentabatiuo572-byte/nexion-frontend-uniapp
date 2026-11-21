// Non-binding loopback sample. The real disclosure store and reading gate remain unchanged.
import { randomUUID } from 'node:crypto';
import { auxiliaryDemo } from './prototype-demo-auxiliary.mjs';

const readTokenLifetime = 300000;

export function riskDemo(url, locale, state, request) {
  const currentPath = '/api/legal/risk-disclosure/current';
  const acknowledgmentPath = '/api/legal/risk-disclosure/acknowledgment';
  if (![currentPath, acknowledgmentPath].includes(url.pathname)) return undefined;
  const now = Date.now();
  const base = auxiliaryDemo(new URL(currentPath, url.origin), locale, state, { method: () => 'GET' });
  state.riskDemo ??= { accepted: state.riskState !== 'unread' };
  const sample = state.riskDemo;
  if (url.pathname === acknowledgmentPath && request.method() === 'POST') {
    const body = request.postDataJSON() || {};
    const reading = sample.reading;
    if (body.confirmed !== true || body.jurisdiction !== base.jurisdiction || body.version !== base.version
      || sample.accepted || !reading || body.acknowledgmentToken !== reading.token
      || reading.jurisdiction !== base.jurisdiction || reading.version !== base.version
      || now - reading.issuedAt < base.minimumReadingSeconds * 1000 || now - reading.issuedAt >= readTokenLifetime) {
      throw Object.assign(new Error('DEMO_READING_REQUIRED'), { status: 409 });
    }
    sample.accepted = true;
    sample.acceptedAt = new Date(now).toISOString();
    delete sample.reading;
  }
  if (sample.accepted) return { ...base, acknowledgedAt: sample.acceptedAt || base.acknowledgedAt };
  const acknowledgmentToken = randomUUID();
  sample.reading = { token: acknowledgmentToken, issuedAt: now, jurisdiction: base.jurisdiction, version: base.version };
  return { ...base, acknowledged: false, acknowledgedAt: null, acknowledgmentToken,
    acknowledgmentTokenExpiresAt: new Date(now + readTokenLifetime).toISOString() };
}
