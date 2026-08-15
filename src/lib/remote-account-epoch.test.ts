import { describe, expect, it } from "vitest";
import { createRemoteAccountEpoch } from "./remote-account-epoch";

describe("remote account request epochs", () => {
  it("rejects account A's late response after account B binds", () => {
    const guard = createRemoteAccountEpoch("A");
    const requestA = guard.snapshot();

    guard.bind("B");

    expect(guard.isCurrent(requestA)).toBe(false);
    expect(guard.isCurrent(guard.snapshot())).toBe(true);
  });

  it("also rejects a same-account request from a previous bind generation", () => {
    const guard = createRemoteAccountEpoch("A");
    const requestA = guard.snapshot();

    guard.bind("A");

    expect(guard.isCurrent(requestA)).toBe(false);
    expect(guard.accountKey()).toBe("A");
  });
});
