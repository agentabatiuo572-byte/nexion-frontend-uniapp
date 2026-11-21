import type { CanonicalQuest } from "@/api/quest-api";
import type { Product } from "@/mock/products";
import type { DeviceKind } from "@/store/types";

/** Native phone setup and legacy multi-platform review pages are not Lite routes. */
export function isLiteNativeRoute(href: string): boolean {
  return /^\/(?:pages\/)?(?:onboarding\/(?:connect|estimator)|entry-surfaces\/(?:index|signed|h5|white))(?:[?#]|$)/.test(href);
}

function hasPhoneQuestText(value: string): boolean {
  return /(?:^|[\s_/-])(?:(?:phone|mobile|smartphone)(?:[\s_/-]|$)|iphone(?=\d|[\s_/-]|$))|手机|手機|điện thoại/i.test(value);
}

const HARDWARE_SKUS = new Set([
  "pc-gpu", "stellarbox-s1", "stellarbox-pro", "stellarbox-pro-v2", "stellarrack-p1", "stellarrack-p2",
]);
const PHONE_SKUS = new Set(["phone", "phone-basic", "iphone15"]);

// Catalog currently supplies only id and DEVICE/SHARE. Never infer identity from
// display names; unclassified SKUs need an explicit identity from the server.
export function isLiteProduct(product: Pick<Product, "id" | "productType"> & {
  kind?: DeviceKind;
  productCode?: string;
}): boolean {
  const identities = [product.id, product.productCode ?? ""].map((value) => value.trim().toLowerCase());
  if (product.productType === "SHARE" || identities.some((id) => HARDWARE_SKUS.has(id))) return true;
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
