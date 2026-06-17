import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Page-header registration store — ported from Nexion-prototype/lib/store/page-header.ts
 * (zustand → Pinia). A sub-page declares its nav header (back + centered title +
 * optional subtitle) via the `use-page-header` composable; AppChassis renders it as a
 * STICKY chassis nav row (mirrors the prototype's SetPageHeader + Header nav row), so
 * the header stays pinned + frosts the scrolled content instead of scrolling away.
 *
 * The 5 tab pages NEVER register → AppChassis always shows the brand row for them
 * (registration is purely additive → zero regression to the optimized tab pages).
 * Non-persisted (per-navigation state). No return-type annotation (P-017).
 */
export interface PageHeaderPayload {
  title: string;
  subtitle?: string;
  /** Logical/route href for the back button, mapped via navTo (P-046). */
  backHref: string;
}

export const usePageHeader = defineStore("pageHeader", () => {
  const header = ref<PageHeaderPayload | null>(null);

  function set(payload: PageHeaderPayload) {
    header.value = payload;
  }
  function clear() {
    header.value = null;
  }

  return { header, set, clear };
});
