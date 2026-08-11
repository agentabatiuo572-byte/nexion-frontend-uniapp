import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { supportApi } from "@/api/runtime";
import type { Conversation, ConversationType, TicketCategory } from "@/domain/support";

function mutationKey(scope: string): string {
  const label = scope.split(":", 1)[0].replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "command";
  return `support-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useConversations = defineStore("conversations", () => {
  const conversations = ref<Conversation[]>([]);
  const loading = ref(false);
  const mutating = ref(false);
  const error = ref<string | null>(null);
  const typingIds = ref<Record<string, boolean>>({});
  const totalUnread = computed(() => conversations.value.reduce((sum, row) => sum + row.unread, 0));
  const pendingKeys = new Map<string, string>();
  const inFlight = new Map<string, Promise<unknown>>();
  let accountEpoch = 0;

  async function command<T>(intent: string, action: (key: string) => Promise<T>): Promise<T> {
    const fingerprint = `${accountEpoch}:${intent}`;
    const running = inFlight.get(fingerprint) as Promise<T> | undefined;
    if (running) return running;
    const key = pendingKeys.get(fingerprint) ?? mutationKey(intent);
    pendingKeys.set(fingerprint, key);
    const promise = action(key);
    inFlight.set(fingerprint, promise);
    mutating.value = true;
    try {
      const result = await promise;
      pendingKeys.delete(fingerprint);
      return result;
    } finally {
      inFlight.delete(fingerprint);
      mutating.value = inFlight.size > 0;
    }
  }

  function replace(conversation: Conversation) {
    const rest = conversations.value.filter((row) => row.id !== conversation.id);
    conversations.value = [conversation, ...rest].sort((a, b) => b.lastTs - a.lastTs);
  }

  async function refresh(): Promise<void> {
    const epoch = accountEpoch;
    loading.value = true;
    error.value = null;
    try {
      const items = (await supportApi.conversations()).items;
      if (epoch === accountEpoch) conversations.value = items;
    } catch (cause) {
      if (epoch === accountEpoch) {
        conversations.value = [];
        error.value = cause instanceof Error ? cause.message : "SUPPORT_CONVERSATIONS_LOAD_FAILED";
      }
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  function byType(type: ConversationType): Conversation[] {
    return conversations.value.filter((row) => row.type === type).sort((a, b) => b.lastTs - a.lastTs);
  }
  function get(id: string): Conversation | undefined { return conversations.value.find((row) => row.id === id); }

  async function open(id: string): Promise<Conversation> {
    error.value = null;
    let conversation = await supportApi.conversation(id);
    const lastAgent = [...conversation.messages].reverse().find(message => message.sender === "agent");
    if (conversation.unread > 0 && lastAgent) {
      try {
        conversation = await supportApi.markConversationRead(conversation, Number(lastAgent.id));
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : "SUPPORT_CONVERSATION_READ_FAILED";
      }
    }
    replace(conversation);
    return conversation;
  }

  async function startConversation(type: Exclude<ConversationType, "ai">, openingText: string): Promise<string> {
    const epoch = accountEpoch;
    const conversation = await command(`conversation-create:${type}:${openingText.trim()}`,
      key => supportApi.startConversation(type, openingText, key));
    if (epoch === accountEpoch) replace(conversation);
    return conversation.id;
  }

  async function startSupportSession(openingText: string): Promise<string> {
    return startConversation("support", openingText);
  }

  async function sendUser(id: string, text: string): Promise<boolean> {
    const current = get(id) ?? await open(id);
    const epoch = accountEpoch;
    const conversation = await command(`conversation-reply:${id}:${current.version}:${text.trim()}`,
      key => supportApi.replyConversation(current, text, key));
    if (epoch === accountEpoch) replace(conversation);
    return true;
  }

  async function convertToTicket(id: string, category: TicketCategory, title: string): Promise<string> {
    const current = get(id) ?? await open(id);
    const epoch = accountEpoch;
    const result = await command(`conversation-ticket:${id}:${current.version}:${category}:${title.trim()}`,
      key => supportApi.convertConversationToTicket(current, category, title, key));
    if (epoch === accountEpoch) replace(result.conversation);
    return result.ticket.id;
  }

  function reset() {
    accountEpoch += 1; conversations.value = []; error.value = null; typingIds.value = {};
    pendingKeys.clear(); inFlight.clear(); mutating.value = false;
  }

  return { conversations, typingIds, totalUnread, loading, mutating, error, refresh, byType, get, open, startConversation, startSupportSession, sendUser, convertToTicket, reset };
});
