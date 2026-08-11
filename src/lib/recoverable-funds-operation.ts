export interface RecoverableFundsHandlers<T> {
  success(value: T): void | Promise<void>;
  failure(reason: string): void | Promise<void>;
  settled(): void | Promise<void>;
}

function failureReason(cause: unknown, fallback: string): string {
  const message = cause && typeof cause === "object" && "message" in cause
    ? String((cause as { message?: unknown }).message ?? "").trim()
    : "";
  if (message) return message;
  const text = String(cause ?? "").trim();
  return text || fallback;
}

/**
 * UI recovery boundary for an external-funds request. It intentionally turns a
 * rejected request into a rendered failure state, while `settled` guarantees
 * that spinners/3DS loading gates cannot remain latched.
 */
export async function runRecoverableFundsOperation<T>(
  operation: () => Promise<T>,
  handlers: RecoverableFundsHandlers<T>,
  fallback = "FUNDS_OPERATION_FAILED",
): Promise<T | null> {
  try {
    const value = await operation();
    await handlers.success(value);
    return value;
  } catch (cause) {
    await handlers.failure(failureReason(cause, fallback));
    return null;
  } finally {
    await handlers.settled();
  }
}
