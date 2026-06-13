<!--
  Achievements (ported from Nexion-prototype/app/(main)/me/achievements/page.tsx).
  Progress hero + categorized list with unlock state, reward + claim button.
  Unlock conditions auto-evaluate on mount against live app store. Cross-store
  claim orchestration (creditNex/creditBalance + bills.add) lives in the handler.
  Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" />

      <!-- Progress hero -->
      <view class="mx-4" :style="heroStyle">
        <view class="flex items-center" style="gap: 12px">
          <view class="grid place-items-center" :style="heroIconBoxStyle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /><circle cx="12" cy="8" r="6" /></svg>
          </view>
          <view style="flex: 1">
            <text class="block" :style="heroLabelStyle">{{ w.progress }}</text>
            <view class="flex items-baseline" style="gap: 4px">
              <text :style="heroCountStyle">{{ unlocked }}</text>
              <text :style="heroTotalStyle">/ {{ total }}</text>
            </view>
          </view>
          <text :style="heroPctStyle">{{ percent }}%</text>
        </view>
        <view :style="barTrackStyle">
          <view :style="barFillStyle" />
        </view>
      </view>

      <!-- Categories -->
      <view style="margin-top: 12px; display: flex; flex-direction: column; gap: 16px">
        <view v-for="grp in groups" :key="grp.cat" class="mx-4">
          <text class="block" :style="catHeadStyle">{{ catLabel(grp.cat) }}</text>
          <view :style="listStyle">
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
                <text v-if="isUnlocked(a.id)" class="block" :style="aWhenStyle">{{ w.unlockedAt }} · {{ relativeWhen(recOf(a.id)!.unlockedAt) }}</text>
              </view>
              <view class="text-right shrink-0">
                <text class="block" :style="rewardStyle(isUnlocked(a.id))">{{ rewardLabel(a) }}</text>
                <view
                  v-if="isUnlocked(a.id)"
                  :style="claimBtnStyle(isClaimed(a.id))"
                  @click="handleClaim(a.id)"
                >
                  <view v-if="isClaimed(a.id)" class="flex items-center" style="gap: 4px">
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
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { toast } from "@/store/ui";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useAchievements } from "@/store/achievements";
import { ACHIEVEMENTS, type AchievementCategory, type AchievementDef } from "@/mock/achievements";

const t = useT();
const w = computed(() => t.value.achievements);
const app = useApp();
const bills = useBills();
const ach = useAchievements();

const CAT_COLOR: Record<AchievementCategory, string> = {
  firsts: "var(--v5-brand)",
  earnings: "var(--v5-warning)",
  social: "var(--v5-tech-cyan)",
  loyalty: "var(--v5-success)",
  hardware: "var(--v5-brand-2)",
};

const ICON_SVG: Record<string, string> = {
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
  const onlineDevices = app.devices.filter((d) => d.kind !== "phone" && d.kind !== "cloud-share").length;
  const earningsTotal = app.earnings.total;
  if (onlineDevices > 0) ach.unlock("hardware_owner");
  if (earningsTotal >= 1) ach.unlock("first_dollar");
  if (earningsTotal >= 1000) ach.unlock("diamond_miner");
  if (earningsTotal > 0) ach.unlock("first_contribution");
}
onShow(() => evaluate());

const groups = computed(() => {
  const cats: AchievementCategory[] = ["firsts", "earnings", "social", "loyalty", "hardware"];
  return cats
    .map((cat) => ({ cat, list: ACHIEVEMENTS.filter((a) => a.category === cat) }))
    .filter((g) => g.list.length > 0);
});

const unlocked = computed(() => ach.records.length);
const total = ACHIEVEMENTS.length;
const percent = computed(() => Math.round((unlocked.value / total) * 100));

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
function label(a: AchievementDef): string {
  return (w.value as unknown as Record<string, string>)[`a_${a.i18nKey}`] ?? a.id;
}
function desc(a: AchievementDef): string {
  return (w.value as unknown as Record<string, string>)[`a_${a.i18nKey}_d`] ?? "";
}
function rewardLabel(a: AchievementDef): string {
  if (a.rewardNex) return `+${a.rewardNex} NEX`;
  if (a.rewardUsdt) return `+$${a.rewardUsdt}`;
  return "VIP badge";
}
function relativeWhen(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return w.value.unlockedJustNow;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function handleClaim(id: string) {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return;
  if (!ach.claim(id)) return;
  const name = label(def);
  if (def.rewardNex) {
    app.creditNex(def.rewardNex);
    bills.add({ type: "achievement", symbol: "NEX", amount: def.rewardNex, status: "posted", memo: `Achievement · ${name}`, ref: id });
  }
  if (def.rewardUsdt) {
    app.creditBalance(def.rewardUsdt);
    bills.add({ type: "achievement", symbol: "USDT", amount: def.rewardUsdt, status: "posted", memo: `Achievement · ${name}`, ref: id });
  }
  toast.success(w.value.claimToast);
}

const heroStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "20px",
};
const heroIconBoxStyle: CSSProperties = { width: "56px", height: "56px", borderRadius: "16px", background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)" };
const heroLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const heroCountStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "26px", fontWeight: 600, color: "var(--v5-ink)" };
const heroTotalStyle: CSSProperties = { fontSize: "14px", color: "var(--v5-ink-4)" };
const heroPctStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, color: "var(--v5-brand)" };
const barTrackStyle: CSSProperties = { marginTop: "12px", height: "8px", borderRadius: "999px", background: "var(--v5-surface-2)", overflow: "hidden" };
const barFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${percent.value}%`,
  background: "linear-gradient(90deg, var(--v5-warning), var(--v5-brand))",
  transition: "width 700ms ease",
}));
const catHeadStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink-3)",
  padding: "12px 8px 4px",
};
const listStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
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
    borderRadius: "12px",
    background: ul ? `color-mix(in srgb, ${CAT_COLOR[cat]} 10%, transparent)` : "var(--v5-surface)",
    opacity: ul ? 1 : 0.5,
  };
}
function aLabelStyle(ul: boolean): CSSProperties {
  return { fontSize: "13.5px", fontWeight: 600, color: ul ? "color-mix(in srgb, var(--v5-ink) 95%, transparent)" : "var(--v5-ink-4)" };
}
function aDescStyle(ul: boolean): CSSProperties {
  return { fontSize: "11.5px", marginTop: "2px", lineHeight: 1.4, color: ul ? "var(--v5-ink-3)" : "var(--v5-ink-4)" };
}
const aWhenStyle: CSSProperties = { fontSize: "10.5px", color: "var(--v5-ink-4)", marginTop: "2px" };
function rewardStyle(ul: boolean): CSSProperties {
  return { fontSize: "11.5px", fontWeight: 500, color: ul ? "var(--v5-brand)" : "var(--v5-ink-4)" };
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
    fontSize: "11px",
    fontWeight: 600,
    background: claimed ? "var(--v5-surface-2)" : "var(--v5-brand)",
    color: claimed ? "var(--v5-ink-4)" : "var(--v5-on-brand)",
  };
}
</script>
