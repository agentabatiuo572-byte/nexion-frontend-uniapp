const STATIC_REVIEW_PREFIXES = [
  "pages/entry-surfaces/",
];

/**
 * 把路由归一成**页面栈同形**(`pages/x/y`),吃得下 `getCurrentPages()` 的 `pages/x/y`
 * 与 H5 冷启动时只能拿到的 `#/pages/x/y?q=1` 两种形态。
 *
 * 🔴 导出成单一来源,是因为「一半判据归一化、另一半没有」曾经放行过越权访问:
 * App.vue 的 isAuthWhitelisted 原来是 `isStaticReviewRoute(route) || 前缀.startsWith(route)`
 * —— 前半段(本文件)归一化了,后半段直接 startsWith,喂 hash 形态时白名单判不中。
 * 两份正则各写一份必然漂移,权限判据经不起漂移。
 */
export function normalizeRoute(route?: string | null): string {
  return (route ?? "").replace(/^\/?#?\/?/, "").split("?")[0];
}

export function isStaticReviewRoute(route?: string | null): boolean {
  if (!route) return false;
  return STATIC_REVIEW_PREFIXES.some((prefix) => normalizeRoute(route).startsWith(prefix));
}
