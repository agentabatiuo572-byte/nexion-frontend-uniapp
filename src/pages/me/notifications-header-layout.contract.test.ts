import { baseParse, compile, type ElementNode, type TemplateChildNode } from "@vue/compiler-dom";
import { parse } from "@vue/compiler-sfc";
import { renderToString } from "@vue/server-renderer";
import * as Vue from "vue";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { fmt } from "@/i18n/format";
import { zh } from "@/i18n/messages/zh";
import { en } from "@/i18n/messages/en";
import { vi } from "@/i18n/messages/vi";
import source from "./notifications.vue?raw";

const descriptor = parse(source).descriptor;
const template = baseParse(descriptor.template!.content);
function elements(nodes: TemplateChildNode[]): ElementNode[] {
  return nodes.flatMap(node => node.type === 1 ? [node, ...elements(node.children)] : []);
}
const all = elements(template.children);
const attribute = (node: ElementNode, name: string) => node.props.find(prop => prop.type === 6 && prop.name === name);
const hasClass = (node: ElementNode, name: string) => {
  const prop = attribute(node, "class");
  return prop?.type === 6 && prop.value?.content.split(" ").includes(name);
};
const nav = all.find(node => hasClass(node, "message-nav"))!;
const heading = all.find(node => hasClass(node, "message-heading"))!;

// Evaluate the page's actual unread expression, preserving its full source count.
function unreadLabel(translations: typeof zh | typeof en | typeof vi, totalUnread: number): string {
  const ast = ts.createSourceFile("notifications.vue.ts", descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true);
  let initializer: ts.Expression | undefined;
  function find(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "unreadLabel") initializer = node.initializer;
    ts.forEachChild(node, find);
  }
  find(ast);
  if (!initializer) throw new Error("Missing page unread expression");
  const code = ts.transpileModule(`const label = ${initializer.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function("computed", "center", "t", "fmt", code + ";return label.value;")(Vue.computed, { totalUnread, error: null, loading: false }, Vue.ref(translations), fmt) as string;
}
async function renderHeader(translations: typeof zh | typeof en | typeof vi, totalUnread: number, expanded = true): Promise<string> {
  const code = compile(`<view>${nav.loc.source}${heading.loc.source}</view>`, { mode: "function", prefixIdentifiers: true, isCustomElement: tag => ["view", "text"].includes(tag) }).code;
  const render = new Function("Vue", code)(Vue) as Vue.RenderFunction;
  const app = Vue.createSSRApp({
    components: { LiquidGlass: { render: () => null } },
    setup: () => ({ t: translations, center: { totalUnread }, headerState: { title: expanded }, unreadLabel: unreadLabel(translations, totalUnread), navBack: () => {}, navTo: () => {} }),
    render,
  });
  return renderToString(app);
}

describe("message page header content contract", () => {
  it("places one accessible page heading between the existing navigation actions", () => {
    const children = nav.children.filter((node): node is ElementNode => node.type === 1);
    expect(children).toHaveLength(3);
    expect(children[0].loc.source).toContain("navBack('/pages/me/me')");
    expect(children[2].loc.source).toContain("navTo('/pages/me/preferences')");
    const titles = all.filter(node => hasClass(node, "message-title"));
    expect(titles).toEqual([children[1]]);
    expect(children[1].loc.source).toContain('role="heading"');
    expect(children[1].loc.source).toContain('aria-level="1"');
    expect(heading.loc.source).not.toContain("drawerTitle");
    expect(heading.loc.source).toContain("unreadLabel");
  });

  for (const [language, translations] of [["zh", zh], ["en", en], ["vi", vi]] as const) {
    it(`${language}: retains translated title/actions and the real 298 unread count`, async () => {
      const html = await renderHeader(translations, 298);
      expect(html).toContain(translations.notifs.drawerTitle);
      expect(html).toContain(`aria-label="${translations.profile.back}"`);
      expect(html).toContain(`aria-label="${translations.notifs.preferences}"`);
      expect(html).toContain(fmt(translations.notifs.unreadCount, { n: 298 }));
      expect(unreadLabel(translations, 298)).not.toContain("99");
    });
  }

  it("leaves the existing collapsed-header state in control of the heading", async () => {
    const title = all.find(node => hasClass(node, "message-title"))!;
    expect(title.loc.source).toContain("'message-title--hidden': !headerState.title");
    expect(title.loc.source).toContain(':aria-hidden="!headerState.title"');
    expect(source).toContain('v-if="!headerState.title" class="message-compact"');
    const html = await renderHeader(zh, 298, false);
    const titleMarkup = html.match(/<text[^>]*role="heading"[^>]*>/)?.[0];
    expect(titleMarkup).toContain("message-title--hidden");
    expect(titleMarkup).toContain('aria-hidden="true"');
    expect(titleMarkup).not.toContain("display:none");
  });

  it("shows the collapsed heading as plain text without an action or glass background", () => {
    const compact = all.find(node => hasClass(node, "message-compact"))!;
    expect(elements(compact.children).map(node => node.tag)).toEqual(["text"]);
    expect(attribute(compact, "role")).toBeUndefined();
    expect(attribute(compact, "tabindex")).toBeUndefined();
    expect(compact.props.some(prop => prop.type === 7 && prop.name === "on")).toBe(false);
    expect(source).not.toContain("revealSections");
  });
});
