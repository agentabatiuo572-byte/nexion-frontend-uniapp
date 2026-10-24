import { describe, expect, it } from "vitest";
import { appDownloadUrl } from "./app-download-url";

describe("official website APP distribution URL", () => {
  it.each([
    "https://www.google.com",
    "https://uvel.example/",
    "https://uvel.example/install/latest?channel=h5&source=qr&platform=auto",
    "https://uvel.example/app.apk?signature=a%2Fb%3D&key=1&key=2",
  ])("preserves the configured destination exactly: %s", url => {
    expect(appDownloadUrl(` ${url} `)).toBe(url);
  });

  it.each([undefined, "", " ", "not a url", "/download/", "//uvel.example", "http://uvel.example", "javascript:alert(1)", "data:text/html,test", "https://user:password@uvel.example/"])("leaves missing or unsafe configuration unavailable: %s", url => {
    expect(appDownloadUrl(url)).toBe("");
  });
});
