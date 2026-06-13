import { defineStore } from "pinia";
import { ref } from "vue";
import { TICKETS, type Ticket, type TicketCategory } from "@/mock/tickets";

const STORAGE_KEY = "nexion-support-tickets-v1";

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

function hydrate(): Ticket[] {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { tickets?: Ticket[] } | "";
    if (s && typeof s === "object" && Array.isArray(s.tickets)) {
      return s.tickets.map(cloneTicket);
    }
  } catch {
    // first run
  }
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
  const tickets = ref<Ticket[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { tickets: tickets.value });
    } catch {
      // storage unavailable
    }
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

  return { tickets, createTicket, reply, close, reset };
});
