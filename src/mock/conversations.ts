// Conversation-center mock data — multi-category human support (advisor / support)
// alongside the Nova AI advisor. Pure data, zero framework deps, backend-replaceable
// (serialisable, action-driven, ms-epoch timestamps). The "ai" type is virtual —
// it is backed by the existing `nova` store, so this mock only seeds the human
// categories. A real backend returns ConvMessage.text directly; the mock instead
// references i18n seed keys (textKey/ctaKey) so seed copy stays bilingual + on-brand.

import type { Messages } from "@/i18n/messages/en";

type ConvNs = Messages["conversations"];

/** i18n key for a seeded message body (resolved via `t.conversations.seed[...]`). */
export type ConvSeedKey = keyof ConvNs["seed"];
/** i18n key for a seeded CTA label (resolved via `t.conversations.cta[...]`). */
export type ConvCtaKey = keyof ConvNs["cta"];
/** i18n key for a runtime agent reply template (resolved via `t.conversations[...]`). */
export type ConvReplyKey = (typeof ADVISOR_REPLY_KEYS)[number] | (typeof SUPPORT_REPLY_KEYS)[number];

/** Customer-service categories. "ai" is virtual (nova-backed); store holds the rest. */
export type ConversationType = "ai" | "advisor" | "support";

/** i18n key for a conversation's role subtitle (`t.conversations[roleKey]`). */
export type ConvRoleKey = "roleAi" | "roleAdvisor" | "roleSupport";

export interface ConvMessage {
  id: string;
  sender: "user" | "agent";
  /** Literal text (runtime-sent messages / real backend). */
  text?: string;
  /** i18n seed key (mock seed) — preferred over `text` when present. */
  textKey?: ConvSeedKey;
  /** i18n CTA label key (seed messages only). */
  ctaKey?: ConvCtaKey;
  /** Logical route the CTA navigates to (mapped by lib/route navTo). */
  ctaHref?: string;
  ts: number;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  agentName: string;
  roleKey: ConvRoleKey;
  /** Avatar/icon tint — v5 token, theme-aware. */
  avatarTint: string;
  messages: ConvMessage[];
  unread: number;
  lastTs: number;
}

const MIN = 60_000;
const HOUR = 3600_000;
const DAY = 86_400_000;

// ─── Runtime agent-reply templates (cycled in order, like nova's AGENT_REPLIES) ───
// `as const satisfies` proves each key exists on the conversations namespace at
// compile time; indexing with the literal element then yields a string.
export const ADVISOR_REPLY_KEYS = [
  "advisorReply1",
  "advisorReply2",
  "advisorReply3",
] as const satisfies readonly (keyof ConvNs)[];

export const SUPPORT_REPLY_KEYS = [
  "supportReply1",
  "supportReply2",
  "supportReply3",
  "supportReply4",
] as const satisfies readonly (keyof ConvNs)[];

export function replyKeysForType(type: ConversationType): readonly ConvReplyKey[] {
  return type === "advisor" ? ADVISOR_REPLY_KEYS : SUPPORT_REPLY_KEYS;
}

// ─── Seed conversations (advisor reaches out proactively; support is a prior
// user-initiated thread the user can reopen). Re-seeded each session, non-persisted
// (mirrors the nova transcript), so the advisor's proactive unread is always a
// live touchpoint on landing. ───
export function seedConversations(now: number = Date.now()): Conversation[] {
  return [
    {
      id: "cv-advisor-1",
      type: "advisor",
      agentName: "Mia",
      roleKey: "roleAdvisor",
      avatarTint: "var(--v5-brand)",
      unread: 2,
      lastTs: now - 12 * MIN,
      messages: [
        { id: "ad-1", sender: "agent", textKey: "advisorWelcome", ts: now - 3 * HOUR },
        { id: "ad-2", sender: "agent", textKey: "advisorIdleGpu", ctaKey: "browseStore", ctaHref: "/store", ts: now - 40 * MIN },
        { id: "ad-3", sender: "agent", textKey: "advisorStaking", ctaKey: "lockStaking", ctaHref: "/staking", ts: now - 12 * MIN },
      ],
    },
    {
      id: "cv-support-1",
      type: "support",
      agentName: "Sarah K.",
      roleKey: "roleSupport",
      avatarTint: "var(--v5-tech-cyan)",
      unread: 0,
      lastTs: now - 5 * HOUR,
      messages: [
        { id: "sp-1", sender: "user", textKey: "supportUserQ", ts: now - 6 * HOUR },
        { id: "sp-2", sender: "agent", textKey: "supportResolved", ts: now - 5 * HOUR },
      ],
    },
  ];
}
