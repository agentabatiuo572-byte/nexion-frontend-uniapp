// Cookie rotations must not redeem the same HttpOnly credential concurrently.
// The browser lock coordinates same-origin tabs/frames without exposing tokens.
// Older/non-browser runtimes retain a same-context queue; no unsafe lock retry.
let fallbackTail: Promise<unknown> = Promise.resolve();

export function withSessionCookieLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("nexgrid-user-session-cookie", work);
  }
  const result = fallbackTail.then(work, work);
  fallbackTail = result.then(() => undefined, () => undefined);
  return result;
}
