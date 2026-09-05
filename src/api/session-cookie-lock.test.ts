import { afterEach, describe, expect, it, vi } from "vitest";
import { withSessionCookieLock } from "./session-cookie-lock";

afterEach(() => vi.unstubAllGlobals());
describe("session cookie rotation lock", () => {
  it("uses the same browser lock for cookie mutations without sharing credentials", async () => {
    const request = vi.fn(async (_name: string, work: () => Promise<string>) => work());
    vi.stubGlobal("navigator", { locks: { request } });
    await expect(withSessionCookieLock(async () => "done")).resolves.toBe("done");
    expect(request).toHaveBeenCalledWith("nexgrid-user-session-cookie", expect.any(Function));
  });
  it("does not retry a rejected lock acquisition outside the lock", async () => {
    const request = vi.fn().mockRejectedValue(new Error("lock unavailable"));
    vi.stubGlobal("navigator", { locks: { request } });
    const work = vi.fn();
    await expect(withSessionCookieLock(work)).rejects.toThrow("lock unavailable");
    expect(work).not.toHaveBeenCalled();
  });
  it("serializes same-context fallback work and recovers after a rejected mutation", async () => {
    vi.stubGlobal("navigator", undefined);
    const calls: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = withSessionCookieLock(async () => { calls.push("first"); await gate; throw new Error("failed"); });
    const rejected = expect(first).rejects.toThrow("failed");
    const next = withSessionCookieLock(async () => { calls.push("next"); return 2; });
    await vi.waitFor(() => expect(calls).toEqual(["first"]));
    release();
    await rejected;
    await expect(next).resolves.toBe(2);
    expect(calls).toEqual(["first", "next"]);
  });
});
