// @ts-expect-error Vitest executes this source contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./market-board-card.vue", import.meta.url), "utf8");

describe("home compute-market navigation", () => {
  it("exposes one cross-platform click and keyboard-accessible market link", () => {
    const entry = source.match(/<view\s+[\s\S]*?data-home-action="compute-market-open"[\s\S]*?>/)?.[0] ?? "";

    expect(entry).toContain('role="link"');
    expect(entry).toContain('tabindex="0"');
    expect(entry).toContain('@click="goMarket"');
    expect(entry).toContain('@keydown.enter.stop.prevent="goMarket"');
    expect(entry).not.toMatch(new RegExp("@t" + "ap="));
  });

  it("routes the market entry to the registered compute-market page", () => {
    expect(source).toContain('navTo("/pages/market/market")');
  });
});
