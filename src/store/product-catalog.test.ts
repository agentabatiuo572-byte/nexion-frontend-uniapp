import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  clear: vi.fn(),
  replace: vi.fn(),
  advanceRuntimeRevision: vi.fn(),
}));

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  productCatalogApi: { catalog: mocks.catalog },
}));
vi.mock("@/api/order-api", () => ({ advanceRuntimeRevision: mocks.advanceRuntimeRevision }));
vi.mock("@/mock/products", () => ({
  clearProductCatalog: mocks.clear,
  replaceProductCatalog: mocks.replace,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("product catalog refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lets a forced refresh supersede an older request and ignores its late response", async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    mocks.catalog.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const catalog = await import("./product-catalog");

    const firstRequest = catalog.refreshProductCatalog(true);
    const secondRequest = catalog.refreshProductCatalog(true);

    expect(secondRequest).not.toBe(firstRequest);
    expect(mocks.catalog).toHaveBeenCalledTimes(2);

    second.resolve({ products: [{ id: "new" }], source: "new", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true, revision: "new" });
    await secondRequest;
    first.resolve({ products: [{ id: "old" }], source: "old", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true, revision: "old" });
    await firstRequest;

    expect(catalog.productCatalogState.revision).toBe("new");
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });
});
