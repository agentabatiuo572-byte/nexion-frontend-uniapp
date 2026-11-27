import { watch } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
import { isLiteProduct } from "@/lib/lite-scope";
import { isSingleSkuVoucher, type VoucherDef } from "@/mock/vouchers";
import {
  productCatalogLanguageReadFailed,
  productCatalogPresentation,
  productCatalogState,
  refreshProductCatalog,
  revalidateProductCatalog,
} from "@/store/product-catalog";
import { useAutoRecovery } from "./use-auto-recovery";
import { onShow } from "./use-tab-page-lifecycle";

type VoucherTargetRestriction = "unavailable" | "appOnly" | null;

const catalogReadFailed = () => productCatalogState.status === "error" || productCatalogLanguageReadFailed.value;

export function voucherTargetRestriction(voucher: VoucherDef): VoucherTargetRestriction {
  if (!isSingleSkuVoucher(voucher)) return null;
  const [id] = voucher.applicableSkus;
  const catalog = productCatalogPresentation.value;
  if (catalog?.publishedProductIds.includes(id)) {
    return catalog.products.some(product => product.id === id) ? null : "appOnly";
  }
  if (remoteApiEnabled && catalog && productCatalogState.status === "ready" && !catalogReadFailed()) return "unavailable";
  return isLiteProduct({ id, productType: undefined }) ? null : "appOnly";
}

export function useVoucherTargetAvailability(needed: () => boolean) {
  const active = () => remoteApiEnabled && needed();
  const read = () => {
    if (active()) void revalidateProductCatalog();
  };
  watch(active, read, { immediate: true });
  onShow(read);
  useAutoRecovery({
    active,
    failed: catalogReadFailed,
    retry: () => refreshProductCatalog(),
    repeatMs: 30_000,
    repeatWhile: () => !hasVisiblePullRefresh(),
  });

  return voucherTargetRestriction;
}
