import { describe, expect, it } from "vitest";

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
});
