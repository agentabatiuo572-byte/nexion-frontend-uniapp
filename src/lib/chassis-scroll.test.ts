import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveChassisScrollElement, scrollCurrentTabToTop } from "./chassis-scroll";

afterEach(() => vi.unstubAllGlobals());

describe("current tab reselection", () => {
  it("uses the actual App WebView scroll node when uni's view ref is a proxy", () => {
    class WebViewElement {
      scrollTop = 783;
      classList = { contains: (name: string) => name === "nx-content" };
    }
    vi.stubGlobal("HTMLElement", WebViewElement);
    const actual = new WebViewElement();
    const proxy = { $el: { scrollTop: 783 } };
    const found = resolveChassisScrollElement(proxy, () => actual as unknown as HTMLElement);
    expect(found).toBe(actual);
    found!.scrollTop = 0;
    expect(actual.scrollTop).toBe(0);
    expect(proxy.$el.scrollTop).toBe(783);
  });

  it("keeps the H5 ref's own scroll node", () => {
    class H5Element {
      classList = { contains: (name: string) => name === "nx-content" };
    }
    vi.stubGlobal("HTMLElement", H5Element);
    const actual = new H5Element();
    const fallback = vi.fn(() => null);
    expect(resolveChassisScrollElement({ $el: actual }, fallback)).toBe(actual);
    expect(fallback).not.toHaveBeenCalled();
  });

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
