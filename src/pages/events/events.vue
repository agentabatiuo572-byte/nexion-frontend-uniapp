<!--
  Events Center — ported from Nexion-prototype/app/(main)/events/page.tsx.

  Featured hero → segmented tabs (All / Ongoing / Upcoming / Joined / Ended) →
  event cards list → footer note. Trackable events opt into join→claim flow
  (event-quest store, P-027 reactive Record); claim credits NEX via app store
  + writes a bill. Decomposed into src/components/events/* (FeaturedHero /
  Card) — each carries its own scroll-grow bar.

  Wrapped in <AppChassis active="home"> (reached from Home). SetPageHeader
  backHref="/" → SubPageHeader back="/pages/index/index". SegmentedControl →
  inline pill tabs. The source's live evaluateEventProgress() is replaced by
  the mock's `trackable`/`done` flags (self-contained, backend-replaceable).
  The SSR `mounted` gate is dropped (no hydration in uni). The lucky-wheel
  event's "Spin now" CTA opens the Lucky Spin sheet via useLuckySpin().openSheet()
  (emitted up from EventsCard as `cta`, kind === "wheel").
  Achievements unlock on claim is omitted (no achievements store ported).
-->
<template>
  <AppChassis active="home">
    <CardStagger class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/index/index" />

      <view class="px-4 space-y-3">
        <!-- Featured hero -->
        <EventsFeaturedHero
          v-if="featured"
          :ev="featured"
          :reward-nex="rewardNexOf(featured)"
          @join="handleJoin(featured)"
          @claim="handleClaim(featured)"
          @cta="handleCta(featured)"
        />

        <!-- Tabs -->
        <view class="flex" :style="segWrapStyle">
          <view v-for="id in TABS" :key="id" class="flex-1 grid place-items-center active:opacity-70" :style="pillStyle(id)" @click="tab = id">
            <text :style="pillLabelStyle(id)">{{ t.events.tabs[id] }}</text>
          </view>
        </view>

        <!-- Event list -->
        <view v-if="filtered.length === 0 && emptyKey" class="rounded-2xl border text-center" :style="emptyStyle">
          <text style="font-size: 12.5px; color: var(--v5-ink-3); line-height: 1.6">{{ t.events.empty[emptyKey] }}</text>
        </view>
        <view v-else class="space-y-2.5">
          <EventsCard
            v-for="ev in filtered"
            :key="ev.id"
            :ev="ev"
            :reward-nex="rewardNexOf(ev)"
            @join="handleJoin(ev)"
            @claim="handleClaim(ev)"
            @cta="handleCta(ev)"
          />
        </view>

        <!-- footer -->
        <text class="block text-center" style="font-size: 10.5px; color: var(--v5-ink-3); line-height: 1.6; padding-top: 4px">{{ t.events.note }}</text>
      </view>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CardStagger from "@/components/card-stagger.vue";
import EventsFeaturedHero from "@/components/events/events-featured-hero.vue";
import EventsCard from "@/components/events/events-card.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useEventQuest } from "@/store/event-quest";
import { useLuckySpin } from "@/store/lucky-spin";
import { toast } from "@/store/ui";
import { EVENTS, type EventStatus, type NexEvent } from "@/mock/events";

type TabId = "all" | EventStatus | "joined";
type EnrichedEvent = NexEvent & { _trackable: boolean; _done: boolean; _claimed: boolean };

const TABS: TabId[] = ["all", "ongoing", "upcoming", "joined", "ended"];

const t = useT();
const app = useApp();
const bills = useBills();
const eventQuest = useEventQuest();
const luckySpin = useLuckySpin();

const tab = ref<TabId>("ongoing");

// Enrich each event with live join/claim state from the store.
const enrichedEvents = computed<EnrichedEvent[]>(() =>
  EVENTS.map((ev) => {
    const trackable = ev.trackable === true;
    const joinedFromStore = eventQuest.isJoined(ev.id);
    const claimedFromStore = eventQuest.isClaimed(ev.id);
    return {
      ...ev,
      // Fallback to mock hardcoded joined for decorative events
      joined: trackable ? joinedFromStore : ev.joined,
      _trackable: trackable,
      _done: ev.done ?? false,
      _claimed: claimedFromStore,
    };
  }),
);

const featured = computed(() =>
  enrichedEvents.value.find((e) => e.featured && e.status === "ongoing"),
);

const filtered = computed<EnrichedEvent[]>(() => {
  const all = enrichedEvents.value;
  const feat = featured.value;
  switch (tab.value) {
    case "all":
      return all.filter((e) => e !== feat);
    case "ongoing":
      return all.filter((e) => e.status === "ongoing" && e !== feat);
    case "upcoming":
      return all.filter((e) => e.status === "upcoming");
    case "joined":
      return all.filter((e) => e.joined && e !== feat);
    case "ended":
      return all.filter((e) => e.status === "ended");
    default:
      return [];
  }
});

const emptyKey = computed<keyof typeof t.value.events.empty | null>(() => {
  if (tab.value === "ongoing" || tab.value === "upcoming" || tab.value === "joined" || tab.value === "ended") {
    return tab.value;
  }
  return null;
});

function rewardNexOf(ev: EnrichedEvent): number {
  return ev.rewardNEX ?? 0;
}

function handleJoin(ev: EnrichedEvent) {
  if (!ev._trackable) return;
  if (eventQuest.join(ev.id)) {
    toast.success(t.value.events.toast.joinedTitle.replace("{name}", ev.title), t.value.events.toast.joinedBody);
  }
}

function handleClaim(ev: EnrichedEvent) {
  if (!ev._trackable || !ev._done || ev._claimed) return;
  const reward = rewardNexOf(ev);
  if (eventQuest.claim(ev.id)) {
    if (reward > 0) {
      app.creditNex(reward);
      // Real backend: claim follows PRD §9.11e atomic pattern (credit + bill).
      bills.add({
        type: "achievement",
        symbol: "NEX",
        amount: reward,
        status: "posted",
        memo: `Event reward · ${ev.id}`,
        ref: `EVENT-${ev.id}-${Date.now().toString(36).toUpperCase()}`,
      });
    }
    toast.success(t.value.events.toast.claimedTitle.replace("{n}", reward.toLocaleString()), ev.title);
  }
}

// Decorative (non-trackable) CTA. The lucky-wheel event opens the Lucky Spin
// sheet instead of the join/claim path; other decorative CTAs navigate via the
// card's own href.
function handleCta(ev: EnrichedEvent) {
  if (ev.kind === "discount") {
    eventQuest.join(ev.id);
    if (eventQuest.claim(ev.id)) {
      toast.success(t.value.events.toast.discountClaimedTitle, ev.title);
    }
    return;
  }
  if (ev.kind === "wheel") {
    luckySpin.openSheet();
  }
}

// ── styles ──
const segWrapStyle: CSSProperties = {
  background: "var(--v5-surface-2)",
  borderRadius: "12px",
  padding: "3px",
  gap: "2px",
};
function pillStyle(id: TabId): CSSProperties {
  const on = tab.value === id;
  return {
    height: "34px",
    borderRadius: "9px",
    background: on ? "var(--v5-surface)" : "transparent",
    boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  };
}
function pillLabelStyle(id: TabId): CSSProperties {
  const on = tab.value === id;
  return {
    fontSize: "11.5px",
    fontWeight: on ? 600 : 500,
    color: on ? "var(--v5-ink)" : "var(--v5-ink-3)",
  };
}
const emptyStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "32px",
};
</script>
