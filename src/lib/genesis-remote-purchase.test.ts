import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { classifyRemoteGenesisPurchaseError } from "./genesis-remote-purchase";

describe("remote genesis purchase failure classification", () => {
  it("recognizes only explicit sold-out and paused domain outcomes", () => {
    expect(classifyRemoteGenesisPurchaseError(new ApiError({ kind: "business", message: "GENESIS_SOLD_OUT" }))).toBe("sold-out");
    expect(classifyRemoteGenesisPurchaseError(new ApiError({ kind: "http", message: "GENESIS_MARKET_PAUSED" }))).toBe("market-closed");
  });

  it("fails closed for unknown, network, and conflicting failures", () => {
    expect(classifyRemoteGenesisPurchaseError(new ApiError({ kind: "business", message: "GENESIS_SUPPLY_CONFLICT" }))).toBe("unavailable");
    expect(classifyRemoteGenesisPurchaseError(new Error("offline"))).toBe("unavailable");
  });
});
