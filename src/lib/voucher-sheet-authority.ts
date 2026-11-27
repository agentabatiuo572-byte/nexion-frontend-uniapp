import { isSingleSkuVoucher, type VoucherDef, type VoucherSurface } from "@/mock/vouchers";
import { fmt } from "@/i18n/format";
import type { Messages } from "@/i18n/messages/en";
import { productDisplayName } from "./product-display-name";

export function voucherScopeText(voucher: VoucherDef, copy: Messages["voucher"]): string {
  if (!isSingleSkuVoucher(voucher)) return copy.scopeAll;
  // Without a name the scope stays a single product, said as one sentence (no product number, no stand-in noun).
  const name = productDisplayName(voucher.applicableSkus[0], "");
  return name ? fmt(copy.scopeSingle, { name }) : copy.scopeSingleUnnamed;
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
