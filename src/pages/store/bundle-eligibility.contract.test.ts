import { describe, expect, it } from "vitest";

/**
 * zentao #244:无购买资格的商品仍可加入套餐,并启用结算按钮。
 *
 * 成因:套餐页在 remote 模式下只跑**本地** `evaluatePurchaseGate`(V-Rank / 团队业绩取自
 * 本地快照),而线上权威门是**服务端**的账号维度资格判定。商品详情页早已按「本地门仅 mock、
 * remote 走服务端资格」分流,套餐页漏了这一步 —— 于是服务端判不合格的 SKU 照样能进套餐结算。
 */
const source = (import.meta.glob("./bundle.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["./bundle.vue"] ?? "") as string;

describe("bundle purchase gate consults the server in remote mode", () => {
  it("asks the server for every SKU and refuses the whole bundle if any is ineligible", () => {
    expect(source).toContain("purchaseEligibilityStore");
    // 逐 SKU 询问,且**任一**不达标即整单拒(不是只看第一件)。
    expect(source).toMatch(/Promise\.all\(list\.map\(\(p\) => purchaseEligibilityStore\.ensure\(p\.id\)\)\)/);
    expect(source).toMatch(/const firstBlocked = decisions\.findIndex\(\(eligible\) => !eligible\)/);
    expect(source).toMatch(/if \(firstBlocked >= 0\) \{/);
  });

  it("keeps the local gate for mock mode only", () => {
    // 以本单的注释标记为界切出这段门控,再断言本地门落在 remote 分支**之后**的 else 里。
    // 用**最后**一处标记:同一个单号在导入处也出现,indexOf 会抓到导入区(首版实测)。
    const marker = source.lastIndexOf("zentao #244");
    expect(marker, "缺少 #244 的分流注释").toBeGreaterThan(-1);
    const region = source.slice(marker, marker + 1200);

    const remoteBranch = region.indexOf("if (remoteApiEnabled) {");
    const elseBranch = region.indexOf("} else {");
    const localGate = region.indexOf("evaluatePurchaseGate(p, gateCtx).blocked");
    expect(remoteBranch, "remote 分支").toBeGreaterThan(-1);
    expect(elseBranch, "else 分支").toBeGreaterThan(remoteBranch);
    expect(localGate, "本地门").toBeGreaterThan(elseBranch);
  });

  it("routes the blocked bundle to that product's own conditions", () => {
    // 与 #246 一致:带上具体商品 id,不落在无关商品的配额页。
    expect(source).toMatch(/team\/quota\?product=\$\{encodeURIComponent\(list\[firstBlocked\]\.id\)\}/);
  });
});
