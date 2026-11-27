import { watch } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
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

type VoucherTargetStatus = "available" | "unavailable" | "unknown";

export function useVoucherTargetAvailability(needed: () => boolean) {
  const active = () => remoteApiEnabled && needed();
  const read = () => {
    if (active()) void revalidateProductCatalog();
  };
  const failed = () => productCatalogState.status === "error" || productCatalogLanguageReadFailed.value;
  watch(active, read, { immediate: true });
  onShow(read);
  useAutoRecovery({
    active,
    failed,
    retry: () => refreshProductCatalog(),
    repeatMs: 30_000,
    repeatWhile: () => !hasVisiblePullRefresh(),
  });

  return (voucher: VoucherDef): VoucherTargetStatus => {
    if (!isSingleSkuVoucher(voucher)) return "available";
    const catalog = productCatalogPresentation.value;
    if (!remoteApiEnabled || !catalog || productCatalogState.status !== "ready" || failed()) return "unknown";
    return catalog.products.some(product => product.id === voucher.applicableSkus[0]) ? "available" : "unavailable";
  };
}
