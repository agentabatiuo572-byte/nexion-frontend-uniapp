<!--
  Learn / Academy — ported from Nexion-prototype/app/(main)/learn/page.tsx.

  Featured hero → "Your Learning" stats → category tabs (All + 5 cats) →
  lesson cards list → footer note. Decomposed into src/components/learn/*
  (FeaturedHero / StatsCard / LessonCard) since each carries its own
  scroll-grow bar instance + the page is dense.

  Wrapped in <AppChassis active="me"> (reached from /me). SetPageHeader
  backHref="/me" → SubPageHeader back="/pages/me/me". No learn/[slug] route
  exists in the source, so lesson hrefs are undefined → taps are no-ops.
  CATEGORIES[].label kept as source data (not i18n) to match the prototype.
-->
<template>
  <AppChassis active="me">
    <CardStagger class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" />

      <view class="px-4 space-y-3">
        <!-- Featured hero -->
        <LearnFeaturedHero v-if="featured" :lesson="featured" />

        <!-- Your Learning stats -->
        <LearnStatsCard :done="stats.done" :total="stats.total" :earned="stats.earned" />

        <!-- Category tabs -->
        <scroll-view scroll-x class="nx-learn-tabs">
          <view class="flex" style="gap: 6px; padding-bottom: 4px">
            <view
              class="shrink-0 inline-flex items-center active:opacity-70"
              :style="tabStyle('all')"
              @click="tab = 'all'"
            >
              <text style="margin-right: 6px">📚</text>
              <text :style="tabLabelStyle('all')">{{ t.learn.tabAll }}</text>
            </view>
            <view
              v-for="c in CATEGORIES"
              :key="c.id"
              class="shrink-0 inline-flex items-center active:opacity-70"
              :style="tabStyle(c.id)"
              @click="tab = c.id"
            >
              <text style="margin-right: 6px">{{ c.emoji }}</text>
              <text :style="tabLabelStyle(c.id)">{{ c.label }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- Lesson list -->
        <view v-if="filtered.length === 0" class="rounded-2xl border text-center" :style="emptyStyle">
          <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.learn.emptyCategory }}</text>
        </view>
        <view v-else class="space-y-2.5">
          <LearnLessonCard v-for="l in filtered" :key="l.id" :lesson="l" />
        </view>

        <!-- footer note -->
        <text class="block text-center" style="font-size: 10.5px; color: var(--v5-ink-3); line-height: 1.6; padding-top: 4px">{{ t.learn.note }}</text>
      </view>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CardStagger from "@/components/card-stagger.vue";
import LearnFeaturedHero from "@/components/learn/learn-featured-hero.vue";
import LearnStatsCard from "@/components/learn/learn-stats-card.vue";
import LearnLessonCard from "@/components/learn/learn-lesson-card.vue";
import { useT } from "@/i18n/use-t";
import { LESSONS, CATEGORIES, type LearnCategory } from "@/mock/learn";

type TabId = "all" | LearnCategory;

const t = useT();
const tab = ref<TabId>("all");

const featured = computed(() => LESSONS.find((l) => l.featured));

const filtered = computed(() => {
  const base = LESSONS.filter((l) => l !== featured.value);
  if (tab.value === "all") return base;
  return base.filter((l) => l.category === tab.value);
});

const stats = computed(() => {
  const done = LESSONS.filter((l) => l.progress >= 100);
  const earned = done.reduce((s, l) => s + l.rewardNEX, 0);
  return { done: done.length, total: LESSONS.length, earned };
});

function tabStyle(id: TabId): CSSProperties {
  const active = tab.value === id;
  return {
    height: "44px",
    padding: "0 16px",
    borderRadius: "999px",
    background: active ? "var(--v5-brand)" : "var(--v5-surface)",
    border: active ? "none" : "1px solid var(--v5-border)",
  };
}
function tabLabelStyle(id: TabId): CSSProperties {
  const active = tab.value === id;
  return {
    fontSize: "12px",
    fontWeight: 600,
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}

const emptyStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "32px",
};
</script>

<style scoped>
.nx-learn-tabs {
  white-space: nowrap;
  width: 100%;
}
</style>
