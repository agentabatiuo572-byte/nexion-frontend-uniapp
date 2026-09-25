import { afterEach, describe, expect, it, vi } from "vitest";
import { syncNativeTheme } from "./native-theme";

afterEach(() => vi.unstubAllGlobals());

describe("native theme view bridge", () => {
  it("sets the resolved theme in every open Uni page WebView", () => {
    const first = vi.fn();
    const second = vi.fn();
    vi.stubGlobal("getCurrentPages", () => [
      { $getAppWebview: () => ({ evalJS: first }) },
      { $getAppWebview: () => ({ evalJS: second }) },
    ]);
    syncNativeTheme("light");
    expect(first).toHaveBeenCalledWith('document.documentElement.setAttribute("data-theme", "light")');
    expect(second).toHaveBeenCalledWith('document.documentElement.setAttribute("data-theme", "light")');
  });

  it("continues when a page is closing", () => {
    const alive = vi.fn();
    vi.stubGlobal("getCurrentPages", () => [
      { $getAppWebview: () => { throw new Error("closed"); } },
      { $getAppWebview: () => ({ evalJS: alive }) },
    ]);
    expect(() => syncNativeTheme("dark")).not.toThrow();
    expect(alive).toHaveBeenCalledOnce();
  });
});
