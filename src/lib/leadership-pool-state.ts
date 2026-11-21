import { ApiError } from "@/api/errors";
import { isTransientReadFailure } from "@/lib/remote-read-failure";

export function leadershipPoolFailureState(cause: unknown): "hold" | "error" {
  return cause instanceof ApiError && cause.message === "F4_LEADERSHIP_POOL_HOLD"
    && (cause.kind === "business" || cause.kind === "http") ? "hold" : "error";
}

export function leadershipPoolReadFailure(cause: unknown) {
  const state = leadershipPoolFailureState(cause);
  return { state, retainSnapshot: state !== "hold" && isTransientReadFailure(cause) };
}
