<!--
  Receipts — ported from Nexion-prototype/app/(main)/me/receipts/page.tsx.
  Proof-of-Compute receipt list: horizontally-scrollable category tabs (All / IG
  / VG / LL / FT / EM / SP / KY) with per-tab counts + clear-all destructive
  action → month-agnostic row list → tap opens the ReceiptModal detail. Reads
  the existing useReceipts store (already ported) + filterByCategory. clear →
  confirm() (destructive). Long-press a row copies its signature (uni.
  setClipboardData, P-028). SetPageHeader → SubPageHeader. Wrapped in
  <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.receipt.title" />

      <!-- Tabs + clear-all -->
      <view class="flex items-center" :style="tabsRowStyle">
        <scroll-view scroll-x class="flex-1 min-w-0" :show-scrollbar="false" style="white-space: nowrap">
          <view class="inline-flex" style="gap: 6px; padding: 0 1px 4px">
            <view
              v-for="c in TAB_ORDER"
              :key="c"
              class="inline-flex items-center shrink-0 active:opacity-70"
              :style="tabPillStyle(c)"
              @click="tab = c"
            >
              <text :style="tabLabelStyle(c)">{{ tabLabel(c) }}</text>
              <text v-if="counts[c] > 0" class="font-mono-tabular tabular-nums" :style="tabCountStyle">{{ counts[c] }}</text>
            </view>
          </view>
        </scroll-view>
        <view v-if="receipts.length > 0" class="grid place-items-center shrink-0 active:opacity-70" :style="clearBtnStyle" @click="handleClearAll">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
        </view>
      </view>

      <!-- Empty -->
      <view v-if="filtered.length === 0" :style="emptyStyle">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" /></svg>
        <text class="block" :style="emptyTitleStyle">{{ t.receipt.emptyTitle }}</text>
        <text class="block" :style="emptyHintStyle">{{ t.receipt.emptyHint }}</text>
      </view>

      <!-- List -->
      <view v-else :style="listStyle">
        <view
          v-for="(r, i) in visibleReceipts"
          :key="`${r.signature}-${i}`"
          class="flex items-center active:opacity-80"
          :style="rowStyle(i)"
          @click="open = r"
          @longpress="copySig(r)"
        >
          <view class="grid place-items-center shrink-0" :style="rowIconStyle(r)">
            <ReceiptCatIcon :category="r.category" :color="r.category === 'KY' ? 'var(--v5-brand-2)' : 'var(--v5-brand)'" />
          </view>
          <view class="flex-1 min-w-0">
            <view class="truncate" :style="rowTitleStyle">
              <text>{{ r.model }}</text>
              <text style="color: var(--v5-ink-4); margin: 0 4px">·</text>
              <text style="color: var(--v5-ink-3)">{{ r.type }}</text>
            </view>
            <view class="truncate" :style="rowSubStyle">
              <text>{{ r.client }}</text>
              <text style="color: var(--v5-ink-4); margin: 0 4px">·</text>
              <text class="font-mono-tabular tabular-nums">#{{ r.id }}</text>
            </view>
          </view>
          <view class="text-right shrink-0" style="margin-left: 8px">
            <text class="block tabular-nums" :style="rowAmountStyle(r)">{{ rowAmount(r) }}</text>
            <text class="block" :style="rowDateStyle">{{ shortDate(r.settledAt) }}</text>
          </view>
        </view>
      </view>

      <!-- Always mounted (even while empty) so the observer below attaches at
           first mount rather than missing it if this tab starts with 0 items. -->
      <view ref="loadMoreSentinel" style="height: 1px" />

      <text class="block" :style="footerStyle">{{ t.receipt.footerNote }}</text>

      <ReceiptModal :receipt="open" @close="open = null" />
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect, watch, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import ReceiptCatIcon from "@/components/me/receipt-cat-icon.vue";
import ReceiptModal from "@/components/me/receipt-modal.vue";
import { useT } from "@/i18n/use-t";
import { useReceipts, filterByCategory } from "@/store/receipts";
import type { Receipt, ReceiptCategory } from "@/mock/receipt";
import { confirm, toast } from "@/store/ui";
import { useScrollGrowProgress } from "@/composables/use-scroll-grow-progress";

type Tab = "ALL" | ReceiptCategory;
const TAB_ORDER: Tab[] = ["ALL", "IG", "VG", "LL", "FT", "EM", "SP", "KY"];
// One screen's worth per load — reduces initial render + (future) server load.
const PAGE_SIZE = 10;

const t = useT();
const receiptsStore = useReceipts();
const tab = ref<Tab>("ALL");
const open = ref<Receipt | null>(null);
const visibleCount = ref(PAGE_SIZE);
watch(tab, () => { visibleCount.value = PAGE_SIZE; });

const receipts = computed(() => receiptsStore.receipts);
const filtered = computed(() => filterByCategory(receipts.value, tab.value));
const visibleReceipts = computed(() => filtered.value.slice(0, visibleCount.value));
const hasMore = computed(() => visibleCount.value < filtered.value.length);

// Sentinel row (always mounted so the observer attaches from the start —
// hasMore can flip true later as receipts arrive) sits at the list end;
// watchEffect re-checks on every dependency change, not just inView flips,
// so a tab/data change that leaves the sentinel already in view still loads.
// ponytail: on a viewport tall enough to fit >1 page of rows, this can load
// several pages back-to-back before the sentinel actually scrolls out of
// view (Vue's reactive re-run can outrun the browser's next real
// intersection check). Harmless on real phone viewports (one page ≈ one
// screen); if a very tall/tablet viewport needs a hard one-page-per-scroll
// cap, gate the bump behind a nextTick() + rAF pair before re-checking.
// ponytail: useScrollGrowProgress falls back to inView=true when
// IntersectionObserver is unavailable (its other 20 call sites are cosmetic
// scroll-in animations, where "show the final state" is a safe default) —
// here that fallback means pagination silently no-ops and every matching
// receipt renders at once instead of erroring. Modern App-webview targets
// (WKWebView/Android System WebView) support IntersectionObserver, so this
// should stay latent; if it ever fires for real, the fix is a local
// capability check in this file, not changing the shared composable's
// default for its other 20 cosmetic consumers.
const { elRef: loadMoreSentinel, inView: loadMoreInView } = useScrollGrowProgress({ threshold: 0 });
watchEffect(() => {
  if (loadMoreInView.value && hasMore.value) {
    visibleCount.value = Math.min(filtered.value.length, visibleCount.value + PAGE_SIZE);
  }
});

const counts = computed<Record<Tab, number>>(() => {
  const c: Record<Tab, number> = { ALL: receipts.value.length, IG: 0, VG: 0, LL: 0, FT: 0, EM: 0, SP: 0, KY: 0 };
  for (const r of receipts.value) c[r.category] += 1;
  return c;
});

function tabLabel(c: Tab): string {
  const map: Record<Tab, string> = {
    ALL: t.value.receipt.tabAll,
    IG: t.value.receipt.catIG,
    VG: t.value.receipt.catVG,
    LL: t.value.receipt.catLL,
    FT: t.value.receipt.catFT,
    EM: t.value.receipt.catEM,
    SP: t.value.receipt.catSP,
    KY: t.value.receipt.catKY,
  };
  return map[c];
}

async function handleClearAll() {
  const ok = await confirm({
    title: t.value.receipt.clearAll,
    message: t.value.receipt.clearConfirm,
    danger: true,
    icon: "danger",
  });
  if (ok) {
    const n = receipts.value.length;
    receiptsStore.clear();
    toast.success(t.value.receipt.clearAll, `${n} receipts removed`);
  }
}

function copySig(r: Receipt) {
  uni.setClipboardData({ data: r.signature, showToast: false, fail: () => {} });
  toast.success("Signature copied", r.signature.substring(0, 16) + "...");
}

function rowAmount(r: Receipt): string {
  return r.category === "KY" ? `✓ $${r.netPaid.toFixed(2)}` : `+$${r.netPaid.toFixed(4)}`;
}
function shortDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── styles ──
const tabsRowStyle: CSSProperties = { margin: "0 16px 12px", gap: "8px" };
function tabPillStyle(c: Tab): CSSProperties {
  const on = tab.value === c;
  // Filter chip — filled tint (active) vs surface-2 (idle), no border: the fill
  // + text color is the single visual difference (V5 chip idiom).
  return {
    height: "44px",
    padding: "0 16px",
    borderRadius: "999px",
    gap: "4px",
    background: on ? "color-mix(in srgb, var(--v5-brand) 15%, transparent)" : "var(--v5-surface-2)",
  };
}
function tabLabelStyle(c: Tab): CSSProperties {
  const on = tab.value === c;
  return { fontSize: "11.5px", fontWeight: 500, color: on ? "var(--v5-brand)" : "var(--v5-ink-3)" };
}
const tabCountStyle: CSSProperties = { fontSize: "11.5px", opacity: 0.7 };
const clearBtnStyle: CSSProperties = { width: "44px", height: "44px", borderRadius: "999px" };

// Empty state — dashed outline hint, no fill (V5 empty-state idiom).
const emptyStyle: CSSProperties = {
  margin: "0 16px",
  border: "1px dashed var(--v5-border-strong)",
  borderRadius: "16px",
  padding: "32px",
  textAlign: "center",
};
const emptyTitleStyle: CSSProperties = { marginTop: "12px", fontSize: "13.5px", color: "var(--v5-ink-2)" };
const emptyHintStyle: CSSProperties = { marginTop: "6px", fontSize: "11.5px", color: "var(--v5-ink-3)", lineHeight: 1.625 };

// De-carded: transparent hairline group (earnings-ledger idiom). The surface +
// outer border was redundant boundary weight — rows are already hairline-split.
// border-top opens the group; 2px optical inset aligns rows under the gutter.
const listStyle: CSSProperties = {
  margin: "0 16px",
  padding: "0 2px",
  borderTop: "1px solid var(--v5-border)",
};
function rowStyle(i: number): CSSProperties {
  return {
    gap: "12px",
    padding: "13px 0",
    borderBottom: i < visibleReceipts.value.length - 1 ? "1px solid var(--v5-border)" : "none",
  };
}
function rowIconStyle(r: Receipt): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background:
      r.category === "KY"
        ? "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)"
        : "color-mix(in srgb, var(--v5-brand) 10%, transparent)",
  };
}
const rowTitleStyle: CSSProperties = {
  fontSize: "13.5px",
  fontWeight: 500,
  color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)",
};
const rowSubStyle: CSSProperties = { marginTop: "2px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
function rowAmountStyle(r: Receipt): CSSProperties {
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "13.5px",
    fontWeight: 600,
    color: r.category === "KY" ? "var(--v5-brand-2)" : "var(--v5-brand)",
  };
}
const rowDateStyle: CSSProperties = { marginTop: "2px", fontSize: "11px", color: "var(--v5-ink-4)" };
const footerStyle: CSSProperties = {
  margin: "16px 24px 24px",
  textAlign: "center",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
  lineHeight: 1.625,
};
</script>
