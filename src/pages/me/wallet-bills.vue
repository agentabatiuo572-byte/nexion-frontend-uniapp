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
      <EmptyState v-if="filtered.length === 0" kind="empty-list" :title="t.empty.billsTitle" :desc="t.empty.billsDesc" />

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
                <text>{{ billMemo(b) }}</text>
                <text v-if="b.ref" style="color: var(--v5-ink-4); margin: 0 4px">·</text>
                <text v-if="b.ref" class="font-mono-tabular">{{ b.ref }}</text>
              </view>
              <text class="block" :style="timeStyle">{{ fmtTime(b.ts) }}</text>
            </view>
            <view class="text-right shrink-0" style="margin-left: 8px">
              <view :style="amountStyle(b.amount)">
                <text>{{ b.amount >= 0 ? "+" : "-" }}{{ fmtAmount(b) }}</text>
                <text style="font-size: 12px; color: var(--v5-ink-4); margin-left: 4px">{{ b.symbol }}</text>
              </view>
              <text
                v-if="b.balanceAfter !== undefined && b.symbol === 'USDT'"
                class="block tabular-nums"
                :style="balanceAfterStyle"
              >{{ runningBalanceLabel(b.balanceAfter!) }}</text>
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
import { useLocaleStore } from "@/store/locale";
import AppChassis from "@/components/app-chassis.vue";
import EmptyState from "@/components/empty-state.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import BillTypeIcon from "@/components/me/bill-type-icon.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useBills, type Bill, type BillType, type BillStatus } from "@/store/bills";
import { navTo } from "@/lib/route";

const t = useT();
const locale = useLocaleStore();
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

// 🔴 每条流水后的余额由**服务端复式账本**下发(Bill.balanceAfter),前端不推算。
//
// 这里曾试过两种推算,两种都错,根因同一个:**账单不是完整账本**。
//  · 从 0 正向累加 → 补不齐那些「改了余额却不写账单」的路径(收益按 tick 累加、赠金释放),
//    实测账单写「余额 $60.31」而钱包写「$24,826.56」,用户以为钱被吞了;
//  · 以真实余额为锚往回倒推 → 又踩反方向:注册赠金进「待审核」桶时只加桶不动余额,
//    账单却无条件写了一行,倒推把它当已入账 → 那行以下每一行偏 $5;
//    而且筛选态(只看支出)下相邻两行之间隔着看不见的行,实测「每笔支出后余额还在涨」。
//
// 结论:两个方向都漏 = 这条路线本身不成立,给 Bill 加个「动没动余额」的字段也只堵一半。
// 判据回到本工程自己的规矩:**指不出单源的数字,要么接单源,要么别显示**。
// mock 期 balanceAfter 恒为 undefined → 这一列不渲染;接上真后端自动出现,零改动。
const filtered = computed<Bill[]>(() => {
  if (tab.value === "all") return billsStore.bills;
  if (tab.value === "in") return billsStore.bills.filter((b) => b.amount > 0);
  return billsStore.bills.filter((b) => b.amount < 0);
});

const grouped = computed<Array<{ month: string; rows: Bill[] }>>(() => {
  const map = new Map<string, Bill[]>();
  for (const b of filtered.value) {
    const d = new Date(b.ts);
    // 🔴 跟**应用**语言,不跟浏览器语言 —— undefined 会让越南语用户看到中文月份表头。
    const key = d.toLocaleDateString(localeTag.value, { year: "numeric", month: "long" });
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
/**
 * 账单文案:有 memoKey 就**渲染时翻译**,没有才回落到写入时那句(存量 / 未迁移调用方)。
 * 之前种子行是英文硬串,越南语用户会在同一个列表里看到中文表头 + 英文摘要 + 越南语新行,三种语言。
 */
function billMemo(b: Bill): string {
  const dict = t.value.bills.memo as Record<string, string> | undefined;
  const s = b.memoKey ? dict?.[b.memoKey] : undefined;
  return s ? (b.memoParams ? fmt(s, b.memoParams) : s) : b.memo;
}
function runningBalanceLabel(bal: number): string {
  return `${t.value.bills.runningBalance}: $${bal.toFixed(2)}`;
}
function fmtAmount(b: Bill): string {
  const abs = Math.abs(b.amount);
  return b.symbol === "USDT" ? abs.toFixed(4) : abs.toLocaleString();
}
/** 应用当前语言对应的 BCP-47 tag(用于日期 / 数字格式化)。 */
const localeTag = computed(() => ({ zh: "zh-CN", en: "en-US", vi: "vi-VN" } as Record<string, string>)[locale.code] ?? "en-US");
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString(localeTag.value, {
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
/**
 * 🔴 带**真实参数**进交易详情。只传 hash 的话,tx 页缺参会按 hash 播种随机编一个金额
 * (50~10000)、网络硬回落 Ethereum、时间也是随机的 —— 用户点自己那笔 $30 的提现,
 * 看到的是「$4,312.77 · Ethereum Mainnet」,一笔跟他毫无关系的交易(2026-08-01 审计)。
 * 入金侧早就焊了这道防线(deposit-usdt-pane「tx 页入参优先,防种子假数据与本笔矛盾」),
 * 账单侧一直没焊 —— 同型只修了一半的典型。
 */
function goBill(b: Bill) {
  const p = new URLSearchParams({ hash: billHash(b) });
  // 金额:USDT 用绝对值(tx 页展示的是转账额,方向由类型体现);NEX 不是链上转账,不喂金额
  if (b.symbol === "USDT") p.set("amount", Math.abs(b.amount).toFixed(2));
  const net = billNetwork(b);
  if (net) p.set("net", net);
  p.set("age", String(Math.max(1, Math.round((Date.now() - b.ts) / 60_000))));
  navTo(`/pages/tx/hash?${p.toString()}`);
}

/**
 * 从账单 memo 里认出链(提现/充值的 memo 带 `USDT-TRC20` 这类网络标识)。认不出就不传,让 tx 页走默认。
 * ⚠️ 必须返回**大写**:tx 页的 NET_LINES 键是 TRC20 / ERC20 / BEP20,且它用 `options.net in NET_LINES`
 * 做白名单校验 —— 传小写会被静默丢弃,参数「传了」但没生效,退化成随机编数(这类假修最难发现)。
 */
function billNetwork(b: Bill): string | null {
  const m = /USDT-(TRC20|ERC20|BEP20)/i.exec(b.memo);
  return m ? m[1].toUpperCase() : null;
}

// ── styles ──
// Mirrors prototype shared SegmentedControl (segmented-control.tsx):
// container gap-0.5(2px)/p-1(4px)/rounded-2xl(16px) L1 surface bg; segment
// h-11(44px)/rounded-[10px]; active = brand-filled indicator + on-brand text.
// Header→content breathing is global (SubPageHeader 24px); no extra top offset.
const segWrapStyle: CSSProperties = {
  margin: "0 16px 12px",
  // 轨道贴页面底:surface-2 与页面底同色不可辨(亮色 ΔE 2.2),改 L1 surface;选中 pill 是 brand 实底,不撞色
  background: "var(--v5-surface)",
  borderRadius: "16px",
  padding: "4px",
  gap: "2px",
};
function pillStyle(tb: Tab): CSSProperties {
  const on = tab.value === tb;
  return {
    height: "44px",
    borderRadius: "10px",
    background: on ? "var(--v5-brand)" : "transparent",
  };
}
function pillLabelStyle(tb: Tab): CSSProperties {
  const on = tab.value === tb;
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: "-0.005em",
    color: on ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}
function tabLabel(tb: Tab): string {
  if (tb === "all") return t.value.bills.tabAll;
  if (tb === "in") return t.value.bills.tabIn;
  return t.value.bills.tabOut;
}

// Empty state (de-card white-list): dashed outline, no fill.
const emptyStyle: CSSProperties = {
  margin: "0 16px",
  border: "1px dashed var(--v5-border-strong)",
  borderRadius: "16px",
  padding: "32px",
  textAlign: "center",
};
const emptyTextStyle: CSSProperties = { fontSize: "13px", color: "var(--v5-ink-2)" };

const listWrapStyle: CSSProperties = { margin: "0 16px 12px" };
// Transparent hairline group per month: container border-top opens it, the mono
// month header + rows carry their own dividers (first row = no top border).
const sectionStyle: CSSProperties = {
  marginBottom: "20px",
  padding: "0 2px",
  borderTop: "1px solid var(--v5-border)",
};
const monthHeaderStyle: CSSProperties = {
  padding: "8px 0",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--v5-border)",
};
function rowStyle(i: number): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 0",
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
  fontSize: "13px",
  fontWeight: 500,
  color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)",
};
function statusBadgeStyle(s: BillStatus): CSSProperties {
  const base: CSSProperties = {
    fontSize: "12px",
    padding: "1px 6px",
    borderRadius: "4px",
  };
  // 行是透明 hairline 组,badge 直接坐在页面底上:原 surface-2 与页面底同色不可辨,改 L1 surface。
  if (s === "posted") return { ...base, background: "var(--v5-surface)", color: "var(--v5-ink-3)" };
  if (s === "pending")
    return { ...base, background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)", color: "var(--v5-warning)" };
  return { ...base, background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)", color: "var(--v5-brand-2)" };
}
const memoStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-3)" };
const timeStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-4)" };
function amountStyle(amount: number): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "13px",
    fontWeight: 600,
    color: amount >= 0 ? "var(--v5-brand)" : "var(--v5-brand-2)",
    fontVariantNumeric: "tabular-nums",
  };
}
const balanceAfterStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-4)" };
const footerStyle: CSSProperties = {
  margin: "12px 24px 24px",
  textAlign: "center",
  fontSize: "12px",
  color: "var(--v5-ink-4)",
  lineHeight: 1.625,
};
</script>
