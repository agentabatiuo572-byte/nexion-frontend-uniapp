<!--
  StreakPowerUps — perks unlocked at streak milestones, as a 2×2 card grid
  (P-65). Unlock state derives from current streak vs threshold (or the server
  status); the "activated" decision is durable in the daily-powerup store.
  Activation routes into the linked touchpoint when the target is mapped; the
  check-in boost has no destination and stays on the daily page. A locked perk
  is an open dashed slot; paused / unverifiable destinations stay solid and say so.
-->
<template>
  <view class="spu">
    <view class="spu-sh">
      <text class="spu-sh__h">{{ w.label }}</text>
      <text class="spu-meta"><template v-if="factsVisible">{{ streakStatParts.before }}<text class="spu-meta__b">{{ streak }}</text>{{ streakStatParts.after }}</template><template v-else>—</template></text>
    </view>

    <view v-if="powerUps.length > 0" class="spu-grid">
      <view v-for="(p, i) in powerUps" :key="p.id" class="spu-card" :class="isOpenSlot(p) ? 'spu-card--l' : 'spu-card--s'" :style="{ '--t': PERK_TINT[perkKind(p)], '--i': i }">
        <view class="spu-r">
          <view class="spu-ic" aria-hidden="true">
            <svg v-if="perkKind(p) === 'team'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <svg v-else-if="perkKind(p) === 'badge'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>
            <svg v-else-if="perkKind(p) === 'boost'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
            <svg v-else-if="perkKind(p) === 'gem'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
          </view>
          <text class="spu-th">{{ thresholdText(p.threshold) }}</text>
        </view>
        <text class="spu-nm">{{ p.labelText }}</text>
        <text v-if="(isClaimed(p.id) || (isBusinessReady(p) && isUnlocked(p))) && p.descText" class="spu-ds">{{ p.descText }}</text>
        <text v-if="!isBusinessReady(p)" class="spu-ds">{{ isBusinessSuspended(p) ? w.suspendedDesc : w.pendingDesc }}</text>
        <view v-if="isClaimed(p.id)" class="spu-bt spu-bt--ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg><text>{{ w.activated }}</text></view>
        <!-- BUG 195:该档指向的业务当前整体停用(质押整池熔断/Genesis 未开放)时,
             不能继续给「激活」入口 —— 用户投入 30/60 天后会撞上一个不可用的页面。
             改为明确说明暂停,并保留档位可见(不隐藏已获得的权益说明)。 -->
        <text v-else-if="!isBusinessReady(p)" class="spu-bt" :class="{ 'spu-bt--w': isBusinessSuspended(p) }">{{ isBusinessSuspended(p) ? w.suspended : w.pending }}</text>
        <view v-else-if="isUnlocked(p)" class="spu-bt">
          <view class="spu-act-hit" role="button" tabindex="0" :aria-disabled="claimBusy || (remoteApiEnabled && faucet.remoteReadState !== 'ready')" :aria-busy="claimBusy" @click="handleClaim(p)" @keydown.enter.prevent="handleClaim(p)" @keydown.space.prevent="handleClaim(p)">
            <view class="spu-act nx-frosted-button"><text>{{ w.activate }}</text><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></view>
          </view>
        </view>
        <view v-else class="spu-bt spu-bt--lock"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg><text>{{ daysToUnlockText(p.threshold) }}</text></view>
      </view>
    </view>

    <!-- Dynamic footer -->
    <view v-if="nextUnclaimedUnlocked" class="spu-pf">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
      <text>{{ footerReadyText }}</text>
    </view>
    <view v-else-if="nextLocked" class="spu-pf spu-pf--n">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
      <text>{{ footerNextText }}</text>
    </view>
    <view v-else-if="powerUps.length > 0 && powerUps.every((p) => isClaimed(p.id))" class="spu-pf spu-pf--a">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
      <text>{{ footerAllText }}</text>
    </view>
    <text v-else-if="powerUps.length > 0" class="spu-note spu-note--wait">{{ w.footerWait }}</text>

    <text class="spu-note">{{ w.footer }}</text>
  </view>
</template>

<script setup lang="ts">
import { navTo } from "@/lib/route";
import { computed, ref, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNexFaucet } from "@/store/nex-faucet";
import { useDailyPowerUp, type StreakPowerUpId } from "@/store/daily-powerup";
import { toast } from "@/store/ui";
import { remoteApiEnabled } from "@/api/runtime";
import { canonicalPowerUpTarget } from "@/lib/remote-powerup-target";
import { useQuestTargetAvailability } from "@/composables/use-quest-target-availability";
import { questActionDomain } from "@/lib/quest-business-availability";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";
import { genesisBlockIsKnownUnavailable } from "@/store/genesis-config";

interface PowerUp {
  id: StreakPowerUpId;
  threshold: number;
  code: string;
  effectType: string;
  href: string;
  labelText: string;
  descText: string;
  status?: "LOCKED" | "AVAILABLE" | "ACTIVATED";
  /** 服务端下发的可用性;null = 不适用,undefined = 旧服务端未声明。 */
  serverBusinessAvailable?: boolean | null;
}

const props = defineProps<{ factsVisible?: boolean }>();
const t = useT();
import { useLocaleStore } from '@/store/locale';
import { powerUpEffectText, powerUpNameText } from '@/lib/power-up-copy';
const locale = useLocaleStore();
// `w` also feeds powerUpNameText, which looks names up by key → type as a string record.
const w = computed(() => t.value.daily.powerUps as unknown as Record<string, string>);
const faucet = useNexFaucet();
const powerUp = useDailyPowerUp();
const claimBusy = ref(false);
// The page supplies scoped display availability; it never authorizes a claim.
const factsVisible = computed(() => props.factsVisible ?? (!remoteApiEnabled || faucet.remoteReadState === 'ready'));

// Local (mock) catalogue mirrors the server seeds: two route badges, the check-in boost, the Genesis entry.
const localPowerUps = computed<PowerUp[]>(() => [
  { id: "royalty_boost", threshold: 7, code: "ROYALTY_BOOST", effectType: "ROUTE_BADGE", href: "/pages/team/team", labelText: w.value.teamGrowthBadge, descText: "" },
  { id: "streak_badge", threshold: 14, code: "STREAK_BADGE", effectType: "ROUTE_BADGE", href: "/pages/me/rewards", labelText: w.value.checkInStreakBadge, descText: "" },
  { id: "checkin_boost", threshold: 30, code: "CHECKIN_BOOST", effectType: "CHECKIN_MULTIPLIER", href: "", labelText: w.value.checkInBoost, descText: powerUpEffectText("CHECKIN_MULTIPLIER", "1.5", locale.code) },
  { id: "genesis_whitelist", threshold: 60, code: "GENESIS_ALLOWLIST", effectType: "ROUTE_BADGE", href: "/pages/genesis/genesis", labelText: w.value.genesisEligibilityEntry, descText: "" },
]);

const powerUps = computed<PowerUp[]>(() => (remoteApiEnabled
  ? (factsVisible.value ? faucet.remotePowerUps : []).map((item) => ({
      id: item.powerUpCode.toLowerCase() as StreakPowerUpId,
      threshold: item.unlockStreakDays,
      code: item.powerUpCode, effectType: item.effectType, href: item.targetPath,
      labelText: powerUpNameText(item.powerUpCode, item.effectType, item.name, w.value), descText: powerUpEffectText(item.effectType, item.effectValue, locale.code),
      status: item.status,
      // 服务端的可用性判定是权威:它读的是各域自己的读模型,比客户端本地推断更准。
      serverBusinessAvailable: item.businessAvailable,
    }))
  : localPowerUps.value));

const streak = computed(() => faucet.signInStreak);

function isUnlocked(p: PowerUp): boolean {
  return remoteApiEnabled
    ? p.status === "AVAILABLE" || p.status === "ACTIVATED"
    : streak.value >= p.threshold;
}

function isClaimed(id: StreakPowerUpId): boolean {
  if (remoteApiEnabled) return powerUps.value.find((p) => p.id === id)?.status === "ACTIVATED" || powerUp.hasClaimed(id);
  return powerUp.hasClaimed(id);
}

const nextUnclaimedUnlocked = computed(() =>
  powerUps.value.find((p) => isBusinessReady(p) && isUnlocked(p) && !isClaimed(p.id)),
);
const nextLocked = computed(() => powerUps.value.find((p) => !isUnlocked(p) && isBusinessReady(p)));

// BUG 195:连签增益指向的业务整体停用时,不再承诺「激活后可用」。
// 判据复用任务面那套**唯一读数入口**(与周任务报警器同源):质押走 useStaking 的远程
// 方案快照,Genesis 走销售闸 —— 不在这里另写一份开关判断。
// 🔴 与任务面同一原则:「还不知道」不算停用(false),不能把一次网络抖动说成业务关闭。
const availability = useQuestTargetAvailability();
const genesisGate = useGenesisSaleGate();
// 主售与二级在闸上不是同一档:二级卖的是别人手里的存量,主售售罄不妨碍转让。
// 所以两档各用各的判据,而不是共用「创世关了」这一个结论。
const genesisPrimaryClosed = computed(() => genesisBlockIsKnownUnavailable(genesisGate.block.value));
const genesisSecondaryClosed = computed(() => genesisBlockIsKnownUnavailable(genesisGate.secondaryBlock.value));
function isBusinessSuspended(p: PowerUp): boolean {
  // 服务端三态字段优先：null 是未知，只有旧服务端未返回字段时才回退本地判据。
  if (p.serverBusinessAvailable !== undefined) return p.serverBusinessAvailable === false;
  // 未声明(旧服务端)时才退回客户端判据,且同样遵守「不知道就别说」。
  switch (questActionDomain(p.href)) {
    case "staking": return availability.value.stakingClosed;
    case "genesis-primary": return genesisPrimaryClosed.value;
    case "genesis-secondary": return genesisSecondaryClosed.value;
    default: return false;
  }
}
function isManagedBusiness(p: PowerUp): boolean {
  return remoteApiEnabled && (p.href === "/wallet/staking" || p.href === "/market/genesis");
}
function isBusinessPending(p: PowerUp): boolean {
  return isManagedBusiness(p) && p.serverBusinessAvailable == null;
}
function isBusinessReady(p: PowerUp): boolean {
  return !isBusinessSuspended(p) && !isBusinessPending(p);
}
const activatedCount = computed(() => powerUps.value.filter((p) => isClaimed(p.id)).length);

const streakStatParts = computed(() => {
  const [before, after = ""] = w.value.streakStat.split("{n}");
  return { before, after };
});
function thresholdText(n: number): string {
  return fmt(w.value.threshold, { n });
}
function daysToUnlockText(threshold: number): string {
  return fmt(w.value.daysToUnlock, { n: Math.max(0, threshold - streak.value) });
}
const footerReadyText = computed(() =>
  nextUnclaimedUnlocked.value ? fmt(w.value.footerReady, { name: nextUnclaimedUnlocked.value.labelText }) : "",
);
const footerNextText = computed(() =>
  nextLocked.value
    ? fmt(w.value.footerNext, {
        days: nextLocked.value.threshold - streak.value,
        name: nextLocked.value.labelText,
      })
    : "",
);
const footerAllText = computed(() => fmt(w.value.footerAll, { n: activatedCount.value }));

async function handleClaim(p: PowerUp) {
  if (remoteApiEnabled && faucet.remoteReadState !== 'ready') return;
  if (!isBusinessReady(p) || claimBusy.value || isClaimed(p.id)) return;
  if (remoteApiEnabled) {
    claimBusy.value = true;
    try {
    if (await powerUp.claimRemote(p.id)) {
      // This component renders the faucet snapshot, so refresh that read model too.
      await faucet.refreshRemote();
      if (!isClaimed(p.id)) return;
      toast.success(fmt(w.value.toastTitle, { name: powerUps.value.find((current) => current.id === p.id)?.labelText ?? p.labelText }), p.descText || w.value.toastBody);
      // Remote targetPath is the server canonical href. Navigate only after
      // activation is confirmed; a failed claim remains retryable in the store.
      const target = canonicalPowerUpTarget(p.href);
      if (target) navTo(target);
    } else {
      toast.error(t.value.authOtp.errorServiceUnavailable);
    }
    } finally { claimBusy.value = false; }
    return;
  }
  const r = powerUp.claim(p.id);
  if (r.ok) {
    toast.success(fmt(w.value.toastTitle, { name: p.labelText }), p.descText || w.value.toastBody);
  } else if (r.conflict) {
    // 这一档增益在别处已经激活过,store 已把最新领取态刷回来 —— 说清楚,别让用户点了没反应。
    toast.warn(t.value.errors.staleTitle, t.value.errors.staleMsg);
  }
  // Route into the deeper linked touchpoint; the check-in boost has none and stays on this page.
  if (p.href) navTo(p.href);
}

// Icon and tint follow the server code: team / streak badge / check-in boost / Genesis; anything else is a generic perk.
function perkKind(p: PowerUp): "team" | "badge" | "boost" | "gem" | "other" {
  const code = p.code.toUpperCase();
  if (code === "ROYALTY_BOOST") return "team";
  if (code === "STREAK_BADGE") return "badge";
  if (p.effectType === "CHECKIN_MULTIPLIER" || code.includes("CHECKIN")) return "boost";
  if (code === "GENESIS_ALLOWLIST") return "gem";
  return "other";
}
const PERK_TINT = { team: "var(--v5-aura-sky)", badge: "var(--v5-warning)", boost: "var(--v5-warning)", gem: "var(--v5-brand-2)", other: "var(--v5-tech-cyan)" } as const;
function isOpenSlot(p: PowerUp): boolean {
  return !isClaimed(p.id) && isBusinessReady(p) && !isUnlocked(p);
}
</script>

<style scoped>
.spu { display: block; }
.spu-sh { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 28px; margin: 0 18px 12px; }
.spu-sh__h { min-width: 0; font: 600 17px/24px var(--font-v5); color: var(--v5-ink); }
.spu-meta { flex: none; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.spu-meta__b { font: 500 13px/18px var(--font-metric); color: var(--v5-ink); }
.spu-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0 16px; }
.spu-card { position: relative; display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 136px; padding: 14px; box-sizing: border-box; border-radius: 20px; animation: spu-rise 460ms cubic-bezier(.16, 1, .3, 1) both; animation-delay: calc(var(--i) * 60ms + 200ms); }
.spu-card--s { background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .spu-card--s { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.spu-card--l { border: 1.5px dashed var(--v5-border-strong); }
.spu-r { display: flex; align-items: center; justify-content: space-between; }
.spu-ic { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: color-mix(in srgb, var(--t) 16%, transparent); color: var(--t); }
.spu-card--l .spu-ic { background: color-mix(in srgb, var(--v5-ink) 6%, transparent); color: var(--v5-ink-4); }
.spu-th { font: 500 12px/16px var(--font-metric); color: var(--v5-ink-3); }
.spu-nm { font: 500 15px/20px var(--font-v5); color: var(--v5-ink); word-break: keep-all; overflow-wrap: anywhere; }
.spu-card--l .spu-nm { color: var(--v5-ink-2); }
.spu-ds { margin-top: -6px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.spu-bt { margin-top: auto; display: flex; align-items: center; gap: 4px; font: 500 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.spu-bt svg { flex: none; }
.spu-bt--lock { font-weight: 400; }
.spu-bt--ok { color: var(--v5-success-ink); }
.spu-bt--w { color: var(--v5-warning-ink); }
/* 34px glass pill inside a 44px hit area. */
.spu-act-hit { display: flex; align-items: center; min-height: 44px; margin: -5px 0; cursor: pointer; }
.spu-act { --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); display: inline-flex; align-items: center; justify-content: center; gap: 2px; height: 34px; padding: 0 14px; border-radius: 999px; font: 500 13px/18px var(--font-v5); white-space: nowrap; }
.spu-act-hit:active .spu-act { opacity: .85; }
.spu-pf { display: flex; align-items: center; gap: 6px; margin: 12px 18px 0; font: 500 13px/18px var(--font-v5); color: var(--v5-ink); }
.spu-pf svg { flex: none; color: var(--v5-warning-ink); }
.spu-pf--n { font-weight: 400; color: var(--v5-ink-2); }
.spu-pf--a, .spu-pf--a svg { color: var(--v5-success-ink); }
.spu-note { display: block; margin: 4px 18px 0; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.spu-note--wait { margin-top: 12px; }
@keyframes spu-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .spu-card { animation: none; }
}
</style>
