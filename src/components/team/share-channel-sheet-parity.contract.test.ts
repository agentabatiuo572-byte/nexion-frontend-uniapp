// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./share-channel-sheet.vue", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("team share sheet 5174 parity", () => {
  it("never renders an empty channel grid when the A3 projection is unavailable", () => {
    expect(source).toContain("return list.length ? list : fallbackVisibleChannels()");
    expect(source).not.toContain("list.length || remoteApiEnabled");
    const fallback = source.slice(source.indexOf("const FALLBACK"), source.indexOf("const channels"));
    expect([...fallback.matchAll(/key: "([^"]+)"/g)].map((row) => row[1])).toEqual([
      "zalo", "telegram", "whatsapp", "messenger", "sms", "x", "copy", "poster", "system",
    ]);
    expect(source).toContain("fallbackVisibleChannels()");
  });

  it("keeps the server reward amount while localizing the explanatory copy", () => {
    expect(source).toContain("t.value.team.serverRewardPerSettlement");
    expect(source).not.toContain("Server-set reward:");
    expect(source).not.toContain("Server invitation reward unavailable");
    expect(source).toMatch(/\.ss-reward \{[^}]*min-height: 65px/);
  });
});
