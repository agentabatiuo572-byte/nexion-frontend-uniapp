<!--
  Home (mission-control) — ZONE 1 in progress. Ported from
  Nexion-prototype/app/components/home/mission-control.tsx (3157 lines, 25
  sections). Built up zone by zone; sections live in src/components/home/*.vue
  and are assembled here inside the chassis + CardStagger entrance.

  ZONE 1 (hook): Greeting → TechMoney → Trial entries → [Conversion → DayOne → LiveFeed]
  ZONE 2-7: pending (status / AI bridge / rank / money / market / trust).
-->
<template>
  <AppChassis active="home">
    <CardStagger class="px-4 pt-3 pb-4 space-y-3" style="color: var(--v5-ink)">
      <!-- ZONE 1: hook — earned anchor + conversion stack + social proof -->
      <GreetingHeader />
      <TechMoneyCard />
      <TrialHeroBanner />
      <TrialGhostSlot />
      <ConversionBanner />
      <DayOneQuestCard />
      <LiveFeedCard />

      <!-- ZONE 2: status — your fleet, the grid, network pulse -->
      <QuickActionRow />
      <MyFleetSection />
      <OnGridSection />
      <NetworkPulseCard />

      <!-- ZONE 3: AI advisor bridge -->
      <StellaCardSlot />

      <!-- ZONE 4: rank & team -->
      <VRankCard />
      <LeadershipPoolCard />

      <!-- ZONE 5: money & ROI -->
      <DoTheMathCard />
      <EarningsLedgerCard />

      <!-- ZONE 6: market -->
      <NexPriceCard />
      <MarketBoardCard />

      <!-- ZONE 7: trust close -->
      <TrustChipWall />
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import GreetingHeader from "@/components/home/greeting-header.vue";
import TechMoneyCard from "@/components/home/tech-money-card.vue";
import TrialHeroBanner from "@/components/trial-hero-banner.vue";
import TrialGhostSlot from "@/components/trial-ghost-slot.vue";
import ConversionBanner from "@/components/home/conversion-banner.vue";
import DayOneQuestCard from "@/components/home/day-one-quest-card.vue";
import LiveFeedCard from "@/components/home/live-feed-card.vue";
import QuickActionRow from "@/components/home/quick-action-row.vue";
import MyFleetSection from "@/components/home/my-fleet-section.vue";
import OnGridSection from "@/components/home/on-grid-section.vue";
import NetworkPulseCard from "@/components/home/network-pulse-card.vue";
import StellaCardSlot from "@/components/home/stella-card-slot.vue";
import VRankCard from "@/components/home/vrank-card.vue";
import LeadershipPoolCard from "@/components/home/leadership-pool-card.vue";
import DoTheMathCard from "@/components/home/do-the-math-card.vue";
import EarningsLedgerCard from "@/components/home/earnings-ledger-card.vue";
import NexPriceCard from "@/components/home/nex-price-card.vue";
import MarketBoardCard from "@/components/home/market-board-card.vue";
import TrustChipWall from "@/components/home/trust-chip-wall.vue";
import { useLocaleStore } from "@/store/locale";

const locale = useLocaleStore();

onLoad(() => {
  locale.ensureSystemDetected();
});
</script>
