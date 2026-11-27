import type { CanonicalQuest } from "@/api/quest-api";
import type { Product, ProductSeriesCode } from "@/mock/products";
import type { Device, DeviceKind } from "@/store/types";

/** Lite's device views leave out phones, and a device missing from the list is out of view too. A replacement whose
 *  other end is out of view still shows on the visible end, without naming that other device (Lite PRD §5.0). */
export function isLiteShownDevice(id: number | string, devices: readonly Device[]): boolean {
  return devices.some(device => device.id === String(id) && device.kind !== "phone");
}

/** Native phone setup and legacy multi-platform review pages are not Lite routes. */
export function isLiteNativeRoute(href: string): boolean {
  return /^\/(?:pages\/)?(?:onboarding\/(?:connect|estimator)|entry-surfaces\/(?:index|signed|h5|white))(?:[?#]|$)/.test(href);
}

function hasPhoneQuestText(value: string): boolean {
  return /(?:^|[\s_/-])(?:(?:phone|mobile|smartphone)(?:[\s_/-]|$)|iphone(?=\d|[\s_/-]|$))|手机|手機|điện thoại/i.test(value);
}

const HARDWARE_SERIES = new Set<ProductSeriesCode>(["S1", "PRO", "PRO_V2", "RACK_P1", "RACK_P2"]);
const PHONE_SKUS = new Set(["phone", "phone-basic", "iphone15"]);

// The explicit series takes priority for hardware. Retain the phone exclusion for older reads
// that only include a product number, and keep unclassified hardware visible.
export function isLiteProduct(product: Pick<Product, "id" | "productType"> & Partial<Pick<Product, "seriesCode">> & {
  kind?: DeviceKind;
  productCode?: string;
}): boolean {
  const identities = [product.id, product.productCode ?? ""].map((value) => value.trim().toLowerCase());
  if (product.productType === "SHARE" || (product.seriesCode != null && HARDWARE_SERIES.has(product.seriesCode))) return true;
  return product.kind !== "phone" && !identities.some((id) => PHONE_SKUS.has(id));
}

const ACCOUNT_PHONE_QUEST_CODES = new Set([
  "bind_mobile", "bind_phone", "bind_phone_number", "verify_mobile", "verify_phone", "verify_phone_number",
]);
const ACCOUNT_PHONE_QUEST_ROUTES = new Set([
  "/pages/me/profile", "/pages/me/security", "/me/profile", "/me/security",
]);

export function isLiteQuest(quest: Pick<CanonicalQuest, "actionRoute" | "questCode" | "name">): boolean {
  if (isLiteNativeRoute(quest.actionRoute)) return false;
  if (ACCOUNT_PHONE_QUEST_CODES.has(quest.questCode.toLowerCase())
      || ACCOUNT_PHONE_QUEST_ROUTES.has(quest.actionRoute.split(/[?#]/)[0])) return true;
  const identity = `${quest.questCode} ${quest.name}`;
  return !(hasPhoneQuestText(identity)
    && /connect|calibrat|activat|bind|buy|purchas|连接|接入|校准|激活|开启|启用|绑定|购买|kết nối|hiệu chuẩn|hiệu chỉnh|kích hoạt|mua|liên kết/i.test(identity));
}
