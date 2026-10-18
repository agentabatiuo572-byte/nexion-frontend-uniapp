import { compile } from "@vue/compiler-dom";
import { parse } from "@vue/compiler-sfc";
import { renderToString } from "@vue/server-renderer";
import * as Vue from "vue";
import { expect, it, vi } from "vitest";
import source from "./index.vue?raw";
import { zh } from "@/i18n/messages/zh";
import { en } from "@/i18n/messages/en";
import { vi as vietnamese } from "@/i18n/messages/vi";

const template = parse(source).descriptor.template!.content;
const banner = template.match(/<!-- #ifdef H5 -->([\s\S]*?)<!-- #endif -->/)![1];
const render = new Function("Vue", compile(banner, {
  mode: "function", prefixIdentifiers: true, isCustomElement: tag => ["view", "text"].includes(tag),
}).code)(Vue);
const handler = source.match(/function goAppDownload\(\) \{([^}]+)\}/)![1];

it.each([zh, en, vietnamese])("shows the prototype download notice only after login and opens the existing guide", async copy => {
  const auth = Vue.reactive({ isAuthenticated: false });
  const navTo = vi.fn();
  const goAppDownload = new Function("navTo", handler).bind(null, navTo);
  let rendered!: Vue.VNode;
  const app = Vue.createSSRApp({
    render: () => (rendered = render({ auth, t: copy, goAppDownload }, [])),
  });
  expect(await renderToString(app)).not.toContain("home-app-download-banner");
  auth.isAuthenticated = true;
  const html = await renderToString(app);
  expect(html).toContain(copy.phonePolicy.webNotice);
  expect(html).toContain(copy.phonePolicy.download);
  expect(html).not.toContain(copy.myDevices.phoneActivationCta);
  const action = (rendered.children as Vue.VNode[]).find(child => child.props?.role === "button")!;
  action.props!.onClick();
  expect(navTo).toHaveBeenCalledExactlyOnceWith("/pages/register/success?download=1");
});

it("keeps the download banner out of native builds and calibration out of H5", () => {
  const h5 = template.replace(/<!-- #ifdef APP-PLUS -->[\s\S]*?<!-- #endif -->/g, "");
  const native = template.replace(/<!-- #ifdef H5 -->[\s\S]*?<!-- #endif -->/g, "");
  expect(h5).not.toContain('data-home-action="phone-binding"');
  expect(native).not.toContain("home-app-download-banner");
});
