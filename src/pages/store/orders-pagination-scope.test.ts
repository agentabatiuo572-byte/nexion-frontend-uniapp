import { describe, expect, it } from 'vitest';
import source from './orders.vue?raw';
import { remoteCommerceRequestCurrent } from '@/lib/remote-commerce-refresh';

const implementation = source.match(/async function loadMoreOrders\(\) \{[\s\S]*?\n\}/)?.[0];
if (!implementation) throw new Error('Actual order pagination handler missing');
const compile = new Function('orders', 'app', 'remoteCommerceRequestCurrent',
  'commerceOrdersUnavailable', 'remoteOrderAvailability', 'genesisOrdersUnavailable',
  `let ordersPageActive = true; let refreshEpoch = 0; ${implementation};
   return { run: loadMoreOrders, refresh: () => { refreshEpoch++; }, hide: () => { ordersPageActive = false; } };`);

function scenario() {
  let reject!: (reason: Error) => void;
  let resolve!: () => void;
  const response = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const app = { accountKey: 'account-a', accountBindingEpoch: 1 };
  const unavailable = { value: false };
  const availability = { value: 'ready' };
  const genesisUnavailable = { value: false };
  const orders = { loadingMore: false, nextCursor: 'page-two', loadMoreRemote: () => response };
  const page = compile(orders, app, remoteCommerceRequestCurrent, unavailable, availability, genesisUnavailable);
  return { app, unavailable, availability, page, reject, resolve, orders, genesisUnavailable };
}

describe('actual orders pagination error scope', () => {
  it.each([false, true])('restores scrolling after a successful append retry while preserving Genesis failure %s', async genesisFailed => {
    const result = scenario();
    const failure = result.page.run(); result.reject(new Error('offline')); await failure;
    expect(result.unavailable.value).toBe(true);
    result.genesisUnavailable.value = genesisFailed;
    result.orders.loadMoreRemote = () => Promise.resolve();
    await result.page.run();
    expect(result.unavailable.value).toBe(false);
    expect(result.availability.value).toBe(genesisFailed ? 'partial' : 'ready');
  });
  it('does not clear a new binding failure after a late successful append', async () => {
    const result = scenario(); result.unavailable.value = true;
    const pending = result.page.run(); result.app.accountBindingEpoch++;
    result.resolve(); await pending;
    expect(result.unavailable.value).toBe(true);
  });

  for (const change of ['account', 'binding', 'refresh', 'hidden'] as const) {
    it(`ignores an old rejection after ${change} changes`, async () => {
      const result = scenario();
      const pending = result.page.run();
      if (change === 'account') result.app.accountKey = 'account-b';
      if (change === 'binding') result.app.accountBindingEpoch++;
      if (change === 'refresh') result.page.refresh();
      if (change === 'hidden') result.page.hide();
      result.reject(new Error('old page failed'));
      await pending;
      expect(result.unavailable.value).toBe(false);
      expect(result.availability.value).toBe('ready');
    });
  }
  it('preserves a current failure as a retryable partial source', async () => {
    const result = scenario();
    const pending = result.page.run();
    result.reject(new Error('current page failed'));
    await pending;
    expect(result.unavailable.value).toBe(true);
    expect(result.availability.value).toBe('partial');
  });
});
