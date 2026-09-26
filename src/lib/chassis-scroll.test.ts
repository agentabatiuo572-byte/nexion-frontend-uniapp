import { describe, expect, it, vi } from "vitest";
import { scrollCurrentTabToTop } from "./chassis-scroll";

describe("current tab reselection", () => {
  it("resets native Android view scrollTop when scrollTo is absent or unsupported", () => {
    const native = { scrollTop: 640 };
    scrollCurrentTabToTop(native, false);
    expect(native.scrollTop).toBe(0);
    const partial = { scrollTop: 420, scrollTo: vi.fn(() => { throw Error("unsupported"); }) };
    scrollCurrentTabToTop(partial, false);
    expect(partial.scrollTop).toBe(0);
  });

  it("preserves H5 smooth scrolling and reduced-motion behavior", () => {
    const scrollTo = vi.fn();
    const h5 = { scrollTop: 640, scrollTo };
    scrollCurrentTabToTop(h5, false);
    scrollCurrentTabToTop(h5, true);
    expect(scrollTo).toHaveBeenNthCalledWith(1, { top: 0, behavior: "smooth" });
    expect(scrollTo).toHaveBeenNthCalledWith(2, { top: 0, behavior: "auto" });
  });
});
