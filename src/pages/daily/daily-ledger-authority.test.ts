import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { computed, reactive, ref } from "vue";
import ts from "typescript";
import source from "./daily.vue?raw";
import { resolveWalletBillMemo } from "@/lib/wallet-bill-display";
import { dailyCheckInSuccessCopy } from "./daily-success-copy";
import { fmt } from "@/i18n/format";
import { en } from "@/i18n/messages/en";

const remote = vi.hoisted(() => ({ fundsServerEnabled: true, walletBillsApi: { list: vi.fn(), summary: vi.fn() } }));
vi.mock("@/api/runtime", () => remote);
const { useBills } = await import("@/store/bills");

function summary(earned: number | null = 199, spent: number | null = 18) {
  return { source: "server", sourceEnvironment: "PRODUCTION", asOf: 2000, timeZone: "UTC",
    rewardsUsdt: 0, rewardsNex: 499, latestRewardAt: 1000, todayNexEarn: 0, pendingNex: 300,
    monthBillCount: 10, recentNexBills: [], settledRewardsNex: earned, withdrawalOffsetNexSpent: spent };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function mount(bills: ReturnType<typeof useBills>) {
  const start = source.indexOf("const lifetimeEarned =");
  const end = source.indexOf("function daysLeftText", start);
  if (start < 0 || end < start) throw new Error("Daily ledger projection missing");
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const faucet = reactive({ history: [{ delta: 999, ts: 1, reason: "cached reward" }, { delta: -50, ts: 2, reason: "cached swap" }] });
  return new Function("computed", "remoteApiEnabled", "bills", "faucet", "t", "resolveWalletBillMemo",
    `${code}\nreturn { lifetimeEarned, lifetimeSpent, historyRows };`,
  )(computed, true, bills, faucet, ref({ bills: { memo: {} }, wallet: { pending: "Pending" } }), resolveWalletBillMemo);
}

function commands(bills: ReturnType<typeof useBills>, accepted: boolean) {
  const script = source.slice(source.indexOf('<script setup lang="ts">') + '<script setup lang="ts">'.length, source.indexOf('</script>'));
  const parsed = ts.createSourceFile('daily.ts', script, ts.ScriptTarget.Latest, true);
  const names = ['refreshLedger', 'handleCheckIn', 'handleClaimMilestone'];
  const functions = parsed.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ''));
  if (functions.length !== names.length) throw new Error('Daily command handlers missing');
  const code = ts.transpileModule(functions.map((node) => node.getText(parsed)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps = {
    bills, remoteApiEnabled: true, pageActive: true, remoteSessionReady: ref(true),
    dailyFactsReady: ref(true), checkInStateConfirmed: ref(true),
    lastSignedToday: ref(false), remoteRefreshing: ref(false), checkInSubmitting: ref(false),
    faucet: { checkInRemote: vi.fn().mockResolvedValue({ ok: accepted, gained: 5, streak: 3 }),
      claimMilestoneRemote: vi.fn().mockResolvedValue(accepted) },
    toast: { success: vi.fn(), error: vi.fn() }, t: ref(en), dailyCheckInSuccessCopy, fmt,
    isMilestoneClaimed: () => false, isMilestoneUnlocked: () => true,
  };
  const handlers = new Function(...Object.keys(deps), `${code}\nreturn { handleCheckIn, handleClaimMilestone };`)(...Object.values(deps));
  return { ...deps, ...handlers };
}

beforeEach(() => {
  setActivePinia(createPinia());
  remote.walletBillsApi.summary.mockReset().mockResolvedValue(summary());
});

describe("Daily wallet ledger authority", () => {
  it.each(['refreshBalance(false)', 'refreshLedger()'])('makes %s retry available to pointer and keyboard users', (handler) => {
    const controls = source.match(/<view\b[^>]*>/g) ?? [];
    const control = controls.find((tag) => tag.includes(`@click="${handler}"`));
    expect(control).toBeDefined();
    expect(control).toContain('role="button"');
    expect(control).toContain('tabindex="0"');
    expect(control).toContain(`@keydown.enter.prevent="${handler}"`);
    expect(control).toContain(`@keydown.space.prevent="${handler}"`);
  });

  it("uses settled rewards and net withdrawal fee offsets independently of cached daily deltas", async () => {
    const bills = useBills();
    bills.bindAccount("A");
    const view = mount(bills);
    await bills.refreshSummary();
    expect(view.lifetimeEarned.value).toBe("199");
    expect(view.lifetimeSpent.value).toBe("18");
    expect(view.historyRows.value).toEqual([]);
  });

  it("keeps loading, errors and unsupported optional totals unknown", async () => {
    const pending = deferred<ReturnType<typeof summary>>();
    remote.walletBillsApi.summary.mockReturnValueOnce(pending.promise);
    const bills = useBills();
    bills.bindAccount("A");
    const view = mount(bills);
    const read = bills.refreshSummary();
    expect(view.lifetimeEarned.value).toBe("—");
    expect(view.lifetimeSpent.value).toBe("—");
    pending.reject(new Error("summary unavailable"));
    await expect(read).rejects.toThrow("summary unavailable");
    expect(view.lifetimeEarned.value).toBe("—");
    expect(view.lifetimeSpent.value).toBe("—");
    remote.walletBillsApi.summary.mockResolvedValueOnce(summary(null, null));
    await bills.refreshSummary();
    expect(view.lifetimeEarned.value).toBe("—");
    expect(view.lifetimeSpent.value).toBe("—");
  });

  it.each(["success", "failure"])("does not expose an old account's delayed %s after rebinding", async (outcome) => {
    const previous = deferred<ReturnType<typeof summary>>();
    remote.walletBillsApi.summary.mockReturnValueOnce(previous.promise).mockResolvedValueOnce(summary(20, 3));
    const bills = useBills();
    bills.bindAccount("A");
    const view = mount(bills);
    const oldRead = bills.refreshSummary();
    bills.bindAccount("B");
    expect(view.lifetimeEarned.value).toBe("—");
    await bills.refreshSummary();
    if (outcome === "success") previous.resolve(summary(999, 888));
    else previous.reject(new Error("previous account unavailable"));
    await expect(oldRead).rejects.toThrow(outcome === "success"
      ? "WALLET_SUMMARY_REQUEST_SUPERSEDED" : "previous account unavailable");
    expect(view.lifetimeEarned.value).toBe("20");
    expect(view.lifetimeSpent.value).toBe("3");
    remote.walletBillsApi.summary.mockRejectedValueOnce(new Error("B unavailable"));
    await expect(bills.refreshSummary()).rejects.toThrow("B unavailable");
    expect(view.lifetimeEarned.value).toBe("—");
    expect(view.lifetimeSpent.value).toBe("—");
  });

  it("preserves the current account's error when an old account succeeds afterwards", async () => {
    const previous = deferred<ReturnType<typeof summary>>();
    remote.walletBillsApi.summary.mockReturnValueOnce(previous.promise).mockRejectedValueOnce(new Error('B unavailable'));
    const bills = useBills(); bills.bindAccount('A');
    const view = mount(bills);
    const oldRead = bills.refreshSummary();
    bills.bindAccount('B');
    await expect(bills.refreshSummary()).rejects.toThrow('B unavailable');
    previous.resolve(summary(999, 888));
    await expect(oldRead).rejects.toThrow('WALLET_SUMMARY_REQUEST_SUPERSEDED');
    expect(bills.summaryStatus).toBe('error');
    expect(view.lifetimeEarned.value).toBe('—');
    expect(view.lifetimeSpent.value).toBe('—');
  });

  it.each(['check-in', 'milestone'])("forces a ledger reread only after a confirmed %s command", async (action) => {
    const bills = useBills(); bills.bindAccount('A');
    const view = mount(bills);
    await bills.refreshSummary();
    const refresh = vi.spyOn(bills, 'refreshSummary');
    const run = (h: ReturnType<typeof commands>) => action === 'check-in' ? h.handleCheckIn()
      : h.handleClaimMilestone({ day: 3, rewardText: '5 NEX', reward: { type: 'nex', amount: 5 } });
    const refused = commands(bills, false);
    await run(refused);
    expect(refresh).not.toHaveBeenCalled();
    expect(view.lifetimeEarned.value).toBe('199');
    remote.walletBillsApi.summary.mockResolvedValueOnce(summary(204, 18));
    const accepted = commands(bills, true);
    await run(accepted);
    expect(refresh).toHaveBeenCalledExactlyOnceWith({ force: true });
    await vi.waitFor(() => expect(view.lifetimeEarned.value).toBe('204'));
  });

  it.each(['check-in', 'milestone'])("keeps totals unknown when the post-%s ledger read fails", async (action) => {
    const bills = useBills(); bills.bindAccount('A');
    const view = mount(bills);
    await bills.refreshSummary();
    remote.walletBillsApi.summary.mockRejectedValueOnce(new Error('ledger unavailable'));
    const accepted = commands(bills, true);
    if (action === 'check-in') await accepted.handleCheckIn();
    else await accepted.handleClaimMilestone({ day: 3, rewardText: '5 NEX', reward: { type: 'nex', amount: 5 } });
    await vi.waitFor(() => expect(bills.summaryStatus).toBe('error'));
    expect(view.lifetimeEarned.value).toBe('—');
    expect(view.lifetimeSpent.value).toBe('—');
    expect(accepted.toast.success).toHaveBeenCalledOnce();
    expect(accepted.toast.error).not.toHaveBeenCalled();
  });

  // #154: "today's check-in state" is only ever proven by a successful read.
  // A failed read leaves remoteCheckedInToday at false, so without this gate the
  // page offers an enabled check-in whose precondition it cannot verify.
  it("refuses the check-in write while today's account state is unconfirmed", async () => {
    const bills = useBills(); bills.bindAccount('A');
    const handler = commands(bills, true);
    handler.checkInStateConfirmed.value = false;
    await handler.handleCheckIn();
    expect(handler.faucet.checkInRemote).not.toHaveBeenCalled();
    expect(handler.toast.error).toHaveBeenCalledOnce();
    expect(handler.toast.success).not.toHaveBeenCalled();
    // The button reports the same gate to assistive tech and names why it is inert.
    const button = (source.match(/<view\b[^>]*>/g) ?? []).find((tag) => tag.includes('@click="handleCheckIn"'));
    expect(button).toContain("!checkInStateConfirmed ? 'true' : 'false'");
    expect(source).toContain("t.daily.checkInUnconfirmed");
  });
});
