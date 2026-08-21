import { describe, expect, it } from "vitest";

const source = (import.meta.glob("./me.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["./me.vue"] ?? "") as string;

describe("Proof business-visible entry", () => {
  it("exposes Proof from the My account surface", () => {
    expect(source).toMatch(/key:\s*["']proof["'][\s\S]{0,260}href:\s*["']\/me\/proof["']/);
  });
});
