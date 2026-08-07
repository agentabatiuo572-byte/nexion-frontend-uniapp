import { reactive } from "vue";
import { productCatalogApi, remoteApiEnabled } from "@/api/runtime";
import { clearProductCatalog, replaceProductCatalog } from "@/mock/products";

export type ProductCatalogStatus = "mock" | "loading" | "ready" | "error";

export const productCatalogState = reactive<{
  status: ProductCatalogStatus;
  error: string;
  source: string;
  revision: string | null;
}>({
  status: remoteApiEnabled ? "loading" : "mock",
  error: "",
  source: remoteApiEnabled ? "" : "mock/products",
  revision: null,
});

let refreshInFlight: Promise<boolean> | null = null;

export function prepareProductCatalog(): void {
  if (!remoteApiEnabled) return;
  clearProductCatalog();
  productCatalogState.status = "loading";
  productCatalogState.error = "";
  productCatalogState.source = "";
  productCatalogState.revision = null;
}

export function refreshProductCatalog(force = false): Promise<boolean> {
  if (!remoteApiEnabled) return Promise.resolve(true);
  if (!force && productCatalogState.status === "ready") return Promise.resolve(true);
  if (refreshInFlight) return refreshInFlight;

  productCatalogState.status = "loading";
  productCatalogState.error = "";
  refreshInFlight = productCatalogApi.catalog()
    .then((snapshot) => {
      replaceProductCatalog(snapshot.products);
      productCatalogState.status = "ready";
      productCatalogState.source = snapshot.source;
      productCatalogState.revision = snapshot.revision;
      return true;
    })
    .catch((error: unknown) => {
      clearProductCatalog();
      productCatalogState.status = "error";
      productCatalogState.error = error instanceof Error ? error.message : "PRODUCT_CATALOG_UNAVAILABLE";
      productCatalogState.source = "";
      productCatalogState.revision = null;
      return false;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}
