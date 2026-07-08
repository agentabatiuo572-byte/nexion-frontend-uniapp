<!--
  ClusterLadder — 5-tier yield ladder. Phone → Cloud Share → NexionBox S1 →
  NexionBox Pro → NexionRack P1, drawn bottom-up (column-reverse) with the user
  "你" marker on Phone. Each row: label · bar (width = relative yield) · $/天.
  Drives the "climb the ladder" upgrade intent.
-->
<template>
  <view>
    <view class="flex items-center justify-between gap-2" :style="headerStyle">
      <text :style="headerTitleStyle">算力阶梯<text class="font-mono-tabular ml-1" :style="headerCountStyle">5 档</text></text>
    </view>
    <view class="flex flex-col-reverse" :style="frameStyle">
      <view
        v-for="tier in tiers"
        :key="tier.id"
        class="grid items-center"
        style="grid-template-columns: 92px minmax(0, 1fr) 84px; gap: 8px"
      >
        <view class="whitespace-nowrap" :style="labelStyle(tier)">
          <text>{{ tier.label }}</text>
          <text
            v-if="tier.you"
            class="font-mono-tabular"
            style="font-size: 11px; color: var(--v5-brand-2); margin-left: 4px; opacity: 0.7"
          >你</text>
        </view>
        <view class="relative overflow-hidden" :style="trackStyle(tier)">
          <view class="absolute left-0 top-0 bottom-0" :style="barStyle(tier)" />
        </view>
        <view class="text-right tabular-nums whitespace-nowrap" :style="yieldStyle(tier)">
          <text>{{ tier.y }}</text>
          <text :style="unitStyle">/天</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

interface Tier {
  id: string;
  label: string;
  y: string;
  width: number;
  you?: boolean;
  rack?: boolean;
}

const tiers: Tier[] = [
  { id: "phone", label: "手机", y: "$0.06", width: 1, you: true },
  { id: "share", label: "Cloud Share", y: "$0.19", width: 1 },
  { id: "s1", label: "NexionBox S1", y: "$7.00", width: 16 },
  { id: "pro", label: "NexionBox Pro", y: "$13.00", width: 29 },
  { id: "rack", label: "NexionRack P1", y: "$45.00", width: 100, rack: true },
];

const headerStyle: CSSProperties = {
  marginRight: "2px",
  marginBottom: "16px",
  marginLeft: "2px",
};
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.012em",
};
const headerCountStyle: CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 400,
  color: "var(--v5-ink-3)",
};

const frameStyle: CSSProperties = {
  paddingTop: "2px",
  gap: "8px",
};

function labelStyle(tier: Tier): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 500,
    fontSize: "12px",
    lineHeight: "16px",
    color: tier.you ? "var(--v5-brand-2)" : "var(--v5-ink)",
    letterSpacing: "-0.008em",
  };
}

function trackStyle(tier: Tier): CSSProperties {
  return {
    height: "4px",
    background: tier.you
      ? "var(--v5-surface-2)"
      : "color-mix(in srgb, var(--v5-brand) 12%, var(--v5-surface-2))",
    borderRadius: "999px",
  };
}

function barStyle(tier: Tier): CSSProperties {
  return {
    width: `${tier.width}%`,
    background: tier.you
      ? "color-mix(in srgb, var(--v5-ink-3) 40%, transparent)"
      : "linear-gradient(90deg, #CFFF34 0%, #A9F044 42%, #55DDBD 100%)",
    borderRadius: "999px",
    boxShadow: tier.you
      ? "none"
      : "inset 0 0 0 1px color-mix(in srgb, var(--v5-brand) 14%, transparent), 0 0 10px color-mix(in srgb, var(--v5-brand) 24%, transparent)",
  };
}

const unitStyle: CSSProperties = {
  fontSize: "10.5px",
  color: "var(--v5-ink-4)",
  fontWeight: 400,
};

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
