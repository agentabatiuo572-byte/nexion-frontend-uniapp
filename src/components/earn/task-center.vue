<!--
  TaskCenter — ported from Nexion-prototype/app/components/task-center.tsx.
  Single merged view (no tabs): "Upgrade Unlocks" locked-tier teasers
  (VRAM-gated, route to /store) on top, followed by the task History list
  (latest 3 completed across devices). The currently-processing section and the
  Current/History tab switcher were removed per product direction.

  Receipt detail: each completed row has a "view receipt" icon (Proof of Compute)
  that opens the ported ReceiptModal (components/me/receipt-modal.vue), looked up
  by task id via useReceipts().byId() — receipts are minted on task completion in
  store/app.ts (generateReceipt sets receipt.id = task.id).
-->
<template>
  <view class="mx-4" style="border-top: 1px solid var(--v5-border); padding-top: 22px">
    <view class="flex items-center justify-between px-0" style="margin-bottom: 16px">
      <text style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); letter-spacing: 0">{{ t.earn.taskCenter }}</text>
      <view class="flex items-center gap-1" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>
        <text class="tabular-nums" style="font-family: var(--font-amount); color: var(--v5-brand)">8,432</text>
        <text>{{ t.earn.jobsLive }}</text>
      </view>
    </view>

    <!-- Upgrade Unlocks -->
    <view v-if="showUpgradeUnlocks && lockedTeasers.length > 0">
      <view class="pt-1 pb-1">
        <view class="flex items-center gap-1.5" style="font-size: 11.5px; letter-spacing: 0.16em; color: var(--v5-ink)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <text>{{ t.earn.upgradeUnlocks }}</text>
        </view>
        <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ t.earn.upgradeUnlocksHint }}</text>
      </view>
      <view :style="lockedListStyle">
        <view
          v-for="teaser in lockedTeasers"
          :key="teaser.category"
          class="active:opacity-80"
          :style="lockedCardStyle"
          @click="goStore"
        >
          <view class="grid place-items-center shrink-0" :style="lockedIconBoxStyle">
            <svg
              width="20"
              height="20"
              :viewBox="categoryIconViewBox(teaser.category)"
              :fill="categoryIconFill(teaser.category)"
              :stroke="categoryIconStrokeColor(teaser.category)"
              :stroke-width="categoryIconStroke(teaser.category)"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path v-for="p in categoryIconPaths(teaser.category)" :key="p" :d="p" />
            </svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block truncate" style="font-size: 12.5px; font-weight: 500; color: var(--v5-ink)">{{ teaser.model }}<text style="color: var(--v5-ink-4); margin: 0 4px">·</text><text style="color: var(--v5-ink-3)">{{ taskLabel(teaser.category) }}</text></text>
            <text class="block truncate" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ t.earn.requires }} <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-tech-cyan)">{{ teaser.minVRAM }}GB VRAM</text> · {{ teaser.unlockTier }}</text>
          </view>
          <view class="text-right shrink-0">
            <text class="block tabular-nums" style="font-family: var(--font-amount); font-size: 15px; color: var(--v5-brand); font-weight: 600; line-height: 1">+${{ teaser.dailyPotentialUSD.toLocaleString() }}<text style="font-size: 10.5px; color: var(--v5-ink-3); font-weight: 400; margin-left: 2px">/d</text></text>
            <view class="flex items-center justify-end gap-0.5" style="font-size: 10.5px; color: var(--v5-ink-4); margin-top: 4px">
              <text>{{ t.earn.upgradeNow }}</text>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Task History (merged single list) -->
    <view :style="historyHeadStyle">
      <view class="flex items-center justify-between">
        <text style="font-family: var(--font-v5); font-size: 12px; font-weight: 600; color: var(--v5-ink)">{{ t.taskHistory.tabHistory }}</text>
        <view class="flex items-center active:opacity-60" style="gap: 2px; padding: 6px 0 6px 16px" @click="goReceipts">
          <text style="font-size: 12px; font-weight: 500; color: var(--v5-brand)">{{ t.taskHistory.viewAll }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
      <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ historyHintText }}</text>
    </view>
    <view v-if="allRecent.length === 0" class="pb-4">
      <text style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.taskHistory.historyEmpty }}</text>
    </view>
    <view v-else class="pb-3" :style="historyListStyle">
      <view v-for="(task, i) in allRecent" :key="i" class="items-center" :style="historyRowStyle(i === allRecent.length - 1)">
        <svg class="shrink-0" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
        <view class="flex items-center min-w-0" style="gap: 6px">
          <text class="truncate min-w-0" style="font-size: 12.5px; color: var(--v5-ink-2)">{{ task.model }}</text>
          <text class="shrink-0" :style="taskTagStyle">{{ taskLabel(task.category) }}</text>
        </view>
        <text class="tabular-nums text-right shrink-0" style="font-family: var(--font-v5); color: var(--v5-brand); font-size: 12.5px; width: 64px">+${{ task.reward.toFixed(3) }}</text>
        <text class="text-right shrink-0" style="font-size: 11.5px; color: var(--v5-ink-3); width: 56px">{{ shortTime(task.completedAt) }}</text>
        <view v-if="receiptFor(task.id)" class="shrink-0 grid place-items-center active:opacity-60" style="width: 24px; height: 24px; border-radius: 6px; color: var(--v5-ink-4)" @click="openReceipt = receiptFor(task.id) ?? null">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path fill="currentColor" d="M3 5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7h3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm11 8v3a2 2 0 0 0 2-2v-1zm-1 3V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a2 2 0 0 0 2 2zM6 6.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5m0 3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5m0 3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5" /></svg>
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
import { fmt } from "@/i18n/format";
import { getLockedTeasers } from "@/mock/tasks";
import type { TaskCategory } from "@/store/types";
import ReceiptModal from "@/components/me/receipt-modal.vue";
import { useReceipts } from "@/store/receipts";
import type { Receipt } from "@/mock/receipt";

const app = useApp();
const t = useT();
const receipts = useReceipts();
const openReceipt = ref<Receipt | null>(null);
const showUpgradeUnlocks = false;
function receiptFor(id: string): Receipt | undefined {
  return receipts.byId(id);
}

// History list: completed tasks across all devices, most-recent first (latest 3).
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
    showUpgradeUnlocks && lockedTeasers.value.length > 0
      ? "1px solid var(--v5-border)"
      : "none",
  paddingTop: showUpgradeUnlocks && lockedTeasers.value.length > 0 ? "16px" : "0",
  paddingBottom: "8px",
}));

const lockedCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minHeight: "64px",
  padding: "10px",
  borderRadius: "14px",
  background: "linear-gradient(180deg, #111317 0%, #15181C 100%)",
  border: "1px solid color-mix(in srgb, var(--v5-border) 72%, transparent)",
};

const lockedListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  rowGap: "16px",
  padding: "6px 0 16px",
};

const lockedIconBoxStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  color: "var(--v5-tech-cyan)",
  background: "color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent)",
};

const historyListStyle: CSSProperties = {
  borderTop: "1px solid color-mix(in srgb, var(--v5-border) 58%, transparent)",
};

function historyRowStyle(isLast: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "17px minmax(0, 1fr) 64px 56px 24px",
    columnGap: "8px",
    minHeight: "52px",
    padding: "8px 0",
    borderBottom: isLast ? "none" : "1px solid color-mix(in srgb, var(--v5-border) 58%, transparent)",
  };
}

const taskTagStyle: CSSProperties = {
  borderRadius: "3px",
  fontSize: "10.5px",
  padding: "2px 6px",
  color: "var(--v5-ink-4)",
  background: "color-mix(in srgb, var(--v5-ink-4) 12%, transparent)",
};

const CATEGORY_ICON_PATHS: Record<TaskCategory, string[]> = {
  IG: ["M3 3h18v18H3zM3 16l5-5 4 4 5-5 4 4"], // image
  VG: [
    "M3 2.5h10c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V4c0-.83.67-1.5 1.5-1.5m-1.5 3h13",
    "m3.5 5.5 2-3m1.5 3 2-3m1.5 3 2-3M6.5 8v4l4-2z",
  ],
  LL: ["M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719", "M8 12h.01", "M12 12h.01", "M16 12h.01"], // message-circle-more
  FT: [
    "M224 160a64 64 0 0 0-64 64v576a64 64 0 0 0 64 64h576a64 64 0 0 0 64-64V224a64 64 0 0 0-64-64zm0-64h576a128 128 0 0 1 128 128v576a128 128 0 0 1-128 128H224A128 128 0 0 1 96 800V224A128 128 0 0 1 224 96",
    "M384 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256",
    "M480 320h256q32 0 32 32t-32 32H480q-32 0-32-32t32-32m160 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256",
    "M288 640h256q32 0 32 32t-32 32H288q-32 0-32-32t32-32",
  ],
  EM: [
    "m13.11 7.664 1.78 2.672",
    "m14.162 12.788-3.324 1.424",
    "M20 4 13.94 5.515",
    "M3 3v16a2 2 0 0 0 2 2h16",
    "M12 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M16 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M9 15m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  ],
  SP: ["M11.5 6C7.022 6 4.782 6 3.391 7.172S2 10.229 2 14s0 5.657 1.391 6.828S7.021 22 11.5 22c4.478 0 6.718 0 8.109-1.172S21 17.771 21 14c0-1.17 0-2.158-.041-3m-2.459-9 .258.697c.338.914.507 1.371.84 1.704.334.334.791.503 1.705.841L22 5.5l-.697.258c-.914.338-1.371.507-1.704.84-.334.334-.503.791-.841 1.705L18.5 9l-.258-.697c-.338-.914-.507-1.371-.84-1.704-.334-.334-.791-.503-1.705-.841L15 5.5l.697-.258c.914-.338 1.371-.507 1.704-.84.334-.334.503-.791.841-1.705zM12 10v8m-3-6v4m-3-3v2m9-3v4m3-3v2"],
};
function categoryIconPaths(category: TaskCategory): string[] {
  return CATEGORY_ICON_PATHS[category] ?? CATEGORY_ICON_PATHS.IG;
}
function categoryIconStroke(category: TaskCategory): number {
  if (category === "LL") return 2.25;
  if (category === "FT") return 0;
  if (category === "VG") return 1;
  return category === "SP" ? 1.5 : 2;
}
function categoryIconViewBox(category: TaskCategory): string {
  if (category === "VG") return "0 0 16 16";
  return category === "FT" ? "0 0 1024 1024" : "0 0 24 24";
}
function categoryIconFill(category: TaskCategory): string {
  return category === "FT" ? "currentColor" : "none";
}
function categoryIconStrokeColor(category: TaskCategory): string {
  return category === "FT" ? "none" : "var(--v5-tech-cyan)";
}
const taskLabelKeys: Record<TaskCategory, keyof typeof t.value.receipt> = {
  IG: "catIG",
  VG: "catVG",
  LL: "catLL",
  FT: "catFT",
  EM: "catEM",
  SP: "catSP",
};
function taskLabel(category: TaskCategory): string {
  return t.value.receipt[taskLabelKeys[category]];
}

function goStore() {
  uni.navigateTo({ url: "/pages/store/store", fail: () => {} });
}

function goReceipts() {
  uni.navigateTo({ url: "/pages/me/receipts", fail: () => {} });
}

function shortTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return t.value.wallet.timeJustNow;
  if (m < 60) return fmt(t.value.wallet.timeMinutesAgo, { n: m });
  return fmt(t.value.wallet.timeHoursAgo, { n: Math.floor(m / 60) });
}
</script>
