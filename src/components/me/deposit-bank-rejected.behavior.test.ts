import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { compile } from "@vue/compiler-dom";
import { parse } from "@vue/compiler-sfc";
import { renderToString } from "@vue/server-renderer";
import * as Vue from "vue";
import ts from "typescript";
import source from "./deposit-bank-pane.vue?raw";
import type { DepositIntent } from "@/store/types";
import { ApiError } from "@/api/errors";
import { fmt } from "@/i18n/format";
import { zh } from "@/i18n/messages/zh";
import { en } from "@/i18n/messages/en";
import { vi as vietnamese } from "@/i18n/messages/vi";
import { computeQuoteRate, fmtVnd, vndForUsdt } from "@/store/fx-core";
import { findResumablePaymentIntent } from "@/lib/hosted-payment";
import { runRecoverableFundsOperation } from "@/lib/recoverable-funds-operation";
import { buildVietQrTransferSteps } from "@/lib/vietqr-remote-safety";

const descriptor = parse(source).descriptor;
const setupSource = descriptor.scriptSetup!.content;
const ast = ts.createSourceFile("deposit-bank-pane.ts", setupSource, ts.ScriptTarget.ES2022, true);
const exposed = ast.statements.flatMap((statement) => {
  if (ts.isFunctionDeclaration(statement)) return statement.name ? [statement.name.text] : [];
  if (!ts.isVariableStatement(statement)) return [];
  return statement.declarationList.declarations.flatMap((declaration) =>
    ts.isIdentifier(declaration.name) ? [declaration.name.text] : []);
});
const script = ts.transpileModule(setupSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText + `;return { ${exposed.join(", ")} };`;
const render = new Function("Vue", compile(descriptor.template!.content, {
  mode: "function", prefixIdentifiers: true, isCustomElement: tag => ["view", "text"].includes(tag),
}).code)(Vue) as Vue.RenderFunction;
const cleanups: Array<() => void> = [];
const now = Date.parse("2026-10-04T00:39:20Z");
const quoteRate = computeQuoteRate(26000, 1.5);
type Messages = typeof zh | typeof en | typeof vietnamese;
interface PaneState extends Record<string, unknown> {
  intent: Vue.ComputedRef<DepositIntent | null>;
  paneView: Vue.ComputedRef<string>;
  hostedRejected: Vue.ComputedRef<boolean>;
  hostedCanOpen: Vue.ComputedRef<boolean>;
  createError: Vue.Ref<string>;
  creating: Vue.Ref<boolean>;
  completeCreateOrder: (amount: number, account: string) => Promise<void>;
  openHostedOrder: (intent: DepositIntent) => void;
  goSupport: () => void;
  regen: () => void;
}

function pane(providerStatus: DepositIntent["providerStatus"] = "rejected", translations: Messages = zh) {
  const original: DepositIntent = {
    intentId: "VQR-existing", usdtAmount: 5000, fxRate: quoteRate, vndAmount: vndForUsdt(5000, quoteRate),
    status: "awaiting_payment", createdAt: now, expireAt: now + 6 * 60_000,
    paymentMode: "hosted", providerStatus,
    ...(providerStatus === "created" ? { paymentUrl: "https://api.hdpayadmin.com/pay?id=existing" } : {}),
  };
  const dep = Vue.reactive({
    intents: [original], records: [], serverStatus: "ready", serverError: "",
    currentAccountKey: () => "user:7", createRemoteBankIntent: vi.fn(async () => original),
    refreshRemoteVietQrDeposits: vi.fn(async () => {}),
    startRemoteVietQrPolling: vi.fn(), stopRemoteVietQrPolling: vi.fn(),
  });
  const fx = { fxAvailable: true, configReady: true, vietQrEnabled: true, dailyCapacityKnown: false,
    minDepositUsdt: 10, maxDepositUsdt: 5000, todayRemainingDepositUsdt: 0,
    quoteRate, feeUsdt: 0, feeVnd: 0, lockWindowMin: 30, load: vi.fn(async () => {}) };
  const navTo = vi.fn(), open = vi.fn(() => true), toast = { error: vi.fn(), success: vi.fn(), warn: vi.fn() };
  const mounted: Array<() => void> = [], unmounted: Array<() => void> = [];
  const modules: Record<string, unknown> = {
    vue: { ...Vue, onMounted: (callback: () => void) => mounted.push(callback),
      onUnmounted: (callback: () => void) => unmounted.push(callback) },
    "@/components/me/fx-rate-line.vue": {}, "@/i18n/use-t": { useT: () => Vue.ref(translations) },
    "@/i18n/format": { fmt }, "@/lib/route": { navTo, navBack: vi.fn() },
    "@/store/ui": { toast, confirm: vi.fn() }, "@/store/deposits": { useDeposits: () => dep },
    "@/store/fx": { useFx: () => fx }, "@/store/app": { useApp: () => ({}) },
    "@/store/fx-core": { fmtVnd, vndForUsdt }, "@/store/server-time": { mockServerNow: () => now },
    "@/store/deposits-core": { BANK_MAX_DEPOSIT_USDT: 5000, MIN_DEPOSIT_USDT: 10 },
    "@/api/runtime": { remoteApiEnabled: true }, "@/api/errors": { ApiError },
    "@/lib/recoverable-funds-operation": { runRecoverableFundsOperation },
    "@/lib/vietqr-remote-safety": { buildVietQrTransferSteps },
    "@/lib/hosted-payment": { findResumablePaymentIntent, openHostedPaymentPage: open },
  };
  const scope = Vue.effectScope();
  const state = scope.run(() => new Function("require", "exports", script)(
    (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected bank pane dependency: ${name}`);
      return modules[name];
    }, {},
  )) as PaneState;
  mounted.forEach(callback => callback());
  cleanups.push(() => { unmounted.forEach(callback => callback()); scope.stop(); });
  return { state, dep, fx, navTo, open, toast, html: () => renderToString(Vue.createSSRApp({
    components: { FxRateLine: { render: () => null } }, setup: () => ({ ...state, fmt, fmtVnd }), render,
  })) };
}

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers(); vi.restoreAllMocks(); });

test.each([zh, en, vietnamese])("a resumed rejected order renders failure and support without payment or a new POST", async (messages) => {
  const view = pane("rejected", messages);
  expect(view.state.intent.value?.intentId).toBe("VQR-existing");
  expect(view.state.paneView.value).toBe("order");
  expect(view.state.hostedRejected.value).toBe(true);
  const html = await view.html();
  expect(html).toContain(messages.bankPane.hostedRejectedNote);
  expect(messages.help.contactSupport).toBeTypeOf("string");
  expect(html).toContain(messages.help.contactSupport);
  expect(html).not.toContain(messages.bankPane.hostedPendingNote);
  expect(html).not.toContain(fmt(messages.bankPane.countdown, { time: "06:00" }));
  expect(html).not.toMatch(/nx-bank-(?:create|hosted-continue|cancel|regen)-cta/);
  view.state.goSupport();
  expect(view.navTo).toHaveBeenCalledExactlyOnceWith("/pages/me/support-tickets?mode=create&cat=deposit");
  expect(view.dep.createRemoteBankIntent).not.toHaveBeenCalled();
  expect(view.open).not.toHaveBeenCalled();
  expect(view.dep.intents[0]).toMatchObject({ intentId: "VQR-existing", status: "awaiting_payment", providerStatus: "rejected" });
});

test.each(["pending", "submit_unknown", "not_submitted"] as const)("%s continues to show the existing pending guidance", async (status) => {
  const view = pane(status), html = await view.html();
  expect(html).toContain(zh.bankPane.hostedPendingNote);
  expect(html).toContain(fmt(zh.bankPane.countdown, { time: "06:00" }));
  expect(html).not.toContain(zh.bankPane.hostedRejectedNote);
  expect(view.dep.createRemoteBankIntent).not.toHaveBeenCalled();
});

test("a refreshed created URL restores payment on the same order without creating another", async () => {
  const view = pane();
  view.dep.intents[0] = { ...view.dep.intents[0], providerStatus: "created", paymentUrl: "https://api.hdpayadmin.com/pay?id=existing" };
  await Vue.nextTick();
  const html = await view.html();
  expect(html).toContain("nx-bank-hosted-continue-cta");
  expect(html).toContain(zh.bankPane.hostedSecureNote);
  expect(html).not.toContain(zh.bankPane.hostedRejectedNote);
  view.state.openHostedOrder(view.state.intent.value!);
  expect(view.open).toHaveBeenCalledExactlyOnceWith("https://api.hdpayadmin.com/pay?id=existing");
  expect(view.dep.createRemoteBankIntent).not.toHaveBeenCalled();
});

test.each([zh, en, vietnamese])("the original CREATE rejection uses the same failure copy and never retries", async (messages) => {
  const view = pane("pending", messages);
  view.dep.createRemoteBankIntent.mockRejectedValue(new ApiError({ kind: "http", status: 502, code: 502, message: "HDPAY_ORDER_CREATE_REJECTED" }));
  await view.state.completeCreateOrder(25, "user:7");
  await vi.advanceTimersByTimeAsync(3000);
  expect(view.state.createError.value).toBe(messages.bankPane.hostedRejectedNote);
  expect(view.toast.error).toHaveBeenCalledExactlyOnceWith(messages.bankPane.hostedRejectedNote);
  expect(view.dep.createRemoteBankIntent).toHaveBeenCalledExactlyOnceWith(25, "user:7");
  expect(view.state.creating.value).toBe(false);
  expect(view.open).not.toHaveBeenCalled();
});

test.each(["credited", "expired"] as const)("canonical %s replaces rejection without an automatic CREATE", async (status) => {
  const view = pane();
  view.dep.intents[0].status = status;
  await Vue.nextTick();
  expect(view.state.paneView.value).toBe(status);
  const html = await view.html();
  expect(html).toContain(status === "credited" ? zh.bankPane.successTitle : "nx-bank-regen-cta");
  expect(html).not.toContain(zh.bankPane.hostedRejectedNote);
  expect(view.dep.createRemoteBankIntent).not.toHaveBeenCalled();
  if (status === "expired") {
    view.state.regen();
    await vi.advanceTimersByTimeAsync(600);
    expect(view.dep.createRemoteBankIntent).toHaveBeenCalledExactlyOnceWith(5000, "user:7");
  }
});
