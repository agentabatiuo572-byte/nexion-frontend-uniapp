<!--
  NetworkPulseCard — home network snapshot (App compact view).
  三格:注册用户(公开估算)/ 在线设备(H9 公开投影)/ 你的排名。
  不读取 verifiedStats:首页不展示真实聚合的平台运营数字。
-->
<template>
  <view v-if="compactAvailable" data-home-section="network">
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em" role="heading" aria-level="2">{{ t.home.networkPulseTitle }}</text>
      <view class="network-compact__action" role="link" tabindex="0" :aria-label="copy.details" @click="goGlobe" @keydown.enter.prevent="goGlobe" @keydown.space.prevent="goGlobe">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </view>
    </view>
    <view class="network-compact">
      <view v-for="m in metrics" :key="m.k" class="network-compact__cell" :role="m.tap ? 'button' : undefined" :tabindex="m.tap ? 0 : -1" @click="activate(m.tap)" @keydown.enter.prevent="activate(m.tap)" @keydown.space.prevent="activate(m.tap)">
        <text class="network-compact__label">{{ m.k }}</text>
        <text class="network-compact__value" :style="{ fontSize: m.vSize, color: m.tone }">{{ m.v }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useAuditUiCopy } from "@/i18n/audit-ui";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import { useNetworkRank } from "@/store/network-rank";
import { useDataVisibility } from "@/store/data-visibility";
import { remoteApiEnabled } from "@/api/runtime";
import { compactNumber as compact, networkPopulationBand } from "@/lib/platform-stats";
import { confirm } from "@/store/ui";
import { navTo } from "@/lib/route";

const props = defineProps<{ registeredDisplay: number | null }>();
const copy = useAuditUiCopy();
const t = useT();
const app = useApp();
const cfg = useConfig();
const remoteRank = useNetworkRank();
const visibility = useDataVisibility();
function refreshRankMoment() {
  if (remoteApiEnabled) void remoteRank.refresh();
}
onMounted(refreshRankMoment);
watch(() => app.accountKey, (accountKey) => {
  if (!remoteApiEnabled) return;
  // Defensive rebind for direct session restore/account mutations; the central
  // account scope also binds this store, and the epoch makes duplicate binds safe.
  remoteRank.bindAccount(accountKey);
  refreshRankMoment();
});
watch(() => cfg.loading, (l, was) => {
  if (was && !l) refreshRankMoment();
});

// Server-computed account rank only; no local fallback.
const rank = computed(() => {
  if (!remoteApiEnabled || remoteRank.snapshot === null) return { kind: "unavailable" } as const;
  return remoteRank.snapshot.currentRank === null
    ? { kind: "unranked" } as const
    : { kind: "ranked", rank: remoteRank.snapshot.currentRank } as const;
});
// The home summary is shown only when all three cells are usable.
const compactAvailable = computed(() => {
  const members = props.registeredDisplay;
  const devices = cfg.config.networkPulse?.onlineDevices;
  const currentRank = rank.value;
  return !cfg.syncFailed && remoteRank.status !== "error"
    && typeof members === "number" && Number.isSafeInteger(members) && members >= 0
    && typeof devices === "number" && Number.isSafeInteger(devices) && devices >= 0
    && (currentRank.kind === "unranked"
      || (currentRank.kind === "ranked" && Number.isSafeInteger(currentRank.rank) && currentRank.rank > 0));
});
function explainRank() {
  const status = rank.value.kind === "unranked" ? t.value.home.networkRankTipUnranked : "";
  void confirm({ title: t.value.home.networkYourRank,
    message: [status, t.value.home.networkRankTipRanked].filter(Boolean).join("\n\n"),
    hideCancel: true, icon: "info" });
}
function goGlobe() {
  navTo("/pages/globe/globe");
}

interface Cell {
  k: string;
  v: string;
  vSize?: string;
  tone: string;
  tap?: () => void;
}

function activate(action?: () => void) {
  action?.();
}

const metrics = computed<Cell[]>(() => {
  const r = rank.value;
  return [
    { k: t.value.home.networkMembers, v: networkPopulationBand(props.registeredDisplay ?? 0), tone: "var(--v5-ink)" },
    { k: t.value.home.networkDevices, v: networkPopulationBand(cfg.config.networkPulse?.onlineDevices ?? 0), tone: "var(--v5-ink)" },
    {
      k: t.value.home.networkYourRank,
      v: r.kind === "ranked" ? visibility.mask(`#${compact(r.rank)}`) : t.value.home.networkRankUnranked,
      vSize: r.kind === "ranked" ? undefined : "12px",
      tone: r.kind === "ranked" ? "var(--v5-brand)" : "var(--v5-ink-3)",
      tap: explainRank,
    },
  ];
});
</script>
<style scoped>
.network-compact {position:relative;overflow:hidden;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:16px 0;border-radius:22px;border:1px solid var(--v5-border);background:var(--v5-surface);}
.network-compact::before {content:'';position:absolute;inset:0;background-image:radial-gradient(color-mix(in srgb,var(--v5-brand) 10%,transparent) 1px,transparent 1.2px);background-size:10px 10px;mask-image:radial-gradient(80% 120% at 70% 50%,#000,transparent 75%);pointer-events:none;}
.network-compact__cell {position:relative;min-width:0;padding:0 14px;border-left:1px solid var(--v5-border);}
.network-compact__cell:first-child {border:0;padding-left:16px;}
.network-compact__label {display:block;min-height:36px;font:400 12.5px/18px var(--font-v5);color:var(--v5-ink-3);}
.network-compact__value {display:block;margin-top:4px;font:600 18px/24px var(--font-v5);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.network-compact__action {display:inline-flex;align-items:center;justify-content:flex-end;width:44px;min-height:44px;color:var(--v5-ink-3);}
</style>
