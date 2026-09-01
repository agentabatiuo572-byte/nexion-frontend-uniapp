export type DayOneTaskCategory = "wallet" | "explore" | "recommend" | "identity" | "social";

const CATEGORY_BY_QUEST_CODE: Readonly<Record<string, DayOneTaskCategory>> = {
  bind_bank_card: "wallet",
  visit_earn: "explore",
  visit_store: "explore",
  view_product_roi: "recommend",
  setup_profile: "identity",
  invite_friend: "social",
};

const ROUTE_BY_QUEST_CODE: Readonly<Record<string, string>> = {
  bind_bank_card: "/pages/me/wallet-cards-new",
  visit_earn: "/pages/earn/earn",
  visit_store: "/pages/store/store",
  view_product_roi: "/pages/store/detail?id=stellarbox-s1",
  setup_profile: "/pages/me/profile",
  invite_friend: "/pages/team/team",
};

export function dayOneTaskCategory(questCode: string): DayOneTaskCategory {
  return CATEGORY_BY_QUEST_CODE[questCode.trim()] ?? "explore";
}

export function dayOneTaskRoute(questCode: string): string {
  return ROUTE_BY_QUEST_CODE[questCode.trim()] ?? "/pages/missions/missions";
}
