<!--
  InviteEarnCard — ported from Nexion-prototype/app/components/team/
  invite-earn-card.tsx. Single-card invite reward CTA: promo chip (phase-driven
  multiplier) + reward numbers/social-proof (left) + share buttons (right) +
  live commission ticker (bottom). framer AnimatePresence ticker → CSS re-keyed
  fade (nx-step-in). framer ping dot → reusable PulseDot.
  DEGRADED vs source (infra not ported — see PORT report §7):
    • SharePoster modal omitted → share/poster buttons copy link + toast;
    • useQuest.markComplete("invite_friend") omitted (quest store not ported);
    • navigator.share → uni.share with clipboard fallback.
  <button>→<view @click>; <span>→<text>; <div>→<view>.
-->
<template>
  <view class="relative overflow-hidden rounded-2xl" :style="rootStyle">
    <!-- 24px grid overlay -->
    <view aria-hidden="true" :style="gridStyle" />

    <!-- Top label row -->
    <view class="relative flex items-center justify-between" style="z-index: 1; font-size: 11.5px">
      <text :style="{ color: 'var(--v5-brand)', fontWeight: 500 }">💰 {{ t.team.earnForEachFriend }}</text>
      <view class="flex items-center" style="gap: 4px">
        <PulseDot color="var(--v5-success)" :size="6" />
        <text class="font-mono-tabular tabular-nums" :style="{ color: 'var(--v5-ink-3)' }">{{ t.team.earnedTodayCount }}</text>
      </view>
    </view>

    <!-- Limited-time promo chip -->
    <view v-if="hasPromo" class="relative inline-flex items-center font-mono-tabular" :style="promoChipStyle">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
      <text>{{ promoChipText }}</text>
    </view>

    <!-- Two-column body -->
    <view class="relative grid" :style="bodyGridStyle">
      <!-- LEFT — stats -->
      <view class="min-w-0 flex flex-col" style="gap: 6px">
        <view class="flex items-baseline" style="gap: 4px; line-height: 1">
          <text class="font-display tabular-nums" :style="leftDollarSignStyle">$</text>
          <text class="font-mono-tabular" :style="leftDollarStyle">{{ dollarReward }}</text>
        </view>
        <text v-if="hasPromo" class="font-mono-tabular" :style="strikeStyle">${{ BASE_REWARD_DOLLAR_LABEL }}</text>
        <text class="font-display tabular-nums" :style="nexLineStyle">+ {{ nexReward.toLocaleString() }} NEX</text>
        <text :style="cooldownStyle">{{ t.team.perFriendCooldown }}</text>
        <!-- Cumulative earned pill -->
        <view class="inline-flex items-center" :style="earnedPillStyle">
          <text>💎</text>
          <text v-if="lifetimeEarned > 0" class="font-display tabular-nums" :style="{ color: 'var(--v5-tech-cyan)', fontWeight: 600 }">+${{ lifetimeEarned.toFixed(2) }}</text>
          <text v-else :style="{ color: 'var(--v5-tech-cyan)' }">{{ t.team.beTheFirst }}</text>
        </view>
      </view>

      <!-- RIGHT — actions -->
      <view class="flex flex-col shrink-0" style="width: 158px; gap: 8px">
        <view class="rounded-lg flex items-center active:opacity-90" :style="shareBtnStyle(false)" @click="openPoster">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v.01M17 21h.01M21 17v.01" /></svg>
          <text class="shrink-0" :style="shareLabelStyle">{{ t.team.inviteSharePoster }}</text>
          <text :style="shareValStyle(false)">{{ t.team.inviteShareQR }}</text>
        </view>
        <view class="rounded-lg flex items-center active:opacity-90" :style="shareBtnStyle(copiedCode)" @click="copyCode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="copiedCode ? 'var(--v5-brand)' : 'var(--v5-brand)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><template v-if="copiedCode"><path d="M20 6 9 17l-5-5" /></template><template v-else><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></template></svg>
          <text class="shrink-0" :style="shareLabelStyle">{{ copiedCode ? t.team.copied : t.team.inviteShareCode }}</text>
          <text class="font-mono-tabular tabular-nums" :style="shareValStyle(copiedCode)">{{ referralCode }}</text>
        </view>
        <view class="rounded-lg flex items-center active:opacity-90" :style="shareBtnStyle(copiedLink)" @click="copyLink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><template v-if="copiedLink"><path d="M20 6 9 17l-5-5" /></template><template v-else><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" /></template></svg>
          <text class="shrink-0" :style="shareLabelStyle">{{ copiedLink ? t.team.copied : t.team.inviteShareLink }}</text>
          <text class="font-mono-tabular tabular-nums" :style="shareValStyle(copiedLink)">nexion.ai/ref/…</text>
        </view>

        <view class="rounded-full flex items-center justify-center active:opacity-90" :style="primaryCtaStyle" @click="shareOrFallback">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
          <text :style="primaryCtaTextStyle">{{ shareParts[0] }}<text :style="{ fontWeight: 600 }">${{ dollarReward }}</text>{{ shareParts[1] }}</text>
        </view>
      </view>
    </view>

    <!-- Live commission ticker -->
    <view class="relative flex items-center overflow-hidden border-t" :style="tickerWrapStyle">
      <view :key="tickerIdx" class="flex items-center w-full min-w-0 nx-step-in" style="gap: 6px; font-size: 11.5px">
        <text class="shrink-0">⚡</text>
        <text class="shrink-0" :style="{ color: 'var(--v5-ink)', fontWeight: 500 }">{{ tickerItem.name }}</text>
        <text class="truncate" :style="{ color: 'var(--v5-ink-3)' }">{{ tickerItem.action }}</text>
        <text class="font-mono-tabular tabular-nums shrink-0" :style="tickerAmtStyle">{{ tickerItem.amount }}</text>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M7 7h10v10M7 17 17 7" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import PulseDot from "@/components/home/pulse-dot.vue";
import { useApp } from "@/store/app";
import { useCommission } from "@/store/commission";
import { useProductPhase } from "@/composables/use-product-phase";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";

const t = useT();
const app = useApp();
const commission = useCommission();
const phase = useProductPhase();

const BASE_REWARD_NEX = 200;
const BASE_REWARD_DOLLAR_LABEL = 200;

interface TickerItem {
  name: string;
  action: string;
  amount: string;
}
const TICKER_ITEMS: TickerItem[] = [
  { name: "Sarah K.", action: "just joined your network", amount: "+$45.20" },
  { name: "Tom W.", action: "bought NexionBox S1", amount: "+$130.00" },
  { name: "Carlos R.", action: "upgraded to V3 Captain", amount: "+$28.40" },
  { name: "Mei L.", action: "added a second device", amount: "+$76.00" },
  { name: "Akira S.", action: "staked $5K · 180d", amount: "+$54.00" },
  { name: "Priya N.", action: "claimed her Day-One bonus", amount: "+$12.00" },
];

const multiplier = computed(() => phase.value.inviteBonusMultiplier);
const hasPromo = computed(() => multiplier.value > 1.0);
const dollarReward = computed(() => Math.round(BASE_REWARD_DOLLAR_LABEL * multiplier.value));
const nexReward = computed(() => Math.round(BASE_REWARD_NEX * multiplier.value));
const lifetimeEarned = computed(() => commission.totalUSDTLifetime());

const referralCode = computed(() => app.user.referralCode);
const referralUrl = computed(() => `https://nexion.ai/ref/${referralCode.value}`);

const promoChipText = computed(() =>
  fmt(t.value.team.invitePromoChip, {
    multiplier: multiplier.value.toFixed(multiplier.value === Math.floor(multiplier.value) ? 0 : 1),
  }),
);
const shareParts = computed(() => t.value.team.shareAndEarn.split("{n}"));

const copiedCode = ref(false);
const copiedLink = ref(false);
const tickerIdx = ref(0);
const tickerItem = computed(() => TICKER_ITEMS[tickerIdx.value]);

function copyToClipboard(data: string) {
  uni.setClipboardData({ data, showToast: false, fail: () => {} });
}

function copyCode() {
  copyToClipboard(referralCode.value);
  copiedCode.value = true;
  setTimeout(() => (copiedCode.value = false), 1500);
}
function copyLink() {
  copyToClipboard(referralUrl.value);
  copiedLink.value = true;
  setTimeout(() => (copiedLink.value = false), 1500);
}
function openPoster() {
  // SharePoster modal not ported — copy link + confirm.
  copyToClipboard(referralUrl.value);
  toast.success(t.value.team.inviteLinkCopied);
}
function shareOrFallback() {
  const text = t.value.team.inviteShareText.replace("{url}", referralUrl.value);
  // Try native uni share (App / mini-program); fall back to clipboard copy on H5.
  uni.share?.({
    provider: "weixin",
    type: 0,
    href: referralUrl.value,
    title: "Nexion",
    summary: text,
    success: () => {},
    fail: () => {
      copyToClipboard(referralUrl.value);
      toast.success(t.value.team.inviteLinkCopied);
    },
  });
  // On platforms where uni.share is undefined, do the copy fallback directly.
  if (typeof uni.share !== "function") {
    copyToClipboard(referralUrl.value);
    toast.success(t.value.team.inviteLinkCopied);
  }
}

let tickerTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  tickerTimer = setInterval(() => {
    tickerIdx.value = (tickerIdx.value + 1) % TICKER_ITEMS.length;
  }, 4200);
});
onUnmounted(() => {
  if (tickerTimer) clearInterval(tickerTimer);
});

// ─── styles ───
const rootStyle: CSSProperties = {
  padding: "16px",
  background:
    "radial-gradient(70% 80% at 0% 0%, var(--v5-brand-soft) 0%, transparent 60%), radial-gradient(70% 80% at 100% 100%, var(--v5-tech-cyan-soft) 0%, transparent 60%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const gridStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  backgroundImage:
    "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  pointerEvents: "none",
  zIndex: 0,
};
const promoChipStyle: CSSProperties = {
  marginTop: "8px",
  gap: "4px",
  padding: "2px 8px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-brand-2) 12%, transparent)",
  color: "var(--v5-brand-2)",
  fontSize: "11.5px",
  zIndex: 1,
};
const bodyGridStyle: CSSProperties = {
  marginTop: "12px",
  gridTemplateColumns: "1fr auto",
  gap: "12px",
  alignItems: "stretch",
  zIndex: 1,
};
const leftDollarSignStyle: CSSProperties = { fontSize: "15px", fontWeight: 500, opacity: 0.75, color: "var(--v5-ink-3)" };
const leftDollarStyle: CSSProperties = {
  fontSize: "30px",
  fontWeight: 600,
  letterSpacing: "-0.024em",
  color: "var(--v5-ink)",
};
const strikeStyle: CSSProperties = {
  fontSize: "11.5px",
  color: "var(--v5-ink-4)",
  textDecoration: "line-through",
  marginTop: "-4px",
};
const nexLineStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 500, color: "var(--v5-tech-cyan)" };
const cooldownStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.3 };
const earnedPillStyle: CSSProperties = {
  marginTop: "auto",
  alignSelf: "flex-start",
  gap: "6px",
  fontSize: "11.5px",
  padding: "4px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent)",
};
function shareBtnStyle(highlight: boolean): CSSProperties {
  return {
    height: "44px",
    gap: "6px",
    padding: "0 10px",
    background: highlight
      ? "color-mix(in srgb, var(--v5-brand) 15%, transparent)"
      : "var(--v5-surface-2)",
  };
}
const shareLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-2)", fontWeight: 500 };
function shareValStyle(_highlight: boolean): CSSProperties {
  return { marginLeft: "auto", fontSize: "11.5px", color: "var(--v5-ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}
const primaryCtaStyle: CSSProperties = {
  height: "44px",
  gap: "4px",
  padding: "0 8px",
  background: "var(--v5-brand)",
  whiteSpace: "nowrap",
};
const primaryCtaTextStyle: CSSProperties = {
  color: "var(--v5-on-brand)",
  fontSize: "13.5px",
  fontWeight: 500,
  letterSpacing: "-0.005em",
};
const tickerWrapStyle: CSSProperties = {
  marginTop: "12px",
  paddingTop: "10px",
  borderColor: "var(--v5-border)",
  height: "34px",
  zIndex: 1,
};
const tickerAmtStyle: CSSProperties = { marginLeft: "auto", color: "var(--v5-brand)", fontWeight: 600 };
</script>
