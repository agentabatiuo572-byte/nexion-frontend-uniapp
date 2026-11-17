// Shared by logic and renderjs without importing Vue or business stores into the view.
export function diagnosticQuery(query: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(query).map(([key, value]) => [key, value !== undefined && value !== null && value !== ""]));
}
export function diagnosticHref(href: string) {
  const [route, query] = href.split("?");
  const presence: Record<string, boolean> = {};
  new URLSearchParams(query).forEach((value, key) => { presence[key] = value !== ""; });
  return { route, query: presence };
}
