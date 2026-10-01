import * as Vue from "vue";
import type { Component } from "vue";
import { compileScript, compileStyle, parse } from "@vue/compiler-sfc";
import ts from "typescript";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import inviteSource from "./invite-earn-card.vue?raw";
import walletSource from "../me/wallet-card.vue?raw";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { vi as vietnamese } from "@/i18n/messages/vi";
import { fmt, openSlotsTemplate } from "@/i18n/format";
import type { ReferralRewardSnapshot } from "@/api/referral-reward-api";

// Run the production SFC scripts and templates. These isolated read states
// supplement the device acceptance; they are not evidence of a live backend.
type Host = { tag: string; text: string; props: Record<string, any>; parent: Host | null; children: Host[] };
const node = (tag: string, text = ""): Host => ({ tag, text, props: {}, parent: null, children: [] });
const renderer = Vue.createRenderer<Host, Host>({
  createElement: tag => node(tag), createText: text => node("#text", text), createComment: () => node("#comment"),
  setText: (target, text) => { target.text = text; },
  setElementText: (target, text) => { target.text = text; target.children = []; },
  patchProp: (target, key, _previous, value) => { target.props[key] = value; },
  parentNode: child => child.parent,
  nextSibling: child => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
  insert: (child, parent, anchor) => {
    if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child);
    child.parent = parent;
    const at = anchor ? parent.children.indexOf(anchor) : -1;
    if (at < 0) parent.children.push(child); else parent.children.splice(at, 0, child);
  },
  remove: child => { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child); },
});
const all = (root: Host): Host[] => [root, ...root.children.flatMap(all)];
const text = (root: Host): string => root.text + root.children.map(text).join("");
const hasClass = (target: Host, name: string) => Vue.normalizeClass(target.props.class).split(" ").includes(name);
const find = (root: Host, name: string) => all(root).find(target => hasClass(target, name))!;
const unmounts: Array<() => void> = [];

async function mount(source: string, dependencies: Record<string, unknown>) {
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: "invite-wallet-state", inlineTemplate: true });
  const code = ts.transpileModule(script.content, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = { default: {} as Component };
  new Function("require", "exports", code)((id: string) => {
    if (id === "vue") return Vue;
    if (id in dependencies) return dependencies[id];
    if (id.endsWith(".vue")) return { default: { render: () => Vue.h("view") } };
    throw new Error(`Unexpected component import: ${id}`);
  }, exports);
  const root = node("root");
  const app = renderer.createApp(exports.default);
  app.mount(root); unmounts.push(() => app.unmount());
  await Vue.nextTick();
  return root;
}

function snapshot(rewardEnabled = false): ReferralRewardSnapshot {
  return { referralCode: "INVITE123", rewardEnabled, inviterRewardNex: rewardEnabled ? 12 : 0,
    invitedCount: 2, pendingCount: 1, settledCount: 1, lifetimeInviterNex: 7, walletNexAvailable: 7,
    recentRewards: [], limit: 5, source: "ledger", sourceEnvironment: "PRODUCTION", runId: null,
    factSources: ["nx_referral_reward_settlement", "nx_wallet_ledger", "nx_earnings_release_entry", "nx_user_wallet"],
    refreshedAt: "2026-10-01T00:00:00Z" };
}

async function invitation(copy = en) {
  const rewards = Vue.reactive({ snapshot: snapshot() as ReferralRewardSnapshot | null,
    error: "", loading: false, refresh: vi.fn(async () => true) });
  const copyText = vi.fn(async () => true);
  const root = await mount(inviteSource, {
    "@/i18n/use-t": { useT: () => Vue.ref(copy) }, "@/i18n/format": { fmt },
    "@/store/app": { useApp: () => ({ user: { referralCode: "STALE_LOCAL_CODE" } }) },
    "@/store/referral-reward": { useReferralReward: () => rewards },
    "@/api/runtime": { remoteApiEnabled: true },
    "@/store/ui": { toast: { info: vi.fn(), success: vi.fn() } },
    "@/lib/share": { copyText, notifyUnavailableShareLink: vi.fn(),
      buildShareLink: (code: string) => code ? `https://invite.example/?ref=${code}` : "" },
  });
  return { root, rewards, copyText };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { unmounts.splice(0).forEach(unmount => unmount()); vi.useRealTimers(); });

test.each([en, zh, vietnamese])("disabled invitation rewards keep sharing without reward or cooldown promises", async copy => {
  const card = await invitation(copy);
  expect(card.rewards.refresh).toHaveBeenCalledOnce();
  const status = text(find(card.root, "invite-card__reward"));
  expect(status).toContain(copy.team.referralRewardsDisabled);
  expect(status).toContain(copy.team.sharingStillAvailable);
  expect(status).toContain("+7 NEX"); // Historical settled earnings remain facts.
  expect(status).not.toContain(copy.team.serverRewardPerSettlement);
  expect(status).not.toContain(copy.team.perFriendCooldown);
  expect(status).not.toContain("0 NEX");
  expect(text(card.root)).not.toContain(copy.team.rewardRules);
  expect(all(card.root).some(target => target.props.role === "link")).toBe(false);
  for (const name of ["nx-team-share-poster", "nx-team-copy-code", "nx-team-copy-link", "nx-team-share-now"]) {
    expect(find(card.root, name).props["aria-disabled"]).toBe(false);
  }
  await find(card.root, "nx-team-copy-code").props.onClick();
  await find(card.root, "nx-team-copy-link").props.onClick();
  expect(card.copyText.mock.calls).toEqual([["INVITE123"], ["https://invite.example/?ref=INVITE123"]]);
});

test("the same invitation card follows server enablement, unavailable reads and the retry action", async () => {
  const card = await invitation();
  card.rewards.snapshot = snapshot(true); await Vue.nextTick();
  let status = text(find(card.root, "invite-card__reward"));
  expect(status).toContain("12 NEX");
  expect(status).toContain(en.team.perFriendCooldown);
  expect(status).toContain(fmt(en.team.settlementStatus, { settled: 1, pending: 1 }));
  card.rewards.error = "read failed"; await Vue.nextTick();
  status = text(find(card.root, "invite-card__reward"));
  expect(status).toBe(en.team.settlementUnavailable);
  expect(status).not.toContain("12 NEX");
  const retry = find(card.root, "invite-card__retry");
  expect(retry.props.role).toBe("button");
  card.rewards.refresh.mockClear();
  let resolveRead!: () => void;
  const pendingRead = new Promise<void>(resolve => { resolveRead = resolve; });
  card.rewards.refresh.mockImplementationOnce(async () => {
    card.rewards.loading = true;
    await pendingRead;
    card.rewards.snapshot = snapshot(true);
    card.rewards.error = "";
    card.rewards.loading = false;
    return true;
  });
  const refresh = retry.props.onClick(); await Vue.nextTick();
  expect(card.rewards.refresh).toHaveBeenCalledOnce();
  expect(find(card.root, "invite-card__retry").props["aria-busy"]).toBe(true);
  expect(text(find(card.root, "invite-card__reward"))).toBe(en.team.rewardLoading);
  resolveRead(); await refresh; await Vue.nextTick();
  expect(find(card.root, "invite-card__retry")).toBeUndefined();
  expect(text(find(card.root, "invite-card__reward"))).toContain("12 NEX");
  expect(text(find(card.root, "invite-card__reward"))).toContain(en.team.perFriendCooldown);
  card.rewards.error = ""; card.rewards.snapshot = null; card.rewards.loading = true; await Vue.nextTick();
  expect(text(find(card.root, "invite-card__reward"))).toBe(en.team.rewardLoading);
  expect(find(card.root, "nx-team-share-now").props["aria-disabled"]).toBe(true);
});

test("wallet valuation names USDT for both values and preserves the remote unavailable state", async () => {
  const market = Vue.reactive({ isMockMode: false, remoteReady: true, nexPriceUSDT: 0.124,
    change24hAvailable: false, change24hPct: 0 });
  const navTo = vi.fn();
  const navReset = vi.fn();
  const app = Vue.reactive({ user: { usdtBalance: 11, nexBalance: 124,
    earningBuckets: { pendingReviewUsdt: 0, bonusLockedUsdt: 0 } }, activeSlotCount: 0, slotCap: 0 });
  const root = await mount(walletSource, {
    "@/i18n/use-t": { useT: () => Vue.ref(en) }, "@/i18n/format": { fmt, openSlotsTemplate },
    "@/store/app": { useApp: () => app },
    "@/store/earning-release": { earningsReleaseSnapshot: Vue.ref(null) },
    "@/store/bills": { useBills: () => ({ summaryStatus: "ready", summary: { monthBillCount: 0 } }) },
    "@/store/market": { useMarket: () => market }, "@/api/runtime": { fundsServerEnabled: true },
    "@/store/free-trial": { trialReservesSlotNow: () => false },
    "@/store/slot-action-sheet": { useSlotActionSheet: () => ({}) },
    "@/lib/route": { navTo, navReset },
  });
  expect(text(find(root, "nx-wallet-valuation"))).toContain("≈ 15.38 USDT · 1 NEX = 0.124 USDT");
  market.remoteReady = false; await Vue.nextTick();
  expect(text(find(root, "nx-wallet-valuation"))).toContain("≈ — USDT · 1 NEX = — USDT");
  expect(text(find(root, "nx-wallet-valuation"))).not.toContain("0.124");
  find(root, "nx-wallet-heading").props.onClick();
  expect(navTo).toHaveBeenCalledExactlyOnceWith("/pages/me/wallet-bills");
  expect(find(root, "nx-wallet-slot-block")).toBeUndefined();
  app.slotCap = 1; await Vue.nextTick();
  const slot = find(root, "nx-wallet-slot-block");
  expect(slot).toBeDefined();
  expect(slot.props.style).not.toHaveProperty("gridTemplateColumns");
  find(root, "wallet-add-device").props.onClick();
  expect(navReset).toHaveBeenCalledOnce();
  expect(navReset.mock.calls[0][0].url).toBe("/pages/store/store");
  const icon = find(root, "nx-wallet-symbol");
  expect(icon.tag).toBe("view");
  expect(icon.children[0].props.stroke).toBe("currentColor");
  const { descriptor } = parse(walletSource);
  const css = compileStyle({ source: descriptor.styles[0].content, filename: "wallet-card.vue", id: "data-v-wallet", scoped: true });
  expect(css.errors).toEqual([]);
  expect(css.code).toMatch(/\.nx-wallet-symbol\[data-v-wallet\][^{]*\{[^}]*color: var\(--v5-nex\)/);
  expect(css.code).toMatch(/@media \(max-width: 350px\)\s*\{\s*\.nx-wallet-slot-block\[data-v-wallet\]\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
});
