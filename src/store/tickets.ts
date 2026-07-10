import { defineStore } from "pinia";
import { ref } from "vue";
import { TICKETS, type Ticket, type TicketCategory } from "@/mock/tickets";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

// 旧设备级单键 "nexion-support-tickets-v1" 废弃(存量无账号归属,mock 可重建);工单按账号分行。
const ACCOUNTS_KEY = "nexion-support-tickets-accounts-v1"; // { [accountKey]: { tickets: Ticket[] } }

function cloneTicket(ticket: Ticket): Ticket {
  const raw = ticket as Partial<Ticket>;
  return {
    ...ticket,
    lastReplyAt: raw.lastReplyAt ?? ticket.updatedAt,
    owner: raw.owner ?? "Unassigned",
    messages: ticket.messages.map((message) => ({ ...message })),
  };
}

function seedTickets(): Ticket[] {
  return TICKETS.map(cloneTicket);
}

function hydrate(accountKey: string): Ticket[] {
  const row = readAccountRow<{ tickets?: Ticket[] }>(ACCOUNTS_KEY, accountKey);
  if (row && Array.isArray(row.tickets)) return row.tickets.map(cloneTicket);
  return seedTickets();
}

function nextTicketId(tickets: Ticket[]): string {
  const max = tickets.reduce((acc, ticket) => {
    const n = Number(ticket.id.replace(/^TK-/, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 1024);
  return `TK-${String(max + 1).padStart(4, "0")}`;
}

export const useTickets = defineStore("tickets", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  const tickets = ref<Ticket[]>(hydrate(boundKey));

  function persist() {
    writeAccountRow<{ tickets: Ticket[] }>(ACCOUNTS_KEY, boundKey, { tickets: tickets.value });
  }

  /** 账号切换重绑:装载该账号的工单(P2-8 设备级泄漏修复)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    tickets.value = hydrate(boundKey);
  }

  function createTicket(input: { category: TicketCategory; subject: string; body: string }): string {
    const now = Date.now();
    const id = nextTicketId(tickets.value);
    const ticket: Ticket = {
      id,
      subject: input.subject.trim(),
      category: input.category,
      status: "open",
      priority: "normal",
      createdAt: now,
      updatedAt: now,
      lastReplyAt: now,
      unread: 0,
      owner: "Unassigned",
      messages: [{ ts: now, author: "user", body: input.body.trim() }],
    };
    tickets.value = [ticket, ...tickets.value];
    persist();
    return id;
  }

  function reply(id: string, body: string): boolean {
    const next = tickets.value.map((ticket) => {
      if (ticket.id !== id) return ticket;
      const now = Date.now();
      return {
        ...ticket,
        status: ticket.status === "closed" || ticket.status === "resolved" ? "open" : ticket.status,
        updatedAt: now,
        lastReplyAt: now,
        messages: [...ticket.messages, { ts: now, author: "user" as const, body: body.trim() }],
      };
    });
    const changed = next.some((ticket, index) => ticket !== tickets.value[index]);
    if (!changed) return false;
    tickets.value = next;
    persist();
    return true;
  }

  function close(id: string): boolean {
    const next = tickets.value.map((ticket) =>
      ticket.id === id
        ? { ...ticket, status: "closed" as const, updatedAt: Date.now(), unread: 0 }
        : ticket,
    );
    const changed = next.some((ticket, index) => ticket !== tickets.value[index]);
    if (!changed) return false;
    tickets.value = next;
    persist();
    return true;
  }

  function reset() {
    tickets.value = seedTickets();
    persist();
  }

  return { tickets, createTicket, reply, close, reset, bindAccount };
});
