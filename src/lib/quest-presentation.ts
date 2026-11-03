import type { CanonicalQuest } from "@/api/quest-api";
import type { LocaleCode } from "@/i18n";
import type { Messages } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { platformDisplayText } from "./brand-copy";

const APP_QUEST_ROUTES = new Set([
  "/pages/missions/missions",
  "/pages/me/profile",
  "/pages/me/security",
  "/pages/me/wallet-cards-new",
  "/pages/me/wallet-topup",
  "/pages/me/wallet-exchange",
  "/pages/me/wallet-repurchase",
  "/pages/me/devices",
  "/pages/earn/earn",
  "/pages/store/store",
  "/pages/store/detail?id=stellarbox-s1",
  "/pages/team/team",
  "/pages/team/commissions",
  "/pages/learn/courses",
  "/pages/staking/staking",
  "/pages/genesis/genesis",
  "/pages/genesis/marketplace",
]);

export function normalizeQuestActionRoute(value: string): string {
  const route = value.trim();
  if (!/^\/pages\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\?[A-Za-z0-9._~%=&-]+)?$/.test(route)
      || !APP_QUEST_ROUTES.has(route)) {
    throw new Error("QUEST_ACTION_ROUTE_INVALID");
  }
  return route;
}

const DAY_ONE_TITLE_KEYS = new Map<string, keyof Messages["home"]>([
  ["bind_bank_card", "dayOneTaskBindCard"],
  ["visit_earn", "dayOneTaskVisitEarn"],
  ["visit_store", "dayOneTaskVisitStore"],
  ["view_product_roi", "dayOneTaskSeeRoi"],
  ["setup_profile", "dayOneTaskSetupProfile"],
  ["invite_friend", "dayOneTaskInviteFriend"],
]);

// Server default names from before the 2026-11-04 copy rewrite. Snapshots may still carry them, so
// they stay a match base next to the current zh default; only these exact names get the new copy.
const LEGACY_DEFAULT_NAMES: Readonly<Record<string, string>> = {
  "home.dayOneTaskSeeRoi": "查看 UVELBox S1 ROI",
  "weeklyQuest.tier1_subscribe_premium_title": "复投加速 · 把余额再锁一轮",
  "weeklyQuest.tier2_reinvest_title": "复投 $100.00 到网络",
  "weeklyQuest.tier2_genesis_browse_title": "看 Genesis 二级市场",
};

function isDefaultName(name: string, id: string, current: unknown): boolean {
  const legacy = LEGACY_DEFAULT_NAMES[id];
  return (typeof current === "string" && name === platformDisplayText(current))
    || (legacy !== undefined && name === platformDisplayText(legacy));
}

/** Localize exact frozen defaults at display time, preserving authored snapshot names. */
export function dayOneQuestDisplayName(
  quest: Pick<CanonicalQuest, "questCode" | "name" | "layer">,
  locale: LocaleCode,
  t: Messages,
): string {
  const name = platformDisplayText(quest.name);
  if (quest.layer !== "DAY_ONE") return name;
  const key = DAY_ONE_TITLE_KEYS.get(quest.questCode);
  if (!key) return name;
  // zh shows the server name unless it is a legacy default the copy rewrite replaced.
  if (locale === "zh" && !(`home.${key}` in LEGACY_DEFAULT_NAMES)) return name;
  const translated = t.home[key];
  return typeof translated === "string" && translated.trim().length > 0
    && isDefaultName(name, `home.${key}`, zh.home[key])
    ? translated
    : name;
}

/** Use bundled copy only for the exact old server default, preserving configured titles. */
export function weeklyQuestDisplayName(
  quest: Pick<CanonicalQuest, "questCode" | "name">,
  locale: LocaleCode,
  t: Messages,
): string {
  const name = platformDisplayText(quest.name);
  const match = /^weekly_t([12])_([a-z0-9_]+)$/.exec(quest.questCode);
  if (!match) return name;
  const key = `tier${match[1]}_${match[2]}_title` as keyof Messages["weeklyQuest"];
  // zh shows the server name unless it is a legacy default the copy rewrite replaced.
  if (locale === "zh" && !(`weeklyQuest.${key}` in LEGACY_DEFAULT_NAMES)) return name;
  const translated = t.weeklyQuest[key];
  return typeof translated === "string"
    && isDefaultName(name, `weeklyQuest.${key}`, zh.weeklyQuest[key])
    ? translated
    : name;
}
