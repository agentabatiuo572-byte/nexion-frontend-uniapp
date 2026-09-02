import { describe, expect, it } from "vitest";
const source = (import.meta.glob("./preference-toggle-row.vue", {
  query: "?raw", import: "default", eager: true,
})["./preference-toggle-row.vue"] ?? "") as string;

describe("preference toggle accessibility", () => {
  it("exposes switch state and keyboard activation", () => {
    expect(source).toContain('role="switch"');
    expect(source).toContain(':aria-checked="value ? \'true\' : \'false\'"');
    expect(source).toContain('@keydown.enter.prevent="emit(\'toggle\')"');
    expect(source).toContain('@keydown.space.prevent="emit(\'toggle\')"');
  });
});
