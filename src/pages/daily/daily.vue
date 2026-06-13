<!--
  Daily Check-in — streak hero + 30-day milestone roadmap + streak power-ups +
  streak saver + top-streakers leaderboard + stats + withdrawal context +
  history (ported from Nexion-prototype/app/(main)/daily/page.tsx).

  Wrapped in <AppChassis active="me"> (reached from /me/wallet). Uses the points
  store (signIn / claimMilestone / useSaver / streak / history). USDT/NEX
  milestone rewards credit the wallet + write a bill (composed in the handler).
  The Day-30 "Lucky Spin" milestone grants a bonus spin ticket and opens the
  Lucky Spin sheet (useLuckySpin.grantBonusTicket + openSheet); badge stays a
  toast-only unlock. Haptic feedback → uni.vibrateShort. TOP_STREAKERS is faithful mock data.
-->
<template>
  <AppChassis active="me">
    <CardStagger style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/wallet" />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- Streak hero -->
        <view class="relative overflow-hidden text-center" :style="heroStyle">
          <text aria-hidden :style="fireStyle">🔥</text>
          <view class="relative">
            <text class="block tabular-nums" :style="streakNumStyle">{{ streak }}</text>
            <text class="block" :style="streakLblStyle">{{ t.daily.activeStreak }}</text>
            <text class="block" :style="streakPointsStyle">{{ heroLineText }}</text>
            <!-- Sign-in button -->
            <view class="w-full inline-flex items-center justify-center active:opacity-90" :style="signInBtnStyle" @click="handleCheckIn">
              <template v-if="lastSignedToday">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px"><path d="M20 6 9 17l-5-5" /></svg>
                <text>{{ t.daily.checkedInToday }}</text>
              </template>
              <template v-else>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
                <text>{{ t.daily.checkInCta }}</text>
              </template>
            </view>
            <view v-if="lastSignedToday" class="inline-flex items-center" :style="nextClaimStyle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              <text>{{ nextClaimText }}</text>
            </view>
          </view>
        </view>

        <!-- Lucky multiplier hint -->
        <text class="text-center" :style="luckyHintStyle">{{ t.daily.luckyHint }}</text>

        <!-- Milestone rewards -->
        <view :style="milestoneCardStyle">
          <view class="flex items-center justify-between" style="margin-bottom: 12px">
            <text class="inline-flex items-center" :style="milestoneLabelStyle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
              <text>{{ t.daily.milestones.label }}</text>
            </text>
          </view>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <view v-for="m in MILESTONES" :key="m.day" class="flex items-center" :style="milestoneRowStyle(m)">
              <view class="grid place-items-center shrink-0" :style="milestoneIconStyle(m)">
                <svg v-if="claimedSet.has(m.day)" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <svg v-else-if="streak >= m.day" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="m.iconPath" />
                  <path v-if="m.iconPath2" :d="m.iconPath2" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </view>
              <view class="flex-1 min-w-0">
                <view class="flex items-center" style="gap: 8px">
                  <text class="tabular-nums" :style="milestoneDayStyle">{{ t.daily.milestones[m.labelKey] }}</text>
                  <text :style="milestoneRewardStyle">{{ t.daily.milestones[m.rewardKey] }}</text>
                </view>
                <text class="block" v-if="streak < m.day" :style="milestoneLeftStyle">{{ daysLeftText(m.day) }}</text>
              </view>
              <view :style="milestoneBtnStyle(m)" @click="handleClaimMilestone(m)">
                <text>{{ claimedSet.has(m.day) ? t.daily.milestones.claimed : t.daily.milestones.claim }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Streak Power-Ups -->
        <StreakPowerUps />

        <!-- Streak Saver -->
        <view :style="saverCardStyle">
          <view class="flex items-start" style="gap: 12px">
            <view class="grid place-items-center shrink-0" :style="saverIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="saverLabelStyle">{{ t.daily.saver.label }}</text>
              <text class="block" :style="saverHeadlineStyle">{{ saverHeadlineText }}</text>
              <text class="block" :style="saverCountStyle">{{ saverCountText }}</text>
            </view>
            <view :style="saverBtnStyle" @click="handleUseSaver">
              <text>{{ t.daily.saver.use }}</text>
            </view>
          </view>
        </view>

        <!-- Top Streakers -->
        <view class="overflow-hidden" :style="leaderCardStyle">
          <view class="px-4 flex items-center justify-between" style="padding-top: 12px; padding-bottom: 8px">
            <text :style="leaderLabelStyle">{{ t.daily.topStreakers.label }}</text>
            <text :style="leaderBestStyle">{{ yourBestText }}</text>
          </view>
          <view class="px-2" style="padding-bottom: 8px">
            <view v-for="(s, i) in TOP_STREAKERS" :key="s.name" class="flex items-center" style="gap: 10px; padding: 8px">
              <text class="tabular-nums text-center" :style="rankStyle">{{ i + 1 }}</text>
              <text class="block grid place-items-center" :style="avatarStyle">{{ s.name.charAt(0) }}</text>
              <view class="flex-1 min-w-0 flex items-center" style="gap: 6px">
                <text class="truncate" :style="streakerNameStyle">{{ s.name }}</text>
                <text style="font-size: 11px">{{ s.flag }}</text>
              </view>
              <text class="tabular-nums" :style="streakerCountStyle">🔥 {{ s.streak }}</text>
            </view>
          </view>
          <text class="block px-4" :style="leaderSubStyle">{{ t.daily.topStreakers.sub }}</text>
        </view>

        <!-- Stats grid -->
        <view class="grid grid-cols-3" style="gap: 8px">
          <view class="text-center" :style="statStyle">
            <text class="block" :style="statLabelStyle">{{ t.daily.balance }}</text>
            <text class="block tabular-nums" :style="statValStyle('var(--v5-success)')">{{ points.points }}</text>
            <text class="block" :style="statSubStyle">{{ t.daily.points }}</text>
          </view>
          <view class="text-center" :style="statStyle">
            <text class="block" :style="statLabelStyle">{{ t.daily.lifetime }}</text>
            <text class="block tabular-nums" :style="statValStyle('var(--v5-ink)')">{{ lifetimeEarned }}</text>
            <text class="block" :style="statSubStyle">{{ t.daily.earned }}</text>
          </view>
          <view class="text-center" :style="statStyle">
            <text class="block" :style="statLabelStyle">{{ t.daily.spent }}</text>
            <text class="block tabular-nums" :style="statValStyle('var(--v5-warning)')">{{ lifetimeSpent }}</text>
            <text class="block" :style="statSubStyle">{{ t.daily.onPayouts }}</text>
          </view>
        </view>

        <!-- Withdrawal context -->
        <view :style="withdrawCardStyle" class="active:scale-[0.99]" @click="goWithdraw">
          <view class="flex items-center" style="gap: 12px">
            <view class="grid place-items-center" :style="withdrawIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
            </view>
            <view class="flex-1">
              <text class="block" :style="withdrawTitleStyle">{{ pointsUnlockText }}</text>
              <text class="block" :style="withdrawRuleStyle">{{ t.daily.pointsRule }}</text>
            </view>
          </view>
        </view>

        <!-- History -->
        <view>
          <text class="block px-1" :style="historyLabelStyle">{{ t.daily.recent }}</text>
          <view class="overflow-hidden" :style="historyCardStyle">
            <text v-if="points.history.length === 0" class="block text-center" :style="historyEmptyStyle">{{ t.daily.noActivity }}</text>
            <view
              v-for="(h, i) in historyRows"
              v-else
              :key="`${h.ts}-${i}`"
              class="flex items-center justify-between"
              :style="historyRowStyle(i === historyRows.length - 1)"
            >
              <view>
                <text class="block" :style="historyReasonStyle">{{ h.reason }}</text>
                <text class="block" :style="historyTimeStyle">{{ formatTs(h.ts) }}</text>
              </view>
              <text class="block tabular-nums" :style="historyDeltaStyle(h.delta)">{{ h.delta > 0 ? "+" : "" }}{{ h.delta }}</text>
            </view>
          </view>
        </view>
      </view>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import StreakPowerUps from "@/components/daily/streak-power-ups.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { usePoints } from "@/store/points";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useLuckySpin } from "@/store/lucky-spin";
import { toast } from "@/store/ui";

const ONE_DAY_MS = 86400 * 1000;

interface Milestone {
  day: number;
  rewardKey: "reward3" | "reward7" | "reward14" | "reward21" | "reward30" | "reward60" | "reward100";
  labelKey: "day3" | "day7" | "day14" | "day21" | "day30" | "day60" | "day100";
  reward: { type: "points" | "usdt" | "nex" | "spin" | "badge"; amount: number };
  tint: string;
  iconPath: string;
  iconPath2?: string;
}

// Icon paths (lucide): Sparkles / Gift / TrendingUp / Star / Trophy / ShieldCheck.
const MILESTONES: Milestone[] = [
  { day: 3, rewardKey: "reward3", labelKey: "day3", reward: { type: "points", amount: 5 }, tint: "var(--v5-brand)", iconPath: "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" },
  { day: 7, rewardKey: "reward7", labelKey: "day7", reward: { type: "points", amount: 15 }, tint: "var(--v5-brand)", iconPath: "M20 12v10H4V12", iconPath2: "M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7" },
  { day: 14, rewardKey: "reward14", labelKey: "day14", reward: { type: "usdt", amount: 1 }, tint: "var(--v5-warning)", iconPath: "M16 7h6v6", iconPath2: "m22 7-8.5 8.5-5-5L2 17" },
  { day: 21, rewardKey: "reward21", labelKey: "day21", reward: { type: "nex", amount: 100 }, tint: "var(--v5-tech-cyan)", iconPath: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" },
  { day: 30, rewardKey: "reward30", labelKey: "day30", reward: { type: "spin", amount: 1 }, tint: "var(--v5-brand-2)", iconPath: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6", iconPath2: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" },
  { day: 60, rewardKey: "reward60", labelKey: "day60", reward: { type: "usdt", amount: 10 }, tint: "var(--v5-warning)", iconPath: "M16 7h6v6", iconPath2: "m22 7-8.5 8.5-5-5L2 17" },
  { day: 100, rewardKey: "reward100", labelKey: "day100", reward: { type: "badge", amount: 1 }, tint: "var(--v5-brand)", iconPath: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", iconPath2: "m9 12 2 2 4-4" },
];

const TOP_STREAKERS = [
  { name: "Daniel_K", flag: "🇺🇸", streak: 412 },
  { name: "Mei_C", flag: "🇸🇬", streak: 387 },
  { name: "Lukas_F", flag: "🇩🇪", streak: 341 },
  { name: "Carlos_M", flag: "🇧🇷", streak: 298 },
  { name: "Priya_S", flag: "🇮🇳", streak: 256 },
];

const t = useT();
const points = usePoints();
const app = useApp();
const bills = useBills();
const luckySpin = useLuckySpin();

// Per-second tick for the countdown.
const tick = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => (tick.value += 1), 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const streak = computed(() => points.signInStreak);
const lastSignedToday = computed(() => points.lastSignedInAt > 0 && isSameDay(points.lastSignedInAt, Date.now()));
const claimedSet = computed(() => new Set(points.claimedMilestones));

const nextMilestone = computed(() =>
  streak.value === 0 ? 3 : MILESTONES.find((m) => m.day > streak.value)?.day ?? 100,
);
const daysToMilestone = computed(() => Math.max(1, nextMilestone.value - streak.value));

const nextResetMs = computed(() => {
  void tick.value;
  const next = today();
  next.setDate(next.getDate() + 1);
  return next.getTime() - Date.now();
});

const streakBroken = computed(() => {
  if (points.lastSignedInAt === 0) return false;
  return Date.now() - points.lastSignedInAt > 2 * ONE_DAY_MS && points.streakSavers > 0;
});

const heroLineText = computed(() =>
  streak.value === 0
    ? t.value.daily.startStreak
    : fmt(t.value.daily.daysToBonus, {
        n: daysToMilestone.value,
        unit: daysToMilestone.value === 1 ? t.value.daily.dayShort : t.value.daily.daysShort,
      }),
);
const nextClaimText = computed(() => fmt(t.value.daily.nextClaimIn, { time: formatCountdown(nextResetMs.value) }));
const saverHeadlineText = computed(() => fmt(t.value.daily.saver.headline, { n: streak.value || "0" }));
const saverCountText = computed(() =>
  points.streakSavers > 0 ? fmt(t.value.daily.saver.count, { n: points.streakSavers }) : t.value.daily.saver.empty,
);
const yourBestText = computed(() =>
  fmt(t.value.daily.topStreakers.yourBest, { n: points.longestStreak || streak.value || 0 }),
);
const pointsUnlockText = computed(() => fmt(t.value.daily.pointsUnlockHint, { n: (points.points * 10).toFixed(0) }));
const lifetimeEarned = computed(() =>
  String(points.history.reduce((s, h) => s + (h.delta > 0 ? h.delta : 0), 0)),
);
const lifetimeSpent = computed(() =>
  String(-points.history.reduce((s, h) => s + (h.delta < 0 ? h.delta : 0), 0)),
);
const historyRows = computed(() => points.history.slice(0, 10));
function daysLeftText(day: number): string {
  return fmt(t.value.daily.milestones.daysLeft, { n: day - streak.value });
}
function formatTs(ts: number): string {
  return new Date(ts).toLocaleString();
}

function handleCheckIn() {
  const r = points.signIn();
  if (!r.ok) {
    toast.info("Already checked in today", "Come back tomorrow for +1 point.");
    return;
  }
  try {
    uni.vibrateShort({ fail: () => {} });
  } catch {
    // vibrate unavailable
  }
  if (r.multiplier > 1) {
    toast.success(`🎲 Lucky ×${r.multiplier}! +${r.gained} points`, `${r.streak}-day streak`);
  } else if (r.gained > 1) {
    toast.success(`🔥 ${r.streak}-day streak! +${r.gained} points`, "Day-7 bonus unlocked");
  } else {
    toast.success(`+${r.gained} point`, `${r.streak}-day streak`);
  }
}

function handleClaimMilestone(m: Milestone) {
  if (claimedSet.value.has(m.day)) {
    toast.info(t.value.daily.milestones.claimedToast, "");
    return;
  }
  if (streak.value < m.day) {
    toast.info(t.value.daily.milestones.lockedToast, "");
    return;
  }
  const gained = m.reward.type === "points" ? m.reward.amount : 0;
  const rewardDisplay = t.value.daily.milestones[m.rewardKey];
  points.claimMilestone(m.day, gained, `Milestone Day-${m.day}: ${rewardDisplay}`);
  // USDT / NEX milestone rewards actually credit the wallet + write a bill.
  if (m.reward.type === "usdt" || m.reward.type === "nex") {
    const ref = `STREAK-D${m.day}-${Date.now().toString(36).toUpperCase()}`;
    if (m.reward.type === "usdt") {
      app.creditBalance(m.reward.amount);
      bills.add({ type: "bonus", symbol: "USDT", amount: m.reward.amount, status: "posted", memo: `Streak milestone · Day-${m.day}`, ref });
    } else {
      app.creditNex(m.reward.amount);
      bills.add({ type: "bonus", symbol: "NEX", amount: m.reward.amount, status: "posted", memo: `Streak milestone · Day-${m.day}`, ref });
    }
  }
  // Day-30 "spin" milestone grants a bonus Lucky Spin ticket + opens the wheel.
  if (m.reward.type === "spin") {
    luckySpin.grantBonusTicket(m.reward.amount);
    luckySpin.openSheet();
  }
  // spin / badge milestones are non-currency unlocks → claim (+ spin sheet above).
  toast.success(rewardDisplay, `Day-${m.day} milestone claimed`);
}

function handleUseSaver() {
  if (points.useSaver()) {
    toast.success(t.value.daily.saver.restored, "");
  } else {
    toast.info(t.value.daily.saver.onlyWhenBroken, "");
  }
}

function goWithdraw() {
  uni.navigateTo({ url: "/pages/me/wallet-withdraw", fail: () => {} });
}

// ── styles ──
const heroStyle: CSSProperties = {
  padding: "22px 20px",
  borderRadius: "18px",
  background: "linear-gradient(135deg, #FFCB94 0%, var(--v5-brand-2) 100%)",
  color: "var(--v5-ink)",
};
const fireStyle: CSSProperties = {
  position: "absolute",
  top: "-30px",
  right: "-10px",
  fontSize: "140px",
  opacity: 0.15,
  pointerEvents: "none",
  lineHeight: 1,
};
const streakNumStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "56px",
  letterSpacing: "-0.034em",
  lineHeight: 1,
};
const streakLblStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11.5px",
  color: "rgba(255,255,255,0.82)",
  letterSpacing: "0.06em",
};
const streakPointsStyle: CSSProperties = { marginTop: "14px", fontSize: "13px", color: "rgba(255,255,255,0.92)" };
const signInBtnStyle = computed<CSSProperties>(() => ({
  marginTop: "18px",
  height: "54px",
  borderRadius: "14px",
  background: lastSignedToday.value ? "rgba(255,255,255,0.42)" : "var(--v5-ink)",
  color: lastSignedToday.value ? "rgba(255,255,255,0.65)" : "var(--v5-brand-2)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
}));
const nextClaimStyle: CSSProperties = {
  marginTop: "10px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "rgba(255,255,255,0.85)",
};
const luckyHintStyle: CSSProperties = {
  marginTop: "-4px",
  display: "block",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.4,
};
const milestoneCardStyle: CSSProperties = {
  padding: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const milestoneLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-warning)",
  letterSpacing: "0.06em",
};
function milestoneRowStyle(m: Milestone): CSSProperties {
  const claimed = claimedSet.value.has(m.day);
  const canClaim = streak.value >= m.day && !claimed;
  return {
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "12px",
    background: claimed ? "var(--v5-surface-2)" : canClaim ? "var(--v5-brand-soft)" : "var(--v5-surface-2)",
  };
}
function milestoneIconStyle(m: Milestone): CSSProperties {
  const claimed = claimedSet.value.has(m.day);
  const reached = streak.value >= m.day;
  return {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: claimed ? "rgba(255,255,255,0.5)" : `color-mix(in srgb, ${m.tint} 10%, transparent)`,
    color: claimed ? "var(--v5-ink-4)" : reached ? m.tint : "var(--v5-ink-4)",
  };
}
const milestoneDayStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-3)",
};
const milestoneRewardStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const milestoneLeftStyle: CSSProperties = { marginTop: "3px", fontSize: "11px", color: "var(--v5-ink-3)" };
function milestoneBtnStyle(m: Milestone): CSSProperties {
  const claimed = claimedSet.value.has(m.day);
  const canClaim = streak.value >= m.day && !claimed;
  return {
    height: "36px",
    padding: "0 14px",
    borderRadius: "999px",
    background: canClaim ? "var(--v5-brand)" : "transparent",
    color: canClaim ? "var(--v5-ink)" : "var(--v5-ink-4)",
    fontFamily: "var(--font-v5)",
    fontWeight: 500,
    fontSize: "12px",
    letterSpacing: "-0.005em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}
const saverCardStyle: CSSProperties = { padding: "16px", borderRadius: "16px", background: "var(--v5-brand-2-soft)" };
const saverIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand-2)",
};
const saverLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
  letterSpacing: "0.06em",
};
const saverHeadlineStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  lineHeight: 1.4,
  letterSpacing: "-0.008em",
};
const saverCountStyle: CSSProperties = { marginTop: "3px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
const saverBtnStyle = computed<CSSProperties>(() => ({
  height: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  background: streakBroken.value ? "var(--v5-brand-2)" : "var(--v5-surface-2)",
  color: streakBroken.value ? "var(--v5-ink)" : "var(--v5-ink-4)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  letterSpacing: "-0.005em",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}));
const leaderCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const leaderLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const leaderBestStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
const rankStyle: CSSProperties = {
  width: "20px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
const avatarStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, var(--v5-brand-soft), var(--v5-tech-cyan-soft))",
  color: "var(--v5-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "11px",
};
const streakerNameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "12.5px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.005em",
};
const streakerCountStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontWeight: 500,
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};
const leaderSubStyle: CSSProperties = { paddingBottom: "12px", fontSize: "11px", color: "var(--v5-ink-3)", lineHeight: 1.5 };
const statStyle: CSSProperties = {
  padding: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const statLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-3)",
  letterSpacing: "0.02em",
};
function statValStyle(tint: string): CSSProperties {
  return {
    marginTop: "4px",
    fontFamily: "var(--font-v5)",
    fontWeight: 500,
    fontSize: "20px",
    letterSpacing: "-0.018em",
    color: tint,
    lineHeight: 1,
  };
}
const statSubStyle: CSSProperties = { marginTop: "4px", fontSize: "11px", color: "var(--v5-ink-3)" };
const withdrawCardStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "14px",
  background: "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)",
  border: "1px solid var(--v5-border)",
};
const withdrawIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-brand-2) 20%, transparent)",
};
const withdrawTitleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };
const withdrawRuleStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "2px" };
const historyLabelStyle: CSSProperties = {
  marginBottom: "8px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const historyCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const historyEmptyStyle: CSSProperties = { padding: "24px", fontSize: "12.5px", color: "var(--v5-ink-3)" };
function historyRowStyle(isLast: boolean): CSSProperties {
  return { padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid var(--v5-border)" };
}
const historyReasonStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "12.5px", color: "var(--v5-ink)" };
const historyTimeStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-ink-4)",
};
function historyDeltaStyle(delta: number): CSSProperties {
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontWeight: 600,
    fontSize: "13px",
    color: delta > 0 ? "var(--v5-success)" : delta < 0 ? "var(--v5-brand-2)" : "var(--v5-ink-3)",
  };
}
</script>
