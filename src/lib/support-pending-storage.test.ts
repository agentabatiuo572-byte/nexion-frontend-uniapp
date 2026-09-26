import { afterEach, expect, it, vi } from "vitest";
import { restoreSupportPending } from "./support-pending-storage";

afterEach(() => vi.unstubAllGlobals());

it("migrates a legacy App localStorage slot into durable uni storage", () => {
  const key = "support-pending-commands:account-a:run-1:tickets";
  const slot = `sha256:${"a".repeat(64)}`;
  const value = JSON.stringify({ [slot]: "support-ticket-create-123" });
  const native = new Map<string, string>();
  vi.stubGlobal("plus", {});
  vi.stubGlobal("localStorage", { getItem: (name: string) => name === key ? value : null });
  vi.stubGlobal("uni", {
    getStorageSync: (name: string) => native.get(name) ?? "",
    setStorageSync: (name: string, data: string) => native.set(name, data),
  });

  expect(restoreSupportPending("account-a", "run-1", "tickets").get(slot)).toBe("support-ticket-create-123");
  expect(native.get(key)).toBe(value);
});
