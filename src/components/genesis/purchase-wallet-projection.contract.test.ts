// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sheetSource = readFileSync(new URL("./purchase-sheet.vue", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../../store/genesis.ts", import.meta.url), "utf8");
const appStoreSource = readFileSync(new URL("../../store/app.ts", import.meta.url), "utf8");
const liveE2eSource = readFileSync(new URL("../../../scripts/genesis-cta-live-e2e.mjs", import.meta.url), "utf8");

describe("Genesis purchase visible wallet projection", () => {
  it("carries the server-authoritative balance from the purchase receipt", () => {
    expect(storeSource).toContain("walletBalanceUsdt: state.walletBalanceUsdt");
  });

  it("does not downgrade a committed purchase when the follow-up readback is unavailable", () => {
    const purchaseStart = storeSource.indexOf("async function purchase(");
    const localFallback = storeSource.indexOf("// ↓↓ mock 模式", purchaseStart);
    const remotePurchase = storeSource.slice(purchaseStart, localFallback);
    expect(remotePurchase).toContain("await syncRemote(request, runScope)");
    expect(remotePurchase).not.toContain(
      'if (!await syncRemote(request, runScope)) return { ok: false, cost: 0, reason: "unavailable" }',
    );
  });

  it("projects a confirmed dev purchase into the wallet UI immediately", () => {
    expect(sheetSource).toContain("result.walletReceiptScope");
    expect(sheetSource).toContain("result.walletReceiptRunId");
    expect(sheetSource).toContain("app.adoptDevelopmentGenesisWallet(");
    const purchaseStart = sheetSource.indexOf("const result = await genesis.purchase(qty.value)");
    const successToast = sheetSource.indexOf("toast.success(", purchaseStart);
    const projection = sheetSource.indexOf("app.adoptDevelopmentGenesisWallet(", purchaseStart);
    expect(projection).toBeGreaterThan(purchaseStart);
    expect(projection).toBeLessThan(successToast);
  });

  it("rejects a receipt after account epoch or Sandbox RunID changes", () => {
    const projectionStart = appStoreSource.indexOf("function adoptDevelopmentGenesisWallet(");
    const projectionEnd = appStoreSource.indexOf("function refreshFundsSandboxForAccount", projectionStart);
    const projectionBody = appStoreSource.slice(projectionStart, projectionEnd);
    expect(projectionBody).toContain("receiptSandboxRunId !== expectedGenesisSandboxRunId");
    expect(projectionBody).toContain("adoptDevelopmentCommerceWallet(balanceAfterUsdt, receiptScope)");
  });

  it("fails closed before direct wallet fixtures unless the local database target is explicitly allowed", () => {
    expect(liveE2eSource).toContain("NX_GENESIS_ALLOW_DB_WRITE_TARGET");
    expect(liveE2eSource).toContain("GENESIS_FIXTURE_DB_WRITE_TARGET_NOT_ALLOWED");
    expect(liveE2eSource).toContain("GENESIS_FIXTURE_DB_HOST_NOT_LOOPBACK");
  });
});
