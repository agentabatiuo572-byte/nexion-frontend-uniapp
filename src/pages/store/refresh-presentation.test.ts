import { computed, ref, reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import ordersPage from "./orders.vue?raw";
import card from "@/components/store/product-card.vue?raw";

function actual(script: string, names: string[], args: Record<string, unknown>) {
  const source = ts.createSourceFile("actual.ts", script.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1], ts.ScriptTarget.Latest, true);
  const statements = source.statements.filter(item => ts.isFunctionDeclaration(item)
    ? names.includes(item.name?.text ?? "")
    : ts.isVariableStatement(item) && item.declarationList.declarations.some(d => names.includes(d.name.getText(source))));
  const body = ts.transpileModule(statements.map(s => s.getText(source)).join("\n") + `\nreturn {${names.join(",")}}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(args), body)(...Object.values(args));
}

describe("actual page presentation remains separate from authority", () => {
  it("only maps the already classified Genesis series error, never commerce or unrelated errors", () => {
    const genesis = reactive({ remoteEligibilityError: "GENESIS_SERIES_UNAVAILABLE" });
    const commerceOrdersUnavailable = ref(true), genesisOrdersUnavailable = ref(true);
    const t = ref({ headerTitles: { storeOrders: "Orders" }, me: { genesisNode: "Genesis" }, authOtp: { errorServiceUnavailable: "Retry" }, genesis: { marketClosed: { seriesUnavailable: "Not open" } } });
    const { unavailableOrderSources } = actual(ordersPage, ["unavailableOrderSources"], { computed, t, genesis, commerceOrdersUnavailable, genesisOrdersUnavailable });
    expect(unavailableOrderSources.value).toEqual([{ label: "Orders", message: "Retry" }, { label: "Genesis", message: "Not open" }]);
    for (const error of ["offline", "GENESIS_STATE_UNAVAILABLE", "genesis_series_unavailable", ""]) {
      genesis.remoteEligibilityError = error;
      expect(unavailableOrderSources.value[1].message).toBe("Retry");
    }
    genesisOrdersUnavailable.value = false;
    expect(unavailableOrderSources.value).toEqual([{ label: "Orders", message: "Retry" }]);
  });

  it("cannot buy from retained cards while catalog loads or fails, nor with unavailable eligibility", () => {
    const state = reactive({ status: "ready" });
    const eligibility = ref({ status: "ready", eligible: true });
    const stockUnavailable = ref(false), gate = ref({ soldOut: false });
    const goCheckout = vi.fn(), goDetail = vi.fn(), retryEligibility = vi.fn();
    const { buyUnavailable, onBuy } = actual(card, ["catalogUnavailable", "buyUnavailable", "onBuy"], {
      computed, remoteApiEnabled: true, productCatalogState: state, eligibility, stockUnavailable, gate, goCheckout, goDetail, retryEligibility,
    });
    for (const status of ["loading", "error"]) { state.status = status; expect(buyUnavailable.value).toBe(true); onBuy(); }
    expect(goCheckout).not.toHaveBeenCalled();
    state.status = "ready";
    for (const status of ["idle", "loading"]) { eligibility.value.status = status; expect(buyUnavailable.value).toBe(true); onBuy(); }
    eligibility.value.status = "error"; expect(buyUnavailable.value).toBe(false); onBuy();
    expect(goCheckout).not.toHaveBeenCalled();
    expect(retryEligibility).toHaveBeenCalledOnce();
    eligibility.value = { status: "ready", eligible: false }; onBuy();
    expect(goCheckout).not.toHaveBeenCalled();
    expect(goDetail).toHaveBeenCalledOnce();
    gate.value.soldOut = true; expect(buyUnavailable.value).toBe(true); onBuy();
    expect(goDetail).toHaveBeenCalledOnce();
    gate.value.soldOut = false;
    eligibility.value.eligible = true; onBuy();
    expect(goCheckout).toHaveBeenCalledOnce();
    stockUnavailable.value = true; expect(buyUnavailable.value).toBe(true); onBuy();
    expect(goCheckout).toHaveBeenCalledOnce();
  });
});
