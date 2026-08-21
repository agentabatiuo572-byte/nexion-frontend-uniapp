import { ApiError } from "@/api/errors";

export type RemoteGenesisPurchaseFailure = "sold-out" | "market-closed" | "unavailable";

/** Map only explicit backend domain outcomes; every unknown remote failure is unavailable. */
export function classifyRemoteGenesisPurchaseError(error: unknown): RemoteGenesisPurchaseFailure {
  if (error instanceof ApiError && error.message === "GENESIS_SOLD_OUT") return "sold-out";
  if (error instanceof ApiError && error.message === "GENESIS_MARKET_PAUSED") return "market-closed";
  return "unavailable";
}
