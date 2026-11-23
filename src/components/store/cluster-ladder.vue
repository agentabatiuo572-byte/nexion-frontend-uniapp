<!--
  ClusterLadder — daily USD yield ladder (ported from store/page.tsx
  ClusterLadderV5). Phone → Box S1 → Box Pro → Box Pro v2 → Rack P1 → Rack P2, drawn bottom-up
  (column-reverse) with the user "←you" marker on the highest owned tier. Each row: label · bar
  (width = relative yield) · $/d, inside one content card. The bars are the shared thin
  .nx-progress, growing from zero once they come into view (.nx-viz-grow + v-viz-inview).
  Yields are parallel estimate comparisons, so they use the metric figures (DS-27).
  Drives the "climb the ladder" upgrade intent.
-->
<template>
  <view>
    <SectionHeader :title="t.store.secNetworkLadder" :count="t.store.secNetworkLadderCount.replace('5', String(tiers.length))" />
    <view class="nx-glass-card ladder-card">
      <view
        v-for="(tier, index) in tiers"
        :key="tier.id"
        class="ladder-row"
      >
        <view class="ladder-label" :style="{ color: tier.you ? 'var(--v5-brand-2)' : 'var(--v5-ink)' }">
          <text class="ladder-name">{{ (tier.label) }}</text>
          <view v-if="tier.you" class="ladder-you"><NxIcon name="arrow-left" /><text>{{ t.store.ladderYou }}</text></view>
        </view>
        <view class="ladder-track nx-progress" aria-hidden="true" :aria-valuenow="Math.round(tier.width)" :style="{ '--nx-progress-hue': tier.you ? 'var(--v5-brand-2)' : tier.fill }">
          <view v-viz-inview class="ladder-fill nx-progress__fill nx-viz-grow" :style="barStyle(tier, index)" />
        </view>
        <view class="ladder-yield" :aria-label="tier.yFull" :style="{ color: yieldColor(tier) }">
          <text class="nx-num-metric">{{ tier.y }}</text>
          <text class="ladder-unit">{{ t.store.perDay }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import SectionHeader from "./section-header.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import { storefrontUsd, type StoreYieldAuthority, type StoreYieldLadderRow } from "@/lib/store-yield-authority";

const t = useT();
const props = defineProps<{ authority: StoreYieldAuthority; owned: ReturnType<typeof import("@/lib/store-upgrade").highestOwnedHardware> }>();

interface Tier {
  id: string;
  label: string;
  y: string;
  yFull: string;
  width: number;
  amount: number;
  you?: boolean;
  rack?: boolean;
  fill?: string;
}

const tiers = computed<Tier[]>(() => {
  const kindForRow: Record<StoreYieldLadderRow["id"], string> = { phone: "phone", entry: "stellarbox-s1", pro: "stellarbox-pro",
    proV2: "stellarbox-pro-v2", rack: "stellarrack-p1", rackP2: "stellarrack-p2" };
  const labels: Record<StoreYieldLadderRow["id"], string> = {
    phone: t.value.store.ladderPhone,
    entry: t.value.store.ladderS1,
    pro: t.value.store.ladderPro,
    proV2: t.value.store.ladderProV2,
    rack: t.value.store.ladderRack,
    rackP2: t.value.store.ladderRackP2,
  };
  const rows: Tier[] = props.authority.ladder.map((row: StoreYieldLadderRow) => {
    const you = kindForRow[row.id] === props.owned?.kind;
    const amount = row.amount;
    return {
      id: row.id,
      label: labels[row.id],
      y: storefrontUsd(amount),
      yFull: storefrontUsd(amount),
      amount: amount?.usd ?? 0,
      width: row.widthPct,
      you,
      rack: row.id === "rack" || row.id === "rackP2",
      fill: "var(--v5-brand)",
    };
  });
  const maximum = Math.max(0, ...rows.map((row) => row.amount));
  return rows.filter((row) => row.id !== "phone").map((row) => ({ ...row, width: maximum > 0 && row.amount > 0 ? Math.max(1, row.amount / maximum * 100) : 0 }));
});

// Same entrance as every .nx-progress row (07 §7.1.1): .nx-viz-grow once in view; rows are drawn bottom-up, so the
// 80ms stagger counts from the bottom row (the phone) upward.
function barStyle(tier: Tier, index: number): CSSProperties {
  return { width: `${tier.width}%`, animationDelay: `${index * 80}ms` };
}

function yieldColor(tier: Tier): string {
  return tier.you ? "var(--v5-brand-2)" : tier.rack ? "var(--v5-brand)" : "var(--v5-ink)";
}
</script>

<style scoped>
.ladder-card { display: flex; flex-direction: column-reverse; gap: var(--v5-space-1); padding: var(--ui-space-inline) var(--ui-space-inset); border-radius: var(--nx-glass-radius); background: var(--nx-glass-fill); box-shadow: var(--nx-glass-edge); }
.ladder-row { display: grid; grid-template-columns: 76px minmax(0, 1fr) 112px; align-items: center; column-gap: var(--ui-space-inline); min-height: 32px; }
.ladder-label { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--v5-space-1); min-width: 0; }
.ladder-name { white-space: nowrap; }
.ladder-you { display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-brand-2-ink); }
/* The bars are the shared .nx-progress (03 §3.6): 3px track, the row hue (brand; the user's own tier coral) fading
   12% to 60% toward an end dot. Tier names are the row labels: list-subtitle role (10 §10.1). */
.ladder-label { font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
/* Side-by-side yield estimates use the inline-figure role (10 §10.1 行内数值, JetBrains Mono). */
.ladder-yield { overflow: hidden; text-align: right; white-space: nowrap; font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; }
.ladder-unit { font: 400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
/* uni <text> wraps on its own (pre-line); a range such as $5.5–6.9 stays on one line in the 112px column. */
.ladder-yield text { white-space: nowrap; }
</style>
