import type { CanonicalPromoBanner, CanonicalQuest } from "@/api/quest-api";

export type HomeTaskCardId = "newcomer" | "weekly";

export interface HomeTaskFeatureFlags {
  homeNewcomerTasksEnabled: boolean;
  homeWeeklyPromoEnabled: boolean;
}

export type HomeWeeklySource =
  | { kind: "quest"; quest: CanonicalQuest }
  | { kind: "promo"; promo: CanonicalPromoBanner };

export function deriveHomeTaskCards(
  syncFailed: boolean,
  flags: HomeTaskFeatureFlags,
): HomeTaskCardId[] {
  if (syncFailed) return [];

  const cards: HomeTaskCardId[] = [];
  if (flags.homeNewcomerTasksEnabled) cards.push("newcomer");
  if (flags.homeWeeklyPromoEnabled) cards.push("weekly");
  return cards;
}

export function selectHomeWeeklySource(
  quests: CanonicalQuest[],
  promo: CanonicalPromoBanner | null,
): HomeWeeklySource | null {
  const weeklyQuests = quests.filter(
    (quest) => quest.layer === "WEEKLY_T1" || quest.layer === "WEEKLY_T2",
  );
  const quest = weeklyQuests.find((candidate) => candidate.status !== "CLAIMED") ?? weeklyQuests[0];
  if (quest) return { kind: "quest", quest };
  if (promo?.status === "active") return { kind: "promo", promo };
  return null;
}
