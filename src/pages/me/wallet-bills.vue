<!--
  Wallet Bills — ported from Nexion-prototype/app/(main)/me/wallet/bills/page.tsx.
  Transaction/bill ledger: segmented tabs (All / Credit / Debit) → month-grouped
  list of credits & debits, each with type icon + memo + ref + running USDT
  balance. Reads the existing useBills store (already ported). SetPageHeader →
  in-page SubPageHeader (back=/pages/me/wallet). SegmentedControl → inline pill
  tabs (events.vue pattern). The SSR mounted-guard is dropped (no SSR in uni).
  Wrapped in <AppChassis active="me">.

  Icon TYPE colours: a few are official accents not in the token set (refer
  green #86E81F, topup blue #3DA9FF) — kept literal like card-brand colours;
  the rest use var(--v5-*). Tinted icon bg uses color-mix (P-022), not `${hex}1A`.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet" :title="t.bills.title" />

      <!-- Tabs -->
      <view class="flex" :style="segWrapStyle">
        <view
          v-for="tb in TABS"
          :key="tb"
          class="flex-1 grid place-items-center active:opacity-70"
          :style="pillStyle(tb)"
          @click="tab = tb"
        >
          <text :style="pillLabelStyle(tb)">{{ tabLabel(tb) }}</text>
        </view>
      </view>

      <!-- Empty -->
      <view v-if="filtered.length === 0" :style="emptyStyle">
        <text class="block" :style="emptyTextStyle">{{ t.bills.empty }}</text>
      </view>

      <!-- Grouped list -->
      <view v-else :style="listWrapStyle">
        <view v-for="g in grouped" :key="g.month" :style="sectionStyle">
          <text class="block" :style="monthHeaderStyle">{{ monthLabel(g.month, g.rows.length) }}</text>
          <view
            v-for="(b, i) in g.rows"
            :key="b.id"
            class="flex items-center active:opacity-90"
            :style="rowStyle(i)"
            role="button"
            tabindex="0"
            :aria-label="billAria(b)"
            @tap.stop="goBill(b)"
            @click.stop="goBill(b)"
          >
            <view class="grid place-items-center shrink-0" :style="iconChipStyle(b.type)">
              <BillTypeIcon :type="b.type" :color="typeColor(b.type)" />
            </view>
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 8px">
                <text class="truncate" :style="typeLabelStyle">{{ typeLabel(b.type) }}</text>
                <text :style="statusBadgeStyle(b.status)">{{ statusLabel(b.status) }}</text>
              </view>
              <view class="truncate" :style="memoStyle">
                <text>{{ b.memo }}</text>
                <text v-if="b.ref" style="color: var(--v5-ink-4); margin: 0 4px">·</text>
                <text v-if="b.ref" class="font-mono-tabular">{{ b.ref }}</text>
              </view>
              <text class="block" :style="timeStyle">{{ fmtTime(b.ts) }}</text>
            </view>
            <view class="text-right shrink-0" style="margin-left: 8px">
              <view :style="amountStyle(b.amount)">
                <text>{{ b.amount >= 0 ? "+" : "-" }}{{ fmtAmount(b) }}</text>
                <text style="font-size: 10px; color: var(--v5-ink-4); margin-left: 4px">{{ b.symbol }}</text>
              </view>
              <text
                v-if="b.balanceAfter !== undefined && b.symbol === 'USDT'"
                class="block tabular-nums"
                :style="balanceAfterStyle"
              >{{ runningBalanceLabel(b.balanceAfter) }}</text>
            </view>
          </view>
        </view>
      </view>

      <text class="block" :style="footerStyle">{{ t.bills.footer }}</text>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import BillTypeIcon from "@/components/me/bill-type-icon.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useBills, type Bill, type BillType, type BillStatus } from "@/store/bills";
import { navTo } from "@/lib/route";

const t = useT();
const billsStore = useBills();

type Tab = "all" | "in" | "out";
const TABS: Tab[] = ["all", "in", "out"];
const tab = ref<Tab>("all");

// Type accent colours. Most map to tokens; refer/topup use official accents
// (like the card-brand colours) kept literal on purpose.
const TYPE_COLOR: Record<BillType, string> = {
  earn: "var(--v5-brand)",
  refer: "#86E81F",
  bonus: "var(--v5-warning)",
  topup: "#3DA9FF",
  withdraw: "var(--v5-brand-2)",
  purchase: "var(--v5-tech-cyan)",
  swap: "var(--v5-brand)",
  kyc: "var(--v5-tech-cyan)",
  stake: "var(--v5-warning)",
  unstake: "var(--v5-ink-3)",
  achievement: "var(--v5-warning)",
};
function typeColor(type: BillType): string {
  return TYPE_COLOR[type];
}

const filtered = computed<Bill[]>(() => {
  if (tab.value === "all") return billsStore.bills;
  if (tab.value === "in") return billsStore.bills.filter((b) => b.amount > 0);
  return billsStore.bills.filter((b) => b.amount < 0);
});

const grouped = computed<Array<{ month: string; rows: Bill[] }>>(() => {
  const map = new Map<string, Bill[]>();
  for (const b of filtered.value) {
    const d = new Date(b.ts);
    const key = d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    const arr = map.get(key) ?? [];
    arr.push(b);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([month, rows]) => ({ month, rows }));
});

function typeLabel(type: BillType): string {
  const key = `type${type.charAt(0).toUpperCase()}${type.slice(1)}` as keyof typeof t.value.bills;
  return t.value.bills[key] as string;
}
function statusLabel(s: BillStatus): string {
  if (s === "posted") return t.value.bills.statusPosted;
  if (s === "pending") return t.value.bills.statusPending;
  return t.value.bills.statusFailed;
}
function monthLabel(month: string, n: number): string {
  return t.value.bills.monthLabel.replace("{month}", month).replace("{n}", String(n));
}
function runningBalanceLabel(bal: number): string {
  return `${t.value.bills.runningBalance}: $${bal.toFixed(2)}`;
}
function fmtAmount(b: Bill): string {
  const abs = Math.abs(b.amount);
  return b.symbol === "USDT" ? abs.toFixed(4) : abs.toLocaleString();
}
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function billHash(b: Bill): string {
  return b.ref || b.id;
}
function billAria(b: Bill): string {
  return `${typeLabel(b.type)} ${b.memo} ${billHash(b)}`;
}
function goBill(b: Bill) {
  navTo(`/pages/tx/hash?hash=${encodeURIComponent(billHash(b))}`);
}

// ── styles ──
const segWrapStyle: CSSProperties = {
  margin: "8px 16px 12px",
  background: "var(--v5-surface-2)",
  borderRadius: "12px",
  padding: "3px",
  gap: "2px",
};
function pillStyle(tb: Tab): CSSProperties {
  const on = tab.value === tb;
  return {
    height: "34px",
    borderRadius: "9px",
    background: on ? "var(--v5-surface)" : "transparent",
    boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  };
}
function pillLabelStyle(tb: Tab): CSSProperties {
  const on = tab.value === tb;
  return { fontSize: "11.5px", fontWeight: on ? 600 : 500, color: on ? "var(--v5-ink)" : "var(--v5-ink-3)" };
}
function tabLabel(tb: Tab): string {
  if (tb === "all") return t.value.bills.tabAll;
  if (tb === "in") return t.value.bills.tabIn;
  return t.value.bills.tabOut;
}

const emptyStyle: CSSProperties = {
  margin: "0 16px",
  background: "var(--v5-surface)",
  border: "1px dashed var(--v5-border)",
  borderRadius: "16px",
  padding: "32px",
  textAlign: "center",
};
const emptyTextStyle: CSSProperties = { fontSize: "13.5px", color: "var(--v5-ink-2)" };

const listWrapStyle: CSSProperties = { margin: "0 16px 12px" };
const sectionStyle: CSSProperties = {
  marginBottom: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  overflow: "hidden",
};
const monthHeaderStyle: CSSProperties = {
  padding: "8px 16px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
  background: "var(--v5-surface)",
  borderBottom: "1px solid var(--v5-border)",
};
function rowStyle(i: number): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 16px",
    borderTop: i !== 0 ? "1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)" : "none",
  };
}
function iconChipStyle(type: BillType): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: `color-mix(in srgb, ${TYPE_COLOR[type]} 12%, transparent)`,
  };
}
const typeLabelStyle: CSSProperties = {
  fontSize: "13.5px",
  fontWeight: 500,
  color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)",
};
function statusBadgeStyle(s: BillStatus): CSSProperties {
  const base: CSSProperties = {
    fontSize: "10px",
    padding: "1px 6px",
    borderRadius: "4px",
  };
  if (s === "posted") return { ...base, background: "var(--v5-surface-2)", color: "var(--v5-ink-3)" };
  if (s === "pending")
    return { ...base, background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)", color: "var(--v5-warning)" };
  return { ...base, background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)", color: "var(--v5-brand-2)" };
}
const memoStyle: CSSProperties = { marginTop: "2px", fontSize: "11px", color: "var(--v5-ink-3)" };
const timeStyle: CSSProperties = { marginTop: "2px", fontSize: "10.5px", color: "var(--v5-ink-4)" };
function amountStyle(amount: number): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "13.5px",
    fontWeight: 600,
    color: amount >= 0 ? "var(--v5-brand)" : "var(--v5-brand-2)",
  };
}
const balanceAfterStyle: CSSProperties = { marginTop: "2px", fontSize: "10px", color: "var(--v5-ink-4)" };
const footerStyle: CSSProperties = {
  margin: "12px 24px 24px",
  textAlign: "center",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
  lineHeight: 1.6,
};
</script>
