import { isSingleSkuVoucher, type VoucherDef, type VoucherSurface } from "@/mock/vouchers";
import { fmt } from "@/i18n/format";
import type { Messages } from "@/i18n/messages/en";
import { landingCopy } from "@/i18n/promotion-landing";
import { productDisplayName } from "./product-display-name";

export function voucherScopeText(voucher: VoucherDef, copy: Messages["voucher"], language: string): string {
  if (!isSingleSkuVoucher(voucher)) return copy.scopeAll;
  const name = productDisplayName(voucher.applicableSkus[0], landingCopy(language).deviceFallback);
  return fmt(copy.scopeSingle, { name });
}

/** H7's empty surface list allows every supported claim entry. */
export function voucherSupportsSurface(voucher: Pick<VoucherDef, "claimSurfaces">, surface: VoucherSurface): boolean {
  return voucher.claimSurfaces.length === 0 || voucher.claimSurfaces.includes(surface);
}

/** Keep the visible claim list on the exact page surface that opened the sheet. */
export function visibleVoucherCatalog<T extends VoucherDef>(
  catalog: T[],
  claimable: VoucherDef[],
  claimedUnused: VoucherDef[],
  surface: VoucherSurface,
): T[] {
  const showable = new Set<string>([
    ...claimable.map((voucher) => voucher.id),
    ...claimedUnused.map((voucher) => voucher.id),
  ]);
  return catalog.filter((voucher) => showable.has(voucher.id) && voucherSupportsSurface(voucher, surface));
}
