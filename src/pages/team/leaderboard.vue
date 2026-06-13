<!--
  Global Leaderboard — ported from
  Nexion-prototype/app/(main)/team/leaderboard/page.tsx.
  Prize-pool hero (period-specific) + period segmented tabs (today/week/month/all)
  + my-rank card (rank + gap-to-next + share CTA) + podium (#2/#1/#3 layout, #1
  raised) + reward rows + rest list (#4-#100 grid rows) + share CTA + footer note.
  Sub-page → <AppChassis active="team"> w/ back → /team. SegmentedControl →
  inline pill tabs (events.vue pattern). LEADERBOARD mock ported to src/mock.
  React local/memo state → ref/computed. <Link>→<view @click>. lucide → inline <svg>.
-->
<template>
  <AppChassis active="team">
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.leaderboard.pageTitle" />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px; padding-top: 4px">
        <!-- Prize pool hero -->
        <view class="relative overflow-hidden rounded-2xl" :style="heroStyle">
          <view aria-hidden :style="heroGlowStyle('warning')" />
          <view class="relative flex items-start justify-between">
            <view>
              <text class="block font-mono-tabular" :style="heroCapStyle('var(--v5-warning)')">{{ t.leaderboard.pool.label }} · {{ prize.label }}</text>
              <text class="block font-display tabular-nums" :style="heroBigStyle">{{ fmtCompactUSD(prize.poolUSD) }}</text>
              <text class="block" :style="{ fontSize: '12px', color: 'var(--v5-ink-3)', marginTop: '6px' }">{{ payoutToText }}</text>
            </view>
            <view class="rounded-2xl grid place-items-center" :style="heroIconStyle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
            </view>
          </view>
          <view class="flex items-center justify-between" :style="heroFooterStyle">
            <text :style="{ color: 'var(--v5-ink-3)' }">{{ t.leaderboard.pool.resetsIn }}</text>
            <text class="font-mono-tabular" :style="{ color: 'var(--v5-ink-2)' }">{{ prize.resetsIn }}</text>
          </view>
        </view>

        <!-- Period tabs -->
        <view class="flex" :style="segWrapStyle">
          <view v-for="p in PERIODS" :key="p" class="flex-1 grid place-items-center active:opacity-70" :style="pillStyle(p)" @click="period = p">
            <text :style="pillLabelStyle(p)">{{ t.leaderboard.periods[p] }}</text>
          </view>
        </view>

        <!-- My rank -->
        <view class="rounded-2xl relative overflow-hidden" :style="myRankStyle">
          <view aria-hidden :style="heroGlowStyle('brand')" />
          <view class="relative flex items-center justify-between">
            <view>
              <text class="block font-mono-tabular" :style="heroCapStyle('var(--v5-brand-2)')">{{ t.leaderboard.myRank.label }}</text>
              <view class="flex items-baseline" style="margin-top: 4px; gap: 6px">
                <text class="font-display tabular-nums" :style="myRankBigStyle">#{{ me.rank }}</text>
                <text :style="{ fontSize: '12px', color: 'var(--v5-ink-3)' }">/ {{ rows.length.toLocaleString() }}+</text>
              </view>
              <view class="flex items-center" style="margin-top: 8px; gap: 6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
                <text :style="{ fontSize: '12px', color: 'var(--v5-warning)' }">{{ gapText }}</text>
              </view>
            </view>
            <view class="flex items-center active:opacity-90" :style="climbCtaStyle" @click="go('/pages/team/team')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
              <text :style="{ color: 'var(--v5-on-brand)' }">{{ t.leaderboard.myRank.climb }}</text>
            </view>
          </view>
        </view>

        <!-- Podium (Top 3) -->
        <view class="rounded-2xl" :style="podiumCardStyle">
          <view class="grid grid-cols-3" style="gap: 8px; align-items: flex-end">
            <view v-for="(p, displayIdx) in podiumDisplay" :key="p.row.rank" class="rounded-xl text-center" :style="podiumColStyle(p.isFirst)">
              <text class="block" style="font-size: 24px; line-height: 1">{{ p.prize.medal }}</text>
              <view class="rounded-full grid place-items-center" :style="podiumAvatarStyle(p.prize.color)">
                <text :style="{ color: 'var(--v5-ink)', fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '13px' }">{{ p.row.handle.charAt(0) }}</text>
              </view>
              <text class="block truncate" :style="podiumHandleStyle">{{ p.row.handle }}</text>
              <text class="block" :style="{ fontSize: '11px' }">{{ p.row.flag }}</text>
              <text class="block font-mono-tabular tabular-nums" :style="podiumEarnStyle(p.prize.color)">{{ fmtCompactUSD(p.row.earnedUSDT) }}</text>
              <text class="block" :style="{ marginTop: '2px', fontSize: '10.5px', color: 'var(--v5-ink-3)' }">{{ p.row.directs }} directs</text>
            </view>
          </view>
          <view style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px">
            <view v-for="(p, i) in PODIUM_PRIZE" :key="i" class="flex items-center justify-between" style="font-size: 11px">
              <view class="flex items-center" style="gap: 6px">
                <text>{{ p.medal }}</text>
                <text :style="{ color: 'var(--v5-ink-3)' }">#{{ i + 1 }}</text>
              </view>
              <text :style="{ color: 'var(--v5-ink-2)' }">{{ p.reward }}</text>
            </view>
          </view>
        </view>

        <!-- Rest list (#4-#100) -->
        <view class="rounded-2xl border overflow-hidden" :style="listCardStyle">
          <view class="grid items-center" :style="listHeadStyle">
            <text>{{ t.leaderboard.columns.rank }}</text>
            <text>{{ t.leaderboard.columns.inviter }}</text>
            <text class="text-right">{{ t.leaderboard.columns.directs }}</text>
            <text class="text-right">{{ t.leaderboard.columns.earned }}</text>
          </view>
          <view
            v-for="(row, i) in rest"
            :key="row.rank"
            class="grid items-center"
            :style="listRowStyle(i === rest.length - 1)"
          >
            <text class="font-mono-tabular tabular-nums" :style="{ color: 'var(--v5-ink-3)', fontSize: '11px' }">{{ row.rank }}</text>
            <view class="flex items-center min-w-0" style="gap: 8px">
              <view class="rounded-full grid place-items-center shrink-0" :style="rowAvatarStyle">
                <text :style="{ color: 'var(--v5-ink)', fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '11.5px' }">{{ row.handle.charAt(0) }}</text>
              </view>
              <view class="min-w-0">
                <view class="flex items-center" style="gap: 6px">
                  <text class="truncate" :style="{ fontWeight: 600, color: 'var(--v5-ink)', fontSize: '12.5px' }">{{ row.handle }}</text>
                  <text :style="{ fontSize: '10px' }">{{ row.flag }}</text>
                  <svg v-if="row.hasDevice" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></svg>
                </view>
                <view class="flex items-center" style="margin-top: 2px; gap: 6px">
                  <text class="font-mono-tabular" :style="vRankChipStyle">V{{ row.vRank }}</text>
                  <text class="font-mono-tabular tabular-nums" :style="{ fontSize: '10px', color: 'var(--v5-ink-4)' }">{{ row.teamSize.toLocaleString() }} team</text>
                  <text v-if="row.delta !== 0" class="font-mono-tabular tabular-nums" :style="{ fontSize: '10px', color: row.delta > 0 ? 'var(--v5-brand)' : 'var(--v5-brand-2)' }">{{ row.delta > 0 ? "↑" : "↓" }}{{ Math.abs(row.delta) }}</text>
                </view>
              </view>
            </view>
            <text class="text-right font-mono-tabular tabular-nums" :style="{ color: 'var(--v5-ink-2)' }">{{ row.directs }}</text>
            <text class="text-right font-mono-tabular tabular-nums" :style="{ fontWeight: 600, color: 'var(--v5-brand)' }">{{ fmtCompactUSD(row.earnedUSDT) }}</text>
          </view>
        </view>

        <!-- Share CTA -->
        <view style="padding-top: 4px">
          <view class="flex items-center justify-center active:opacity-90" :style="shareCtaStyle" @click="go('/pages/team/team')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
            <text :style="{ color: 'var(--v5-on-brand)' }">{{ t.leaderboard.cta.share }}</text>
          </view>
        </view>

        <!-- footer note -->
        <text class="block text-center" :style="footerNoteStyle">{{ t.leaderboard.note }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { LEADERBOARD, PERIOD_PRIZE, PODIUM_PRIZE, MY_RANK, type LeaderPeriod } from "@/mock/leaderboard";

const t = useT();
const PERIODS: LeaderPeriod[] = ["today", "week", "month", "all"];
const period = ref<LeaderPeriod>("week");

const rows = computed(() => LEADERBOARD[period.value]);
const prize = computed(() => PERIOD_PRIZE[period.value]);
const me = computed(() => MY_RANK[period.value]);
const top3 = computed(() => rows.value.slice(0, 3));
const rest = computed(() => rows.value.slice(3));

// Podium display order: #2 (left) / #1 (center, raised) / #3 (right)
const podiumDisplay = computed(() => {
  const order = [top3.value[1], top3.value[0], top3.value[2]];
  return order
    .map((row, idx) => {
      if (!row) return null;
      const actualIdx = idx === 0 ? 1 : idx === 1 ? 0 : 2;
      return { row, prize: PODIUM_PRIZE[actualIdx], isFirst: actualIdx === 0 };
    })
    .filter((x): x is { row: (typeof rows.value)[number]; prize: (typeof PODIUM_PRIZE)[number]; isFirst: boolean } => x !== null);
});

const payoutToText = computed(() => fmt(t.value.leaderboard.pool.payoutTo, { n: prize.value.topN }));
const gapText = computed(() => fmt(t.value.leaderboard.myRank.gap, { amount: me.value.gapToNext.toLocaleString() }));

function fmtCompactUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// ─── styles ───
const heroStyle: CSSProperties = { padding: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)" };
function heroGlowStyle(kind: "warning" | "brand"): CSSProperties {
  const bg =
    kind === "warning"
      ? "radial-gradient(45% 55% at 85% 15%, var(--v5-warning-soft) 0%, transparent 60%)," +
        "radial-gradient(35% 45% at 15% 90%, rgba(255,203,148,0.20) 0%, transparent 60%)"
      : "radial-gradient(45% 55% at 85% 15%, var(--v5-brand-2-soft) 0%, transparent 60%)," +
        "radial-gradient(35% 45% at 15% 90%, var(--v5-brand-soft) 0%, transparent 60%)";
  return { position: "absolute", inset: "-20%", background: bg, filter: "blur(8px)", pointerEvents: "none", opacity: 0.85 };
}
function heroCapStyle(color: string): CSSProperties {
  return { fontSize: "11px", fontWeight: 500, color, letterSpacing: "0.06em" };
}
const heroBigStyle: CSSProperties = { marginTop: "8px", fontSize: "30px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.022em", color: "var(--v5-warning)" };
const heroIconStyle: CSSProperties = { width: "48px", height: "48px", background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)" };
const heroFooterStyle: CSSProperties = { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--v5-border)", fontSize: "11px" };

const segWrapStyle: CSSProperties = { background: "var(--v5-surface-2)", borderRadius: "12px", padding: "3px", gap: "2px" };
function pillStyle(p: LeaderPeriod): CSSProperties {
  const on = period.value === p;
  return { height: "34px", borderRadius: "9px", background: on ? "var(--v5-surface)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none" };
}
function pillLabelStyle(p: LeaderPeriod): CSSProperties {
  const on = period.value === p;
  return { fontSize: "11.5px", fontWeight: on ? 600 : 500, color: on ? "var(--v5-ink)" : "var(--v5-ink-3)" };
}

const myRankStyle: CSSProperties = { padding: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)" };
const myRankBigStyle: CSSProperties = { fontSize: "26px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.022em", color: "var(--v5-ink)" };
const climbCtaStyle: CSSProperties = {
  gap: "6px",
  height: "36px",
  padding: "0 14px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "12.5px",
  letterSpacing: "-0.005em",
};

const podiumCardStyle: CSSProperties = { padding: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", borderRadius: "16px" };
function podiumColStyle(isFirst: boolean): CSSProperties {
  return {
    padding: "10px",
    background: isFirst ? "var(--v5-warning-soft)" : "var(--v5-surface-2)",
    transform: isFirst ? "translateY(-6px)" : "none",
  };
}
function podiumAvatarStyle(color: string): CSSProperties {
  return { width: "36px", height: "36px", margin: "6px auto 0", background: color };
}
const podiumHandleStyle: CSSProperties = { marginTop: "6px", fontFamily: "var(--font-v5)", fontWeight: 600, fontSize: "11.5px", color: "var(--v5-ink)" };
function podiumEarnStyle(color: string): CSSProperties {
  return { marginTop: "4px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12.5px", fontWeight: 600, color };
}

const listCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "16px" };
const listHeadStyle: CSSProperties = {
  gridTemplateColumns: "32px 1fr 56px 84px",
  padding: "10px 12px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--v5-border)",
};
function listRowStyle(isLast: boolean): CSSProperties {
  return {
    gridTemplateColumns: "32px 1fr 56px 84px",
    padding: "10px 12px",
    fontSize: "12px",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
const rowAvatarStyle: CSSProperties = { width: "28px", height: "28px", background: "linear-gradient(135deg, var(--v5-success-soft), var(--v5-brand-soft))" };
const vRankChipStyle: CSSProperties = {
  padding: "0 4px",
  borderRadius: "4px",
  background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)",
  fontSize: "10px",
  color: "var(--v5-ink-4)",
};

const shareCtaStyle: CSSProperties = {
  width: "100%",
  gap: "6px",
  height: "50px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
};
const footerNoteStyle: CSSProperties = { paddingTop: "8px", fontSize: "10.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
</script>
