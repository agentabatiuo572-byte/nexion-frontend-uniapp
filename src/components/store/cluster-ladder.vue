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
        style="grid-template-columns: 72px 1fr 60px; gap: 10px"
      >
        <view class="whitespace-nowrap truncate" :style="labelStyle(tier)">
          <text>{{ tier.label }}</text>
          <text
            v-if="tier.you"
            class="font-mono-tabular"
            style="font-size: 10px; color: var(--v5-brand-2); margin-left: 4px; opacity: 0.7"
          >{{ t.store.ladderYou }}</text>
        </view>
        <view class="relative overflow-hidden" style="height: 5px; background: var(--v5-surface-3); border-radius: 2.5px">
          <view class="absolute left-0 top-0 bottom-0" :style="barStyle(tier)" />
        </view>
        <view class="text-right tabular-nums whitespace-nowrap" :style="yieldStyle(tier)">
          <text>{{ tier.y }}</text>
          <text style="font-size: 10.5px; color: var(--v5-ink-4); font-weight: 400">{{ t.store.perDay }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import SectionHeader from "./section-header.vue";

const t = useT();

interface Tier {
  id: string;
  label: string;
  y: string;
  width: number;
  you?: boolean;
  rack?: boolean;
  fill?: string;
  fillOpacity?: number;
}

const tiers = computed<Tier[]>(() => [
  { id: "phone", label: t.value.store.ladderPhone, y: "$0.06", width: 1, you: true },
  { id: "share", label: t.value.store.ladderShare, y: "$0.07", width: 2, fill: "var(--v5-ink-4)", fillOpacity: 0.25 },
  { id: "s1", label: t.value.store.ladderS1, y: "$38.50", width: 27, fill: "var(--v5-brand)", fillOpacity: 0.35 },
  { id: "pro", label: t.value.store.ladderPro, y: "$76.00", width: 53, fill: "var(--v5-brand)", fillOpacity: 0.55 },
  { id: "rack", label: t.value.store.ladderRack, y: "$142.60", width: 100, fill: "var(--v5-brand)", fillOpacity: 0.75, rack: true },
]);

const frameStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "12px 14px",
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
