import type { CanonicalQuest } from "@/api/quest-api";
import type { Product } from "@/mock/products";

/** Native phone setup and legacy multi-platform review pages are not Lite routes. */
export function isLiteNativeRoute(href: string): boolean {
  return /^\/(?:pages\/)?(?:onboarding\/(?:connect|estimator)|entry-surfaces\/(?:index|signed|h5|white))(?:[?#]|$)/.test(href);
}

// Catalog has DEVICE/SHARE but no phone-specific device kind. Prefer SKU identity;
// published names identify remaining phone products until that contract exists.
export function isPhoneProductName(value: string): boolean {
  return /(?:^|[\s_/-])(?:(?:phone|mobile|smartphone)(?:[\s_/-]|$)|iphone(?=\d|[\s_/-]|$))|手机|手機|điện thoại/i.test(value);
}

export function isLiteProduct(product: Pick<Product, "id" | "name" | "productType">): boolean {
  if (product.productType === "SHARE") return true;
  return !isPhoneProductName(product.id) && !isPhoneProductName(product.name);
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
  return !(isPhoneProductName(identity)
    && /connect|calibrat|activat|bind|buy|purchas|连接|接入|校准|激活|开启|启用|绑定|购买|kết nối|hiệu chuẩn|hiệu chỉnh|kích hoạt|mua|liên kết/i.test(identity));
}
