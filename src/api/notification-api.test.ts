import { describe, expect, it, vi } from "vitest";
import { createNotificationApi } from "./notification-api";

const createdInstant = Date.parse("2026-09-18T03:38:00Z");
const readInstant = Date.parse("2026-09-18T04:20:00Z");
function page(createdAt: unknown, readAt: unknown = null) {
  const request = vi.fn().mockResolvedValue({
    items: [{ id: 1, kind: "system", priority: "normal", title: "Welcome",
      body: "", ctaLabel: "", ctaHref: "", createdAt, readAt }],
    nextCursor: null, unread: readAt === null ? 1 : 0,
  });
  return createNotificationApi({ request } as never).page();
}

describe("notification timestamp contract", () => {
  it.each(["2026-09-18 11:38:00", "2026-09-18T11:38:00"])(
    "parses server business time %s independently of the device timezone", async createdAt => {
      const result = await page(createdAt, "2026-09-18 12:20:00");
      expect(result.items[0].createdAt).toBe(createdInstant);
      expect(result.items[0].readAt).toBe(readInstant);
      expect(Math.floor((Date.parse("2026-09-18T04:30:00Z") - result.items[0].createdAt) / 60_000)).toBe(52);
    });

  it.each(["2026-09-18T03:38:00Z", "2026-09-18T11:38:00+08:00", "2026-09-18T12:38:00+09:00", createdInstant])(
    "preserves the explicit instant %s and an unread notification", async createdAt => {
      const result = await page(createdAt);
      expect(result.items[0].createdAt).toBe(createdInstant);
      expect(result.items[0].readAt).toBeNull();
      expect(result.unread).toBe(1);
    });

  it.each(["2026-02-30 11:38:00", "2026-09-18", "invalid", null, 0, Infinity])(
    "rejects invalid creation time %s instead of fabricating a time", async createdAt => {
      await expect(page(createdAt)).rejects.toMatchObject({ message: "NOTIFICATION_RESPONSE_INVALID" });
    });

  it("rejects an invalid read time without changing read-state semantics", async () => {
    await expect(page(createdInstant, "2026-02-30 12:20:00"))
      .rejects.toMatchObject({ message: "NOTIFICATION_RESPONSE_INVALID" });
  });
});
