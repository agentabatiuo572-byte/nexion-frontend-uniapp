<!--
  Genealogy — ported from Nexion-prototype/app/(main)/team/tree/page.tsx.
  Sprint-1.5 royalty roster: two metric cards (total network / monthly volume)
  + Direct section + Extended section (each a collapsible TeamRosterSection).
  No 7-layer sections / binary wing / L1-L7 labels (de-MLM'd). Sub-page →
  <AppChassis active="team"> w/ back → /team. Reuses network + commission
  (UNILEVEL_USDT) stores. useMemo → computed. React Set/Record toggle state →
  reactive(Record) per P-027. <div>→<view>, text leaves→<text>.
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.tree.pageTitle" />

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px; padding-top: 4px">
        <!-- Top metrics -->
        <view class="grid grid-cols-2" style="gap: 8px">
          <view class="rounded-2xl border" :style="metricCardStyle">
            <text class="block" :style="metricLabelStyle">{{ t.tree.totalNetwork }}</text>
            <text class="block font-display tabular-nums" :style="metricValueStyle('var(--v5-ink)')">{{ members.length }}</text>
            <text class="block" :style="metricSuffixStyle">{{ members.length === 1 ? t.tree.member : t.tree.membersPlural }}</text>
          </view>
          <view class="rounded-2xl border" :style="metricCardStyle">
            <text class="block" :style="metricLabelStyle">{{ t.tree.monthlyVolume }}</text>
            <text class="block font-display tabular-nums" :style="metricValueStyle('var(--v5-brand)')">${{ (totalVol / 1000).toFixed(1) }}K</text>
            <text class="block" :style="metricSuffixStyle">{{ t.tree.acrossNetwork }}</text>
          </view>
        </view>

        <!-- Direct section -->
        <TeamRosterSection
          color="var(--v5-brand)"
          :title="t.tree.directTitle"
          :subtitle="directSubtitle"
          accent-bg="rgba(198,255,58,0.12)"
          accent-text="var(--v5-brand)"
          :badge="t.tree.badgeDirect"
          :members="direct"
          :is-open="expanded.direct"
          :empty-label="t.tree.emptyDirect"
          kind="direct"
          @toggle="expanded.direct = !expanded.direct"
        />

        <!-- Extended section -->
        <TeamRosterSection
          color="var(--v5-tech-cyan)"
          :title="t.tree.extendedTitle"
          :subtitle="extendedSubtitle"
          accent-bg="rgba(124,92,255,0.14)"
          accent-text="var(--v5-tech-cyan)"
          :badge="t.tree.badgeExtended"
          :members="extended"
          :is-open="expanded.extended"
          :empty-label="t.tree.emptyExtended"
          kind="extended"
          @toggle="expanded.extended = !expanded.extended"
        />
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, reactive, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import TeamRosterSection from "@/components/team/team-roster-section.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNetwork, type NetworkMember } from "@/store/network";
import { UNILEVEL_USDT } from "@/store/commission";

const t = useT();
const network = useNetwork();

const members = computed(() => network.members);
const direct = computed(() => members.value.filter((m) => m.layer === 1));
const extended = computed(() => members.value.filter((m) => m.layer !== 1));

const totalVol = computed(() => members.value.reduce((s, m) => s + m.monthVolumeUSD, 0));
const directVol = computed(() => direct.value.reduce((s, m) => s + m.monthVolumeUSD, 0));
const extendedRoyalty = computed(() =>
  extended.value.reduce((sum, m: NetworkMember) => sum + m.monthVolumeUSD * (UNILEVEL_USDT[m.layer] ?? 0), 0),
);
const directRoyalty = computed(() => directVol.value * UNILEVEL_USDT[1]);

const directSubtitle = computed(() =>
  fmt(t.value.tree.directSubtitle, { n: direct.value.length, amount: directRoyalty.value.toFixed(2) }),
);
const extendedSubtitle = computed(() =>
  fmt(t.value.tree.extendedSubtitle, { n: extended.value.length, amount: extendedRoyalty.value.toFixed(2) }),
);

// expand toggle: reactive(Record) per P-027 (Vue Set/ref-toggle pitfall)
const expanded = reactive<Record<"direct" | "extended", boolean>>({ direct: true, extended: true });

// ─── styles ───
const metricCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)", borderRadius: "16px", padding: "14px" };
const metricLabelStyle: CSSProperties = { fontSize: "10px", color: "var(--v5-ink-3)" };
function metricValueStyle(color: string): CSSProperties {
  return { fontSize: "20px", fontWeight: 600, marginTop: "4px", lineHeight: 1, color };
}
const metricSuffixStyle: CSSProperties = { marginTop: "4px", fontSize: "10.5px", color: "var(--v5-ink-3)" };
</script>
