import type { CanonicalQuest } from "@/api/quest-api";
import type { Product } from "@/mock/products";

/** Native phone setup and legacy multi-platform review pages are not Lite routes. */
export function isLiteNativeRoute(href: string): boolean {
  return /^\/(?:pages\/)?(?:onboarding\/(?:connect|estimator)|entry-surfaces\/(?:index|signed|h5|white))(?:[?#]|$)/.test(href);
}

// Use explicit phone identifiers/names; opaque server publications remain server-owned.
export function isPhoneProductName(value: string): boolean {
  return /(?:^|[\s_/-])(?:phone|mobile|smartphone|iphone)(?:[\s_/-]|$)|手机|手機|điện thoại/i.test(value);
}

export function isLiteProduct(product: Pick<Product, "id" | "name">): boolean {
  return !isPhoneProductName(product.id) && !isPhoneProductName(product.name);
}

export function isLiteQuest(quest: Pick<CanonicalQuest, "actionRoute" | "questCode" | "name">): boolean {
  if (isLiteNativeRoute(quest.actionRoute)) return false;
  const identity = `${quest.questCode} ${quest.name}`;
  if (/phone[\s_-]*number|手机号|手機號|số điện thoại/i.test(identity)) return true;
  return !(isPhoneProductName(identity)
    && /connect|calibrat|activat|bind|buy|purchas|连接|接入|校准|激活|开启|启用|绑定|购买|kết nối|hiệu chuẩn|hiệu chỉnh|kích hoạt|mua|liên kết/i.test(identity));
}
