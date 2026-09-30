import { beforeEach, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";
import ts from "typescript";
import { createApiClient } from "@/api/api-client";
import { createSessionVault } from "@/api/session-vault";
import { binarySessionReady as accountSessionReady } from "@/lib/binary-session-ready";
import { ApiError } from "@/api/errors";
import source from "../pages/me/support-tickets.vue?raw";
import { installSupportStorage } from "@/test/storage-setup";

installSupportStorage();
const runtime = vi.hoisted(() => ({ remoteApiEnabled: true, supportApi: {
  authorityRevision: vi.fn(), commandResult: vi.fn(), tickets: vi.fn(), ticket: vi.fn(), markTicketRead: vi.fn(),
} }));
vi.mock("@/api/runtime", () => runtime);
const { useTickets } = await import("./tickets");
const ticket = { id: "TK-1", subject: "Own ticket", category: "technical", status: "open", priority: "normal", version: 1,
  createdAt: 1, updatedAt: 1, lastReplyAt: 1, messageCount: 1, unread: 0, owner: "Agent", messages: [] };
const snapshot = (userId = 1) => ({ accessToken: "test-access", refreshToken: "test-refresh", tokenType: "Bearer",
  user: { userId, countryCode: "+86", phone: "13800000001", nickname: "Test", onboardingComplete: true } });
beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks();
  runtime.supportApi.authorityRevision.mockResolvedValue("run-1"); runtime.supportApi.commandResult.mockResolvedValue(null); });

function pageHarness() {
  const store = useTickets(); store.bindAccount("default");
  const app = reactive({ accountKey: "default", accountBindingEpoch: 0 }), auth = reactive({ accountId: "", isAuthenticated: false });
  const vault = createSessionVault(), transport = vi.fn(async () => ({ status: 200, headers: {}, data: { code: 0, message: "OK", data: ticket } }));
  const client = createApiClient({ baseUrl: "https://example.test", vault, transport: { request: transport } });
  runtime.supportApi.ticket.mockImplementation(id => client.request({ path: `/api/app/support/tickets/${id}` }));
  runtime.supportApi.tickets.mockImplementation(() => client.request({ path: "/api/app/support/tickets" }).then(() => ({ items: [], total: 0 })));
  const ast = ts.createSourceFile("tickets.ts", source.split('<script setup lang="ts">')[1].split("</script>")[0], ts.ScriptTarget.ES2022, true);
  const variables = ["mode", "subject", "desc", "reply", "submitAttempted", "supportSessionReady", "ticketShowRevision", "ticketsPageVisible", "ticketsPageEpoch", "ticketOpenRequest", "ticketAccountWasBound", "detailTicket", "ticketSuggestionGeneration", "ticketSuggestionLoading"];
  const parts = variables.map(name => ast.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(item => item.name.getText(ast) === name))?.getText(ast)).filter(Boolean) as string[];
  if (!parts.some(part => part.includes("const supportSessionReady"))) parts.unshift(`const supportSessionReady = computed(() => {
    void app.accountBindingEpoch; return accountSessionReady({remote: true, authenticated: auth.isAuthenticated,
      accountId: auth.accountId, appAccountKey: app.accountKey, sessionUserId: sessionVault.read()?.user.userId ?? null}); });`);
  const names = new Set(["openTicket", "reloadTickets", "activateTicketPage", "hideTicketPage", "submitCreate", "sendReply", "closeTicket", "loadEarlierTicket"]);
  parts.push(...ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text ?? "")).map(node => node.getText(ast)));
  for (const node of ast.statements) {
    if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) continue;
    const call = node.expression.expression.getText(ast), text = node.getText(ast);
    if (["onLoad", "onShow", "onHide", "onUnload", "onUnmounted"].includes(call)
      || (call === "watch" && (text.includes("app.accountKey") || text.includes("ticketShowRevision")))) parts.push(text);
  }
  let load!: (query: Record<string, string>) => void, show!: () => Promise<void>, hide = () => {}, unmount = () => {};
  const toast = { info: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn() };
  const deps = { computed, ref, watch, nextTick, app, auth, sessionVault: vault, accountSessionReady, ticketsStore: store, remoteApiEnabled: true,
    captureAccountScope: () => app.accountBindingEpoch, isCurrentAccountScope: (epoch: number) => epoch === app.accountBindingEpoch,
    loadSlaTargets: vi.fn(), loadTicketSuggestions: vi.fn(), selectCategory: vi.fn(), categoriesForNew: ["technical"], newCat: ref("technical"),
    canReply: () => true, toast, t: ref({ security: { opFailed: "failed" }, tickets: { create: {}, detail: {} } }),
    onLoad: (fn: typeof load) => { load = fn; }, onShow: (fn: typeof show) => { show = fn; }, onHide: (fn: typeof hide) => { hide = fn; },
    onUnload: (fn: typeof unmount) => { unmount = fn; }, onUnmounted: (fn: typeof unmount) => { unmount = fn; } };
  const scope = effectScope(), code = ts.transpileModule(parts.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = scope.run(() => new Function("deps", `const {${Object.keys(deps).join(",")}} = deps; ${code}
    return { mode, subject, desc, reply, ready: supportSessionReady, openTicket, submitCreate, sendReply, closeTicket };`)(deps));
  const restore = (userId = 1) => {
    vault.save(snapshot(userId)); auth.accountId = `user:${userId}`; auth.isAuthenticated = true;
    store.bindAccount(auth.accountId); app.accountKey = auth.accountId; app.accountBindingEpoch++;
  };
  return { ...result, store, app, auth, vault, transport, toast, scope, restore, load: (q: Record<string, string>) => load(q), show: () => show(), hide: () => hide(), unmount: () => unmount() };
}

it("cold detail retains its query intent and opens once after the first verified binding", async () => {
  const h = pageHarness();
  try {
    h.load({ ticket: "TK-1" }); await h.show(); await nextTick();
    expect(runtime.supportApi.tickets).not.toHaveBeenCalled(); expect(runtime.supportApi.ticket).not.toHaveBeenCalled();
    h.restore(); await nextTick(); await vi.waitFor(() => expect(h.store.tickets.find((item: { id: string }) => item.id === "TK-1")?.id).toBe("TK-1"));
    expect(h.mode.value).toEqual({ kind: "detail", id: "TK-1" }); expect(runtime.supportApi.ticket).toHaveBeenCalledTimes(1);
    expect(h.toast.warn).not.toHaveBeenCalled();
  } finally { h.scope.stop(); }
});

it.each(["hide", "unmount"] as const)("late cookie restore after %s performs no reads", async leave => {
  const h = pageHarness();
  try { h.load({ ticket: "TK-1" }); await h.show(); h[leave](); h.restore(); await nextTick();
    expect(runtime.supportApi.ticket).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled(); }
  finally { h.scope.stop(); }
});

it("before readiness all mutations preserve input; the first restore preserves the create form draft", async () => {
  const h = pageHarness(), create = vi.spyOn(h.store, "createTicket"), reply = vi.spyOn(h.store, "reply"), close = vi.spyOn(h.store, "close");
  try {
    h.load({ mode: "create" }); await h.show(); h.subject.value = "draft subject"; h.desc.value = "draft body"; h.reply.value = "draft reply";
    await h.submitCreate(); await h.sendReply(); await h.closeTicket();
    expect(create).not.toHaveBeenCalled(); expect(reply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    expect(h.subject.value).toBe("draft subject"); expect(h.desc.value).toBe("draft body"); expect(h.reply.value).toBe("draft reply");
    h.restore(); await nextTick(); expect(h.mode.value.kind).toBe("create"); expect(h.subject.value).toBe("draft subject");
  } finally { h.scope.stop(); }
});

it.each(["switch", "logout"])("a real %s clears previous detail and drafts", async change => {
  const h = pageHarness(); h.restore(); await nextTick(); h.load({ ticket: "TK-1" });
  try {
    h.subject.value = "private subject"; h.desc.value = "private body"; h.reply.value = "private reply";
    if (change === "switch") h.restore(2);
    else { h.vault.clear(); h.auth.isAuthenticated = false; h.auth.accountId = ""; h.store.bindAccount("default"); h.app.accountKey = "default"; h.app.accountBindingEpoch++; }
    await nextTick(); expect(h.mode.value.kind).toBe("list"); expect([h.subject.value, h.desc.value, h.reply.value]).toEqual(["", "", ""]);
  } finally { h.scope.stop(); }
});

it.each([401, 403, 404])("a real ticket denial still reports failure and does not display detail (%s)", async status => {
  const h = pageHarness(); h.restore(); await nextTick(); h.load({ ticket: "TK-1" });
  vi.spyOn(h.store, "load").mockRejectedValue(new ApiError({ kind: status === 404 ? "http" : "auth", status, message: "denied" }));
  try { await h.show(); await nextTick(); await vi.waitFor(() => expect(h.toast.warn).toHaveBeenCalled()); expect(h.mode.value.kind).toBe("list"); }
  finally { h.scope.stop(); }
});

it("an identity mismatch never reads the requested ticket", async () => {
  const h = pageHarness();
  try { h.load({ ticket: "TK-1" }); await h.show(); h.restore(); h.vault.save(snapshot(2)); h.app.accountBindingEpoch++;
    await nextTick(); expect(h.ready.value).toBe(false); expect(runtime.supportApi.ticket).not.toHaveBeenCalled(); }
  finally { h.scope.stop(); }
});

it("the latest ticket click wins even if the previous response arrives first", async () => {
  const h = pageHarness(); h.restore(); await nextTick(); await h.show(); await nextTick();
  const releases = new Map<string, (value: any) => void>();
  vi.spyOn(h.store, "load").mockImplementation(id => new Promise(resolve => releases.set(String(id), resolve)));
  const markRead = vi.spyOn(h.store, "markRead").mockResolvedValue(undefined);
  try {
    const first = h.openTicket("TK-A"), second = h.openTicket("TK-B");
    releases.get("TK-A")!({ ...ticket, id: "TK-A" }); await first;
    releases.get("TK-B")!({ ...ticket, id: "TK-B" }); await second;
    expect(h.mode.value).toEqual({ kind: "detail", id: "TK-B" }); expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead.mock.calls[0][0]).toMatchObject({ id: "TK-B" });
  } finally { h.scope.stop(); }
});

it.each(["submitCreate", "sendReply", "closeTicket"])("a late %s outcome cannot clear or revive the new account's UI", async operation => {
  const h = pageHarness(); h.restore(); await nextTick(); h.load(operation === "submitCreate" ? { mode: "create" } : { ticket: "TK-1" });
  await h.show(); await nextTick();
  if (operation !== "submitCreate") await vi.waitFor(() => expect(h.store.tickets.length).toBe(1));
  const method = operation === "submitCreate" ? "createTicket" : operation === "sendReply" ? "reply" : "close";
  let release!: (value: any) => void;
  const mutation = vi.spyOn(h.store, method).mockImplementation(() => new Promise<any>(resolve => { release = resolve; }));
  try {
    h.subject.value = "old subject"; h.desc.value = "old body"; h.reply.value = "old reply";
    const sending = h[operation](); await vi.waitFor(() => expect(mutation).toHaveBeenCalled());
    h.restore(2); h.subject.value = "new subject"; h.desc.value = "new body"; h.reply.value = "new reply";
    const nextMode = h.mode.value; release(operation === "submitCreate" ? "TK-old" : undefined); await sending;
    expect(h.mode.value).toBe(nextMode); expect([h.subject.value, h.desc.value, h.reply.value]).toEqual(["new subject", "new body", "new reply"]);
    expect(h.toast.success).not.toHaveBeenCalled(); expect(h.toast.error).not.toHaveBeenCalled();
  } finally { h.scope.stop(); }
});
