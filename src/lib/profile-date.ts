export function formatJoinedDate(joinedAt: number, locale: string): string {
  if (!Number.isFinite(joinedAt) || joinedAt <= 0) return "—";
  const value = new Date(joinedAt);
  if (Number.isNaN(value.getTime())) return "—";
  return value.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
