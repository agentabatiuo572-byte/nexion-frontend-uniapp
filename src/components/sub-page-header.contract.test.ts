import { compile } from '@vue/compiler-dom';
import { parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { describe, expect, it } from 'vitest';
import source from './sub-page-header.vue?raw';
import ticketSource from '@/pages/me/support-tickets.vue?raw';
import { zh } from '@/i18n/messages/zh';
import { en } from '@/i18n/messages/en';
import { vi } from '@/i18n/messages/vi';

const template = parse(source).descriptor.template!.content;
const render = new Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true, isCustomElement: tag => ['view', 'text'].includes(tag) }).code)(Vue) as Vue.RenderFunction;
async function header(plain: boolean, t = zh) {
  return renderToString(Vue.createSSRApp({
    components: { LiquidGlass: { render: () => Vue.h('span', { 'data-glass': true }) } },
    setup: () => ({ plain, statusBarHeight: 0, pendingBarInset: 0, rowH: 44, t, subtitle: '', displayTitle: t.tickets.detailTitle, unread: 8, actionLabel: plain ? t.tickets.viewTicketList : undefined, action: plain ? () => {} : undefined, goBack: () => {}, goBell: () => {}, onKeyboardActivate: () => {} }),
    render,
  }));
}

describe('ticket detail header controls', () => {
  for (const [locale, t] of [['zh', zh], ['en', en], ['vi', vi]] as const) {
    it(`${locale}: puts the compact list action beside the back control and leaves title bare`, async () => {
      const html = await header(true, t);
      expect(html).toContain(t.tickets.viewTicketList);
      expect(html).toContain(t.tickets.detailTitle);
      expect(html).not.toContain('spv-bell');
      expect(html.match(/role="button"/g)).toHaveLength(2);
      expect(html).toMatch(/<view class="spv-titlewrap"><text class="spv-title">/);
      expect(html.indexOf('spv-back')).toBeLessThan(html.indexOf('spv-titlewrap'));
      expect(html.indexOf('spv-titlewrap')).toBeLessThan(html.indexOf('spv-action'));
      expect(html.slice(html.indexOf('class="spv-action"'))).not.toContain('<svg');
    });
  }
  it('retains the default shared message button and background', async () => {
    const html = await header(false);
    expect(html).toContain('spv-bell');
    expect(html).not.toContain('spv-action');
    expect(html.match(/data-glass/g)).toHaveLength(1);
  });
  it('opts in only ticket detail, preserving create-mode return and list routing', () => {
    expect(ticketSource).toContain(':plain="mode.kind === \'detail\'"');
    expect(ticketSource).toContain(':action="mode.kind === \'detail\' ? showTicketList : undefined"');
    expect(ticketSource).toContain('function showTicketList() { setMode({ kind: \'list\' }); }');
    expect(ticketSource).toContain('<view v-if="mode.kind === \'create\'" class="px-4"');
    expect(zh.tickets.viewTicketList).toBe('查看工单列表');
  });
  it('keeps both controls keyboard-operable with repeat suppression and 44px targets', () => {
    expect(source).toContain('onKeyboardActivate($event, action)');
    expect(source).toContain('if (event.repeat) return;');
    expect(source).toContain('min-height: 44px');
    expect(source).toContain('.spv--plain .spv-glass { width: 44px; height: 44px; }');
    expect(source).toContain('grid-template-columns: 92px minmax(0, 1fr) 92px');
  });
});
