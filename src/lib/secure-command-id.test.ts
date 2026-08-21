import { describe, expect, it, vi } from "vitest";
import { requireCryptoUuid } from "./secure-command-id";

describe("secure command identifiers", () => {
  it("uses the platform crypto UUID", () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "7a9bb4c6-55c7-4fbe-8c54-5b5bfbf60a01") });
    expect(requireCryptoUuid()).toBe("7a9bb4c6-55c7-4fbe-8c54-5b5bfbf60a01");
  });

  it("fails closed when crypto UUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    expect(() => requireCryptoUuid()).toThrow("CRYPTO_RANDOM_UUID_UNAVAILABLE");
  });
});
