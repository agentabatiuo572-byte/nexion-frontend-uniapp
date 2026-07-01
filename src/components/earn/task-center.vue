<!--
  TaskCenter — ported from Nexion-prototype/app/components/task-center.tsx.
  Single merged view (no tabs): "Upgrade Unlocks" locked-tier teasers
  (VRAM-gated, route to /store) on top, followed by the task History list
  (last 20 completed across devices). The currently-processing section and the
  Current/History tab switcher were removed per product direction.

  Receipt detail: each completed row has a "view receipt" icon (Proof of Compute)
  that opens the ported ReceiptModal (components/me/receipt-modal.vue), looked up
  by task id via useReceipts().byId() — receipts are minted on task completion in
  store/app.ts (generateReceipt sets receipt.id = task.id).
-->
<template>
  <view class="mx-4" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--v5-border)">
    <view class="flex items-center justify-between mb-2.5 px-0">
      <text style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.earn.taskCenter }}</text>
      <view class="flex items-center gap-1" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>
        <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-brand)">8,432</text>
        <text>{{ t.earn.jobsLive }}</text>
      </view>
    </view>

    <!-- Upgrade Unlocks -->
    <view v-if="lockedTeasers.length > 0">
      <view class="pt-1 pb-1">
        <view class="flex items-center gap-1.5" style="font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <text>{{ t.earn.upgradeUnlocks }}</text>
        </view>
        <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ t.earn.upgradeUnlocksHint }}</text>
      </view>
      <view class="pt-1.5 pb-4 space-y-2">
        <view
          v-for="teaser in lockedTeasers"
          :key="teaser.category"
          class="flex items-center gap-3 active:opacity-80"
          style="min-height: 64px; padding: 10px; border-radius: 14px; background: linear-gradient(180deg, #111317 0%, #15181C 100%); border: 1px solid color-mix(in srgb, var(--v5-border) 72%, transparent)"
          @click="goStore"
        >
          <view class="rounded-lg grid place-items-center shrink-0" style="width: 36px; height: 36px; background: color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent)">
            <svg width="20" height="20" :viewBox="categoryIconViewBox(teaser.category)" fill="none" stroke="var(--v5-tech-cyan)" :stroke-width="categoryIconStrokeWidth(teaser.category)" stroke-linecap="round" stroke-linejoin="round"><path :d="categoryIconPath(teaser.category)" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block truncate" style="font-size: 12.5px; font-weight: 500; color: var(--v5-ink)">{{ teaser.model }}<text style="color: var(--v5-ink-4); margin: 0 4px">·</text><text style="color: var(--v5-ink)">{{ taskCategoryLabel(teaser.category) }}</text></text>
            <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px; line-height: 1.35">
              <text style="white-space: nowrap">{{ t.earn.requires }} <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-tech-cyan)">{{ teaser.minVRAM }}GB VRAM</text> · </text><text>{{ unlockTierLabel(teaser.unlockTier) }}</text>
            </text>
          </view>
          <view class="text-right shrink-0">
            <text class="block tabular-nums" style="font-family: var(--font-v5); font-size: 15px; color: var(--v5-brand); font-weight: 600; line-height: 1">+${{ teaser.dailyPotentialUSD.toLocaleString() }}<text style="font-size: 10.5px; color: var(--v5-ink-3); font-weight: 400; margin-left: 2px">/d</text></text>
            <view class="flex items-center justify-end gap-0.5" style="font-size: 10.5px; color: var(--v5-ink-4); margin-top: 4px">
              <text>{{ t.earn.upgradeNow }}</text>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Task History (merged single list) -->
    <view class="pt-3 pb-2" :style="historyHeadStyle">
      <view class="flex items-center justify-between">
        <text style="font-size: 15px; font-weight: 600; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.taskHistory.tabHistory }}</text>
        <view class="flex items-center active:opacity-60" style="gap: 2px; padding: 6px 0 6px 16px" @click="goReceipts">
          <text style="font-size: 12.5px; font-weight: 500; color: var(--v5-brand)">{{ t.taskHistory.viewAll }}</text>
          <svg style="color: var(--v5-brand)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </view>
      </view>
      <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ historyHintText }}</text>
    </view>
    <view v-if="allRecent.length === 0" class="pb-4">
      <text style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.taskHistory.historyEmpty }}</text>
    </view>
    <view v-else class="pb-3 task-history-list">
      <view v-for="(task, i) in allRecent" :key="i" class="task-history-row active:opacity-80" :style="historyRowStyle(i)" @click="openReceipt = receiptFor(task.id) ?? null">
        <svg class="shrink-0" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.1 2.1 4.9-5" /></svg>
        <view class="task-history-main">
          <view class="task-history-name-row">
            <text class="task-history-model">{{ task.model }}</text>
            <text class="task-history-dot">·</text>
            <text class="task-history-chip" :style="historyChipStyle(task.category)">{{ taskCategoryLabel(task.category) }}</text>
          </view>
        </view>
        <text class="tabular-nums shrink-0 task-history-reward">+${{ task.reward.toFixed(3) }}</text>
        <text class="text-right shrink-0 task-history-time">{{ shortTime(task.completedAt) }}</text>
        <view v-if="receiptFor(task.id)" class="shrink-0 grid place-items-center active:opacity-60" style="width: 24px; height: 24px; border-radius: 6px; color: var(--v5-ink-4)" @click.stop="openReceipt = receiptFor(task.id) ?? null">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7h3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm11 8v3a2 2 0 0 0 2-2v-1zm-1 3V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a2 2 0 0 0 2 2zM6 6.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5m0 3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5m0 3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5" /></svg>
        </view>
        <view v-else class="shrink-0" style="width: 24px; height: 24px" />
      </view>
    </view>
    <ReceiptModal :receipt="openReceipt" @close="openReceipt = null" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { getLockedTeasers } from "@/mock/tasks";
import type { TaskCategory } from "@/store/types";
import ReceiptModal from "@/components/me/receipt-modal.vue";
import { useReceipts } from "@/store/receipts";
import type { Receipt } from "@/mock/receipt";
import { fmt } from "@/i18n/format";

const app = useApp();
const t = useT();
const receipts = useReceipts();
const openReceipt = ref<Receipt | null>(null);
function receiptFor(id: string): Receipt | undefined {
  return receipts.byId(id);
}

// History list: completed tasks across all devices, most-recent first (last 3).
const allRecent = computed(() =>
  app.devices
    .flatMap((d) => d.recentTasks)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 3),
);

const maxVram = computed(() => app.devices.reduce((m, d) => Math.max(m, d.vramTotal), 0));
const lockedTeasers = computed(() => getLockedTeasers(maxVram.value, 3));

const historyHintText = computed(() =>
  t.value.taskHistory.historyHint.replace("{n}", String(allRecent.value.length)),
);

// Divider above History only when the Upgrade Unlocks block precedes it.
const historyHeadStyle = computed<CSSProperties>(() => ({
  borderTop:
    lockedTeasers.value.length > 0
      ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)"
      : "none",
}));

function historyRowStyle(i: number): CSSProperties {
  return {
    borderBottom:
      i === allRecent.value.length - 1
        ? "none"
        : "1px solid color-mix(in srgb, var(--v5-border) 58%, transparent)",
  };
}

function historyChipStyle(category: TaskCategory): CSSProperties {
  const color = category === "SP" ? "var(--v5-tech-cyan)" : category === "EM" ? "var(--v5-ink-3)" : "var(--v5-brand)";
  return {
    color,
    background: `color-mix(in srgb, ${color} 16%, transparent)`,
  };
}

const CATEGORY_ICON_PATHS: Record<TaskCategory, string> = {
  IG: "M6.5 8a2 2 0 1 0 4 0a2 2 0 0 0-4 0m14.427 1.99c-6.61-.908-12.31 4-11.927 10.51 M3 13.066c2.78-.385 5.275.958 6.624 3.1 M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z", // image
  VG: "M3 2.5h10c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V4c0-.83.67-1.5 1.5-1.5m-1.5 3h13 M3.5 5.5l2-3m1.5 3l2-3m1.5 3l2-3M6.5 8v4l4-2z", // film
  LL: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", // message
  FT: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.7-2.7z", // wrench
  EM: "M3 5a9 3 0 0 0 18 0a9 3 0 0 0-18 0M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0", // database
  SP: "M11.5 6C7.022 6 4.782 6 3.391 7.172S2 10.229 2 14s0 5.657 1.391 6.828S7.021 22 11.5 22c4.478 0 6.718 0 8.109-1.172S21 17.771 21 14c0-1.17 0-2.158-.041-3 M18.5 2l.258.697c.338.914.507 1.371.84 1.704.334.334.791.503 1.705.841L22 5.5l-.697.258c-.914.338-1.371.507-1.704.84-.334.334-.503.791-.841 1.705L18.5 9l-.258-.697c-.338-.914-.507-1.371-.84-1.704-.334-.334-.791-.503-1.705-.841L15 5.5l.697-.258c.914-.338 1.371-.507 1.704-.84.334-.334.503-.791.841-1.705z M12 10v8m-3-6v4m-3-3v2m9-3v4m3-3v2", // audio
};
function categoryIconPath(category: TaskCategory): string {
  return CATEGORY_ICON_PATHS[category] ?? CATEGORY_ICON_PATHS.IG;
}
function categoryIconViewBox(category: TaskCategory): string {
  return category === "VG" ? "0 0 16 16" : "0 0 24 24";
}
function categoryIconStrokeWidth(category: TaskCategory): number {
  if (category === "VG") return 1;
  return category === "IG" || category === "SP" ? 1.5 : 2;
}

function taskCategoryLabel(category: TaskCategory): string {
  switch (category) {
    case "IG":
      return t.value.earn.taskCategoryIG;
    case "VG":
      return t.value.earn.taskCategoryVG;
    case "LL":
      return t.value.earn.taskCategoryLL;
    case "FT":
      return t.value.earn.taskCategoryFT;
    case "EM":
      return t.value.earn.taskCategoryEM;
    case "SP":
      return t.value.earn.taskCategorySP;
    default:
      return category;
  }
}

function unlockTierLabel(tier: string): string {
  return tier.replace("RTX 4090 PC", t.value.earn.rtx4090Host);
}

function goStore() {
  uni.navigateTo({ url: "/pages/store/store", fail: () => {} });
}

function goReceipts() {
  uni.navigateTo({ url: "/pages/me/receipts", fail: () => {} });
}

function shortTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return t.value.taskHistory.justNow;
  if (m < 60) return fmt(t.value.taskHistory.minAgo, { n: m });
  return fmt(t.value.taskHistory.hourAgo, { n: Math.floor(m / 60) });
}
</script>

<style scoped>
.task-history-list {
  border-top: 1px solid color-mix(in srgb, var(--v5-border) 58%, transparent);
}

.task-history-row {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  font-size: 12px;
}

.task-history-main {
  flex: 1;
  min-width: 0;
}

.task-history-name-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.task-history-model {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--v5-ink-2);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.task-history-dot {
  flex-shrink: 0;
  color: var(--v5-ink-4);
}

.task-history-chip {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10.5px;
  line-height: 15px;
}

.task-history-reward {
  width: 56px;
  font-family: var(--font-v5);
  color: var(--v5-brand);
  font-size: 12.5px;
  text-align: right;
}

.task-history-time {
  width: 54px;
  color: var(--v5-ink-3);
  font-size: 11.5px;
}
</style>
