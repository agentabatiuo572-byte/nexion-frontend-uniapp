import { defineStore } from "pinia";
import { ref } from "vue";
import { supportApi } from "@/api/runtime";
import type { Ticket, TicketCategory } from "@/domain/support";

function mutationKey(scope: string): string {
  const label = scope.split(":", 1)[0].replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "command";
  return `support-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useTickets = defineStore("tickets", () => {
  const tickets = ref<Ticket[]>([]);
  const loading = ref(false);
  const mutating = ref(false);
  const error = ref<string | null>(null);
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

  function replace(ticket: Ticket) {
    const rest = tickets.value.filter((row) => row.id !== ticket.id);
    tickets.value = [ticket, ...rest].sort((a, b) => b.lastReplyAt - a.lastReplyAt);
  }

  async function refresh(): Promise<void> {
    const epoch = accountEpoch;
    loading.value = true;
    error.value = null;
    try {
      const items = (await supportApi.tickets()).items;
      if (epoch === accountEpoch) tickets.value = items;
    } catch (cause) {
      if (epoch === accountEpoch) {
        tickets.value = [];
        error.value = cause instanceof Error ? cause.message : "SUPPORT_TICKETS_LOAD_FAILED";
      }
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function load(id: string): Promise<Ticket> {
    const ticket = await supportApi.ticket(id);
    replace(ticket);
    return ticket;
  }

  async function createTicket(input: { category: TicketCategory; subject: string; body: string }): Promise<string> {
    const epoch = accountEpoch;
    const intent = `ticket-create:${input.category}:${input.subject.trim()}:${input.body.trim()}`;
    const ticket = await command(intent, key => supportApi.createTicket(input, key));
    if (epoch === accountEpoch) replace(ticket);
    return ticket.id;
  }

  async function reply(id: string, body: string): Promise<boolean> {
    const current = tickets.value.find((row) => row.id === id) ?? await load(id);
    const epoch = accountEpoch;
    const ticket = await command(`ticket-reply:${id}:${current.version}:${body.trim()}`,
      key => supportApi.replyTicket(current, body, key));
    if (epoch === accountEpoch) replace(ticket);
    return true;
  }

  async function close(id: string): Promise<boolean> {
    const current = tickets.value.find((row) => row.id === id) ?? await load(id);
    const epoch = accountEpoch;
    const ticket = await command(`ticket-close:${id}:${current.version}`,
      key => supportApi.closeTicket(current, key));
    if (epoch === accountEpoch) replace(ticket);
    return true;
  }

  function clearAccount() {
    accountEpoch += 1; tickets.value = []; error.value = null;
    pendingKeys.clear(); inFlight.clear(); mutating.value = false;
  }
  function bindAccount() { clearAccount(); }
  function reset() { clearAccount(); }

  return { tickets, loading, mutating, error, refresh, load, createTicket, reply, close, reset, bindAccount };
});
