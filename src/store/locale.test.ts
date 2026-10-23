import { beforeEach, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useLocaleStore } from "./locale";
import { LOCALES } from "@/i18n";
beforeEach(() => {
  vi.stubGlobal("uni", { getStorageSync: () => "", setStorageSync: vi.fn(), getSystemInfoSync: () => ({ language: "vi-VN" }) });
  setActivePinia(createPinia());
});
test("only English and Vietnamese are offered", () => { expect(LOCALES.map(x => x.code)).toEqual(["en", "vi"]); });
test.each(["zh-CN", "vi-VN", "en-US"])("a fresh %s device starts in English", language => {
  vi.stubGlobal("uni", { getStorageSync: () => "", setStorageSync: vi.fn(), getSystemInfoSync: () => ({ language }) });
  expect(useLocaleStore().code).toBe("en");
});
test.each(["zh", "ja"] as const)("unsupported server and explicit locale %s fall back to English", language => {
  const store = useLocaleStore(); store.applyServerLocale(language); expect(store.code).toBe("en");
  expect(store.explicitRevision).toBe(0); store.setLocale(language); expect(store.code).toBe("en");
});
test.each([{code:"zh",userSet:true},{code:"vi",userSet:false}])("old unsupported or automatic language is migrated to English: %j", saved => {
  const setStorageSync = vi.fn(); vi.stubGlobal("uni", { getStorageSync: () => saved, setStorageSync });
  expect(useLocaleStore().code).toBe("en"); expect(setStorageSync).toHaveBeenCalledWith("nexgrid-locale-v1", {code:"en",userSet:false});
});
test("keeps an explicit Vietnamese preference across startup and account hydration", () => {
  vi.stubGlobal("uni", { getStorageSync: () => ({code:"vi",userSet:true}), setStorageSync: vi.fn() });
  const store=useLocaleStore(); expect(store.code).toBe("vi"); store.ensureSystemDetected(); expect(store.code).toBe("vi");
  store.applyServerLocale("en"); store.ensureSystemDetected(); expect(store.code).toBe("en"); expect(store.explicitRevision).toBe(0);
});
