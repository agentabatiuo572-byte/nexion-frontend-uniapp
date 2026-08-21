<!--
  ClusterLadder — 5-tier yield ladder (ported from store/page.tsx
  ClusterLadderV5). Phone → Share → Box S1 → Box Pro → Rack P1, drawn bottom-up
  (column-reverse) with the user "←you" marker on Phone. Each row: label · bar
  (width = relative yield) · $/d. Drives the "climb the ladder" upgrade intent.
-->
<template>
  <view>
    <SectionHeader :title="t.store.secNetworkLadder" :count="t.store.secNetworkLadderCount" />
    <view class="flex flex-col-reverse" :style="frameStyle">
      <view
        v-for="tier in tiers"
        :key="tier.id"
        class="grid items-center"
        style="grid-template-columns: 72px minmax(0, 1fr) minmax(70px, 84px); gap: 10px"
      >
        <view class="whitespace-nowrap truncate" :style="labelStyle(tier)">
          <text>{{ tier.label }}</text>
          <text
            v-if="tier.you"
            class="font-mono-tabular"
            style="font-size: 12px; color: var(--v5-brand-2-ink); margin-left: 4px; opacity: 0.7"
          >{{ t.store.ladderYou }}</text>
        </view>
        <view class="relative overflow-hidden" style="height: 5px; background: var(--v5-surface-3); border-radius: 2.5px">
          <view class="absolute left-0 top-0 bottom-0" :style="barStyle(tier)" />
        </view>
        <view class="text-right tabular-nums whitespace-nowrap overflow-hidden" :aria-label="tier.yFull" :style="yieldStyle(tier)">
          <text>{{ tier.y }}</text>
          <text style="font-size: 12px; color: var(--v5-ink-4); font-weight: 400">{{ t.store.perDay }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import SectionHeader from "./section-header.vue";
import { storefrontUsd, storefrontUsdFull, type StoreYieldAuthority, type StoreYieldLadderRow } from "@/lib/store-yield-authority";

const t = useT();
const props = defineProps<{ authority: StoreYieldAuthority }>();

interface Tier {
  id: string;
  label: string;
  y: string;
  yFull: string;
  width: number;
  you?: boolean;
  rack?: boolean;
  fill?: string;
  fillOpacity?: number;
}

const tiers = computed<Tier[]>(() => props.authority.ladder.map((row: StoreYieldLadderRow) => {
  const labels = {
    phone: t.value.store.ladderPhone,
    share: t.value.store.ladderShare,
    entry: t.value.store.ladderS1,
    pro: t.value.store.ladderPro,
    rack: t.value.store.ladderRack,
  };
  return {
    id: row.id,
    label: labels[row.id],
    y: storefrontUsd(row.amount),
    yFull: storefrontUsdFull(row.amount),
    width: row.widthPct,
    you: row.id === "phone",
    rack: row.id === "rack",
    fill: row.id === "share" ? "var(--v5-ink-4)" : "var(--v5-brand)",
    fillOpacity: row.id === "share" ? 0.25 : row.id === "entry" ? 0.35 : row.id === "pro" ? 0.55 : 0.75,
  };
}));

const frameStyle: CSSProperties = {
  paddingTop: "2px",
  gap: "8px",
};

function labelStyle(tier: Tier): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 500,
    fontSize: "13px",
    color: tier.you ? "var(--v5-brand-2)" : "var(--v5-ink)",
    letterSpacing: "-0.008em",
  };
}

function barStyle(tier: Tier): CSSProperties {
  return {
    width: `${tier.width}%`,
    background: tier.you ? "var(--v5-brand-2)" : (tier.fill ?? "var(--v5-brand)"),
    opacity: tier.you ? 0.55 : (tier.fillOpacity ?? 1),
    borderRadius: "2.5px",
  };
}

function yieldStyle(tier: Tier): CSSProperties {
  const color = tier.you
    ? "var(--v5-brand-2)"
    : tier.rack
      ? "var(--v5-brand)"
      : "var(--v5-ink)";
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: "13px",
    color,
    letterSpacing: "-0.008em",
  };
}
</script>
