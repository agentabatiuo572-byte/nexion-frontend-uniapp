<!--
  TaskCenter — ported from Nexion-prototype/app/components/task-center.tsx.
  Current/History tabs over the user's live + recent device tasks:
    Current tab → currently-processing list + "Upgrade Unlocks" locked-tier
      teasers (VRAM-gated, route to /store) + completed-today preview (5).
    History tab → completed list (last 20).
  Reads device task data from the app store + VRAM-gated teasers from mock/tasks.

  Receipt detail: the source row has a "view receipt" icon that opens a
  ReceiptModal (a separate, large 534-line surface not yet ported to uni). That
  modal is out of scope here, so the per-row receipt icon is omitted rather than
  rendered as a dead button — wire it back when receipt-modal.vue is ported.
-->
<template>
  <view class="mx-4 mt-5">
    <view class="flex items-center justify-between mb-2.5 px-1">
      <text style="font-family: var(--font-v5); font-size: 13.5px; font-weight: 600; color: var(--v5-ink-3); letter-spacing: -0.01em">{{ t.earn.taskCenter }}</text>
      <view class="flex items-center gap-1" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>
        <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-brand)">8,432</text>
        <text>{{ t.earn.jobsLive }}</text>
      </view>
    </view>

    <!-- Tabs -->
    <view class="flex gap-1.5 mb-2 px-1">
      <view :style="tabStyle(tab === 'current')" @click="tab = 'current'"><text :style="tabLabelStyle(tab === 'current')">{{ t.taskHistory.tabCurrent }}</text></view>
      <view :style="tabStyle(tab === 'history')" @click="tab = 'history'"><text :style="tabLabelStyle(tab === 'history')">{{ t.taskHistory.tabHistory }}</text></view>
    </view>

    <view style="background: var(--v5-surface); border-radius: 16px; border: 1px solid var(--v5-border); overflow: hidden">
      <!-- ===== Current tab ===== -->
      <template v-if="tab === 'current'">
        <view class="px-4 pt-3 pb-2">
          <text style="font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3)">{{ t.earn.currentlyProcessing }}</text>
        </view>
        <view v-if="allCurrent.length === 0" class="px-4 pb-3">
          <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.earn.noActive }}</text>
        </view>
        <view v-else class="pb-2">
          <view
            v-for="(row, i) in allCurrent"
            :key="i"
            class="px-4 py-2.5"
            :style="{ borderTop: i !== 0 ? '1px solid color-mix(in srgb, var(--v5-border) 50%, transparent)' : 'none' }"
          >
            <view class="flex items-center justify-between gap-2">
              <text class="truncate" style="font-size: 13.5px; font-weight: 500; line-height: 1.2; color: var(--v5-ink)">{{ row.task.model }}<text style="color: var(--v5-ink-4); margin: 0 6px">·</text><text style="color: var(--v5-ink-2)">{{ row.task.type }}</text></text>
              <text class="tabular-nums shrink-0" style="font-family: var(--font-v5); font-size: 11.5px; color: var(--v5-brand)">#{{ row.task.id }}</text>
            </view>
            <view class="mt-1 flex items-center gap-1.5" style="font-size: 12px; color: var(--v5-ink-3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
              <text>{{ row.task.client }} · {{ row.task.location }}</text>
            </view>
            <text class="block mt-0.5" style="font-size: 12px; color: var(--v5-ink-3)">{{ t.earn.deviceLabel }} <text style="color: var(--v5-ink-2)">{{ row.deviceName }}</text></text>
          </view>
        </view>

        <!-- Upgrade Unlocks -->
        <view v-if="lockedTeasers.length > 0" style="border-top: 1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)">
          <view class="px-4 pt-3 pb-1">
            <view class="flex items-center gap-1.5" style="font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <text>{{ t.earn.upgradeUnlocks }}</text>
            </view>
            <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ t.earn.upgradeUnlocksHint }}</text>
          </view>
          <view class="px-3 pt-1.5 pb-2 space-y-1">
            <view
              v-for="teaser in lockedTeasers"
              :key="teaser.category"
              class="flex items-center gap-3 px-2 py-2 rounded-lg active:opacity-80"
              @click="goStore"
            >
              <view class="rounded-lg grid place-items-center shrink-0" style="width: 32px; height: 32px; background: color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="categoryIconPath(teaser.category)" /></svg>
              </view>
              <view class="flex-1 min-w-0">
                <text class="block truncate" style="font-size: 12.5px; font-weight: 500; color: var(--v5-ink-2)">{{ teaser.model }}<text style="color: var(--v5-ink-4); margin: 0 4px">·</text><text style="color: var(--v5-ink-3)">{{ teaser.type }}</text></text>
                <text class="block truncate" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ t.earn.requires }} <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-tech-cyan)">{{ teaser.minVRAM }}GB VRAM</text> · {{ teaser.unlockTier }}</text>
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

        <!-- Completed Today (preview) -->
        <view class="px-4 pt-2" style="border-top: 1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)">
          <text class="block" style="font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3); padding: 10px 0">{{ t.earn.completedToday }}</text>
        </view>
        <!-- completed list -->
        <view v-if="allRecent.length === 0" class="px-4 pb-4">
          <text style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.earn.completedHint }}</text>
        </view>
        <view v-else class="px-4 pb-3 space-y-1.5">
          <view v-for="(row, i) in allRecent" :key="i" class="flex items-center justify-between gap-2" style="font-size: 12px">
            <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
            <text class="flex-1 truncate min-w-0" style="color: var(--v5-ink-2)">{{ row.task.model }}<text style="color: var(--v5-ink-4); margin: 0 4px">·</text><text style="color: var(--v5-ink-3)">{{ row.task.type }}</text></text>
            <text class="tabular-nums shrink-0" style="font-family: var(--font-v5); color: var(--v5-brand)">+${{ row.task.reward.toFixed(3) }}</text>
            <text class="text-right shrink-0" style="font-size: 11.5px; color: var(--v5-ink-3); width: 48px">{{ shortTime(row.task.completedAt) }}</text>
          </view>
        </view>
      </template>

      <!-- ===== History tab ===== -->
      <template v-else>
        <view class="px-4 pt-3 pb-2">
          <text class="block" style="font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3)">{{ t.earn.completedToday }}</text>
          <text class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px">{{ historyHintText }}</text>
        </view>
        <view v-if="allRecent.length === 0" class="px-4 pb-4">
          <text style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.taskHistory.historyEmpty }}</text>
        </view>
        <view v-else class="px-4 pb-3 space-y-1.5">
          <view v-for="(row, i) in allRecent" :key="i" class="flex items-center justify-between gap-2" style="font-size: 12px">
            <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
            <text class="flex-1 truncate min-w-0" style="color: var(--v5-ink-2)">{{ row.task.model }}<text style="color: var(--v5-ink-4); margin: 0 4px">·</text><text style="color: var(--v5-ink-3)">{{ row.task.type }}</text></text>
            <text class="tabular-nums shrink-0" style="font-family: var(--font-v5); color: var(--v5-brand)">+${{ row.task.reward.toFixed(3) }}</text>
            <text class="text-right shrink-0" style="font-size: 11.5px; color: var(--v5-ink-3); width: 48px">{{ shortTime(row.task.completedAt) }}</text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { getLockedTeasers } from "@/mock/tasks";
import type { TaskCategory } from "@/store/types";

const app = useApp();
const t = useT();
const tab = ref<"current" | "history">("current");

const allCurrent = computed(() =>
  app.devices.flatMap((d) => (d.currentTask ? [{ deviceName: d.name, task: d.currentTask }] : [])),
);
const histLimit = computed(() => (tab.value === "history" ? 20 : 5));
const allRecent = computed(() =>
  app.devices
    .flatMap((d) => d.recentTasks.map((task) => ({ deviceName: d.name, task })))
    .sort((a, b) => b.task.completedAt - a.task.completedAt)
    .slice(0, histLimit.value),
);

const maxVram = computed(() => app.devices.reduce((m, d) => Math.max(m, d.vramTotal), 0));
const lockedTeasers = computed(() => getLockedTeasers(maxVram.value, 3));

const historyHintText = computed(() =>
  t.value.taskHistory.historyHint.replace("{n}", String(allRecent.value.length)),
);

const CATEGORY_ICON_PATHS: Record<TaskCategory, string> = {
  IG: "M3 3h18v18H3zM3 16l5-5 4 4 5-5 4 4", // image
  VG: "M14 4v16M10 4v16M4 8h4M4 16h4M16 8h4M16 16h4M4 4h16v16H4z", // film
  LL: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", // message
  FT: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.7-2.7z", // wrench
  EM: "M3 5a9 3 0 0 0 18 0a9 3 0 0 0-18 0M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0", // database
  SP: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3M19 10v2a7 7 0 0 1-14 0v-2M12 19v3", // mic
};
function categoryIconPath(category: TaskCategory): string {
  return CATEGORY_ICON_PATHS[category] ?? CATEGORY_ICON_PATHS.IG;
}

function goStore() {
  uni.navigateTo({ url: "/pages/store/store", fail: () => {} });
}

function shortTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function tabStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    padding: "0 16px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    background: active ? "color-mix(in srgb, var(--v5-brand) 15%, transparent)" : "var(--v5-surface-2)",
    border: active ? "1px solid color-mix(in srgb, var(--v5-brand) 35%, transparent)" : "1px solid transparent",
  };
}
function tabLabelStyle(active: boolean): CSSProperties {
  return {
    fontSize: "12.5px",
    fontWeight: 500,
    color: active ? "var(--v5-brand)" : "var(--v5-ink-3)",
  };
}
</script>
