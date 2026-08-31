import { describe, expect, it, vi } from "vitest";
import { buildCommissionsHowContent, createCommissionsHowResource, COMMISSIONS_HOW_SLOTS, type CommissionsHowSnapshot } from "./commissions-how-content";

const snapshot = (): CommissionsHowSnapshot => ({
  document: { contentKey: "team-commissions-how", version: "p2", status: "PUBLISHED", source: "server", sourceEnvironment: "PRODUCTION", runId: "", locale: "zh", blocks: [
    { id: "network", kind: "text", title: "网络", body: "{networkRates} {networkNex} {networkGate} {exitCap}" },
    { id: "binary", kind: "text", title: "双轨", body: "{binaryRules}" },
    { id: "cooling", kind: "text", title: "冷却", body: "{coolingDays}" },
    { id: "peer", kind: "text", title: "平级", body: "{peerRules} {peerStatus}" },
    { id: "cultivation", kind: "text", title: "培育", body: "{cultivationRules}" },
    { id: "leadership", kind: "text", title: "领导池", body: "{leadershipRules} {leadershipVotes}" },
    { id: "genesis", kind: "text", title: "创世", body: "{genesisStatus}" },
    ...COMMISSIONS_HOW_SLOTS.filter(id => !["network", "binary", "cooling", "peer", "cultivation", "leadership", "genesis"].includes(id))
      .map(id => ({ id, kind: "text" as const, title: id, body: id })),
  ] },
  rates: { unilevelUsdt: { 1: .123456, 2: .025 }, unilevelNex: { 1: 2.5, 2: 1 } },
  guide: { source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: null, coolingDays: 17, network: { depthGateLayer: 5, depthGateRank: 4, exitCapRate: .21 }, binary: { threshold: 876.123456, matchRate: .1375, dailyCap: 6789, settlePeriod: "weekly", residualPolicy: "carryForward", paused: false }, leadership: null, capabilities: { peer: false, genesis: false } },
  ranks: [{ v: 4, title: "Live", cnTitle: "Live", directBonus: .123456, unilevelDepth: 7, peerBonus: .0375, leadershipVotes: 9, cultivationBonus: 321.123456, visible: true }],
});
describe("commissions-how presentation", () => {
  it("uses changed canonical rates, cooldown and eligibility rather than prototype constants", () => {
    const view = buildCommissionsHowContent(snapshot(), "zh");
    expect(view.section("network").body).toContain("12.3456%");
    expect(view.section("network").body).toContain("L5");
    expect(view.section("network").body).toContain("V4");
    expect(view.section("binary").body).toContain("876.123456");
    expect(view.section("binary").body).toContain("13.75%");
    expect(view.section("binary").body).toContain("每周");
    expect(view.section("cooling").body).toContain("17");
    expect(view.section("cooling").body).not.toContain("30");
    expect(view.section("peer").body).toContain("3.75%");
    expect(view.section("cultivation").body).toContain("321.123456 NEX");
  });
  it("marks missing rules and unsupported payout paths explicitly", () => {
    const facts = snapshot(); facts.guide.coolingDays = null; facts.guide.binary = null;
    const view = buildCommissionsHowContent(facts, "zh");
    expect(view.section("cooling").body).toContain("未配置");
    expect(view.section("binary").body).not.toMatch(/10%|1,000/);
    expect(view.section("leadership").body).toContain("暂不可结算");
    expect(view.section("peer").body).toContain("未开放");
    expect(view.section("genesis").body).toContain("未开放");
    expect(view.exampleTotal).not.toMatch(/79|2,000/);
  });
  it("distinguishes zero-day cooling from absent configuration and ignores hidden ranks", () => {
    const facts = snapshot(); facts.guide.coolingDays = 0; facts.ranks[0].visible = false;
    const view = buildCommissionsHowContent(facts, "zh");
    expect(view.section("cooling").body).toContain("0");
    expect(view.section("cultivation").body).not.toContain("321.123456");
  });
  it("does not render missing or unknown published tokens, or treat HTML as markup", () => {
    const facts = snapshot(); facts.document.blocks[0].body = "<b>{unknown}</b>";
    expect(buildCommissionsHowContent(facts, "zh").section("network").available).toBe(false);
    expect(buildCommissionsHowContent(null, "zh").section("network").body).not.toContain("10%");
  });
  it("renders valid leadership, paused monthly binary and six-place example arithmetic", () => {
    const facts = snapshot();
    facts.guide.leadership = { rate: .0375, minRank: 4, monthlyCap: 4500.123456 };
    facts.guide.binary!.paused = true; facts.guide.binary!.settlePeriod = "monthly";
    const view = buildCommissionsHowContent(facts, "zh");
    expect(view.section("leadership").body).toContain("3.75%");
    expect(view.section("leadership").body).toContain("4,500.123456");
    expect(view.section("leadership").body).toContain("9 票");
    expect(view.section("binary").body).toContain("已暂停");
    expect(view.amounts.network).toBe("12.3456 USDT + 30.864 NEX");
    expect(view.amounts.cultivation).toContain("配置额");
    expect(view.exampleTotal).toBe("非实际收益合计");
  });
  it("handles nullable gate facts, missing benefit tiers, capabilities and unsupported locales", () => {
    const facts = snapshot();
    facts.guide.network = { depthGateLayer: null, depthGateRank: null, exitCapRate: null };
    facts.guide.capabilities = { peer: true, genesis: true };
    facts.guide.leadership = { rate: 0, minRank: 12, monthlyCap: 0 };
    facts.ranks = []; facts.rates.unilevelUsdt = {}; facts.rates.unilevelNex = {};
    const view = buildCommissionsHowContent(facts, "fr");
    expect(view.section("network").body).toContain("Missing or invalid");
    expect(view.section("leadership").body).toContain("No configured benefits");
    expect(view.amounts.network).toBe("—");
    expect(view.amounts.peer).toBe("Requires settlement");
    expect(view.section("peer").body).toContain("actual events");
  });
  it("rounds example amounts half-up at six places like network settlement", () => {
    const facts = snapshot(); facts.rates.unilevelUsdt[1] = .11111111; facts.rates.unilevelNex[1] = 1.5;
    expect(buildCommissionsHowContent(facts, "en").amounts.network).toBe("11.111111 USDT + 16.666667 NEX");
  });
  it("hides all example amounts when the publication is missing context", () => {
    const facts = snapshot(); facts.document.blocks = facts.document.blocks.filter(block => block.id !== "example-note");
    const view = buildCommissionsHowContent(facts, "zh");
    expect(view.incomplete).toBe(true);
    expect(Object.values(view.amounts)).toEqual(["—", "—", "—", "—"]);
  });
  it("does not push just-below-half examples across the rounding boundary", () => {
    const facts = snapshot(); facts.rates.unilevelUsdt[1] = .1000000049999999; facts.rates.unilevelNex[1] = 0;
    expect(buildCommissionsHowContent(facts, "en").amounts.network).toBe("10 USDT + 0 NEX");
  });
  it("handles scientific decimals and hides examples outside exact display precision", () => {
    const facts = snapshot(); facts.rates.unilevelUsdt[1] = 1e-9; facts.rates.unilevelNex[1] = 2;
    expect(buildCommissionsHowContent(facts, "en").amounts.network).toBe("0 USDT + 0 NEX");
    facts.rates.unilevelUsdt[1] = .1; facts.rates.unilevelNex[1] = Number.MAX_SAFE_INTEGER;
    expect(buildCommissionsHowContent(facts, "en").amounts.network).toBe("—");
  });
  it.each(["en", "vi"])("renders localized configuration status in %s", locale => {
    expect(buildCommissionsHowContent(snapshot(), locale).section("leadership").body).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
describe("commissions-how resource lifecycle", () => {
  const deferred = <T>() => { let resolve!: (x: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
  it("merges retries, clears facts on errors, retries and ignores stale locale completions", async () => {
    const gate = deferred<CommissionsHowSnapshot>(); const apply = vi.fn();
    const read = vi.fn().mockReturnValueOnce(gate.promise).mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce(snapshot());
    const resource = createCommissionsHowResource({ read, apply });
    const old = resource.load("zh"); expect(resource.load("zh")).toBe(old);
    await resource.load("en"); gate.resolve(snapshot()); await old;
    expect(apply.mock.lastCall?.[0]).toEqual({ loading: false, error: true, snapshot: null });
    await resource.load("en"); expect(apply.mock.lastCall?.[0].snapshot).toEqual(snapshot());
    resource.dispose(); await resource.load("zh"); expect(read).toHaveBeenCalledTimes(3);
  });
  it("does not apply an in-flight result after unmount", async () => {
    const gate = deferred<CommissionsHowSnapshot>(); const apply = vi.fn();
    const resource = createCommissionsHowResource({ read: () => gate.promise, apply });
    const pending = resource.load("zh"); resource.dispose(); gate.resolve(snapshot()); await pending;
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
