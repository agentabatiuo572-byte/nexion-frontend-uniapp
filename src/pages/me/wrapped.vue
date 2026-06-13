<!--
  Wrapped — ported from Nexion-prototype/app/(main)/me/wrapped/page.tsx.
  Spotify-style year-in-review story carousel (6 cards): hero → total earned →
  devices + active days → network grew → V-rank → share/done. Tap advances; left
  quarter taps back; bottom prev/next + progress bars. Reads app (user/devices/
  earnings), v-rank (myRank + V_RANKS), network (totalMembers), commission
  (lifetime). framer-motion AnimatePresence → CSS `nx-story-in` transition keyed
  on idx. Full-bleed overlay (absolute inset-0, z above chassis header) wrapped
  in <AppChassis active="me">. Gradient literals → token color-mix. Close/Done →
  navigateBack with reLaunch fallback to /pages/me/me.
-->
<template>
  <AppChassis active="me">
    <view :style="overlayStyle" @click="next">
      <!-- Progress bars -->
      <view class="flex shrink-0" :style="barsStyle">
        <view v-for="i in CARDS" :key="i" :style="barTrackStyle">
          <view :style="barFillStyle(i - 1)" />
        </view>
      </view>

      <!-- Close + label -->
      <view class="flex items-center justify-between shrink-0" :style="topRowStyle">
        <view class="grid place-items-center active:opacity-60" style="width: 40px; height: 40px" @click.stop="close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <text class="font-mono-tabular" :style="labelStyle">{{ t.wrapped.label }} · {{ yearLabel }}</text>
        <view style="width: 40px; height: 40px" />
      </view>

      <!-- Card content -->
      <view class="flex-1 relative" style="display: flex; align-items: center; justify-content: center">
        <!-- Left tap zone (back) -->
        <view :style="leftZoneStyle" @click.stop="prev" />

        <view :key="idx" class="nx-story-in" :style="cardStyle">
          <view style="padding: 0 8px; text-align: left">
            <!-- 0: hero -->
            <template v-if="idx === 0">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" /></svg>
              <text class="block font-display" :style="title48Style">{{ t.wrapped.card1Title }}</text>
              <text class="block" :style="body14Style">{{ t.wrapped.card1Body }}</text>
            </template>
            <!-- 1: total earned -->
            <template v-else-if="idx === 1">
              <text class="block font-mono-tabular" :style="kickerStyle('var(--v5-brand)')">{{ t.wrapped.card2Label }}</text>
              <text class="block font-display tabular-nums" :style="bigNumStyle">${{ (totalEarnings + lifetime).toFixed(2) }}</text>
              <text class="block" :style="body14Style">{{ card2BodyText }}</text>
            </template>
            <!-- 2: devices -->
            <template v-else-if="idx === 2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
              <text class="block font-display" :style="num60Style">{{ deviceCount }}</text>
              <text class="block" :style="subBrand2Style">{{ card3DevicesText }}</text>
              <text class="block" :style="body14Style">{{ card3BodyText }}</text>
            </template>
            <!-- 3: network -->
            <template v-else-if="idx === 3">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <text class="block font-display" :style="num72Style">{{ totalMembers }}</text>
              <text class="block" :style="subWarningStyle">{{ t.wrapped.card4Title }}</text>
              <text class="block" :style="body14Style">{{ t.wrapped.card4Body }}</text>
            </template>
            <!-- 4: V-rank -->
            <template v-else-if="idx === 4">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
              <text class="block font-display" :style="num64Style">V{{ myRank }}</text>
              <text class="block" :style="subBrand2Style">{{ vRankTitle }}</text>
              <text class="block" :style="body14Style">{{ t.wrapped.card5Body }}</text>
            </template>
            <!-- 5: share/done -->
            <template v-else>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
              <text class="block font-display" :style="title30Style">{{ t.wrapped.card6Title }}</text>
              <text class="block" :style="body13Style">{{ t.wrapped.card6Body }}</text>
              <view class="flex" style="margin-top: 24px; gap: 8px">
                <view class="flex items-center active:opacity-90" :style="shareBtnStyle" @click.stop="shareWrapped">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
                  <text style="margin-left: 6px" :style="shareBtnTextStyle">{{ t.wrapped.shareCta }}</text>
                </view>
                <view class="flex items-center active:opacity-80" :style="doneBtnStyle" @click.stop="close">
                  <text :style="doneBtnTextStyle">{{ t.wrapped.doneCta }}</text>
                </view>
              </view>
            </template>
          </view>
        </view>

        <!-- Right tap zone (next) -->
        <view :style="rightZoneStyle" @click.stop="next" />
      </view>

      <!-- Bottom prev/next -->
      <view class="flex items-center justify-between shrink-0" :style="bottomRowStyle">
        <view class="grid place-items-center active:opacity-70" :style="navBtnStyle(idx === 0)" @click.stop="prev">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <text class="font-mono-tabular" style="font-size: 10.5px; color: var(--v5-ink-3)">{{ idx + 1 }} / {{ CARDS }}</text>
        <view class="grid place-items-center active:opacity-70" :style="navBtnStyle(idx === CARDS - 1)" @click.stop="next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useApp } from "@/store/app";
import { useVRank, V_RANKS } from "@/store/v-rank";
import { useNetwork } from "@/store/network";
import { useCommission } from "@/store/commission";

const CARDS = 6;

const t = useT();
const app = useApp();
const vRank = useVRank();
const network = useNetwork();
const commission = useCommission();

const idx = ref(0);

const deviceCount = computed(() => app.devices.length);
const totalEarnings = computed(() => app.earnings.total);
const myRank = computed(() => vRank.myRank);
const totalMembers = computed(() => network.totalMembers);
const lifetime = computed(() => commission.totalUSDTLifetime());

const yearLabel = "2026";
const daysActive = computed(() => Math.max(1, Math.floor((Date.now() - app.user.joinedAt) / 86400000)));

const vRankTitle = computed(() => V_RANKS[myRank.value].title);
const card2BodyText = computed(() => fmt(t.value.wrapped.card2Body, { days: String(daysActive.value) }));
const card3DevicesText = computed(() => fmt(t.value.wrapped.card3Devices, { n: String(deviceCount.value) }));
const card3BodyText = computed(() => fmt(t.value.wrapped.card3Body, { days: String(daysActive.value) }));

function next() {
  idx.value = Math.min(CARDS - 1, idx.value + 1);
}
function prev() {
  idx.value = Math.max(0, idx.value - 1);
}
function shareWrapped() {
  toast.success(t.value.wrapped.shareToast);
}
function close() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/me/me", fail: () => {} }) });
}

// ── styles ──
// Full-bleed overlay covering the chassis (header z below this). Pinned to the
// chassis's relative ancestor via absolute inset-0.
const overlayStyle: CSSProperties = {
  position: "absolute",
  left: "0",
  right: "0",
  top: "0",
  bottom: "0",
  zIndex: 110,
  background: "var(--v5-surface)",
  display: "flex",
  flexDirection: "column",
};
const barsStyle: CSSProperties = { padding: "12px 12px 0", gap: "6px" };
const barTrackStyle: CSSProperties = {
  flex: "1",
  height: "3px",
  borderRadius: "999px",
  background: "color-mix(in srgb, white 10%, transparent)",
  overflow: "hidden",
};
function barFillStyle(i: number): CSSProperties {
  return {
    height: "100%",
    width: i <= idx.value ? "100%" : "0%",
    background: "white",
    transition: i === idx.value ? "none" : "width 300ms ease",
  };
}
const topRowStyle: CSSProperties = { padding: "8px 12px 0" };
const labelStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-ink-3)" };
const leftZoneStyle: CSSProperties = { position: "absolute", left: "0", top: "0", bottom: "0", width: "25%", zIndex: 10 };
const rightZoneStyle: CSSProperties = { position: "absolute", right: "0", top: "0", bottom: "0", width: "25%", zIndex: 10 };

// Card gradient per index — token color-mix over near-black (source used dark
// hex tints + brand rgba). Single card style; bg keyed on idx.
const CARD_BG: Record<number, string> = {
  0: "radial-gradient(80% 60% at 50% 30%, color-mix(in srgb, var(--v5-brand) 30%, transparent) 0%, transparent 65%), linear-gradient(180deg, color-mix(in srgb, var(--v5-brand) 8%, var(--v5-on-brand)) 0%, var(--v5-on-brand) 100%)",
  1: "radial-gradient(80% 60% at 100% 0%, color-mix(in srgb, var(--v5-brand) 34%, transparent) 0%, transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--v5-brand) 8%, var(--v5-on-brand)) 0%, var(--v5-on-brand) 100%)",
  2: "radial-gradient(80% 60% at 0% 0%, color-mix(in srgb, var(--v5-brand-2) 30%, transparent) 0%, transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--v5-brand-2) 10%, var(--v5-on-brand)) 0%, var(--v5-on-brand) 100%)",
  3: "radial-gradient(80% 60% at 50% 100%, color-mix(in srgb, var(--v5-warning) 30%, transparent) 0%, transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--v5-warning) 8%, var(--v5-on-brand)) 0%, var(--v5-on-brand) 100%)",
  4: "radial-gradient(80% 60% at 100% 100%, color-mix(in srgb, var(--v5-brand-2) 30%, transparent) 0%, transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--v5-brand-2) 8%, var(--v5-on-brand)) 0%, var(--v5-on-brand) 100%)",
  5: "linear-gradient(160deg, color-mix(in srgb, var(--v5-brand) 16%, transparent), color-mix(in srgb, var(--v5-brand-2) 16%, transparent))",
};
const cardStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: "20px",
  right: "20px",
  top: "0",
  bottom: "0",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  background: CARD_BG[idx.value],
}));

const title48Style: CSSProperties = {
  marginTop: "24px",
  fontSize: "48px",
  fontWeight: 600,
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  color: "var(--v5-ink)",
};
const title30Style: CSSProperties = { marginTop: "24px", fontSize: "30px", fontWeight: 600, lineHeight: 1.1, color: "var(--v5-ink)" };
const body14Style: CSSProperties = {
  marginTop: "12px",
  fontSize: "14px",
  color: "color-mix(in srgb, var(--v5-ink) 80%, transparent)",
  lineHeight: 1.6,
};
const body13Style: CSSProperties = {
  marginTop: "8px",
  fontSize: "13.5px",
  color: "color-mix(in srgb, var(--v5-ink) 80%, transparent)",
  lineHeight: 1.6,
};
function kickerStyle(color: string): CSSProperties {
  return { fontSize: "10px", letterSpacing: "0.18em", color };
}
const bigNumStyle: CSSProperties = { marginTop: "12px", fontSize: "88px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--v5-ink)" };
const num60Style: CSSProperties = { marginTop: "24px", fontSize: "60px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const num64Style: CSSProperties = { marginTop: "24px", fontSize: "64px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const num72Style: CSSProperties = { marginTop: "24px", fontSize: "72px", fontWeight: 600, lineHeight: 1, color: "var(--v5-ink)" };
const subBrand2Style: CSSProperties = { marginTop: "8px", fontSize: "18px", fontWeight: 600, color: "var(--v5-brand-2)" };
const subWarningStyle: CSSProperties = { marginTop: "8px", fontSize: "18px", fontWeight: 600, color: "var(--v5-warning)" };
const shareBtnStyle: CSSProperties = { height: "48px", padding: "0 20px", borderRadius: "999px", background: "var(--v5-brand)" };
const shareBtnTextStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-on-brand)" };
const doneBtnStyle: CSSProperties = { height: "48px", padding: "0 20px", borderRadius: "999px", background: "var(--v5-surface-2)" };
const doneBtnTextStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };
const bottomRowStyle: CSSProperties = { padding: "0 20px 24px", color: "var(--v5-ink-3)" };
function navBtnStyle(dim: boolean): CSSProperties {
  return { width: "44px", height: "44px", borderRadius: "999px", background: "var(--v5-surface-2)", opacity: dim ? 0.3 : 1 };
}
</script>
