import { describe, expect, it } from "vitest";
import { appDownloadUrl } from "./app-download-url";

describe("official website APP distribution URL", () => {
  it.each(["auto", "ios", "android"] as const)("routes %s through the website download page", platform => {
    expect(appDownloadUrl("https://uvel.example/", platform)).toBe(`https://uvel.example/download/?platform=${platform}&source=button`);
  });

  it("defensively normalizes direct calls with a fragment; published configuration must be fragment-free", () => {
    expect(appDownloadUrl(" https://uvel.example/download/?campaign=h5&platform=android#install ", "ios"))
      .toBe("https://uvel.example/download/?campaign=h5&platform=ios&source=button");
  });

  it("uses a fixed website route even when the configured URL contains another path", () => {
    expect(appDownloadUrl("https://uvel.example/about")).toBe("https://uvel.example/download/?platform=auto&source=button");
  });

  it("marks button navigation and replaces stale repeated platform/source parameters", () => {
    const url = new URL(appDownloadUrl("https://uvel.example/?campaign=h5&source=qr&source=old&platform=android&platform=auto", "ios"));
    expect(url.searchParams.getAll("platform")).toEqual(["ios"]);
    expect(url.searchParams.getAll("source")).toEqual(["button"]);
    expect(url.searchParams.get("campaign")).toBe("h5");
  });

  it.each([undefined, "", " ", "not a url", "/download/", "//uvel.example", "http://uvel.example", "javascript:alert(1)", "data:text/html,test", "https://user:password@uvel.example/"])("leaves missing or unsafe configuration unavailable: %s", url => {
    expect(appDownloadUrl(url)).toBe("");
  });
});
