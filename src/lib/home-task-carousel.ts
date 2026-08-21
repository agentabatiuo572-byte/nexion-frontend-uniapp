import type { CanonicalPromoBanner, CanonicalQuest, QuestSnapshot } from "@/api/quest-api";

export type HomeTaskCardId = "newcomer" | "weekly";

export interface HomeTaskFeatureFlags {
  homeNewcomerTasksEnabled: boolean;
  homeWeeklyPromoEnabled: boolean;
}

export type HomeWeeklySource =
  | { kind: "quest"; quest: CanonicalQuest }
  | { kind: "promo"; promo: CanonicalPromoBanner };

export interface HomeWeeklyCardView {
  multiplier: number | null;
  rewardNex: number | null;
  countdownDays: number | null;
  countdownHours: number | null;
  subtitle: string | null;
  targetDevice: string | null;
  targetDaily: number | null;
  action: "missions" | "store" | null;
}

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
  const quest = weeklyQuests.find((candidate) => candidate.status !== "CLAIMED");
  if (quest) return { kind: "quest", quest };
  if (promo?.status === "active") return { kind: "promo", promo };
  return null;
}

/**
 * Keeps the 5174 weekly-card slot structure while preserving server authority.
 * Mission identity/reward comes from nx_mission; the shared visual countdown
 * and product-yield metadata comes from PC H3's nx_growth_promo_banner row.
 */
export function presentHomeWeeklyCard(
  source: HomeWeeklySource | null,
  presentation: CanonicalPromoBanner | null,
  questBonusMultiplier: number,
): HomeWeeklyCardView {
  if (!source) {
    return {
      multiplier: null,
      rewardNex: null,
      countdownDays: null,
      countdownHours: null,
      subtitle: null,
      targetDevice: null,
      targetDaily: null,
      action: null,
    };
  }

  const metadata = source.kind === "promo" ? source.promo : presentation;
  if (source.kind === "quest") {
    const multiplier = Number.isFinite(questBonusMultiplier) && questBonusMultiplier > 0
      ? questBonusMultiplier
      : 1;
    return {
      multiplier,
      rewardNex: Math.round(source.quest.rewardNex * multiplier),
      countdownDays: metadata?.countdownDays ?? null,
      countdownHours: metadata?.countdownHours ?? null,
      subtitle: metadata?.targetDevice
        ? `${source.quest.name} · ${metadata.targetDevice}`
        : source.quest.name,
      targetDevice: metadata?.targetDevice ?? null,
      targetDaily: metadata?.targetDaily ?? null,
      action: "missions",
    };
  }

  return {
    multiplier: source.promo.multiplier,
    rewardNex: Math.round(source.promo.baseReward * source.promo.multiplier),
    countdownDays: source.promo.countdownDays,
    countdownHours: source.promo.countdownHours,
    subtitle: source.promo.targetDevice,
    targetDevice: source.promo.targetDevice,
    targetDaily: source.promo.targetDaily,
    action: "store",
  };
}

export function isHomeWeeklyCardReady(
  remote: boolean,
  loading: boolean,
  error: string | null,
  snapshot: QuestSnapshot | null,
): boolean {
  if (!remote) return true;
  if (loading || error || !snapshot) return false;
  return selectHomeWeeklySource(snapshot.quests, snapshot.promoBanner) !== null;
}
