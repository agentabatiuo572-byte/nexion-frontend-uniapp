const DAY_MS = 86_400_000;

export function readMonotonicNowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function advanceMonotonicHighWater(previous: number, candidate: number): number {
  if (!Number.isFinite(candidate) || candidate < 0) return previous;
  return Math.max(previous, candidate);
}

export function projectServerNow(
  serverNow: number,
  receivedMonotonicAt: number,
  currentMonotonicAt: number,
): number {
  return serverNow + Math.max(0, currentMonotonicAt - receivedMonotonicAt);
}

export function deadlineRemainingMs(deadline: number, projectedServerNow: number): number {
  return Math.max(0, deadline - projectedServerNow);
}

export function deadlineRemainingDays(remainingMs: number): number {
  return remainingMs > 0 ? Math.ceil(remainingMs / DAY_MS) : 0;
}
