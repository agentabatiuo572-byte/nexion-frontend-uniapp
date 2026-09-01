export type DayOneTaskCategory = "wallet" | "explore" | "recommend" | "identity" | "social";

const CATEGORY_BY_QUEST_CODE: Readonly<Record<string, DayOneTaskCategory>> = {
  bind_bank_card: "wallet",
  visit_earn: "explore",
  visit_store: "explore",
  view_product_roi: "recommend",
  setup_profile: "identity",
  invite_friend: "social",
};

export function dayOneTaskCategory(questCode: string): DayOneTaskCategory {
  return CATEGORY_BY_QUEST_CODE[questCode.trim()] ?? "explore";
}
