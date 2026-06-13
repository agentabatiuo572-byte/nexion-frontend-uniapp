<!--
  V Rank — ported from Nexion-prototype/app/(main)/team/rank/page.tsx.
  My-rank hero (VBadgeIcon 48 + progress bar to next rank w/ scroll-grow + missing
  list + upgrade CTA → /store) + full 13-rank ladder (VBadgeIcon 36 + conditions +
  perk chips). Sub-page → <AppChassis active="team"> w/ in-page back → /team.
  Reuses v-rank store + nextRankProgress + V_RANKS + useScrollGrowProgress (P-019
  $el-safe). useMemo → computed. lucide → inline <svg>. <Link>→<view @click>.
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.rank.pageTitle" />

      <!-- How-it-works entry -->
      <view class="px-4 flex items-center justify-end" style="padding-top: 8px; padding-bottom: 8px">
        <view class="inline-flex items-center active:opacity-80" :style="howEntryStyle" @click="go('/pages/team/rank-how')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <text>{{ t.rank.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </view>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- My status hero -->
        <view class="rounded-2xl relative overflow-hidden" :style="heroStyle">
          <view aria-hidden :style="heroGlowStyle" />
          <view class="relative">
            <text class="block" :style="heroCapStyle">{{ t.rank.currentRank }}</text>
            <view class="flex items-center" style="margin-top: 8px; gap: 12px">
              <VBadgeIcon :v="myRank" :size="48" />
              <view>
                <text class="block" :style="heroRankStyle">V{{ myRank }} {{ currentDef.title }}</text>
                <text class="block" :style="heroSubStyle">{{ heroSubText }}</text>
              </view>
            </view>

            <view v-if="prog.next" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--v5-border)">
              <view class="flex items-center justify-between" style="font-size: 11px; margin-bottom: 6px">
                <text :style="{ color: 'var(--v5-ink-3)' }">
                  <text>{{ t.rank.next }} </text>
                  <text :style="{ color: 'var(--v5-brand)', fontWeight: 600 }">V{{ prog.next.v }} {{ prog.next.title }}</text>
                </text>
                <text class="font-mono-tabular" :style="{ color: 'var(--v5-brand)' }">{{ Math.round(prog.progressPct * 100) }}%</text>
              </view>
              <view ref="rankBarRef" class="rounded-full overflow-hidden" :style="barTrackStyle">
                <view class="rounded-full" :style="barFillStyle" />
              </view>
              <view v-if="prog.missing.length > 0" style="margin-top: 12px; display: flex; flex-direction: column; gap: 4px">
                <view v-for="(m, i) in prog.missing" :key="i" class="flex items-center" style="gap: 6px">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  <text :style="{ fontSize: '11.5px', color: 'var(--v5-ink-3)' }">{{ m }}</text>
                </view>
              </view>
              <view class="inline-flex items-center active:opacity-90" :style="upgradeCtaStyle" @click="go('/pages/store/store')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <text>{{ t.rank.upgradeCta }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 13-rank ladder -->
        <view class="rounded-2xl border overflow-hidden" :style="ladderCardStyle">
          <view
            v-for="(r, idx) in V_RANKS"
            :key="r.v"
            class="flex items-start"
            :style="rowStyle(rowStatus(r.v), idx === V_RANKS.length - 1)"
          >
            <VBadgeIcon :v="r.v" :size="36" />
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 8px; flex-wrap: wrap">
                <text class="font-display" :style="rowTitleStyle">V{{ r.v }} {{ r.title }}</text>
                <view v-if="rowStatus(r.v) === 'done'" class="flex items-center" style="gap: 2px">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <text :style="{ fontSize: '10px', color: 'var(--v5-brand)', fontWeight: 500 }">{{ t.rank.done }}</text>
                </view>
                <text v-else-if="rowStatus(r.v) === 'current'" class="font-mono-tabular" :style="currentTagStyle">{{ t.rank.current }}</text>
              </view>

              <text class="block" :style="condStyle">{{ formatConditions(r) }}</text>

              <view class="flex" style="margin-top: 8px; gap: 6px; flex-wrap: wrap">
                <text v-if="r.directBonus > 0.05" :style="chipStyle('default')">Direct {{ Math.round(r.directBonus * 100) }}%</text>
                <text v-if="r.unilevelDepth > 1" :style="chipStyle('default')">{{ r.unilevelDepth >= 99 ? "Unlimited extended" : "Extended royalty" }}</text>
                <text v-if="r.peerBonus > 0" :style="chipStyle('default')">Peer {{ Math.round(r.peerBonus * 100) }}%</text>
                <text v-if="r.leadershipVotes > 0" :style="chipStyle('purple')">Pool {{ r.leadershipVotes }} votes</text>
                <text v-if="r.prizeName !== '—'" :style="chipStyle('lemon')">{{ r.prizeIcon }} {{ r.prizeName }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import VBadgeIcon from "@/components/team/v-badge-icon.vue";
import { useT } from "@/i18n/use-t";
import { useVRank, nextRankProgress, V_RANKS, type VRank, type VRankDef } from "@/store/v-rank";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";

const t = useT();
const vState = useVRank();
const { elRef: rankBarRef, inView: rankBarInView } = useScrollGrowProgress();

const myRank = computed(() => vState.myRank);
const currentDef = computed(() => V_RANKS[vState.myRank]);
const prog = computed(() =>
  nextRankProgress({
    myRank: vState.myRank,
    selfBuyUSD: vState.selfBuyUSD,
    directRefs: vState.directRefs,
    teamVolumeUSD: vState.teamVolumeUSD,
    vDownlineCounts: vState.vDownlineCounts,
  }),
);

const heroSubText = computed(() => {
  const d = currentDef.value;
  return `Direct bonus ${Math.round(d.directBonus * 100)}%${d.unilevelDepth > 1 ? " · Extended royalty" : ""}`;
});

function rowStatus(v: VRank): "done" | "current" | "locked" {
  return v < vState.myRank ? "done" : v === vState.myRank ? "current" : "locked";
}

function formatConditions(r: VRankDef): string {
  const c = r.conditions;
  const parts: string[] = [];
  if (c.selfBuyUSD) parts.push(`Self-buy ≥ $${c.selfBuyUSD}`);
  if (c.directRefs) parts.push(`Direct refs ≥ ${c.directRefs}`);
  if (c.teamVolumeUSD) parts.push(`Team $${c.teamVolumeUSD.toLocaleString()}`);
  if (c.vDownlines) {
    for (const [v, n] of Object.entries(c.vDownlines)) {
      parts.push(`${n}× V${v}`);
    }
  }
  return parts.length ? parts.join(" + ") : "Register immediately";
}

function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// ─── styles ───
const howEntryStyle: CSSProperties = {
  gap: "8px",
  padding: "0 14px",
  minHeight: "44px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};

const heroStyle: CSSProperties = { background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "16px" };
const heroGlowStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(45% 55% at 85% 15%, var(--v5-brand-2-soft) 0%, transparent 60%)," +
    "radial-gradient(35% 45% at 15% 90%, var(--v5-brand-soft) 0%, transparent 60%)",
  filter: "blur(8px)",
  pointerEvents: "none",
  opacity: 0.85,
};
const heroCapStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
  letterSpacing: "0.06em",
};
const heroRankStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "24px",
  letterSpacing: "-0.018em",
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const heroSubStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "4px" };

const barTrackStyle: CSSProperties = { height: "8px", background: "color-mix(in srgb, var(--v5-surface-2) 70%, transparent)" };
const barFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  background: "linear-gradient(to right, var(--v5-tech-cyan), var(--v5-brand))",
  width: `${rankBarInView.value ? prog.value.progressPct * 100 : 0}%`,
  transition: rankBarInView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));

const upgradeCtaStyle: CSSProperties = {
  marginTop: "12px",
  gap: "6px",
  height: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  letterSpacing: "-0.005em",
};

const ladderCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "16px" };
function rowStyle(status: "done" | "current" | "locked", isLast: boolean): CSSProperties {
  return {
    padding: "14px 16px",
    gap: "12px",
    background: status === "current" ? "color-mix(in srgb, var(--v5-brand) 4%, transparent)" : "transparent",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
const rowTitleStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, lineHeight: 1.1, color: "var(--v5-ink)" };
const currentTagStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--v5-brand)",
  letterSpacing: "0.06em",
};
const condStyle: CSSProperties = { marginTop: "6px", fontSize: "11px", color: "var(--v5-ink-3)", lineHeight: 1.45 };

function chipStyle(kind: "default" | "purple" | "lemon"): CSSProperties {
  const map = {
    default: { background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)", color: "var(--v5-ink-3)" },
    purple: { background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)", color: "var(--v5-brand-2)" },
    lemon: { background: "color-mix(in srgb, var(--v5-brand) 12%, transparent)", color: "var(--v5-brand)" },
  } as const;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 6px",
    borderRadius: "4px",
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "10.5px",
    letterSpacing: "0.02em",
    ...map[kind],
  };
}
</script>
