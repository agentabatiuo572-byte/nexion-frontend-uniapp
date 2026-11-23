import { ApiError } from "@/api/errors";

/** A refused receipt read has a final result. Other failures can recover on a later read. */
export function isReceiptUnavailable(cause: unknown): boolean {
  if (!(cause instanceof ApiError)) return false;
  const status = cause.kind === "business" ? cause.code : cause.status;
  return status === 404 || status === 403;
}
