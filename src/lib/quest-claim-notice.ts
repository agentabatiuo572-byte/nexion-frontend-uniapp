import { asApiError, isApiRefusal } from "@/api/errors";

/** Terminal mission rejections that are safe to show as state guidance. */
export type QuestClaimNotice =
  | "alreadyClaimed"
  | "instanceNotFound"
  | "definitionInactive"
  | "expired"
  | "notCompleted";

const NOTICE_BY_CODE: Readonly<Record<string, QuestClaimNotice>> = {
  QUEST_ALREADY_CLAIMED: "alreadyClaimed",
  QUEST_INSTANCE_NOT_FOUND: "instanceNotFound",
  QUEST_DEFINITION_INACTIVE: "definitionInactive",
  QUEST_EXPIRED: "expired",
  QUEST_NOT_COMPLETED: "notCompleted",
};

/** Keep backend diagnostics out of member-facing components. */
export function questClaimNoticeFor(cause: unknown): QuestClaimNotice | null {
  const failure = asApiError(cause);
  if (!isApiRefusal(failure, 409, ...Object.keys(NOTICE_BY_CODE))) return null;
  return NOTICE_BY_CODE[failure.message] ?? null;
}
