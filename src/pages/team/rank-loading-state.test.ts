// @ts-expect-error Node is used only by the test runner.
import { readFileSync } from 'node:fs';
import { compile } from '@vue/compiler-dom';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./rank.vue', import.meta.url), 'utf8');
const fallback = source.match(/^        <view v-else(?:-if="[^"]+")? class="rounded-2xl"[\s\S]*?(?=^      <\/view>)/m)?.[0];
if (!fallback) throw new Error('Missing rank fallback template');
const render = new Function('Vue', compile(`<view v-if="rankAvailable">Ready</view>${fallback}`, { mode: 'function', prefixIdentifiers: true }).code)(Vue);
async function show(ready: boolean, error: string | null) {
  return renderToString(Vue.createSSRApp({ render, setup: () => ({
    rankAvailable: ready, vState: { remoteError: error }, unavailableStyle: {}, retryRank() {},
    t: { rank: { loading: 'Loading rank', loadError: 'Rank unavailable', retry: 'Retry' } },
  }) }));
}
describe('rank read status', () => {
  it('does not announce failure while the first read or retry is pending', async () => {
    const html = await show(false, null);
    expect(html).toContain('Loading rank');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Rank unavailable');
    expect(html).not.toContain('Retry');
  });
  it('offers retry after a failed read', async () => {
    const html = await show(false, 'unavailable');
    expect(html).toContain('Rank unavailable');
    expect(html).toContain('Retry');
    expect(html).not.toContain('Loading rank');
  });
  it('removes fallback after confirmation', async () => {
    const html = await show(true, null);
    expect(html).toContain('Ready');
    expect(html).not.toContain('Loading rank');
    expect(html).not.toContain('Rank unavailable');
  });
});
