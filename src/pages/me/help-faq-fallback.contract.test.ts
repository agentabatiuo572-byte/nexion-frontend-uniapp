import { describe, expect, it } from "vitest";

const source = (import.meta.glob("./help.vue", {
  query: "?raw", import: "default", eager: true,
})["./help.vue"] ?? "") as string;

describe("Help Center FAQ locale fallback", () => {
  it("visibly identifies published default-language content", () => {
    expect(source).toContain("const faqLanguageFallback = computed");
    expect(source).toContain('v-if="faqLanguageFallback"');
    expect(source).toContain("w.faqLanguageFallback");
    expect(source).toContain('role="status"');
  });
});
