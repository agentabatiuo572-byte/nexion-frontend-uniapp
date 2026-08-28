import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const ids = [
  "6f0b5c55-0ec5-4a31-85eb-1d4531c1e8df",
  "8c12eaf3-744d-405e-b2fb-64b3d81267be",
  "b150350c-fdbf-4c7c-a663-477dd9afe098",
];

const { useNova } = await import("./nova");

beforeEach(() => {
  setActivePinia(createPinia());
  let index = 0;
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => ids[index++] ?? ids.at(-1)) });
});

describe("Nova conversation scope", () => {
  it("keeps one UUID within a conversation and rotates it for a new conversation or account", () => {
    const nova = useNova();

    nova.bindRemoteAccount("account-a");
    expect(nova.conversationId).toBe(ids[0]);
    nova.bindRemoteAccount("account-a");
    expect(nova.conversationId).toBe(ids[0]);

    nova.sendUser("old question");
    nova.startNewConversation();
    expect(nova.messages).toEqual([]);
    expect(nova.conversationId).toBe(ids[1]);

    nova.bindRemoteAccount("account-b");
    expect(nova.conversationId).toBe(ids[2]);
  });

  it("fails closed instead of creating a predictable conversation id", () => {
    vi.stubGlobal("crypto", {});
    const nova = useNova();

    expect(() => nova.bindRemoteAccount("account-a"))
      .toThrow("CRYPTO_RANDOM_UUID_UNAVAILABLE");
    expect(nova.conversationId).toBe("");
  });

  it("hydrates a canonical remote transcript after an H5 reload", () => {
    const nova = useNova();
    nova.bindRemoteAccount("account-a");

    nova.hydrateRemote("account-a", ids[1], [
      { id: "turn:user", sender: "user", text: "Question", ts: 100 },
      { id: "turn:nova", sender: "nova", text: "Answer", ts: 101 },
    ]);

    expect(nova.conversationId).toBe(ids[1]);
    expect(nova.messages.map((message) => [message.sender, message.text]))
      .toEqual([["user", "Question"], ["nova", "Answer"]]);
  });
});
