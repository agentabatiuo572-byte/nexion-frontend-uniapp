<template>
  <view class="nx-glass-card invite-card">
<view class="invite-card__header">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87"/></svg>
      <view class="invite-card__heading">
        <text class="invite-card__title">{{ t.team.inviteTitle }}</text>
        <text class="invite-card__tagline">{{ t.team.inviteTagline }}</text>
      </view>
    </view>
    <view class="invite-card__reward" role="status" :aria-busy="rewards.loading">
      <template v-if="rewards.snapshot && !rewards.error">
        <template v-if="rewardEnabled">
          <view class="invite-card__reward-line"><text>{{ t.team.serverRewardPerSettlement }}</text><text class="invite-card__amount">{{ nexReward.toLocaleString() }} NEX</text></view>
          <text class="invite-card__muted">{{ t.team.perFriendCooldown }}</text>
        </template>
        <text class="invite-card__muted">{{ settlementStatus }}</text>
        <text v-if="!rewardEnabled" class="invite-card__muted">{{ t.team.sharingStillAvailable }}</text>
        <text v-if="lifetimeEarned > 0" class="invite-card__earned">+{{ lifetimeEarned.toLocaleString() }} NEX</text>
      </template>
      <text v-else class="invite-card__muted">{{ rewards.loading ? t.team.rewardLoading : t.team.settlementUnavailable }}</text>
    </view>

    <view class="invite-card__actions" :class="{ 'invite-card__disabled': !referralCode }">
      <view class="invite-card__action nx-team-share-poster" role="button" tabindex="0" :aria-label="t.team.inviteSharePoster" :aria-disabled="!referralCode" @click="openPoster">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="16" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 5"/></svg>
        <text>{{ t.team.inviteSharePoster }}</text>
      </view>
      <view class="invite-card__action nx-team-copy-code" role="button" tabindex="0" :aria-label="t.team.inviteShareCode" :aria-disabled="!referralCode" @click="copyCode">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-if="copiedCode" d="m4 12 5 5L20 6"/><template v-else><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3v3h-6z"/></template></svg>
        <text>{{ copiedCode ? t.team.copied : t.team.inviteShareCode }}</text>
      </view>
      <view class="invite-card__action nx-team-copy-link" role="button" tabindex="0" :aria-label="t.team.inviteShareLink" :aria-disabled="!referralCode" @click="copyLink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-if="copiedLink" d="m4 12 5 5L20 6"/><template v-else><path d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 0) scale(.83 1)"/></template></svg>
        <text>{{ copiedLink ? t.team.copied : t.team.inviteShareLink }}</text>
      </view>
    </view>
    <view class="invite-card__cta nx-team-share-now" :class="{ 'invite-card__disabled': !referralCode }" role="button" tabindex="0" :aria-disabled="!referralCode" @click="openShare">
      <text>{{ t.team.shareInvite }}</text><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
    </view>

    <view class="invite-card__history">
      <view v-if="tickerItem && !rewards.error" :key="tickerIdx" class="invite-card__ticker nx-step-in">
        <text>{{ tickerItem.name }}</text><text>{{ tickerItem.action }}</text><text class="invite-card__earned">{{ tickerItem.amount }}</text>
      </view>
      <view v-else-if="rewards.error && remoteApiEnabled" class="invite-card__retry" role="button" tabindex="0" :aria-busy="rewards.loading" @click="rewards.refresh()">
        <text>{{ rewards.loading ? t.team.rewardLoading : t.team.rewardHistoryUnavailable }}</text>
      </view>
      <text v-else-if="rewards.loading">{{ t.team.rewardLoading }}</text>
      <text v-else-if="rewards.snapshot">{{ t.team.noSettledRewards }}</text>
    </view>
  </view>
  <SharePosterSheet :open="posterOpen" @close="posterOpen = false" />
  <ShareChannelSheet :open="shareOpen" @close="shareOpen = false" @open-poster="shareOpen = false; posterOpen = true;" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, type CSSProperties } from "vue";
import PulseDot from "@/components/home/pulse-dot.vue";
import ShareChannelSheet from "@/components/team/share-channel-sheet.vue";
import SharePosterSheet from "@/components/team/share-poster-sheet.vue";
import { useApp } from "@/store/app";
import { useReferralReward } from "@/store/referral-reward";
import { useT } from "@/i18n/use-t";
import { toast } from "@/store/ui";
import { buildShareLink, copyText, notifyUnavailableShareLink } from "@/lib/share";
import { remoteApiEnabled } from "@/api/runtime";
import { fmt } from "@/i18n/format";

const t = useT();
const app = useApp();
const rewards = useReferralReward();
interface TickerItem {
  name: string;
  action: string;
  amount: string;
}
const tickerItems = computed<TickerItem[]>(() => (rewards.snapshot?.recentRewards ?? []).map((row) => ({
  name: row.settlementNo.length > 12 ? `${row.settlementNo.slice(0, 12)}…` : row.settlementNo,
  action: row.releaseBucket === "withdrawable" ? t.value.team.settledToWallet : t.value.team.settledProtected,
  amount: `+${row.amountNex.toLocaleString()} NEX`,
})));
const hasPromo = computed(() => false);
const multiplier = computed(() => 1);
const rewardEnabled = computed(() => rewards.snapshot?.rewardEnabled === true);
const nexReward = computed(() => rewards.snapshot?.inviterRewardNex ?? 0);
const lifetimeEarned = computed(() => rewards.snapshot?.lifetimeInviterNex ?? 0);
const settlementStatus = computed(() => rewards.snapshot
  ? rewards.snapshot.rewardEnabled
    ? fmt(t.value.team.settlementStatus, {
      settled: rewards.snapshot.settledCount,
      pending: rewards.snapshot.pendingCount,
    })
    : t.value.team.referralRewardsDisabled
  : t.value.team.settlementUnavailable);

const referralCode = computed(() => {
  if (remoteApiEnabled) return rewards.snapshot?.referralCode ?? "";
  return app.user.referralCode;
});
// 展示用短链标签从真实链接派生(禁写死 nexgrid.ai 与实际复制内容脱节,审计 P2)。
const linkLabel = computed(() => {
  const bare = buildShareLink(referralCode.value).replace(/^https?:\/\//, "");
  if (!bare) return "—";
  return bare.length > 15 ? `${bare.slice(0, 15)}…` : bare;
});

const promoChipText = computed(() => "");

const copiedCode = ref(false);
const copiedLink = ref(false);
const posterOpen = ref(false);
const shareOpen = ref(false);
const tickerIdx = ref(0);
const tickerItem = computed(() => tickerItems.value[tickerIdx.value] ?? null);

// FEAT-SHARE1 异常2:码为空四入口置灰 + toast,不产出空码链接。
function guardCode(): boolean {
  if (referralCode.value) return true;
  toast.info(t.value.share.noCodeYet);
  return false;
}
function guardLink(): string {
  const link = buildShareLink(referralCode.value);
  if (!link) notifyUnavailableShareLink();
  return link;
}

async function copyCode() {
  if (!guardCode()) return;
  const ok = await copyText(referralCode.value);
  if (!ok) {
    // 异常3:剪贴板失败禁误报成功态。
    toast.info(t.value.share.copyFailed);
    return;
  }
  copiedCode.value = true;
  // BUG 171:按钮的 :aria-label 是静态名称,只把按钮文字换成「已复制!」读屏不播报
  // (名称来自 aria-label,文字变化被盖住)。可感知反馈走 toast —— 宿主 .nx-toast-host
  // 是 role=status + aria-live=polite,与 share-poster-sheet 的复制反馈同源。
  toast.success(t.value.team.inviteCodeCopied);
  // 🔴 复制邀请码**不是分享**(zentao #199)。
  //   此前这里上报 channel="code" 的分享事件,服务端据此消费 invite_friend 任务;
  //   任务校验一旦失败,用户会在「邀请码已复制」之后又看到「分享已发出,但服务端暂时
  //   无法验证任务,未发放奖励」—— 他并没有分享任何东西。复制与分享的埋点必须隔离:
  //   只有真正把内容发到某个渠道(见 lib/share.ts 的 activateChannel)才算分享。
  setTimeout(() => (copiedCode.value = false), 1500);
}
async function copyLink() {
  const link = guardLink();
  if (!link) return;
  const ok = await copyText(link);
  if (!ok) {
    toast.info(t.value.share.copyFailed);
    return;
  }
  copiedLink.value = true;
  toast.success(t.value.team.inviteLinkCopied);
  // 同上:复制链接只是把文本放进剪贴板,不构成分享事件。
  setTimeout(() => (copiedLink.value = false), 1500);
}
function openPoster() {
  if (!guardLink()) return;
  posterOpen.value = true;
}
function openShare() {
  if (!guardLink()) return;
  shareOpen.value = true;
}
defineExpose({ openShare });

let tickerTimer: ReturnType<typeof setInterval> | null = null;
watch(() => tickerItems.value.length, (length) => {
  if (tickerTimer) clearInterval(tickerTimer);
  tickerTimer = null;
  tickerIdx.value = 0;
  if (length > 1) tickerTimer = setInterval(() => {
    tickerIdx.value = (tickerIdx.value + 1) % length;
  }, 4200);
});
onMounted(() => void rewards.refresh());
onUnmounted(() => {
  if (tickerTimer) clearInterval(tickerTimer);
});

// ─── styles ───
const rootStyle: CSSProperties = {
  padding: "16px",
  background:
    "radial-gradient(70% 80% at 0% 0%, var(--v5-brand-soft) 0%, transparent 60%), radial-gradient(70% 80% at 100% 100%, var(--v5-tech-cyan-soft) 0%, transparent 60%), var(--v5-surface)",
};
const gridStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  backgroundImage:
    // 网格线跟随 ink:写死的白网格在亮主题下落在白卡面上 = 纹理消失(卡底是 var(--v5-surface),跟主题)
    "linear-gradient(to right, color-mix(in srgb, var(--v5-ink) 3%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--v5-ink) 3%, transparent) 1px, transparent 1px)",
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
  color: "var(--v5-brand-2-ink)",
  fontSize: "12px",
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
  fontSize: "34px",
  fontWeight: 600,
  letterSpacing: "-0.024em",
  color: "var(--v5-ink)",
};
const strikeStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-ink-4)",
  textDecoration: "line-through",
  marginTop: "-4px",
};
const nexLineStyle: CSSProperties = { fontSize: "13px", fontWeight: 500, color: "var(--v5-tech-cyan-ink)" };
const cooldownStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.3 };
const earnedPillStyle: CSSProperties = {
  marginTop: "auto",
  alignSelf: "flex-start",
  gap: "6px",
  fontSize: "12px",
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
  return { marginLeft: "auto", fontSize: "12px", color: "var(--v5-ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
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
  fontSize: "13px",
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

<style scoped>
.invite-card { padding: 20px 20px 16px; }
.invite-card__header { display: flex; align-items: flex-start; gap: 14px; }
.invite-card__header > svg { flex-shrink: 0; }
.invite-card__heading { min-width: 0; }
.invite-card__title { display: block; font-size: 20px; font-weight: 600; line-height: 1.3; }
.invite-card__tagline { display: block; margin-top: 4px; font-size: 12px; line-height: 1.5; color: var(--v5-ink-3); }
.invite-card__reward { display: flex; flex-direction: column; margin-top: 20px; font-size: 12px; line-height: 1.5; }
.invite-card__reward-line { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.invite-card__amount { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
.invite-card__muted { color: var(--v5-ink-3); }
.invite-card__actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 20px; border-top: 1px solid var(--v5-border); }
.invite-card__action { display: flex; min-width: 0; min-height: 50px; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--v5-brand); text-align: center; }
.invite-card__action > svg { width: 24px; height: 24px; }
.invite-card__action text { color: var(--v5-ink-3); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.invite-card__cta { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 14px; min-height: 44px; border-radius: 999px; padding: 10px 14px; background: var(--v5-brand); color: var(--v5-on-brand); font-size: 15px; font-weight: 600; }
.invite-card__cta:active, .invite-card__action:active, .invite-card__retry:active { opacity: .75; }
.invite-card__disabled { opacity: .5; }
.invite-card [tabindex="0"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
.invite-card__history { margin-top: 10px; color: var(--v5-ink-3); font-size: 12px; line-height: 1.5; }
.invite-card__history:empty { display: none; }
.invite-card__ticker { display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid var(--v5-border); padding-top: 10px; }
.invite-card__earned { color: var(--v5-tech-cyan-ink); font-variant-numeric: tabular-nums; }
.invite-card__retry { min-height: 44px; display: flex; align-items: center; }
.invite-card__sandbox { margin-bottom: 14px; padding: 8px 10px; border-radius: 10px; background: var(--v5-warning-soft); color: var(--v5-warning-ink); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
</style>
