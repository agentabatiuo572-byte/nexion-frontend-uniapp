<!--
  Achievements (ported from Nexion-prototype/app/(main)/me/achievements/page.tsx).
  Progress hero + categorized list with unlock state, reward + claim button.
  Unlock conditions auto-evaluate on mount against live app store. Cross-store
  claim orchestration 走 postMoneyBills 收口点(资金与账单同生共死),仍在 handler 里。
  Wrapped in <NxPageContent :embedded="embedded" active="me">.
-->
<template>
  <NxPageContent :embedded="embedded" active="me">
    <view class="growth-achievements" style="padding-bottom: 24px">
      <SubPageHeader v-if="!embedded" back="/pages/me/me" />

      <view v-if="total !== 0 && !(remoteApiEnabled && remoteError && !remoteSnapshot)" class="achievement-summary mx-4">
        <GrowthProgress ring :size="82" :stroke="9" :value="percent" :label="percentLabel"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="1.8"><circle cx="12" cy="9" r="6" /><path d="m8 14-2 7 6-3 6 3-2-7" /></svg></GrowthProgress>
        <view><text class="block" :style="heroLabelStyle">{{ w.progress }}</text><view class="achievement-summary__count">{{ unlocked ?? '—' }} <text>/ {{ total === null ? '—' : total }}</text></view><text class="block" :style="heroLabelStyle">{{ percent === null ? '—' : fmt(t.growthUi.achievementCompleted, {n:percent}) }}</text></view>
      </view>

      <!-- Real-backend milestones. Remote mode never derives rewards from mock stores. -->
      <view v-if="remoteApiEnabled" style="margin-top: var(--v5-space-8); display: flex; flex-direction: column; gap: var(--v5-space-8)">
        <view v-if="remoteLoading && !remoteSnapshot" class="nx-glass-card mx-4" :style="listStyle">
          <text class="block" style="padding: 18px; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3)">{{ w.remoteLoading }}</text>
        </view>
        <EmptyState v-else-if="remoteError && !remoteSnapshot" kind="recoverable-error" :title="w.remoteUnavailable" :cta-label="w.retry" @cta="refreshRemote" />
        <template v-if="remoteSnapshot">
          <view v-if="!remoteGroups.length" class="mx-4" style="padding:var(--v5-space-6) 0;color:var(--v5-ink-3)" role="status">
            <text class="block">{{ emptyAchievements }}</text>
          </view>
          <view v-for="grp in remoteGroups" :key="grp.key" class="mx-4">
            <text class="block" :style="catHeadStyle">{{ grp.label }}</text>
            <view v-if="grp.key === 'daily' && remoteSnapshot.dailyMilestones.length" class="achievement-track">
              <text class="block achievement-track__caption">{{ t.growthUi.streakPrefix }} <text class="nx-num-metric achievement-streak">{{ remoteSnapshot.streak.currentStreak }}</text> {{ t.growthUi.streakSuffix }}</text>
              <view class="achievement-track__rail">
                <GrowthProgress class="achievement-track__bar" :value="dailyTrackPct" :label="w.serverDailyMilestones" />
                <view v-for="(milestone, mi) in remoteSnapshot.dailyMilestones" :key="milestone.milestoneId" class="achievement-node" :class="{'achievement-node--current': mi === currentDailyIndex, 'achievement-node--done': milestone.status !== 'LOCKED'}" :style="{left: remoteSnapshot.dailyMilestones.length === 4 ? ['24%', '50%', '75%', 'calc(100% - 8px)'][mi] : `${remoteSnapshot.dailyMilestones.length === 1 ? 50 : (mi + 1) / remoteSnapshot.dailyMilestones.length * 100}%`}">
                  <view class="achievement-node__dot" />
                  <view v-if="milestone.status !== 'LOCKED' || mi === currentDailyIndex" class="achievement-node__label"><text>{{ fmt(t.growthUi.milestoneDay, {n:milestone.milestoneDay}) }}</text><text class="achievement-node__reward">{{ dailyMilestoneRewardText(milestone, dailyRewardLabels(t.daily.milestones)) }}</text><NxButton v-if="milestone.status === 'CLAIMABLE'" variant="brand" size="small" :disabled="!!remoteBusy" :label="w.claim" @click="claimRemote(grp.rows[mi])" /></view>
                </view>
              </view>
            </view>
            <view v-else class="nx-glass-card" :class="{'achievement-badges': grp.key === 'badges'}" :style="listStyle">
              <view
                v-for="(row, i) in grp.rows"
                :key="row.key"
                class="achievement-row flex items-center" :class="{'achievement-row--badge': grp.key === 'badges', 'achievement-row--locked': row.status === 'LOCKED', 'achievement-row--ready': row.status === 'CLAIMABLE'}"
                :style="[grp.key === 'badges' ? {} : rowStyle(i !== 0), {'--ui-growth-delay': Math.min(i * 60, 480) + 'ms'}]"
              >
                <view class="grid place-items-center shrink-0" :style="remoteIconBoxStyle(row.status)">
                  <view v-html="iconSvg(row.iconId, row.status === 'LOCKED' ? 'var(--v5-ink-4)' : 'var(--v5-brand)')" />
                </view>
                <view class="min-w-0" style="flex: 1">
                  <text class="block" :style="aLabelStyle(row.status !== 'LOCKED')">{{ row.label }}</text>
                  <text class="block" :style="aDescStyle(row.status !== 'LOCKED')">{{ row.description }}</text>
                </view>
                <view class="text-right shrink-0">
                  <text v-if="row.status !== 'CLAIMABLE'" class="block" :style="rewardStyle(row.status !== 'LOCKED')">{{ row.reward }}</text>
                  <NxButton v-if="row.status === 'CLAIMABLE'" variant="brand" size="small" :disabled="!!remoteBusy" :label="remoteBusy === row.key ? w.claiming : `${w.claim} ${row.reward}`" @click="claimRemote(row)" />
                  <text v-else-if="row.status !== 'LOCKED'" class="block" style="margin-top: 2px; font-size: 12px; color: var(--v5-ink-3)">
                    {{ w.claimed }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </template>
      </view>

      <!-- Local prototype achievements stay available only in mock mode. -->
      <view v-else style="margin-top: var(--v5-space-8); display: flex; flex-direction: column; gap: var(--v5-space-8)">
        <view v-for="grp in groups" :key="grp.cat" class="mx-4">
          <text class="block" :style="catHeadStyle">{{ catLabel(grp.cat) }}</text>
          <view class="nx-glass-card" :style="listStyle">
            <view
              v-for="(a, i) in grp.list"
              :key="a.id"
              class="flex items-center"
              :style="rowStyle(i !== 0)"
            >
              <view class="grid place-items-center shrink-0" :style="iconBoxStyle(a, grp.cat)">
                <view v-html="iconSvg(a.id, isUnlocked(a.id) ? catColor(grp.cat) : 'var(--v5-ink-4)')" />
              </view>
              <view class="min-w-0" style="flex: 1">
                <view class="flex items-center" style="gap: 6px">
                  <text :style="aLabelStyle(isUnlocked(a.id))">{{ label(a) }}</text>
                  <svg v-if="!isUnlocked(a.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </view>
                <text class="block" :style="aDescStyle(isUnlocked(a.id))">{{ desc(a) }}</text>
                <text v-if="isUnlocked(a.id)" class="block" :style="aWhenStyle">{{ w.unlockedAt }} · {{ formatDisplayDateTime(recOf(a.id)!.unlockedAt, locale.code) }}</text>
              </view>
              <view class="text-right shrink-0">
                <text class="block" :style="rewardStyle(isUnlocked(a.id))">{{ rewardLabel(a) }}</text>
                <view
                  v-if="isUnlocked(a.id)"
                  class="active:opacity-80 transition-opacity"
                  :style="claimBtnStyle(isClaimed(a.id))"
                  @click="handleClaim(a.id)"
                >
                  <view v-if="isClaimed(a.id)" class="flex items-center" style="gap: var(--v5-space-1)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    <text>{{ w.claimed }}</text>
                  </view>
                  <text v-else>{{ w.claim }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </NxPageContent>
</template>

<script setup lang="ts">
import EmptyState from "@/components/empty-state.vue";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
const { embedded = false } = defineProps<{ embedded?: boolean }>();
import { formatGroupedAmount as formatAmount } from "@/lib/amount-display";
import { onMounted, computed, onUnmounted, ref, watch, type CSSProperties } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import GrowthProgress from "@/components/ui/growth-progress.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxPageContent from "@/components/ui/nx-page-content.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { dailyMilestoneRewardText, dailyRewardLabels } from "@/pages/daily/daily-reward-view";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { formatDisplayDateTime } from "@/lib/display-date";
import { toast } from "@/store/ui";
import { useApp } from "@/store/app";
import { postMoneyBillsOnce, type ReceiptDraft } from "@/lib/money-receipt";
import { useAchievements } from "@/store/achievements";
import { isPurchasedHardwareKind } from "@/store/device-types";
import { ACHIEVEMENTS, type AchievementCategory, type AchievementDef } from "@/mock/achievements";
import { pointsApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import type { BadgeAchievementStatus, DailySnapshot, DailyMilestoneStatus, EarningMilestoneStatus } from "@/api/points-api";
import { readAchievementsForCurrentSession, type AchievementRemoteReadFailure } from "./achievements-remote-read";

const t = useT();
import { useLocaleStore } from '@/store/locale';
import { uiLocale } from "@/i18n";
const locale = useLocaleStore();
const emptyAchievements = computed(() => ({ zh: '暂时没有可参与的成就', en: 'No achievements available yet', vi: 'Hiện chưa có thành tích khả dụng', id: 'Belum ada pencapaian yang tersedia', ms: 'Belum ada pencapaian tersedia', fil: 'Wala pang available na achievement', ru: 'Доступных достижений пока нет', kk: 'Әзірге қолжетімді жетістік жоқ', uz: 'Hozircha yutuqlar yoʻq' })[uiLocale(locale.code)]);
const w = computed(() => t.value.achievements);
const app = useApp();
const ach = useAchievements();
const remoteSnapshot = ref<DailySnapshot | null>(null);
const remoteLoading = ref(false);
const remoteError = ref(false);
// Safe diagnostic class only: never expose a server response/body or token in UI/logs.
const remoteFailure = ref<AchievementRemoteReadFailure | null>(null);
const remoteBusy = ref("");
let accountGeneration = 0;
let readGeneration = 0;
let pageVisible = true;
let disposed = false;
function invalidateRemote() {
  accountGeneration += 1;
  readGeneration += 1;
  remoteLoading.value = false;
  remoteError.value = false;
  remoteFailure.value = null;
  remoteBusy.value = "";
}
function isCurrentRemote(account: number): boolean {
  return !disposed && pageVisible && account === accountGeneration;
}
watch(() => [app.accountKey, app.accountBindingEpoch], () => {
  invalidateRemote();
  remoteSnapshot.value = null;
  if (remoteApiEnabled && pageVisible && !disposed) void refreshRemote();
}, { flush: "sync" });

type RemoteStatus = DailyMilestoneStatus | EarningMilestoneStatus | BadgeAchievementStatus;
interface RemoteMilestoneRow {
  key: string;
  kind: "daily" | "earning" | "badge";
  id: number | string;
  label: string;
  description: string;
  reward: string;
  status: RemoteStatus;
  iconId: string;
}

const CAT_COLOR: Record<AchievementCategory, string> = {
  firsts: "var(--v5-brand)",
  earnings: "var(--v5-warning)",
  social: "var(--v5-tech-cyan)",
  loyalty: "var(--v5-success)",
  hardware: "var(--v5-brand-2)",
};

const ICON_SVG: Record<string, string> = {
  flame: `<path d="M5 12.5 10 17 19 7.5" />`,
  calendar: `<rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />`,
  cpu: `<rect x="4" y="4" width="16" height="12" rx="2" /><path d="M8 20h8M12 16v4" />`,
  book: `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Zm20 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" />`,
  users: `<circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M19 8v6M22 11h-6" />`,
  zap: `<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z" />`,

  first_contribution: `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />`,
  first_dollar: `<line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />`,
  power_user: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />`,
  social_star: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />`,
  hardware_owner: `<path d="M3.5 8 12 12l8.5-4M12 12v9.5" /><path d="m7.5 4.27 9 5.15" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />`,
  diamond_miner: `<path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" />`,
};
function iconSvg(id: string, color: string): string {
  const inner = ICON_SVG[id] ?? `<circle cx="12" cy="12" r="9" />`;
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

// Auto-evaluate unlock conditions (mirrors source useMemo on mount).
function evaluate() {
  const onlineDevices = app.visibleDevices.filter((d) => isPurchasedHardwareKind(d.kind)).length;
  const earningsTotal = app.earnings.total;
  if (onlineDevices > 0) ach.unlock("hardware_owner");
  if (earningsTotal >= 1) ach.unlock("first_dollar");
  if (earningsTotal >= 1000) ach.unlock("diamond_miner");
  if (earningsTotal > 0) ach.unlock("first_contribution");
}
async function refreshRemote() {
  if (!remoteApiEnabled || !pageVisible || disposed) return;
  const account = accountGeneration;
  const request = ++readGeneration;
  const isCurrent = () => isCurrentRemote(account) && request === readGeneration;
  remoteLoading.value = true;
  remoteError.value = false;
  remoteFailure.value = null;
  const result = await readAchievementsForCurrentSession({
    accountKey: () => app.accountKey,
    session: () => sessionVault.read(),
    isCurrent,
    read: () => pointsApi.state(),
  });
  if (!isCurrent() || result.kind === "stale") return;
  if (result.kind === "success") {
    remoteSnapshot.value = result.snapshot;
  } else {
    remoteFailure.value = result.failure;
    remoteError.value = true;
  }
  remoteLoading.value = false;
}
useAutoRecovery({
  failed: () => remoteApiEnabled && remoteError.value && !remoteLoading.value,
  retry: refreshRemote,
});

onMounted(() => {
  if (!embedded) return;
  pageVisible = true;
  if (remoteApiEnabled) void refreshRemote(); else evaluate();
});
onShow(() => {
  if (disposed) return;
  pageVisible = true;
  if (remoteApiEnabled) void refreshRemote();
  else evaluate();
});
onHide(() => {
  pageVisible = false;
  invalidateRemote();
});
onUnmounted(() => {
  disposed = true;
  pageVisible = false;
  invalidateRemote();
});

const remoteGroups = computed(() => {
  const snapshot = remoteSnapshot.value;
  if (!snapshot) return [];
  const rewardLabels = dailyRewardLabels(t.value.daily.milestones);
  const daily: RemoteMilestoneRow[] = snapshot.dailyMilestones.map((row) => ({
    key: `daily:${row.milestoneId}`,
    kind: "daily",
    id: row.milestoneId,
    label: `${w.value.dailyMilestone} ${row.milestoneDay}`,
    description: `${w.value.streakProgress}: ${snapshot.streak.currentStreak}/${row.milestoneDay}`,
    reward: dailyMilestoneRewardText(row, rewardLabels),
    status: row.status,
    iconId: "power_user",
  }));
  const earnings: RemoteMilestoneRow[] = snapshot.earningMilestones.map((row) => ({
    key: `earning:${row.milestoneId}`,
    kind: "earning",
    id: row.milestoneId,
    label: `${w.value.earningMilestone} ${formatAmount(row.thresholdUsdt)}`,
    description: `${w.value.lifetimeEarnings} ${formatAmount(row.lifetimeEarningsUsdt)}`,
    reward: `+${formatAmount(row.rewardNex)} UVT`,
    status: row.status,
    iconId: "first_dollar",
  }));
  const badges: RemoteMilestoneRow[] = snapshot.badgeAchievements.map((row) => ({
    key: `badge:${row.achievementCode}`,
    kind: "badge",
    id: row.achievementCode,
    label: row.name,
    description: row.description,
    reward: row.rewardPoints > 0 ? fmt(w.value.pointsReward, { n: row.rewardPoints }) : badgeCategoryLabel(row.category),
    status: row.status,
    iconId: row.iconKey || "power_user",
  }));
  return [
    { key: "daily", label: w.value.serverDailyMilestones, rows: daily },
    { key: "earning", label: w.value.serverEarningMilestones, rows: earnings },
    { key: "badges", label: w.value.serverBadgeAchievements, rows: badges },
  ].filter((group) => group.rows.length > 0);
});

const groups = computed(() => {
  const cats: AchievementCategory[] = ["firsts", "earnings", "social", "loyalty", "hardware"];
  return cats
    .map((cat) => ({ cat, list: ACHIEVEMENTS.filter((a) => a.category === cat) }))
    .filter((g) => g.list.length > 0);
});

const currentDailyIndex = computed(() => {
  const rows = remoteSnapshot.value?.dailyMilestones ?? [];
  const claimable = rows.findIndex(row => row.status === 'CLAIMABLE');
  if (claimable >= 0) return claimable;
  return rows.findIndex(row => row.status === 'LOCKED');
});
const dailyTrackPct = computed(() => {
  const snapshot = remoteSnapshot.value;
  if (!snapshot || !snapshot.dailyMilestones.length) return 0;
  const rows = snapshot.dailyMilestones;
  // Track positions reflect the actual operator-configured milestone days.
  const current = snapshot.streak.currentStreak;
  if (rows.length === 1) return Math.min(100, current / rows[0].milestoneDay * 100);
  const next = rows.findIndex(row => row.milestoneDay > current);
  if (next < 0) return 100;
  if (next === 0) return current / rows[0].milestoneDay / rows.length * 100;
  const before = rows[next - 1].milestoneDay, after = rows[next].milestoneDay;
  return ((next + (current - before) / (after - before)) / rows.length) * 100;
});

const unlocked = computed<number | null>(() => remoteApiEnabled
  ? remoteSnapshot.value
    ? remoteGroups.value.flatMap((group) => group.rows).filter((row) => row.status === "CLAIMED" || row.status === "FIRED" || row.status === "UNLOCKED").length
    : null
  : ach.records.length);
const total = computed<number | null>(() => remoteApiEnabled
  ? remoteSnapshot.value
    ? remoteGroups.value.reduce((sum, group) => sum + group.rows.length, 0)
    : null
  : ACHIEVEMENTS.length);
const percent = computed<number | null>(() => total.value === null || unlocked.value === null
  ? null
  : total.value > 0 ? Math.round((unlocked.value / total.value) * 100) : 0);
const percentLabel = computed(() => percent.value === null ? "—" : `${percent.value}%`);

async function claimRemote(row: RemoteMilestoneRow) {
  if (!remoteApiEnabled || !pageVisible || disposed || row.status !== "CLAIMABLE" || remoteBusy.value) return;
  remoteBusy.value = row.key;
  const account = accountGeneration;
  try {
    if (row.kind === "daily") {
      const receipt = await pointsApi.claimMilestone(Number(row.id), `h5-achievement-daily:${row.id}`);
      if (!isCurrentRemote(account)) return;
      if (remoteSnapshot.value) remoteSnapshot.value = {
        ...remoteSnapshot.value,
        dailyMilestones: remoteSnapshot.value.dailyMilestones.map((item) => item.milestoneId === receipt.milestoneId
          ? { ...item, status: "CLAIMED" } : item),
      };
    } else {
      const receipt = await pointsApi.evaluateEarningMilestones(`h5-achievement-earning:${row.id}`, String(row.id));
      if (!isCurrentRemote(account)) return;
      if (remoteSnapshot.value) remoteSnapshot.value = {
        ...remoteSnapshot.value,
        earningMilestones: remoteSnapshot.value.earningMilestones.map((item) => receipt.fired.some((fired) => fired.milestoneId === item.milestoneId)
          ? { ...item, status: "FIRED" } : item),
      };
    }
    readGeneration += 1;
    toast.success(w.value.claimToast);
    await refreshRemote();
  } catch {
    if (isCurrentRemote(account)) toast.error(w.value.remoteUnavailable);
  } finally {
    if (isCurrentRemote(account)) remoteBusy.value = "";
  }
}

function recOf(id: string) {
  return ach.records.find((r) => r.id === id) ?? null;
}
function isUnlocked(id: string): boolean {
  return !!recOf(id);
}
function isClaimed(id: string): boolean {
  return !!recOf(id)?.claimed;
}
function catColor(c: AchievementCategory): string {
  return CAT_COLOR[c];
}
function catLabel(c: AchievementCategory): string {
  switch (c) {
    case "firsts":
      return w.value.catFirsts;
    case "earnings":
      return w.value.catEarnings;
    case "social":
      return w.value.catSocial;
    case "loyalty":
      return w.value.catLoyalty;
    case "hardware":
      return w.value.catHardware;
  }
}
// `nx_achievement.category` is operator-set and uppercased by the API parser.
// A category with no shipped label must degrade to a neutral word, never print
// the stored code.
function badgeCategoryLabel(category: string): string {
  switch (category.trim().toLowerCase()) {
    case "streak": return w.value.catStreak;
    case "firsts": return w.value.catFirsts;
    case "earnings": return w.value.catEarnings;
    case "social": return w.value.catSocial;
    case "loyalty": return w.value.catLoyalty;
    case "hardware": return w.value.catHardware;
    default: return w.value.catOther;
  }
}
function label(a: AchievementDef): string {
  return (w.value as unknown as Record<string, string>)[`a_${a.i18nKey}`] ?? a.id;
}
function desc(a: AchievementDef): string {
  return (w.value as unknown as Record<string, string>)[`a_${a.i18nKey}_d`] ?? "";
}
function rewardLabel(a: AchievementDef): string {
  if (a.rewardNex) return `+${formatAmount(a.rewardNex)} UVT`;
  if (a.rewardUsdt) return `+${formatAmount(a.rewardUsdt)}`;
  return "VIP badge";
}
function handleClaim(id: string) {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return;
  // 🔴 前置门必须与消费门 `claim()` **等强**:后者的守卫是「记录存在(=已解锁)**且**未领」,
  // 只查 `isClaimed` 会漏掉前一半 —— 先发钱后消费的顺序下,未解锁的成就会**先把奖发出去**
  // 再被 claim() 拒。当前不可达(按钮只在 isUnlocked 时渲染),但「前置门弱于消费门」
  // 正是这类事故的定义:渲染层的拦截不是判定层的拦截(卡轨双击那条同一形状)。
  if (!ach.isUnlocked(id) || ach.isClaimed(id)) return;
  const name = label(def);
  // 同一次领取的两腿一次落盘 —— 发了 NEX 没发 $ 是半边账,收据即指令(不再单独 credit*)。
  // 🔴 顺序 = 先发钱(幂等)→ 后消费资格(2026-08-04 对抗审计 B-P1-3):原来是先 ach.claim(id)
  // 消费掉,发钱失败就 return —— 成就标记已置、奖归零且**再也领不了**(成就是一次性的)。
  // ref 本来就是成就 id(天然稳定),换成幂等出口后重放不会重复发。
  const drafts: ReceiptDraft[] = [];
  if (def.rewardNex) drafts.push({ type: "achievement", symbol: "UVT", amount: def.rewardNex, status: "posted", memo: `Achievement · ${name}`, ref: id });
  if (def.rewardUsdt) drafts.push({ type: "achievement", symbol: "USDT", amount: def.rewardUsdt, status: "posted", memo: `Achievement · ${name}`, ref: id });
  if (drafts.length && postMoneyBillsOnce(drafts) !== "ok") return;
  if (!ach.claim(id)) return; // 消费失败:钱已幂等落定,下次重试命中同一 ref 不会再发
  toast.success(w.value.claimToast);
}

// De-carded: progress stat + bar sit on the page floor (surface/border/padding
// dropped). Warning icon tint box + progress bar kept. 2px inset aligns with the
// category labels + badge lists below.
const heroStyle: CSSProperties = { padding: "0 2px" };
const heroIconBoxStyle: CSSProperties = { width: "56px", height: "56px", borderRadius: "var(--v5-radius-m)", background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)" };
const heroLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const heroCountStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "26px", fontWeight: 600, color: "var(--v5-ink)" };
const heroTotalStyle: CSSProperties = { fontSize: "var(--ui-type-body)", color: "var(--v5-ink-4)" };
const heroPctStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, color: "var(--v5-brand)" };
const barTrackStyle: CSSProperties = { marginTop: "12px", height: "8px", borderRadius: "var(--v5-radius-full)", background: "var(--v5-surface-2)", overflow: "hidden" };
const barFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: percent.value === null ? "0%" : `${percent.value}%`,
  background: "linear-gradient(90deg, var(--v5-warning), var(--v5-brand))",
  transition: "width 700ms ease",
}));
const catHeadStyle: CSSProperties = {
  padding: "0 4px",
  marginBottom: "12px",
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-section)",
  fontWeight: 600,
  letterSpacing: "-0.012em",
  color: "var(--v5-ink)",
};
const retryBtnStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  margin: "4px 18px 14px",
  color: "var(--v5-brand)",
  fontSize: "13px",
  fontWeight: 600,
};
function remoteIconBoxStyle(status: RemoteStatus): CSSProperties {
  return {
    width: "40px",
    height: "40px",
    borderRadius: "var(--v5-radius-s)",
    background: status === "LOCKED" ? "var(--v5-surface-3)" : "var(--v5-brand-soft)",
    opacity: 1,
  };
}
// Badge list keeps a filled tile identity (achievement/badge semantic, de-card
// white-list) — the single visual difference is the fill; outer border dropped.
const listStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderRadius: "var(--ui-radius-surface)",
  overflow: "hidden",
};
function rowStyle(divider: boolean): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 16px",
    borderTop: divider ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)" : "none",
  };
}
function iconBoxStyle(a: AchievementDef, cat: AchievementCategory): CSSProperties {
  const ul = isUnlocked(a.id);
  return {
    width: "40px",
    height: "40px",
    borderRadius: "var(--v5-radius-s)",
    // 未解锁态原用 --v5-surface,与所在卡片同色 → 图标框整个隐形(双主题)。
    // 改 surface-3(同 security.vue 关闭态图标框的既有惯例);叠加下面的 opacity .5 后
    // 对卡片仍有 ΔE≈4.5,弱而可见 —— 未解锁本就该弱,但不该没有。
    background: ul ? `color-mix(in srgb, ${CAT_COLOR[cat]} 10%, transparent)` : "var(--v5-surface-3)",
    opacity: ul ? 1 : 0.5,
  };
}
function aLabelStyle(ul: boolean): CSSProperties {
  return { fontSize: "15px", fontWeight: 500, color: "var(--v5-ink)" };
}
function aDescStyle(ul: boolean): CSSProperties {
  return { fontSize: "12px", marginTop: "2px", lineHeight: 1.375, color: "var(--v5-ink-3)" };
}
const aWhenStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-4)", marginTop: "2px", lineHeight: 1.5, whiteSpace: "normal", overflowWrap: "anywhere" };
function rewardStyle(ul: boolean): CSSProperties {
  return { fontFamily: "var(--font-metric)", fontSize: "13px", fontWeight: 500, color: ul ? "var(--v5-nex-ink)" : "var(--v5-ink-3)" };
}
function claimBtnStyle(claimed: boolean): CSSProperties {
  return {
    marginTop: "4px",
    // mobile-first tap target — matches source h-11 (44px) px-2.5
    height: "44px",
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    background: claimed ? "var(--v5-surface-2)" : "var(--v5-brand)",
    color: claimed ? "var(--v5-ink-4)" : "var(--v5-on-brand)",
  };
}


</script>

<style scoped>
.achievement-summary { display:flex; align-items:center; gap:18px; padding:18px 16px; border-radius:var(--ui-radius-surface); background:var(--v5-surface); margin-top:var(--v5-space-3); }.achievement-summary__count { font:500 32px/38px var(--font-metric); letter-spacing:-.02em; }.achievement-summary__count text { font-size:16px; color:var(--v5-ink-3); }
.achievement-track { padding:18px 24px 14px; border-radius:var(--ui-radius-surface); background:var(--v5-surface); }.achievement-track__caption { font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }.achievement-track__rail { position:relative; height:90px; margin:var(--v5-space-4) 8px 0; }.achievement-track__bar { position:absolute; left:0; right:0; top:7px; height:4px; }
.achievement-node { position:absolute; top:0; width:18px; height:18px; margin-left:-9px; display:grid; place-items:center; border-radius:50%; }.achievement-node__dot { width:8px; height:8px; border-radius:50%; background:var(--v5-ink-4); }.achievement-node--done .achievement-node__dot { background:var(--v5-brand); }.achievement-node--current { box-shadow:inset 0 0 0 2px var(--v5-brand); background:var(--v5-brand-soft); }.achievement-node--current .achievement-node__dot { background:var(--v5-brand); animation: achievement-pulse 2s ease-in-out infinite; }
.achievement-node__label { position:absolute; top:24px; left:50%; transform:translateX(-50%); text-align:center; width:100px; font:500 12px/16px var(--font-v5); color:var(--v5-brand); }.achievement-node:last-child .achievement-node__label { transform:translateX(-85%); }.achievement-node__reward { display:block; font:500 11px/14px var(--font-metric); color:var(--v5-nex); }
.achievement-row--ready { position:relative; overflow:hidden; background:color-mix(in srgb,var(--v5-brand) 8%,transparent); }.achievement-row--locked { opacity:.55; }
.achievement-badges { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--v5-space-2); background:transparent !important; box-shadow:none !important; }
.achievement-row--badge { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 6px 12px; border-radius:18px; background:var(--v5-surface); text-align:center; animation:nx-viz-pop 420ms cubic-bezier(.2,1.4,.4,1) var(--ui-growth-delay) both; }.achievement-row--badge.achievement-row--locked { border:1.5px dashed var(--v5-border-strong); background:transparent; }.achievement-row--badge > view { flex:none !important; }.achievement-row--badge > view:first-child {width:44px !important;height:44px !important;border-radius:50% !important;}.achievement-row--badge > view:last-child { text-align:center; }.achievement-row--badge > view:nth-child(2) > text:first-child { font:500 13px/18px var(--font-v5) !important; }.achievement-row--badge > view:nth-child(2) > text:nth-child(2), .achievement-row--badge > view:last-child > text:nth-child(2) { display:none; }
@keyframes achievement-pulse { 50% {transform:scale(.7); opacity:.5;} }
@media (prefers-reduced-motion:reduce) { .achievement-row--badge,.achievement-node__dot {animation:none !important;} }

/* Approved growth board geometry and material. */
 .achievement-track { padding:18px 16px 14px; min-height:117.5px; box-sizing:border-box; }.achievement-track__rail { height:56px; margin-top:10px; }
.achievement-streak { font-weight:600; color:var(--v5-ink); }.achievement-row:not(.achievement-row--badge) { min-height:60px; padding:8px 16px !important; box-sizing:border-box; }
.achievement-row--locked { opacity:.55; }.achievement-row--badge { padding:14px 6px 12px; min-height:115px; box-sizing:border-box; }
.achievement-row--badge > view:first-child { box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--v5-brand) 40%,transparent); }
.achievement-row--badge.achievement-row--locked > view:first-child { box-shadow:none; }
.achievement-row--badge > view:last-child > text:first-child { font:500 11px/14px var(--font-metric) !important; color:var(--v5-success-ink) !important; }
.achievement-row--badge.achievement-row--locked > view:last-child > text:first-child { color:var(--v5-ink-4) !important; }
.achievement-row :deep(.nx-button--brand > .nx-button__surface), .achievement-node :deep(.nx-button--brand > .nx-button__surface) { --ui-button-ink:var(--v5-ink) !important; }

.achievement-row--badge.achievement-row--locked {opacity:1;}.achievement-row--badge.achievement-row--locked > view:nth-child(2) > text:first-child {color:var(--v5-ink-3) !important;}

.achievement-track__rail { margin:12px 0 0; height:50px; }
.achievement-track__bar { left:8px; right:8px; }
.achievement-summary { min-height:120px; box-sizing:border-box; }
.achievement-summary > view:last-child { transform:translate(2px,2.5px); }
.achievement-summary > view:last-child > text:last-child { margin-top:4px; }
.achievement-row--badge:not(.achievement-row--locked) > view:first-child { background:var(--v5-brand-soft)!important; }

</style>
