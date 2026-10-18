import { describe, expect, it } from "vitest";
import {
  isLoopbackPreviewClient,
  mustBlockDevelopmentOAuthProxy,
  trustedPreviewProxyOrigin,
} from "./dev-preview-auth-boundary";

describe("development OAuth preview boundary", () => {
  it("recognizes only direct loopback clients", () => {
    expect(isLoopbackPreviewClient("127.0.0.1")).toBe(true);
    expect(isLoopbackPreviewClient("::1")).toBe(true);
    expect(isLoopbackPreviewClient("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackPreviewClient("192.168.8.25")).toBe(false);
    expect(isLoopbackPreviewClient(undefined)).toBe(false);
  });

  it("blocks development OAuth challenge and exchange through a LAN preview", () => {
    expect(mustBlockDevelopmentOAuthProxy(
      "/auth/users/oauth/development/passkey/challenge",
      "192.168.8.25",
    )).toBe(true);
    expect(mustBlockDevelopmentOAuthProxy(
      "/auth/users/oauth/exchange?source=h5",
      "192.168.8.25",
    )).toBe(true);
    expect(mustBlockDevelopmentOAuthProxy(
      "/auth/users/oauth/development;jsessionid=attacker/passkey/challenge",
      "192.168.8.25",
    )).toBe(true);
    expect(mustBlockDevelopmentOAuthProxy(
      "/auth/users/oauth%2Fdevelopment%2Fpasskey%2Fchallenge",
      "192.168.8.25",
    )).toBe(true);
    expect(mustBlockDevelopmentOAuthProxy(
      "/auth/users/oauth/development/passkey/challenge",
      "127.0.0.1",
    )).toBe(false);
    expect(mustBlockDevelopmentOAuthProxy(
      "/auth/users/login",
      "192.168.8.25",
    )).toBe(false);
  });
});

describe("HTTPS preview origin forwarding", () => {
  const target = "https://18.142.169.24";
  it("maps a same-origin loopback request to the HTTPS upstream", () => {
    expect(trustedPreviewProxyOrigin("http://127.0.0.1:5176", "127.0.0.1:5176", "127.0.0.1", target)).toBe(target);
  });
  it.each([
    ["https://evil.example", "127.0.0.1:5176", "127.0.0.1"],
    ["http://127.0.0.1:5175", "127.0.0.1:5176", "127.0.0.1"],
    ["http://127.0.0.1:5176", "127.0.0.1:5176", "192.168.1.2"],
    ["http://evil.example:5176", "evil.example:5176", "127.0.0.1"],
    [undefined, "127.0.0.1:5176", "127.0.0.1"],
    ["null", "127.0.0.1:5176", "127.0.0.1"],
  ])("does not grant an upstream origin to %s via %s from %s", (origin, host, peer) => {
    expect(trustedPreviewProxyOrigin(origin, host, peer, target)).toBeUndefined();
  });
  it("leaves the existing HTTP backend proxy unchanged", () => {
    expect(trustedPreviewProxyOrigin("http://127.0.0.1:5176", "127.0.0.1:5176", "127.0.0.1", "http://127.0.0.1:8110")).toBeUndefined();
  });
});
