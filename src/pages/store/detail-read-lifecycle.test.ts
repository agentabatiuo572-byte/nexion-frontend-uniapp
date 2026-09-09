import { describe, expect, it, vi } from "vitest";
import { ref, computed } from "vue";
import ts from "typescript";
import page from "./detail.vue?raw";

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(reason: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const start = page.indexOf('const id = ref("");');
const catalogStatusStart = page.indexOf("const catalogStatus = computed", start);
const catalogStatusEnd = page.indexOf("\n", catalogStatusStart);
if (start < 0 || catalogStatusStart < start || catalogStatusEnd < catalogStatusStart) throw new Error("store detail read lifecycle source is required");
const lifecycleCode = ts.transpileModule(
  `${page.slice(start, catalogStatusEnd)}; return { id, catalogRetrying, refreshDetailFacts, invalidateDetailFacts, retryCatalog, catalogStatus };`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;

function setup() {
  const shown: Array<() => void> = [];
  const loaded: Array<(options?: Record<string, string>) => Promise<void>> = [];
  const catalog = vi.fn<() => Promise<boolean>>();
  const phase = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const trust = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const productCatalogState = { status: "loading" };
  let currentAccountScope = { accountKey: "user:1", epoch: 1 };
  const value = new Function(
    "ref", "computed", "Promise", "refreshProductCatalog", "refreshServerProductPhase", "remoteApiEnabled", "refreshTrust", "onLoad", "onShow", "captureAccountScope", "isCurrentAccountScope", "productCatalogState",
    lifecycleCode,
  )(ref, computed, Promise, catalog, phase, true, trust,
    (callback: (options?: Record<string, string>) => Promise<void>) => loaded.push(callback),
    (callback: () => void) => shown.push(callback),
    () => currentAccountScope,
    (scope: typeof currentAccountScope) => scope === currentAccountScope,
    productCatalogState,
  ) as {
    id: { value: string };
    catalogRetrying: { value: boolean };
    refreshDetailFacts: () => Promise<void>;
    invalidateDetailFacts: () => void;
    retryCatalog: () => Promise<void>;
    catalogStatus: { value: string };
  };
  return {
    shown, loaded, catalog, phase, trust, value,
    rebindAccount: () => { currentAccountScope = { accountKey: "user:2", epoch: 2 }; },
  };
}

describe("store detail canonical read lifecycle", () => {
  it("starts the public Trust read only after the forced catalog revision settles, including a catalog failure", async () => {
    const catalogRead = deferred<boolean>();
    const s = setup();
    s.catalog.mockReturnValueOnce(catalogRead.promise);

    const reading = s.value.refreshDetailFacts();
    expect(s.catalog).toHaveBeenCalledTimes(1);
    // A forced catalog read advances the runtime revision on either settlement.
    // Starting Trust before that boundary makes its valid response stale.
    expect(s.trust).not.toHaveBeenCalled();

    catalogRead.resolve(false);
    await reading;
    expect(s.phase).toHaveBeenCalledTimes(1);
    expect(s.trust).toHaveBeenCalledTimes(1);
  });

  it("does not restart public Trust after the detail read was invalidated by hide or account rebind", async () => {
    const hiddenCatalog = deferred<boolean>();
    const hidden = setup();
    hidden.catalog.mockReturnValueOnce(hiddenCatalog.promise);
    const hiddenRead = hidden.value.refreshDetailFacts();
    hidden.value.invalidateDetailFacts();
    hiddenCatalog.resolve(true);
    await hiddenRead;
    expect(hidden.phase).not.toHaveBeenCalled();
    expect(hidden.trust).not.toHaveBeenCalled();

    const staleAccountCatalog = deferred<boolean>();
    const account = setup();
    account.catalog.mockReturnValueOnce(staleAccountCatalog.promise);
    const accountRead = account.value.refreshDetailFacts();
    account.rebindAccount();
    staleAccountCatalog.resolve(true);
    await accountRead;
    expect(account.phase).not.toHaveBeenCalled();
    expect(account.trust).not.toHaveBeenCalled();
    expect(page).toMatch(/onHide\(\(\) => \{[\s\S]*?invalidateDetailFacts\(\)/);
    expect(page).toMatch(/onUnmounted\(\(\) => \{[\s\S]*?invalidateDetailFacts\(\)/);
  });

  it("starts a new lifecycle read from onShow without letting the earlier read trigger Trust", async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    const s = setup();
    s.catalog.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const loading = s.loaded[0]({ id: "no-such-product" });
    expect(s.value.id.value).toBe("no-such-product");
    expect(s.catalog).toHaveBeenCalledTimes(1);
    s.shown[0]();
    expect(s.catalog).toHaveBeenCalledTimes(2);

    first.resolve(false);
    await loading;
    second.resolve(true);
    await Promise.resolve();
    expect(s.trust).toHaveBeenCalledTimes(1);
  });

  it("serializes an error retry and does not leave its busy flag set after recovery", async () => {
    const failed = deferred<boolean>();
    const recovered = deferred<boolean>();
    const s = setup();
    s.catalog.mockReturnValueOnce(failed.promise).mockReturnValueOnce(recovered.promise);

    const firstRetry = s.value.retryCatalog();
    const duplicateRetry = s.value.retryCatalog();
    expect(s.catalog).toHaveBeenCalledTimes(1);
    expect(s.value.catalogRetrying.value).toBe(true);
    failed.resolve(false);
    await Promise.all([firstRetry, duplicateRetry]);
    expect(s.value.catalogRetrying.value).toBe(false);

    const recoveryRetry = s.value.retryCatalog();
    expect(s.catalog).toHaveBeenCalledTimes(2);
    recovered.resolve(true);
    await recoveryRetry;
    expect(s.value.catalogRetrying.value).toBe(false);
    expect(s.phase).toHaveBeenCalledTimes(2);
  });

  it("restores Trust after a successful catalog retry invalidates its prior public snapshot", async () => {
    const s = setup();
    let trustStatus: "ready" | "idle" = "ready";
    s.catalog.mockImplementationOnce(async () => {
      // Mirrors refreshProductCatalog(true): current settlement advances the
      // runtime revision and the Trust listener clears its snapshot to idle.
      trustStatus = "idle";
      return true;
    });
    s.trust.mockImplementationOnce(async () => {
      expect(trustStatus).toBe("idle");
      trustStatus = "ready";
      return true;
    });

    await s.value.retryCatalog();
    expect(s.catalog).toHaveBeenCalledTimes(1);
    expect(s.trust).toHaveBeenCalledTimes(1);
    expect(trustStatus).toBe("ready");
    expect(s.value.catalogRetrying.value).toBe(false);
  });
});
