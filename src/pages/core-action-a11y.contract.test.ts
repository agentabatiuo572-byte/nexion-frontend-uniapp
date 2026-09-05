import { describe, expect, it } from "vitest";

const pages = import.meta.glob(["./me/wallet-exchange.vue", "./team/agent.vue", "./earn/earn.vue", "./store/detail.vue", "./me/receipts.vue"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("core financial and ambassador controls", () => {
  it("declares keyboard and screen-reader semantics for every wallet exchange action", () => {
    const value = pages["./me/wallet-exchange.vue"] ?? "";
    for (const handler of ["goHowItWorks", "onRefresh", "setMax", "flip", "handleConfirm"]) {
      const tag = value.match(new RegExp(`<view[^>]*@click="${handler}"[^>]*>`, "s"))?.[0] ?? "";
      expect(tag, handler).toContain('role="button"');
      expect(tag, handler).toContain('tabindex="0"');
    }
  });

  it("makes the ambassador route and submit actions keyboard reachable", () => {
    const value = pages["./team/agent.vue"] ?? "";
    expect(value.match(/<view[^>]*@click="go\('\/pages\/team\/rank'\)"[^>]*>/s)?.[0]).toContain('role="button"');
    const submit = value.match(/<view[^>]*@click="submit"[^>]*>/s)?.[0] ?? "";
    expect(submit).toContain('role="button"');
    expect(submit).toContain('tabindex="0"');
    expect(submit).toContain(":aria-disabled=");
  });

  it.each([
    ["./earn/earn.vue", ["range = r", "taskPoolOpen = !taskPoolOpen", "openExplainer"]],
    ["./store/detail.vue", ["openTrustUrl(row.Url)", "refreshTrustMaterial"]],
    ["./me/receipts.vue", ["tab = c", "handleClearAll", "open = r"]],
  ] as const)("makes audited actions keyboard reachable in %s", (path, handlers) => {
    const value = pages[path] ?? "";
    for (const handler of handlers) {
      const marker = value.indexOf(`@click="${handler}"`);
      const stoppedMarker = value.indexOf(`@click.stop="${handler}"`);
      const click = marker >= 0 ? marker : stoppedMarker;
      const tag = click >= 0 ? value.slice(value.lastIndexOf("<", click), value.indexOf(">", click) + 1) : "";
      expect(tag, handler).toContain('role="button"');
      expect(tag, handler).toContain('tabindex="0"');
    }
  });
});
