<!--
  NetworkCard (DESIGN G2 / G2a): the profile 我的网络 card. Next-rank badge | "toward Vn · hardest gap +N" line,
  the two perks you get at Vn, one shared .nx-progress with the average next-rank progress | chevron.
  The whole card opens the my-rank page. The section title lives in the page's NxSection.
-->
<template>
  <view v-if="vrank.remoteReady && !next" class="nx-network-card nx-network-card--top" role="link" tabindex="0" :aria-label="maxRankLine" @click="goRank" @keydown.enter.prevent="goRank" @keydown.space.prevent="goRank">
    <TeamRankEmblem v-if="!visibility.hidden" :rank="vrank.myRank" :size="48" />
    <text class="nx-network-card__line">{{ maxRankLine }}</text>
    <view class="nx-network-card__chev" aria-hidden="true"><NxIcon name="chevron-right" /></view>
  </view>
  <view v-else-if="vrank.remoteReady && next" class="nx-network-card" role="link" tabindex="0" :aria-label="ariaLabel" @click="goRank" @keydown.enter.prevent="goRank" @keydown.space.prevent="goRank">
    <TeamRankEmblem v-if="!visibility.hidden" :rank="next.v" :size="48" />
    <view class="nx-network-card__copy">
      <text class="nx-network-card__line"><text class="nx-network-card__nowrap">{{ fmt(copy.g2Toward, { r: `V${next.v}` }) }}</text><template v-if="gapLine"><text class="nx-network-card__dot"> · </text><text>{{ visibility.mask(gapLine) }}</text><text v-if="moreCount > 0" class="nx-network-card__more"> {{ visibility.mask(fmt(copy.g2More, { n: moreCount })) }}</text></template></text>
      <text v-if="perkClauses.length" class="nx-network-card__perk"><text v-for="(clause, i) in perkClauses" :key="i" class="nx-network-card__clause">{{ clause }}</text></text>
      <view class="nx-network-card__prog">
        <view ref="elRef" class="nx-progress" :aria-valuenow="visibility.hidden || !progressKnown ? undefined : inView === false ? 0 : pct"><view class="nx-progress__fill" :style="barStyle" /></view>
        <text class="nx-network-card__pct">{{ visibility.mask(progressKnown ? `${pct}%` : '—') }}</text>
      </view>
    </view>
    <view class="nx-network-card__chev" aria-hidden="true"><NxIcon name="chevron-right" /></view>
  </view>
</template>

<script setup lang="ts">
import NxIcon from "@/components/ui/nx-icon.vue";
import TeamRankEmblem from "@/components/team/team-rank-emblem.vue";
import { formatAmount } from "@/lib/amount-display";
import { navTo } from "@/lib/route";
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useLocaleStore } from "@/store/locale";
import { useDataVisibility } from "@/store/data-visibility";
import { useVRank, nextRankGap } from "@/store/v-rank";
import { teamRankProgress } from "@/lib/team-rank-progress";
import { rankTitle } from "@/lib/v-rank-copy";
import { formatComputePoints } from "@/i18n/compute-points";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";

const t = useT();
const vrank = useVRank();
const locale = useLocaleStore();
const visibility = useDataVisibility();
const { elRef, inView } = useScrollGrowProgress();
const copy = computed(() => t.value.myRank);

const gap = computed(() => nextRankGap(vrank, vrank.ladder));
// DESIGN 2.2: the same requirement rows as the team-page card (next rank plus unmet earlier ranks).
// LOGIC SEAM: the shared "还差 N 项" counter (and V7→V8 「审核中」) is wired by the logic item.
const requirements = computed(() => teamRankProgress({
  myRank: vrank.myRank, selfComputePoints: vrank.selfComputePoints, directRefs: vrank.directRefs,
  teamComputePoints: vrank.teamComputePoints, vDownlineCounts: vrank.vDownlineCounts,
}, vrank.ladder));
const next = computed(() => gap.value.next);
const progressKnown = computed(() => gap.value.progressKnown);
const pct = computed(() => Math.round(gap.value.progressPct * 100));
const moreCount = computed(() => Math.max(0, requirements.value.missing.length - 1));
const maxRankLine = computed(() => fmt(t.value.me.networkCardMaxRank, { title: rankTitle(vrank.myRank, locale.code, vrank.ladder) }));

// First line names the hardest unmet condition (lowest share of its target).
const gapLine = computed(() => {
  if (!progressKnown.value) return "";
  const worst = [...requirements.value.missing].sort((a, b) => a.current! / a.required - b.current! / b.required)[0];
  if (!worst) return "";
  const left = worst.required - worst.current!;
  if (worst.kind === "vDownlines") return fmt(copy.value.g2GapLead, { n: left, r: `V${worst.vLevel}` });
  if (worst.kind === "directRefs") return fmt(copy.value.rowInviteSub, { a: left });
  return fmt(worst.kind === "selfComputePoints" ? copy.value.rowStoreSub : copy.value.rowTeamSub, { n: formatComputePoints(left, locale.code) });
});

// LOGIC SEAM (DESIGN 12.0): `hasSalaryData` = /api/team/rank carries a `salary` field; `nextSalaryUsdt` =
// /api/config/v-ranks ranks[next].monthlySalaryUsdt. Neither is parsed yet (v-rank-api rankRow / rank state),
// so the card shows g2PerksNoSal until the logic item fills these two values.
const hasSalaryData = computed<boolean>(() => false);
const nextSalaryUsdt = computed<number | null>(() => null);
const nextUvt = computed(() => next.value?.rewards.find(reward => reward.type === "UVT")?.amount ?? 0);
const perkText = computed(() => {
  const n = next.value;
  if (!n) return "";
  const r = `V${n.v}`, b = `${formatAmount(nextUvt.value)}\u00A0UVT`;
  if (hasSalaryData.value && nextSalaryUsdt.value !== null && nextSalaryUsdt.value > 0)
    return fmt(copy.value.g2Perks, { r, a: `${formatAmount(nextSalaryUsdt.value)}\u00A0USDT`, b });
  return fmt(copy.value.g2PerksNoSal, { r, b, p: `${formatAmount(Math.round(n.directBonus * 1000) / 10)}%` });
});
// DESIGN 11.2-14: the line breaks only between clauses, so each clause keeps its separator and stays whole.
const perkClauses = computed(() => perkText.value ? perkText.value.split(/(?<=[，,、；;])\s*/).map(part => part.trim()).filter(Boolean) : []);
const ariaLabel = computed(() => [fmt(copy.value.g2Toward, { r: `V${next.value?.v ?? ""}` }), visibility.mask(gapLine.value), perkText.value].filter(Boolean).join(" · "));

const barStyle = computed<CSSProperties>(() => ({
  width: `${inView.value === false || visibility.hidden || !progressKnown.value ? 0 : pct.value}%`,
  transition: inView.value === false ? "none" : PROGRESS_GROW_TRANSITION,
}));

function goRank() { navTo("/pages/team/rank"); }
</script>

<style scoped>
/* DESIGN G2: solid content card (01 §1.1.2), badge | copy | chevron laid out across the width (04.0). */
.nx-network-card { display: flex; align-items: center; gap: 14px; min-width: 0; box-sizing: border-box; padding: var(--ui-space-inset); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); color: var(--v5-ink); cursor: pointer; }
:global([data-theme="light"]) .nx-network-card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.nx-network-card:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.nx-network-card__copy { flex: 1; min-width: 0; }
.nx-network-card__line { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.nx-network-card--top .nx-network-card__line { flex: 1; min-width: 0; }
.nx-network-card__nowrap { white-space: nowrap; }
.nx-network-card__dot { color: var(--v5-ink-4); }
.nx-network-card__more { font-weight: 400; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); white-space: nowrap; }
.nx-network-card__perk { display: block; margin-top: 4px; font: 400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.nx-network-card__clause { display: inline-block; max-width: 100%; margin-right: .25em; }
.nx-network-card__prog { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.nx-network-card__prog .nx-progress { flex: 1; }
.nx-network-card__pct { flex: none; font: 500 12px/16px var(--font-metric); color: var(--v5-ink-2); font-variant-numeric: tabular-nums; }
.nx-network-card__chev { display: grid; flex: none; font-size: 16px; color: var(--v5-ink-4); }
</style>
