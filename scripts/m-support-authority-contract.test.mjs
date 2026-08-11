import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("M App support production paths use the server API and never local support mocks", async () => {
  const [runtime, tickets, conversations, ticketPage, messagesPage, chatPage, helpPage] = await Promise.all([
    read("src/api/runtime.ts"),
    read("src/store/tickets.ts"),
    read("src/store/conversations.ts"),
    read("src/pages/me/support-tickets.vue"),
    read("src/pages/support/messages.vue"),
    read("src/pages/support/chat.vue"),
    read("src/pages/me/help.vue"),
  ]);
  assert.match(runtime, /supportApi/);
  for (const source of [tickets, conversations, ticketPage, messagesPage, chatPage, helpPage]) {
    assert.doesNotMatch(source, /@\/mock\/(tickets|conversations|faq)/);
    assert.doesNotMatch(source, /account-scoped-storage|localStorage|uni\.setStorageSync/);
  }
  assert.match(tickets, /supportApi\.(tickets|createTicket|replyTicket|closeTicket)/);
  assert.match(conversations, /supportApi\.(conversations|conversation|startConversation|replyConversation|convertConversationToTicket)/);
  assert.match(conversations, /markConversationRead/);
  assert.match(helpPage, /supportApi\.faqs/);
});

test("support API parser is strict and every mutation carries idempotency plus CAS", async () => {
  const api = await read("src/api/support-api.ts");
  assert.match(api, /SUPPORT_(TICKET|CONVERSATION|FAQ)_RESPONSE_INVALID/);
  assert.match(api, /idempotencyKey:/);
  assert.match(api, /expectedStatus/);
  assert.match(api, /expectedVersion/);
  assert.doesNotMatch(api, /fallbackTransfer/);
  assert.match(api, /while \(items\.length < total\)/);
  assert.match(api, /markConversationRead/);
});

test("support mutations are single-flight and retain one key across unknown-result retries", async () => {
  const [tickets, conversations] = await Promise.all([
    read("src/store/tickets.ts"), read("src/store/conversations.ts"),
  ]);
  for (const source of [tickets, conversations]) {
    assert.match(source, /pendingKeys/);
    assert.match(source, /inFlight/);
    assert.match(source, /pendingKeys\.get\(fingerprint\) \?\? mutationKey/);
    assert.match(source, /pendingKeys\.delete\(fingerprint\)/);
  }
});

test("ticket list projects the authoritative message count and opens its detail before rendering a timeline", async () => {
  const [api, domain, row, page] = await Promise.all([
    read("src/api/support-api.ts"),
    read("src/domain/support.ts"),
    read("src/components/me/ticket-row.vue"),
    read("src/pages/me/support-tickets.vue"),
  ]);
  assert.match(api, /messageCount/);
  assert.match(domain, /messageCount:\s*number/);
  assert.match(row, /tk\.messageCount/);
  assert.match(page, /@open="openTicket\(tk\.id\)"/);
  assert.match(page, /async function openTicket\(id: string\)[\s\S]*ticketsStore\.load\(id\)/);
});

test("an empty human conversation lane gives the user an authoritative start path instead of a local fallback", async () => {
  const [messages, chat, conversations] = await Promise.all([
    read("src/pages/support/messages.vue"),
    read("src/pages/support/chat.vue"),
    read("src/store/conversations.ts"),
  ]);
  assert.match(messages, /cta-label="startConversationLabel"/);
  assert.match(messages, /@cta="onStartConversation"/);
  assert.match(messages, /navTo\("\/pages\/support\/chat\?start="/);
  assert.match(chat, /q\?\.start/);
  assert.match(chat, /convStore\.startConversation\(/);
  assert.match(conversations, /async function startConversation\(type: Exclude<ConversationType, "ai">, openingText: string\)/);
});

test("ticket list and detail render refreshed server metadata through the active locale", async () => {
  const [row, page, en, zh] = await Promise.all([
    read("src/components/me/ticket-row.vue"),
    read("src/pages/me/support-tickets.vue"),
    read("src/i18n/messages/en.ts"),
    read("src/i18n/messages/zh.ts"),
  ]);
  assert.match(row, /t\.value\.tickets\.status\[props\.tk\.status\]/);
  assert.match(row, /t\.value\.tickets\.category\[props\.tk\.category\]/);
  assert.match(row, /t\.value\.tickets\.timeJustNow/);
  assert.match(row, /t\.value\.tickets\.messagesCount/);
  assert.match(page, /await ticketsStore\.refresh\(\)/);
  assert.match(page, /t\.value\.tickets\.status\[s\]/);
  assert.match(page, /t\.value\.tickets\.category\[c\]/);
  assert.match(page, /t\.value\.tickets\.detail\.agentFallback/);
  assert.match(page, /t\.value\.tickets\.timeJustNow/);
  for (const source of [row, page]) {
    assert.doesNotMatch(source, /CATEGORY_LABEL|STATUS_LABEL/);
    assert.doesNotMatch(source, /return "just now"|`\$\{Math\.floor\([^`]+\}\)(?:m|h|d) ago`/);
  }
  assert.match(en, /messagesCount:\s*"\{n\} messages"/);
  assert.match(en, /unassignedAgent:\s*"Unassigned"/);
  assert.match(zh, /status:[\s\S]*open:\s*"进行中"/);
  assert.match(zh, /category:[\s\S]*other:\s*"其他"/);
  assert.match(zh, /messagesCount:\s*"\{n\} 条消息"/);
  assert.match(zh, /timeJustNow:\s*"刚刚"/);
});

test("conversation list and detail localize an unassigned server owner after refresh", async () => {
  const [messages, chat, en, zh] = await Promise.all([
    read("src/pages/support/messages.vue"),
    read("src/pages/support/chat.vue"),
    read("src/i18n/messages/en.ts"),
    read("src/i18n/messages/zh.ts"),
  ]);
  assert.match(messages, /await convStore\.refresh\(\)/);
  assert.match(messages, /displayAgentName\(c\.agentName\)/);
  assert.match(messages, /t\.value\.conversations\.unassignedAgent/);
  assert.match(chat, /displayAgentName\(conv\.value\.agentName\)/);
  assert.match(chat, /t\.value\.conversations\.unassignedAgent/);
  assert.match(en, /unassignedAgent:\s*"Unassigned"/);
  assert.match(zh, /unassignedAgent:\s*"待分配客服"/);
});
