<!--
  Binary — ported from Nexion-prototype/app/(main)/team/binary/page.tsx.
  Balance Match (Track A vs Track B): match = min(A,B)/30 × 10%, daily cap from
  phase (P1-P3 $5K → P4+ $2K). Blocked if either track < $1,000/mo. Hero →
  block warning → 2 wing cards (top member + VBadge) → strong/weak gap → auto-
  placement entry → recent matches. Sub-page → <AppChassis active="team"> with
  in-page back row. Reuses network + commission stores + use-product-phase.
  De-MLM'd copy preserved (Track A/B / 平衡匹配, no "binary leg"/"spillover" in UI).
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <!-- In-page header: back -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <text class="block" :style="headerTitleStyle">{{ t.binary.pageTitle }}</text>
      </view>

      <!-- How-it-works entry -->
      <view class="px-4 flex items-center justify-end" style="padding-top: 8px; padding-bottom: 8px">
        <view class="inline-flex items-center active:opacity-80" :style="howItWorksStyle" @click="go('/pages/team/binary-how')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <text>{{ t.binary.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </view>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- match hero -->
        <view class="rounded-2xl text-center" :style="heroStyle">
          <text class="block font-mono-tabular" :style="heroCapStyle">{{ t.binary.estimate }}</text>
          <text class="block font-display tabular-nums" :style="heroAmtStyle">+${{ match.toFixed(2) }}</text>
          <text class="block" :style="heroFormulaStyle">{{ formulaText }}</text>
        </view>

        <!-- blocked warning -->
        <view v-if="blocked" class="rounded-2xl border flex items-start" :style="blockedStyle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          <view style="font-size: 12px; line-height: 1.4">
            <text class="block" :style="{ color: 'var(--v5-ink)', fontWeight: 600 }">{{ t.binary.blocked }}</text>
            <text class="block" :style="{ color: 'var(--v5-ink-3)', marginTop: '4px' }">{{ blockedDetailText }} {{ t.binary.blockedAction }}</text>
            <view class="inline-flex items-center active:opacity-70" :style="inviteCtaStyle" @click="go('/pages/team/team')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>
              <text>{{ t.binary.inviteCta }}</text>
            </view>
          </view>
        </view>

        <!-- two wings -->
        <view class="grid grid-cols-2" style="gap: 10px">
          <view v-for="wing in wings" :key="wing.key" class="rounded-2xl" :style="wingStyle(wing.isWeak)">
            <view class="flex items-center justify-between">
              <text class="font-display" :style="{ fontSize: '13.5px', fontWeight: 600, color: wing.color }">{{ wing.name }}</text>
              <text v-if="wing.isWeak" class="font-mono-tabular" :style="weakBadgeStyle">{{ t.binary.weakBadge }}</text>
            </view>
            <text class="block font-display tabular-nums" :style="wingVolStyle">${{ wing.monthVol.toLocaleString() }}</text>
            <text class="block" :style="{ fontSize: '10.5px', color: 'var(--v5-ink-3)', marginTop: '4px' }">{{ wingMembersText(wing.count) }}</text>
            <view v-if="wing.top" class="flex items-center border-t" :style="topMemberStyle">
              <text :style="{ fontSize: '14px' }">{{ wing.top.avatar }}</text>
              <view class="flex-1 min-w-0">
                <text class="block truncate" :style="{ fontSize: '11px' }">{{ wing.top.name }}</text>
                <view class="flex items-center" style="gap: 4px; margin-top: 2px">
                  <VBadge :v="wing.top.vRank" size="sm" :show-title="false" />
                  <text class="font-mono-tabular" :style="{ fontSize: '10px', color: 'var(--v5-ink-3)' }">${{ wing.top.monthVolumeUSD }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- strong / weak gap -->
        <view class="rounded-2xl border" :style="cardStyle">
          <text class="block font-mono-tabular" :style="gapCapStyle">{{ t.binary.strongWeakGap }}</text>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <view>
              <view class="flex items-center justify-between" style="font-size: 11px; margin-bottom: 4px">
                <text :style="{ color: 'var(--v5-ink)' }">{{ t.binary.strong }} ${{ strongVol.toLocaleString() }}</text>
                <text class="font-mono-tabular" :style="{ color: 'var(--v5-ink-3)' }">100%</text>
              </view>
              <view class="rounded-full overflow-hidden" :style="gapBarTrackStyle">
                <view class="h-full rounded-full" :style="{ width: '100%', background: 'var(--v5-brand)' }" />
              </view>
            </view>
            <view>
              <view class="flex items-center justify-between" style="font-size: 11px; margin-bottom: 4px">
                <text :style="{ color: 'var(--v5-ink)' }">{{ t.binary.weak }} ${{ weakVol.toLocaleString() }}</text>
                <text class="font-mono-tabular" :style="{ color: 'var(--v5-warning)' }">{{ strongVol > 0 ? ((weakVol / strongVol) * 100).toFixed(0) : 0 }}%</text>
              </view>
              <view class="rounded-full overflow-hidden" :style="gapBarTrackStyle">
                <view class="h-full rounded-full" :style="{ width: strongVol > 0 ? `${(weakVol / strongVol) * 100}%` : '0%', background: 'var(--v5-warning)' }" />
              </view>
            </view>
            <text class="block" :style="{ fontSize: '10.5px', color: 'var(--v5-ink-3)', marginTop: '8px', lineHeight: 1.4 }">{{ t.binary.gapHint }}</text>
          </view>
        </view>

        <!-- auto-placement entry -->
        <view class="rounded-2xl border active:opacity-95" :style="spilloverStyle" @click="go('/pages/team/unilevel')">
          <view class="flex items-start" style="gap: 10px">
            <view class="rounded-lg grid place-items-center shrink-0" :style="spilloverIconStyle">
              <text :style="{ fontSize: '20px' }">↳</text>
            </view>
            <view class="flex-1">
              <text class="block" :style="{ fontSize: '13.5px', fontWeight: 600, color: 'var(--v5-ink)' }">{{ spilloverTitleText }}</text>
              <text class="block" :style="{ fontSize: '11px', color: 'var(--v5-ink-3)', marginTop: '2px', lineHeight: 1.4 }">{{ t.binary.spilloverHint }}</text>
            </view>
          </view>
        </view>

        <!-- recent matches -->
        <view v-if="recentBinaries.length > 0" class="rounded-2xl border overflow-hidden" :style="cardFlushStyle">
          <text class="block font-mono-tabular" :style="recentCapStyle">{{ t.binary.recentMatches }}</text>
          <view
            v-for="(e, i) in recentBinaries"
            :key="e.id"
            class="flex items-center"
            :style="recentRowStyle(i === recentBinaries.length - 1)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>
            <view class="flex-1 min-w-0">
              <text class="block" :style="{ fontSize: '12px', color: 'var(--v5-ink)' }">{{ e.sourceUserName }}</text>
              <text class="block font-mono-tabular" :style="{ fontSize: '10px', color: 'var(--v5-ink-3)', marginTop: '2px' }">{{ new Date(e.ts).toLocaleDateString() }}</text>
            </view>
            <text class="font-mono-tabular tabular-nums" :style="{ fontSize: '13.5px', color: 'var(--v5-warning)', fontWeight: 600 }">+${{ e.amountUSDT.toFixed(2) }}</text>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import VBadge from "@/components/team/v-badge.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNetwork, type NetworkMember } from "@/store/network";
import { useCommission } from "@/store/commission";
import { useProductPhase } from "@/composables/use-product-phase";

const t = useT();
const network = useNetwork();
const commission = useCommission();
const phase = useProductPhase();

const MIN_THRESHOLD = 1000;
const MATCH_RATE = 0.1;

const DAILY_CAP = computed(() => phase.value.binaryDailyCapUSD);
const sides = computed(() => network.byBinary());
const leftMonthVol = computed(() => network.leftVolumeMonth());
const rightMonthVol = computed(() => network.rightVolumeMonth());
const leftDailyAvg = computed(() => leftMonthVol.value / 30);
const rightDailyAvg = computed(() => rightMonthVol.value / 30);
const weakSide = computed(() => (leftMonthVol.value <= rightMonthVol.value ? "left" : "right"));
const weakVol = computed(() => Math.min(leftMonthVol.value, rightMonthVol.value));
const strongVol = computed(() => Math.max(leftMonthVol.value, rightMonthVol.value));
const match = computed(() =>
  Math.min(Math.min(leftDailyAvg.value, rightDailyAvg.value) * MATCH_RATE, DAILY_CAP.value),
);
const blocked = computed(() => leftMonthVol.value < MIN_THRESHOLD || rightMonthVol.value < MIN_THRESHOLD);

const recentBinaries = computed(() =>
  commission.events.filter((e) => e.kind === "binary").slice(0, 5),
);
const spilloverCount = computed(() => network.members.filter((m) => m.isSpillover).length);

function topOf(members: NetworkMember[]): NetworkMember | undefined {
  return [...members].sort((a, b) => b.monthVolumeUSD - a.monthVolumeUSD)[0];
}

interface Wing {
  key: string;
  name: string;
  count: number;
  monthVol: number;
  isWeak: boolean;
  color: string;
  top: NetworkMember | undefined;
}
const wings = computed<Wing[]>(() => [
  {
    key: "left",
    name: t.value.binary.leftWing,
    count: sides.value.left.length,
    monthVol: leftMonthVol.value,
    isWeak: weakSide.value === "left",
    color: "var(--v5-brand)",
    top: topOf(sides.value.left),
  },
  {
    key: "right",
    name: t.value.binary.rightWing,
    count: sides.value.right.length,
    monthVol: rightMonthVol.value,
    isWeak: weakSide.value === "right",
    color: "var(--v5-tech-cyan)",
    top: topOf(sides.value.right),
  },
]);

const formulaText = computed(() =>
  fmt(t.value.binary.formula, { l: leftDailyAvg.value.toFixed(0), r: rightDailyAvg.value.toFixed(0) }),
);
const blockedDetailText = computed(() =>
  fmt(t.value.binary.blockedDetail, {
    side: weakSide.value === "left" ? t.value.binary.left : t.value.binary.right,
    vol: weakVol.value.toFixed(0),
  }),
);
const spilloverTitleText = computed(() =>
  fmt(t.value.binary.spilloverTitle, { n: spilloverCount.value }),
);
function wingMembersText(n: number): string {
  return fmt(t.value.binary.monthVolMembers, { n });
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/team/team", fail: () => {} }) });
}
function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// ─── styles ───
const headerStyle: CSSProperties = { gap: "8px", padding: "8px 14px 4px" };
const backBtnStyle: CSSProperties = { width: "36px", height: "36px", marginLeft: "-6px" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};
const howItWorksStyle: CSSProperties = {
  gap: "8px",
  padding: "0 14px",
  minHeight: "44px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};
const heroStyle: CSSProperties = {
  padding: "16px",
  background:
    "radial-gradient(80% 60% at 50% 0%, rgba(245,165,36,0.20) 0%, transparent 65%), linear-gradient(180deg, #1A1610 0%, #0E0E0E 100%)",
  border: "1px solid rgba(245,165,36,0.30)",
};
const heroCapStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-warning)" };
const heroAmtStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "48px",
  fontWeight: 600,
  lineHeight: 1,
  color: "var(--v5-warning)",
};
const heroFormulaStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "8px" };

const blockedStyle: CSSProperties = {
  padding: "14px",
  gap: "10px",
  background: "color-mix(in srgb, var(--v5-brand-2) 12%, transparent)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const inviteCtaStyle: CSSProperties = {
  marginTop: "8px",
  gap: "4px",
  fontSize: "11px",
  color: "var(--v5-brand)",
  textDecoration: "underline",
};

function wingStyle(isWeak: boolean): CSSProperties {
  return {
    padding: "14px",
    background: "#0F0F0F",
    border: `1px solid ${isWeak ? "rgba(245,165,36,0.40)" : "rgba(255,255,255,0.06)"}`,
  };
}
const weakBadgeStyle: CSSProperties = {
  fontSize: "10px",
  background: "color-mix(in srgb, var(--v5-warning) 20%, transparent)",
  color: "var(--v5-warning)",
  padding: "2px 6px",
  borderRadius: "4px",
};
const wingVolStyle: CSSProperties = { marginTop: "8px", fontSize: "20px", fontWeight: 600, lineHeight: 1 };
const topMemberStyle: CSSProperties = {
  marginTop: "10px",
  paddingTop: "10px",
  borderColor: "var(--v5-border)",
  gap: "6px",
};

const cardStyle: CSSProperties = {
  padding: "16px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const cardFlushStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const gapCapStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-ink-3)",
  marginBottom: "10px",
};
const gapBarTrackStyle: CSSProperties = { height: "8px", background: "color-mix(in srgb, var(--v5-surface-2) 50%, transparent)" };

const spilloverStyle: CSSProperties = {
  padding: "14px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const spilloverIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  background: "color-mix(in srgb, var(--v5-brand-2) 20%, transparent)",
};

const recentCapStyle: CSSProperties = {
  padding: "12px 16px 8px",
  fontSize: "10px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink-3)",
};
function recentRowStyle(isLast: boolean): CSSProperties {
  return {
    padding: "10px 16px",
    gap: "10px",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
</script>
