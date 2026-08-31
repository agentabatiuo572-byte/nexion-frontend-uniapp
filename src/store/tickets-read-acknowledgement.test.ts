import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ApiError } from "@/api/errors";
import type { Ticket } from "@/domain/support";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  supportApi: {
    authorityRevision: vi.fn(),
    tickets: vi.fn(),
    ticket: vi.fn(),
    markTicketRead: vi.fn(),
  },
}));

vi.mock("@/api/runtime", () => remote);

const { useTickets } = await import("./tickets");

function ticket(id: string, version: number, unread: number): Ticket {
  return {
    id,
    subject: `Ticket ${id}`,
    category: "technical",
    status: "open",
    priority: "normal",
    version,
    createdAt: 1_756_640_000_000,
    updatedAt: 1_756_640_000_000 + version,
    lastReplyAt: 1_756_640_000_000 + version,
    messageCount: 1,
    unread,
    owner: "Agent",
    messages: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  remote.supportApi.authorityRevision.mockResolvedValue("support-run-1");
  remote.supportApi.tickets.mockResolvedValue({ items: [], total: 0 });
});

describe("ticket read acknowledgement", () => {
  it("adopts the server read snapshot only for the ticket version the user opened", async () => {
    const store = useTickets();
    const opened = ticket("TK-A", 3, 1);
    const acknowledged = ticket("TK-A", 4, 0);
    remote.supportApi.ticket.mockResolvedValue(opened);
    remote.supportApi.markTicketRead.mockResolvedValue(acknowledged);

    store.bindAccount("A");
    await store.load("TK-A");
    await store.markRead(opened);

    expect(remote.supportApi.markTicketRead).toHaveBeenCalledWith(opened);
    expect(store.tickets).toEqual([acknowledged]);
  });

  it("reads back a new agent reply after a 409 instead of applying the stale acknowledgement", async () => {
    const store = useTickets();
    const opened = ticket("TK-A", 3, 1);
    const newerReply = ticket("TK-A", 4, 2);
    remote.supportApi.ticket.mockResolvedValueOnce(opened).mockResolvedValueOnce(newerReply);
    remote.supportApi.markTicketRead.mockRejectedValue(new ApiError({ kind: "http", status: 409, message: "SUPPORT_TICKET_CONFLICT" }));

    store.bindAccount("A");
    await store.load("TK-A");
    await expect(store.markRead(opened)).rejects.toMatchObject({ status: 409 });

    expect(remote.supportApi.ticket).toHaveBeenCalledTimes(2);
    expect(store.tickets).toEqual([newerReply]);
  });

  it("does not apply a late read result to the next signed-in account", async () => {
    const store = useTickets();
    const opened = ticket("TK-A", 3, 1);
    const accountB = ticket("TK-B", 1, 1);
    const acknowledgment = deferred<Ticket>();
    remote.supportApi.ticket.mockResolvedValueOnce(opened).mockResolvedValueOnce(accountB);
    remote.supportApi.markTicketRead.mockReturnValueOnce(acknowledgment.promise);

    store.bindAccount("A");
    await store.load("TK-A");
    const pending = store.markRead(opened);
    store.bindAccount("B");
    await store.load("TK-B");
    acknowledgment.resolve(ticket("TK-A", 4, 0));
    await pending;

    expect(store.tickets).toEqual([accountB]);
  });
});
