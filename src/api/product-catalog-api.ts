import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ServerLanguage } from "@/i18n";
import {
  parseProductCatalogPayload,
  ProductCatalogContractError,
  type ProductCatalogSnapshot,
} from "./product-catalog-contract";

export type { ProductCatalogSnapshot } from "./product-catalog-contract";

export interface ProductCatalogApi {
  catalog(locale: ServerLanguage): Promise<ProductCatalogSnapshot>;
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "PRODUCT_CATALOG_RESPONSE_INVALID" });
}

export function createProductCatalogApi(client: ApiClient): ProductCatalogApi {
  return {
    async catalog(locale): Promise<ProductCatalogSnapshot> {
      const payload = await client.request<unknown>({
        method: "GET",
        path: `/api/store/catalog?locale=${encodeURIComponent(locale)}`,
      });
      try {
        const snapshot = parseProductCatalogPayload(payload);
        return { ...snapshot, products: snapshot.products.map(product => ({ ...product, catalogRequestLocale: locale })) };
      } catch (error) {
        if (error instanceof ProductCatalogContractError) return invalid();
        throw error;
      }
    },
  };
}
