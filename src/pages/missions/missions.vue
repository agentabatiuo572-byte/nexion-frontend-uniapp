<!--
  Mission Center — ported from Nexion-prototype/app/(main)/missions/page.tsx.

  Single hub for every task system: hero + sectioned RouteRows (Today /
  This Week / This Month / Day-One / Events / Achievements).

  Wrapped in <AppChassis active="home"> (reached from Home). SetPageHeader
  backHref="/" → SubPageHeader back="/pages/index/index".

  Scope note: the source embeds live <WeeklyQuestHero>/<WeeklyQuestList>/
  <MonthlyChallengeCard> components and computes a day-one quest phase. Those
  quest subsystems are not yet ported to uni, so — to keep this hub
  self-contained — "This Week" / "Day-One" surface as RouteRows pointing at
  their destinations, and "This Month" shows the i18n "launches soon" copy
  (matching monthSoonTitle/Body). The Events row stat IS live: ongoing /
  joined / claimable counts derive from the ported EVENTS mock + event-quest
  store, so the badge + stat line are real.
-->
<template>
  <AppChassis active="home">
    <CardStagger class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/index/index" />

      <!-- Hero -->
      <view class="mx-4 mt-2 relative overflow-hidden" :style="heroStyle">
        <view aria-hidden :style="heroAuroraStyle" />
        <view aria-hidden :style="heroGridStyle" />
        <view class="relative">
          <view class="inline-flex items-center font-mono-tabular" :style="heroChipStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0z" /></svg>
            {{ t.missions.heroLabel }}
          </view>
          <text class="block" :style="heroTitleStyle">{{ t.missions.heroTitle }}</text>
          <text class="block" :style="heroSubtitleStyle">{{ t.missions.heroSubtitle }}</text>
        </view>
      </view>

      <!-- Today -->
      <view :style="sectionStyle">
        <view class="mx-4 flex items-center" :style="sectionHeadStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
          <text :style="sectionTitleStyle">{{ t.missions.todayHeading }}</text>
        </view>
        <view class="mx-4 flex items-center active:opacity-80" :style="rowStyle" @click="go('/pages/daily/daily')">
          <view class="grid place-items-center shrink-0" :style="rowIconBox('var(--v5-brand-2)')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.missions.todayLabel }}</text>
            <text class="block truncate" :style="rowValueStyle">{{ t.missions.todayValue }}</text>
          </view>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>

      <!-- This Week -->
      <view :style="sectionStyle">
        <view class="mx-4 flex items-center" :style="sectionHeadStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /></svg>
          <text :style="sectionTitleStyle">{{ t.missions.weekHeading }}</text>
        </view>
        <view class="mx-4 flex items-center active:opacity-80" :style="rowStyle" @click="go('/pages/daily/daily')">
          <view class="grid place-items-center shrink-0" :style="rowIconBox('var(--v5-brand)')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.missions.weekLabel }}</text>
            <text class="block truncate" :style="rowValueStyle">{{ t.missions.weekValue }}</text>
          </view>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>

      <!-- This Month -->
      <view :style="sectionStyle">
        <view class="mx-4 flex items-center" :style="sectionHeadStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M17 14h-6" /><path d="M13 18H7" /><path d="M7 14h.01" /><path d="M17 18h.01" /></svg>
          <text :style="sectionTitleStyle">{{ t.missions.monthHeading }}</text>
        </view>
        <view class="mx-4 rounded-xl border" :style="monthCardStyle">
          <view class="flex items-center" style="gap: 10px">
            <view class="grid place-items-center shrink-0" :style="rowIconBox('var(--v5-warning)')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="rowLabelStyle">{{ t.missions.monthSoonTitle }}</text>
              <text class="block" :style="monthBodyStyle">{{ t.missions.monthSoonBody }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Events -->
      <view :style="sectionStyle">
        <view class="mx-4 flex items-center" :style="sectionHeadStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          <text :style="sectionTitleStyle">{{ t.missions.eventsHeading }}</text>
        </view>
        <view class="mx-4 flex items-center active:opacity-80" :style="rowStyle" @click="go('/pages/events/events')">
          <view class="grid place-items-center shrink-0" :style="rowIconBox('var(--v5-warning)')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <view class="flex items-center" style="gap: 6px">
              <text :style="rowLabelStyle">{{ t.missions.eventsLabel }}</text>
              <text v-if="eventStats.claimable > 0" class="inline-flex items-center justify-center tabular-nums font-mono-tabular" :style="badgeStyle">{{ eventStats.claimable }}</text>
            </view>
            <text class="block truncate" :style="rowValueStyle">{{ eventStatText }}</text>
          </view>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>

      <!-- Achievements -->
      <view :style="sectionStyle">
        <view class="mx-4 flex items-center" :style="sectionHeadStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0z" /></svg>
          <text :style="sectionTitleStyle">{{ t.missions.achievementsHeading }}</text>
        </view>
        <view class="mx-4 flex items-center active:opacity-80" :style="rowStyle" @click="go('/pages/me/achievements')">
          <view class="grid place-items-center shrink-0" :style="rowIconBox('var(--v5-success)')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0z" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.missions.achievementsLabel }}</text>
            <text class="block truncate" :style="rowValueStyle">{{ t.missions.achievementsValue }}</text>
          </view>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CardStagger from "@/components/card-stagger.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useEventQuest } from "@/store/event-quest";
import { EVENTS } from "@/mock/events";

const t = useT();
const eventQuest = useEventQuest();

// Live Events row stat — ongoing / joined / claimable from the ported mock +
// store (claimable = trackable + done + not yet claimed).
const eventStats = computed(() => {
  const ongoing = EVENTS.filter((ev) => ev.status === "ongoing").length;
  let joined = 0;
  let claimable = 0;
  for (const ev of EVENTS) {
    const trackable = ev.trackable === true;
    const isJoined = trackable ? eventQuest.isJoined(ev.id) : ev.joined;
    if (isJoined && ev.status !== "ended") joined += 1;
    if (trackable && (ev.done ?? false) && !eventQuest.isClaimed(ev.id)) claimable += 1;
  }
  return { ongoing, joined, claimable };
});

const eventStatText = computed(() =>
  fmt(t.value.missions.eventsStat, {
    ongoing: eventStats.value.ongoing,
    joined: eventStats.value.joined,
    claimable: eventStats.value.claimable,
  }),
);

function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// ── styles ──
const heroStyle: CSSProperties = {
  position: "relative",
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const heroAuroraStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(40% 50% at 80% 20%, var(--v5-success-soft) 0%, transparent 60%)," +
    "radial-gradient(40% 50% at 10% 80%, var(--v5-brand-soft) 0%, transparent 60%)," +
    "radial-gradient(35% 45% at 70% 90%, rgba(255,203,148,0.20) 0%, transparent 60%)",
  filter: "blur(8px)",
  pointerEvents: "none",
  opacity: 0.85,
  animation: "v5-aurora-drift 14s ease-in-out infinite",
};
const heroGridStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  backgroundImage:
    "linear-gradient(to right, color-mix(in srgb, var(--v5-ink) 4%, transparent) 1px, transparent 1px)," +
    "linear-gradient(to bottom, color-mix(in srgb, var(--v5-ink) 4%, transparent) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  pointerEvents: "none",
};
const heroChipStyle: CSSProperties = {
  gap: "6px",
  padding: "3px 9px",
  borderRadius: "999px",
  background: "var(--v5-success-soft)",
  border: "1px solid color-mix(in srgb, var(--v5-success) 30%, transparent)",
  color: "var(--v5-success)",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
};
const heroTitleStyle: CSSProperties = {
  marginTop: "14px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "26px",
  letterSpacing: "-0.022em",
  lineHeight: 1.2,
  color: "var(--v5-ink)",
};
const heroSubtitleStyle: CSSProperties = {
  marginTop: "10px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  color: "var(--v5-ink-2)",
  lineHeight: 1.55,
};
const sectionStyle: CSSProperties = { marginTop: "18px" };
const sectionHeadStyle: CSSProperties = { gap: "8px", marginBottom: "10px" };
const sectionTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const rowStyle: CSSProperties = {
  gap: "12px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
function rowIconBox(tint: string): CSSProperties {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    background: `color-mix(in srgb, ${tint} 10%, transparent)`,
  };
}
const rowLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const rowValueStyle: CSSProperties = {
  marginTop: "2px",
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
};
const badgeStyle: CSSProperties = {
  minWidth: "18px",
  height: "18px",
  padding: "0 5px",
  borderRadius: "999px",
  background: "var(--v5-warning)",
  color: "var(--v5-on-brand)",
  fontSize: "10px",
  fontWeight: 500,
};
const monthCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "14px",
};
const monthBodyStyle: CSSProperties = {
  marginTop: "3px",
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.45,
};
</script>
