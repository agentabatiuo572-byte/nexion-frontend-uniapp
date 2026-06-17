import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getT } from "@/i18n/use-t";
import {
  seedConversations,
  replyKeysForType,
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
    const t = Date.now();
    conversations.value = conversations.value.map((c) =>
      c.id === id
        ? { ...c, messages: [...c.messages, { id: nextId(), sender: "user", text: body, ts: t }], lastTs: t }
        : c,
    );
  }

  /** Push the next cycled template reply for a conversation (resolved bilingual). */
  function pushAgentReply(id: string) {
    const conv = get(id);
    if (!conv) return;
    const keys = replyKeysForType(conv.type);
    const idx = replyCursor.value[id] ?? 0;
    const text = getT().conversations[keys[idx % keys.length]];
    const t = Date.now();
    conversations.value = conversations.value.map((c) =>
      c.id === id
        ? { ...c, messages: [...c.messages, { id: nextId(), sender: "agent", text, ts: t }], lastTs: t }
        : c,
    );
    replyCursor.value = { ...replyCursor.value, [id]: idx + 1 };
  }

  function reset() {
    conversations.value = seedConversations();
    replyCursor.value = {};
  }

  return {
    conversations,
    totalUnread,
    byType,
    get,
    open,
    sendUser,
    pushAgentReply,
    reset,
  };
});
