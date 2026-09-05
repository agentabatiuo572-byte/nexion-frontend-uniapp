import { beforeEach, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useLocaleStore } from "./locale";
beforeEach(() => {
  vi.stubGlobal("uni", { getStorageSync: () => "", setStorageSync: vi.fn() });
  setActivePinia(createPinia());
});
test("a historical unsupported profile locale never diverges from rendered language", () => {
  const store = useLocaleStore();
  store.applyServerLocale("ja");
  expect(store.code).toBe("en");
  expect(store.explicitRevision).toBe(0);
  store.setLocale("zh");
  expect(store.code).toBe("zh");
});
