import { describe, expect, it } from "vitest";
import { orderListPanels } from "@/lib/remote-commerce-refresh";

const pages = import.meta.glob("./{orders,order-detail}.vue", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;
const page = (name: string) => pages[`./${name}`] ?? "";

describe("orders cursor pagination UI", () => {
  it("offers an accessible explicit load-more control", () => {
    const source = page("orders.vue");
    expect(source).toContain("orders.nextCursor");
    expect(source).toContain('@click.stop="loadMoreOrders"');
    expect(source).toContain('@keydown.enter.prevent.stop="loadMoreOrders"');
    expect(source).toContain('@keydown.space.prevent.stop="loadMoreOrders"');
    expect(source).toContain("orders.loadMoreRemote()");
  });

  it("resolves a deep-linked order across all available pages", () => {
    expect(page("order-detail.vue")).toContain("orders.ensureRemoteOrder(id.value)");
  });

  // One unavailable order source is supplemental state. The page used to render
  // only loading/empty/list/unavailable, so a partial read with no rows (genesis
  // down, commerce empty) left the main content area blank behind the outage
  // banner — the store CTA disappeared entirely.
  it("renders main content for every non-loading presentation the panel can report", () => {
    const source = page("orders.vue");
    for (const state of ["empty", "partial"]) {
      const panels = orderListPanels({ loading: false, availability: state === "partial" ? "partial" : "ready", orderCount: 0 });
      expect(panels.mainPresentation).toBe(state);
    }
    // The partial read must reach the same main-content branch as an empty read,
    // so the store CTA is present rather than replaced by the outage banner.
    expect(source).toMatch(/mainContentEmpty[\s\S]{0,120}mainPresentation === "empty"/);
    expect(source).toMatch(/mainContentEmpty[\s\S]{0,160}mainPresentation === "partial"/);
    expect(source).toMatch(/v-if="mainContentEmpty"[\s\S]{0,300}t\.empty\.ordersCta/);
  });
});
