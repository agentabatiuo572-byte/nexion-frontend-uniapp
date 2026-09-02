import { describe, expect, it } from "vitest";

const source = (import.meta.glob("./support.vue", {
  query: "?raw", import: "default", eager: true,
})["./support.vue"] ?? "") as string;

describe("support channel actions", () => {
  it("opens configured channel targets instead of treating a toast as success", () => {
    expect(source).toContain('externalId: "telegram"');
    expect(source).toContain('externalId: "discord"');
    expect(source).toContain('externalId: "email"');
    expect(source).toContain("openExternalSupportChannel(c.externalId)");
    expect(source).toContain('@keydown.space.prevent="onChannel(c)"');
  });
});
