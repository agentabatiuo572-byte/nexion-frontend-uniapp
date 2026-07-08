// Sliding-window send limiter — client-side UX guard for chat inputs.
// A real backend enforces the same policy server-side (HTTP 429 + Retry-After);
// this mirrors that contract (max sends per rolling window, retry hint in
// seconds) so swapping in real API errors is zero-rework.

export interface SendVerdict {
  ok: boolean;
  /** Seconds until the next send is allowed (0 when ok). */
  retryInSec: number;
}

export interface SendLimiter {
  /** Try to consume one send slot. Only successful sends count against the window. */
  tryAcquire(now?: number): SendVerdict;
}

export function createSendLimiter(max: number, windowMs: number): SendLimiter {
  let stamps: number[] = [];
  return {
    tryAcquire(now = Date.now()): SendVerdict {
      stamps = stamps.filter((t) => now - t < windowMs);
      if (stamps.length < max) {
        stamps = [...stamps, now];
        return { ok: true, retryInSec: 0 };
      }
      return { ok: false, retryInSec: Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000)) };
    },
  };
}
