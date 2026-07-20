import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getT } from "@/i18n/use-t";
import {
  seedConversations,
  replyKeysForType,
  nextSupportAgent,
  SUPPORT_IDLE_WARN_MS,
  SUPPORT_SESSION_TIMEOUT_MS,
  type Conversation,
  type ConversationType,
} from "@/mock/conversations";

/**
 * Conversation center — human customer-service categories (advisor / support).
 * The Nova AI category ("ai") is virtual and backed by the `nova` store, so it
 * is NOT held here. Non-persisted (session transcript, like nova): re-seeded each
 * session so the advisor's proactive unread is a live touchpoint on landing.
 *
 * Backend-replaceable: every action is serialisable + action-driven; swapping to a
 * real backend means messages arrive with literal `text` and replies stream in via
 * `pushAgentReply(id, text)` instead of the template cycler.
 *
 * P-017: setup store carries NO explicit return annotation (Pinia infers it).
 * Architecture law: stores do not import each other — cross-store orchestration
 * (combining AI + human unread, etc.) lives in the page layer.
 */

let counter = 1;
function nextId(): string {
  counter += 1;
  return `cm${counter}-${Date.now().toString(36)}`;
}

export const useConversations = defineStore("conversations", () => {
  const conversations = ref<Conversation[]>(seedConversations());
  // Per-conversation reply cursor → cycles the template list for a sense of progress.
  const replyCursor = ref<Record<string, number>>({});
  // Ephemeral "agent is typing" flags (conversation id → on). Backend-replaceable:
  // a real backend feeds this from WS typing events; never persisted.
  const typingIds = ref<Record<string, boolean>>({});

  // Human-side total unread (AI unread is the nova store's concern; the bubble
  // combines the two at the page layer).
  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + c.unread, 0),
  );

  /** Conversations of one category, newest activity first. */
  function byType(type: ConversationType): Conversation[] {
    return conversations.value
      .filter((c) => c.type === type)
      .sort((a, b) => b.lastTs - a.lastTs);
  }

  function get(id: string): Conversation | undefined {
    return conversations.value.find((c) => c.id === id);
  }

  function open(id: string) {
    conversations.value = conversations.value.map((c) =>
      c.id === id ? { ...c, unread: 0 } : c,
    );
  }

  function sendUser(id: string, text: string) {
    const body = text.trim();
    if (!body) return;
    // Closed sessions are read-only history — a real backend would 409 this write.
    const conv = get(id);
    if (!conv || conv.sessionStatus === "closed") return;
    const t = Date.now();
    conversations.value = conversations.value.map((c) =>
      c.id === id
        // idleWarnedAt: null — fresh activity ends the quiet spell; the next one warns anew.
        ? { ...c, messages: [...c.messages, { id: nextId(), sender: "user", text: body, status: "sent", ts: t }], lastTs: t, idleWarnedAt: null }
        : c,
    );
  }

  /** Agent read the thread → every user message flips to "read" (已读 receipt). */
  function markUserRead(id: string) {
    conversations.value = conversations.value.map((c) =>
      c.id === id
        ? { ...c, messages: c.messages.map((m) => (m.sender === "user" && m.status !== "read" ? { ...m, status: "read" as const } : m)) }
        : c,
    );
  }

  /** Toggle the ephemeral "agent is typing" flag for one conversation. */
  function setTyping(id: string, on: boolean) {
    typingIds.value = { ...typingIds.value, [id]: on };
  }

  /** Push the next cycled template reply for a conversation (resolved bilingual). */
  function pushAgentReply(id: string) {
    const conv = get(id);
    // Closed sessions never receive replies (mirrors the server refusing the write).
    if (!conv || conv.sessionStatus === "closed") return;
    const keys = replyKeysForType(conv.type);
    const idx = replyCursor.value[id] ?? 0;
    const text = getT().conversations[keys[idx % keys.length]];
    const t = Date.now();
    conversations.value = conversations.value.map((c) =>
      c.id === id
        ? { ...c, messages: [...c.messages, { id: nextId(), sender: "agent", text, ts: t }], lastTs: t, idleWarnedAt: null }
        : c,
    );
    replyCursor.value = { ...replyCursor.value, [id]: idx + 1 };
  }

  /** Advance the idle state machine of active support sessions — two stages:
   *  ① quiet for idleWarn → post the in-thread countdown warning (does NOT touch
   *    lastTs: a warning must not extend the session);
   *  ② quiet for idleClose → close with a system notice stamped at the moment the
   *    timeout crossed.
   *  Called from page onShow (lazy checkpoint) AND on an interval while the chat
   *  page is open, so the warning/closure land live in front of the user. A real
   *  backend runs this server-side and pushes both events — this becomes a no-op. */
  function sweepSupportTimeouts(now: number = Date.now()) {
    conversations.value = conversations.value.map((c) => {
      if (c.type !== "support" || c.sessionStatus !== "active") return c;
      const idle = now - c.lastTs;
      if (idle >= SUPPORT_SESSION_TIMEOUT_MS) {
        const closedTs = c.lastTs + SUPPORT_SESSION_TIMEOUT_MS;
        return {
          ...c,
          sessionStatus: "closed" as const,
          lastTs: closedTs,
          messages: [...c.messages, { id: nextId(), sender: "system" as const, textKey: "sessionTimeoutClosed" as const, ts: closedTs }],
        };
      }
      if (idle >= SUPPORT_IDLE_WARN_MS && !c.idleWarnedAt) {
        // Countdown = REAL minutes left until the close threshold (not the static
        // warn→close gap): a late checkpoint sweep (user re-enters at idle 3-4min)
        // must not promise more time than the session actually has.
        const minsLeft = Math.max(1, Math.ceil((c.lastTs + SUPPORT_SESSION_TIMEOUT_MS - now) / 60_000));
        return {
          ...c,
          idleWarnedAt: now,
          messages: [...c.messages, {
            id: nextId(),
            sender: "system" as const,
            textKey: "sessionIdleWarn" as const,
            textArgs: { n: minsLeft },
            ts: c.lastTs + SUPPORT_IDLE_WARN_MS,
          }],
        };
      }
      return c;
    });
  }

  /** Ensure a live support session and return its id. If one is already active it is
   *  reused (one live session at a time — restarting from an old closed thread routes
   *  to it; also absorbs double-taps). Otherwise assign the next pool agent after the
   *  most recent session's (reassignment after a timeout never lands on the same
   *  agent) and open with the agent's greeting. */
  function startSupportSession(now: number = Date.now()): string {
    // Sweep first so a stale "active" that already crossed the timeout can't be
    // reused — both entry points (contact button / restart bar) get this for free.
    sweepSupportTimeouts(now);
    const existing = byType("support").find((c) => c.sessionStatus === "active");
    if (existing) return existing.id;
    const prevAgent = byType("support")[0]?.agentName;
    const id = nextId();
    conversations.value = [
      ...conversations.value,
      {
        id,
        type: "support",
        agentName: nextSupportAgent(prevAgent),
        roleKey: "roleSupport",
        avatarTint: "var(--v5-tech-cyan)",
        unread: 0,
        lastTs: now,
        sessionStatus: "active",
        idleWarnedAt: null,
        messages: [{ id: nextId(), sender: "agent", textKey: "supportGreeting", ts: now }],
      },
    ];
    return id;
  }

  function reset() {
    conversations.value = seedConversations();
    replyCursor.value = {};
    typingIds.value = {};
  }

  return {
    conversations,
    typingIds,
    totalUnread,
    byType,
    get,
    open,
    sendUser,
    markUserRead,
    setTyping,
    pushAgentReply,
    sweepSupportTimeouts,
    startSupportSession,
    reset,
  };
});
