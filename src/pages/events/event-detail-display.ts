import type { EventDetail } from "@/api/event-detail-api";
import { asApiError, isAmbiguousEnvelopeOutcome } from "@/api/errors";
import type { eventDetailCopy } from "@/i18n/event-detail";
import { formatAmount } from "@/lib/amount-display";
import { promotionStoreHref } from "@/lib/promotion-entry";
import { promotionLandingHref } from "@/lib/promotion-landing";

export function eventDetailRules(rules: EventDetail["rules"], copy: typeof eventDetailCopy.en) {
  return Object.entries(copy.labels).flatMap(([key, label]) => {
    const value = rules[key];
    if (value === undefined || value === null || value === "") return [];
    if (key === "weekdays" && Array.isArray(value)) return [{ label, value: value.map(day => copy.weekdays[Number(day) - 1]).filter(Boolean).join(" · ") }];
    if (key === "regions" && Array.isArray(value)) return [{ label, value: value.map(region => typeof region?.name === "string" ? region.name : "").filter(Boolean).join(" · ") }];
    return typeof value === "string" || typeof value === "number" ? [{ label, value: String(value) }] : [];
  }).filter(row => row.value);
}
export function eventDetailReward(reward: EventDetail["rewards"][number], copy: typeof eventDetailCopy.en): string {
  const label = ({ UVT: "UVT", USDT: "USDT", DEVICE: copy.device, STREAK_SAVER: copy.saver, GENESIS_TICKET: copy.tickets } as Record<string, string>)[reward.type] ?? copy.reward;
  return `${reward.pool ? `${copy.labels.poolUsdt} · ` : ""}${formatAmount(reward.quantity ?? reward.amount)} ${label}`;
}
export function eventClaimCommandKey(code: string, claimKeys: readonly string[] = []): string {
  return `h4-event-claim:${code}${claimKeys[0] && claimKeys[0] !== "ONCE" ? `:${claimKeys[0]}` : ""}`;
}
export function eventDetailHref(detail: EventDetail): string {
  if(detail.event.kind==='seasonal'&&typeof detail.rules.voucherId==='string'&&detail.rules.voucherId.trim())return promotionStoreHref(undefined,{voucherId:detail.rules.voucherId,upgradeActivityId:typeof detail.rules.promotionActivityId==='string'?detail.rules.promotionActivityId:undefined});
  if (["discount", "seasonal"].includes(detail.event.kind) && typeof detail.rules.promotionActivityId === "string" && detail.rules.promotionActivityId) return promotionLandingHref(detail.rules.promotionActivityId);
  if (detail.event.kind === "regional") return "";
  return detail.event.href;
}
// Refusals the event commands answer with (4xx + code): the command did not run. A 409 without one of these codes stays
// ambiguous (it can mean the idempotency key already has a record).
const eventRefusals: Record<string, EventCommandFailure> = {
  EVENT_NOT_CLAIMABLE: "notClaimable", EVENT_ALREADY_CLAIMED: "claimed", EVENT_NOT_OPEN: "notOpen", EVENT_REGION_NOT_ELIGIBLE: "notEligible",
  EVENT_BUDGET_EXHAUSTED: "budget", COVERAGE_REDLINE: "generic", EVENT_REMINDER_NOT_AVAILABLE: "reminder",
};
export type EventCommandFailure = "unknown" | "notClaimable" | "claimed" | "notOpen" | "notEligible" | "budget" | "reminder" | "notRun" | "generic";
/** "unknown" only when the command may have run (network loss, timeout, gateway 5xx, unreadable reply); otherwise the reason to show. */
export function eventCommandFailure(cause: unknown): EventCommandFailure {
  const error = asApiError(cause);
  const status = error.kind === "business" ? error.code : error.status;
  const refusal = eventRefusals[error.message];
  if (refusal && (error.kind === "business" || error.kind === "http") && status !== undefined && status >= 400 && status < 500) return refusal;
  // A 503 the app server returned itself (its envelope carries the code) means the command was not run: say so and
  // that the same action can be tried again (06 §6.1).
  if (error.kind === "http" && error.status === 503 && error.code === 503) return "notRun";
  return isAmbiguousEnvelopeOutcome(error) ? "unknown" : "generic";
}
/** The event detail read answered that the event does not exist (404 + EVENT_NOT_FOUND): nothing on it can be confirmed. */
export function isEventNotFound(cause: unknown): boolean {
  const error = asApiError(cause);
  const status = error.kind === "business" ? error.code : error.status;
  return error.message === "EVENT_NOT_FOUND" && (error.kind === "business" || error.kind === "http") && status === 404;
}
export function eventDetailAction(detail: EventDetail): "join" | "claim" | "open" | "remind" | null {
  if (detail.eligible && detail.userStatus === "CLAIMABLE") return "claim";
  if (detail.enabled && detail.event.state === "upcoming" && !detail.reminderSubscribed) return "remind";
  if (!detail.enabled || !detail.eligible || detail.event.state !== "ongoing" || ["DISABLED", "NOT_STARTED", "ENDED", "NOT_ELIGIBLE", "CLAIMED"].includes(detail.eligibilityReason)) return null;
  if (detail.event.trackable && detail.userStatus === "AVAILABLE") return "join";
  return eventDetailHref(detail) ? "open" : null;
}
