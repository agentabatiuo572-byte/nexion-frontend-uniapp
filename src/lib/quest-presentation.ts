const APP_QUEST_ROUTES = new Set([
  "/pages/missions/missions",
  "/pages/me/profile",
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
