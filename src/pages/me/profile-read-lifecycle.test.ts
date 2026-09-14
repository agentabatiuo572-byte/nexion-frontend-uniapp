import ts from "typescript";
import * as vue from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import source from "./profile.vue?raw";
import { zh } from "@/i18n/messages/zh";
import * as runtimeRevision from "@/api/order-api";
import { profileVRankProjection } from "@/lib/profile-vrank-display";
import { createP318AccountPageFence } from "./p3-18-account-page-fence";
import { reconcileProfileEdit } from "@/lib/profile-save-flow";

const remote = vi.hoisted(() => ({ remoteApiEnabled: true, vRankApi: { ladder: vi.fn(), current: vi.fn() } }));
vi.mock("@/api/runtime", () => remote);
const { useVRank } = await import("@/store/v-rank");
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });
const flush = async () => { await vue.nextTick(); for (let n = 0; n < 8; n++) await Promise.resolve(); };

// Runs the actual page worker and Pinia V-rank store. All network edges are synthetic.
function mount() {
  setActivePinia(createPinia()); runtimeRevision.advanceRuntimeRevision(null);
  const reads: Array<{ ladder: ReturnType<typeof deferred>; current: ReturnType<typeof deferred> }> = [];
  remote.vRankApi.ladder.mockReset().mockImplementation(() => {
    const row = { ladder: deferred(), current: deferred() }; reads.push(row); return row.ladder.promise;
  });
  remote.vRankApi.current.mockReset().mockImplementation(() => reads[reads.length - 1].current.promise);
  const rank = useVRank();
  const app = vue.reactive({ accountKey: "A", accountBindingEpoch: 1, user: { tier: "L5", joinedAt: 1 } });
  const auth = vue.reactive({ accountId: "A", email: "" });
  const profile = vue.reactive({ displayName: "Confirmed", phoneE164: "", nicknameCandidates: [],
    refreshNicknameCandidates: vi.fn(async () => true),
    projectServerNickname: vi.fn((nickname: string) => { profile.displayName = nickname; }),
  });
  const payout = vue.reactive({ hasAnyAddress: false, provenance: null as unknown, currentFor: () => undefined,
    refreshRemote: vi.fn(async () => false),
  });
  const profileReads: Array<ReturnType<typeof deferred>> = [];
  const profileRead = vi.fn(() => { const request = deferred(); profileReads.push(request); return request.promise; });
  const hooks: Record<string, Array<() => void>> = { mount: [], show: [], hide: [], unmount: [] };
  const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
  const modules: Record<string, unknown> = {
    vue: { ...vue, onMounted: (fn: () => void) => hooks.mount.push(fn), onUnmounted: (fn: () => void) => hooks.unmount.push(fn) },
    "@dcloudio/uni-app": { onShow: (fn: () => void) => hooks.show.push(fn), onHide: (fn: () => void) => hooks.hide.push(fn) },
    "@/api/runtime": { remoteApiEnabled: true, profileApi: { profile: profileRead } },
    "@/lib/route": { navTo: vi.fn() }, "@/i18n/use-t": { useT: () => vue.ref(zh) },
    "@/i18n/format": { dateLocale: () => "zh-CN" }, "@/store/app": { useApp: () => app },
    "@/store/auth": { useAuth: () => auth }, "@/store/profile": { useProfile: () => profile },
    "@/store/payout-address": { usePayoutAddress: () => payout }, "@/store/quest": { useQuest: () => ({}) },
    "@/store/v-rank": { useVRank: () => rank }, "@/store/locale": { useLocaleStore: () => ({ code: "zh" }) },
    "@/store/payout-address-core": { PAYOUT_NETWORKS: ["usdt-trc20"], maskAddressMid: (address: string) => address },
    "@/store/ui": { toast }, "@/lib/account-scope": {
      captureAccountScope: () => ({ account: app.accountKey, epoch: app.accountBindingEpoch }),
      isCurrentAccountScope: (scope: { account: string; epoch: number }) => scope.account === app.accountKey && scope.epoch === app.accountBindingEpoch,
    },
    "@/lib/remote-profile-quest": { claimSetupProfileQuest: () => { throw Error("No reward writes in read fixture"); } },
    "@/lib/profile-save-flow": { reconcileProfileEdit }, "@/lib/secure-command-id": { requireCryptoUuid: vi.fn() },
    "@/lib/profile-date": { formatJoinedDate: () => "" }, "@/lib/profile-vrank-display": { profileVRankProjection },
    "@/api/order-api": runtimeRevision, "./p3-18-account-page-fence": { createP318AccountPageFence },
  };
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const output = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const scope = vue.effectScope();
  const page = scope.run(() => new Function("require", "exports", output + ";return {refreshVRankForCurrentAccount,loadRemoteProfile,tierLabel,tierProgressLine,walletSub,walletAction,name,avatarUrl};")((id: string) => {
    if (id.endsWith(".vue")) return {};
    if (!(id in modules)) throw Error(`Unexpected dependency ${id}`);
    return modules[id];
  }, {}));
  const fire = (event: string) => hooks[event].forEach(fn => fn());
  cleanups.push(() => { fire("unmount"); scope.stop(); });
  const accept = (index: number, value: number) => {
    reads[index].ladder.resolve({ ranks: Array.from({ length: 13 }, (_, v) => ({ v, title: `Rank ${v}`, cnTitle: `级别${v}`, rewards: [] })) });
    reads[index].current.resolve({ rankCode: `V${value}`, progress: { selfBuyUSD: 0, directRefs: 0, teamVolumeUSD: 0, vDownlineCounts: {} } });
  };
  return { page, rank, reads, accept, app, auth, payout, profile, profileReads, toast, fire };
}

describe("profile authoritative read lifecycle", () => {
  it("does not render a locally seeded tier or unset wallet while reads are unconfirmed", () => {
    const h = mount();
    expect(h.page.tierLabel.value).toBe("—"); expect(h.page.tierProgressLine.value).toBe("—");
    expect(h.page.walletSub.value).toBe(zh.profile.walletUnknown);
    expect(h.page.walletAction.value).toBe(zh.profile.walletPaired);
  });
  it("keeps failed rank unknown and recovers to configured current and next names", async () => {
    const h = mount(); const first = h.page.refreshVRankForCurrentAccount();
    h.reads[0].current.reject(Error("offline")); await first;
    expect(h.rank.remoteError).toBeTruthy(); expect(h.page.tierLabel.value).toBe("—");
    const retry = h.page.refreshVRankForCurrentAccount(); h.accept(1, 4); await retry;
    expect(h.rank.remoteError).toBeNull(); expect(h.page.tierLabel.value).toBe("V4 · 级别4");
    expect(h.page.tierProgressLine.value).toContain("V5 · 级别5");
  });
  for (const event of ["runtime", "account", "rebind", "hide-show"]) {
    for (const failed of [false, true]) {
      it(`ignores old rank ${failed ? "error" : "success"} after ${event}`, async () => {
        const h = mount(); const old = h.page.refreshVRankForCurrentAccount();
        if (event === "runtime") runtimeRevision.advanceRuntimeRevision("profile-fixture");
        else if (event === "hide-show") { h.fire("hide"); h.fire("show"); }
        else { if (event === "account") { h.app.accountKey = "B"; h.auth.accountId = "B"; } h.app.accountBindingEpoch++; h.rank.bindAccount(h.app.accountKey); }
        await flush(); const latest = h.reads.length - 1; expect(latest).toBeGreaterThan(0);
        h.accept(latest, 8); await flush();
        if (failed) h.reads[0].current.reject(Error("late")); else h.accept(0, 2);
        await old;
        expect(h.page.tierLabel.value).toBe("V8 · 级别8"); expect(h.rank.remoteError).toBeNull();
      });
    }
  }
  it("does not launch runtime reads while hidden and unsubscribes on unmount", async () => {
    const h = mount(); h.fire("hide"); runtimeRevision.advanceRuntimeRevision("hidden");
    await h.page.refreshVRankForCurrentAccount(); expect(h.reads).toHaveLength(0);
    h.fire("show"); expect(h.reads).toHaveLength(1); h.accept(0, 3); await flush();
    h.fire("unmount"); runtimeRevision.advanceRuntimeRevision("gone");
    await h.page.refreshVRankForCurrentAccount(); expect(h.reads).toHaveLength(1);
  });
  for (const event of ["hide", "account", "rebind"]) {
    it(`discards old profile identity after ${event}`, async () => {
      const h = mount(); const request = h.page.loadRemoteProfile();
      if (event === "hide") h.fire("hide");
      else { if (event === "account") { h.app.accountKey = "B"; h.auth.accountId = "B"; } h.app.accountBindingEpoch++; }
      await flush(); h.page.name.value = "Current edit";
      h.profileReads[0].resolve({ nickname: "Old result", avatarUrl: "old.png", avatarRevision: "old" }); await request;
      expect(h.page.name.value).toBe("Current edit"); expect(h.page.avatarUrl.value).toBe("");
      expect(h.profile.projectServerNickname).not.toHaveBeenCalled(); expect(h.toast.error).not.toHaveBeenCalled();
    });
  }
});
